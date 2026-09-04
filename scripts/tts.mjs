/**
 * 生成中文配音，并把每句字幕的精确起止时间写进 src/timings.generated.ts
 *
 * 用法（项目根目录）：
 *   npm run tts
 *   TTS_VOICE="Tingting" npm run tts        # 换声音
 *   TTS_RATE=230 npm run tts                # 调语速（默认 210，越大越快）
 *   TTS_PROVIDER=elevenlabs npm run tts     # 用云端声音（需要 .env 里的 key）
 *
 * 为什么“分句生成”而不是整段生成：
 *   卡拉 OK 逐字高亮的价值就是字跟着声音走。整段生成只能拿到总时长，
 *   句内时间只能按字数估算，必然对不上；分句生成能拿到每句的真实时长，
 *   句间再补一段静音当作自然停顿，节奏反而比整段更可控。
 *
 * 产物：
 *   public/audio/<segment>.m4a   每段配音
 *   src/timings.generated.ts     段落帧数 + 每句字幕的 start/end（帧）
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { FALLBACK_FRAMES, FPS, SEGMENT_KEYS, SCRIPT } from "../src/script.ts";

// ---- 配置 ----
const PROVIDER = process.env.TTS_PROVIDER ?? "say";

// 坑：say 的同名声音有中英文两个变体，`-v "Reed"` 选到的是英文版，
// 读中文时几乎不出声（13 个字只有 0.016s）。必须带 locale 的完整名。
const VOICE = process.env.TTS_VOICE ?? "Reed (中文（中国大陆）)";
const RATE = Number(process.env.TTS_RATE ?? 210);

const LEAD_IN = 0.35; // 段首留白：让开场动画先跑，声音后进
const GAP = 0.22; // 句间停顿
const TAIL = 0.45; // 段尾留白：最后一句说完多留一拍再切

// 兜底估算用的中文语速（字/秒），只在没有 provider 可用时用来生成时间轴
const FALLBACK_CPS = 5.0;

const ROOT = resolve(import.meta.dirname, "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const WORK_DIR = join(tmpdir(), `remotion-tts-${process.pid}`);

// ---- 小工具 ----
const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const secondsToFrames = (sec) => Math.max(1, Math.round(sec * FPS));

const durationOf = (wav) =>
  parseFloat(
    run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      wav,
    ]).trim(),
  );

const toWav = (input, wav) => {
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-ar", "44100", "-ac", "1", wav]);
  return durationOf(wav);
};

const silence = (sec, wav) => {
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=mono:sample_rate=44100",
    "-t", String(sec),
    wav,
  ]);
};

const concatWavs = (files, out) => {
  const listFile = join(WORK_DIR, "concat.txt");
  writeFileSync(listFile, files.map((f) => `file '${f}'`).join("\n"));
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    out,
  ]);
};

const toM4a = (wav, m4a) => {
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", wav,
    "-c:a", "aac", "-b:a", "128k",
    m4a,
  ]);
};

// ---- 两个 provider ----
const synthOne = {
  // macOS 本地：零依赖零成本，随时可用
  say: (text, index, segment) => {
    const aiff = join(WORK_DIR, `${segment}-${index}.aiff`);
    const wav = join(WORK_DIR, `${segment}-${index}.wav`);
    run("say", ["-v", VOICE, "-r", String(RATE), "-o", aiff, text]);
    return toWav(aiff, wav);
  },

  // 云端：音色更像“AI 男声”，需要 .env 里的 ELEVENLABS_API_KEY
  elevenlabs: async (text, index, segment) => {
    const { apiKey, voiceId } = loadEnv();
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY 未配置（见 .env.example）");

    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.4, similarity_boost: 0.8 },
          }),
        },
      );
      if (res.ok) {
        const mp3 = join(WORK_DIR, `${segment}-${index}.mp3`);
        const wav = join(WORK_DIR, `${segment}-${index}.wav`);
        writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
        return toWav(mp3, wav);
      }
      lastErr = `${res.status}: ${(await res.text()).slice(0, 120)}`;
      // 429 限流 / 5xx 抖动：退避重试，避免单句失败导致整段回退到机器人音
      await new Promise((r) => setTimeout(r, Math.min(2000, 400 * (attempt + 1))));
    }
    throw new Error(`ElevenLabs 重试失败 ${lastErr}`);
  },
};

const loadEnv = () => {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return { apiKey: "", voiceId: "" };
  const parsed = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) parsed[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return {
    apiKey: parsed.ELEVENLABS_API_KEY ?? "",
    voiceId: parsed.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB", // Adam，男声
  };
};

// ---- 主流程 ----
const synthSegment = async (segment) => {
  const lines = SCRIPT[segment].captions;
  const parts = [];
  const timings = [];
  let cursor = LEAD_IN;

  const leadWav = join(WORK_DIR, `${segment}-lead.wav`);
  silence(LEAD_IN, leadWav);
  parts.push(leadWav);

  for (let i = 0; i < lines.length; i++) {
    const wav = join(WORK_DIR, `${segment}-${i}.wav`);
    const dur = await synthOne[PROVIDER](lines[i], i, segment);
    // 免费档有并发/频率限制，句间留一拍，避免触发 429
    if (PROVIDER === "elevenlabs" && i < lines.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
    parts.push(wav);
    timings.push({
      start: secondsToFrames(cursor),
      end: secondsToFrames(cursor + dur),
    });
    cursor += dur;

    // 句间 / 段尾留白
    const gapSec = i === lines.length - 1 ? TAIL : GAP;
    const gapWav = join(WORK_DIR, `${segment}-gap-${i}.wav`);
    silence(gapSec, gapWav);
    parts.push(gapWav);
    cursor += gapSec;
  }

  const segWav = join(WORK_DIR, `${segment}.wav`);
  concatWavs(parts, segWav);
  toM4a(segWav, join(AUDIO_DIR, `${segment}.m4a`));

  return { timings, totalFrames: secondsToFrames(cursor) };
};

const main = async () => {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR, { recursive: true });

  const segmentFrames = {};
  const captionTimings = {};

  for (const segment of SEGMENT_KEYS) {
    const lines = SCRIPT[segment].captions;
    try {
      const { timings, totalFrames } = await synthSegment(segment);
      segmentFrames[segment] = totalFrames;
      captionTimings[segment] = timings;
      const sec = (totalFrames / FPS).toFixed(2);
      console.log(
        `  ✓ ${segment.padEnd(11)} ${lines.length} 句 → ${sec}s (${totalFrames} 帧)`,
      );
    } catch (err) {
      // provider 不可用时不能让整个项目崩掉：用估算时长生成时间轴，
      // 并把 AUDIO_AVAILABLE 置为 false，组件侧就不会去加载不存在的音频
      console.warn(`  ! ${segment.padEnd(11)} 生成失败：${err.message}`);
      console.warn(`    改用估算时长（${FALLBACK_CPS} 字/秒），不挂音频`);
      segmentFrames[segment] = FALLBACK_FRAMES[segment];
      captionTimings[segment] = estimateTimings(lines);
      globalThis.__ttsDegraded = true;
    }
  }

  writeTimings(segmentFrames, captionTimings);

  const total = Object.values(segmentFrames).reduce((a, b) => a + b, 0);
  console.log(
    `\n总时长 ${(total / FPS).toFixed(2)}s（${total} 帧）→ src/timings.generated.ts`,
  );
  rmSync(WORK_DIR, { recursive: true, force: true });
};

// 估算：按字数推时长，句间补停顿。只在 provider 不可用时兜底。
const estimateTimings = (lines) => {
  const timings = [];
  let cursor = LEAD_IN;
  lines.forEach((text, i) => {
    const dur = Array.from(text).length / FALLBACK_CPS;
    timings.push({
      start: secondsToFrames(cursor),
      end: secondsToFrames(cursor + dur),
    });
    cursor += dur + (i === lines.length - 1 ? TAIL : GAP);
  });
  return timings;
};

const writeTimings = (segmentFrames, captionTimings) => {
  const available = !globalThis.__ttsDegraded;
  const fmt = (o) =>
    Object.entries(o)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`)
      .join("\n");

  const content = `// 由 scripts/tts.mjs 自动生成 —— 不要手改
// 想调整请改 src/script.ts 的文案或 scripts/tts.mjs 的配置，再跑 \`npm run tts\`
//
// 此文件入库是故意的：仓库默认带一份「无音频」的估算时间轴，
// clone 下来即可渲染；跑过 tts 之后会被真实音频时长覆盖。

// 音频文件是否真的生成了。false 时组件不加载 audio，只按时间轴走字幕
export const AUDIO_AVAILABLE = ${available};

// 各段落总帧数（由音频真实长度决定）
export const SEGMENT_FRAMES = {
${fmt(segmentFrames)}
} as const;

// 每句字幕的起止帧。句与句之间故意留空档 = 说话的自然停顿，
// 这段时间字幕消失，跟真实口播节奏一致
export const CAPTION_TIMINGS = {
${Object.entries(captionTimings)
  .map(
    ([k, v]) =>
      `  ${k}: [\n` +
      v
        .map((t) => `    { start: ${t.start}, end: ${t.end} },`)
        .join("\n") +
      `\n  ],`,
  )
  .join("\n")}
} as const;
`;

  const out = join(ROOT, "src", "timings.generated.ts");
  writeFileSync(out, content);
  console.log(`  已写入 ${out.replace(ROOT + "/", "")}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
