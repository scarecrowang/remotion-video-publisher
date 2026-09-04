/**
 * case-tts.mjs —— 给案例片生成配音 + 字幕时间轴。
 *
 * 用法（项目根目录）：
 *   node scripts/case-tts.mjs energy-case-01
 *     => 读取 content/energy-case-01.md (经 case.generated 归一)
 *     => 读 CASE_SHOTS 每镜 caption，走所选 TTS provider 分句合成
 *     => 写 public/case-audio/<slug>_<index>.m4a
 *     => 重写 src/caseTimings.generated.ts（每镜总帧 + 每句字幕起止）
 *
 * 配音服务（TTS_PROVIDER）——全部在 .env 里配置：
 *   - volcano    火山引擎·豆包语音合成大模型(Seed TTS)，推荐（真人感强、中文母语）
 *   - elevenlabs ElevenLabs，原默认
 *   - say        macOS 本地免费配音（草稿/预览用）
 *
 * 与 src/scripts/tts.mjs 的差异：
 *   - 数据源是 case.generated.ts（不是 SCRIPT）
 *   - 字幕一镜一句（速览卡节奏），不再走「四段每段 2-3 句」
 *   - 输出文件路径是 case-audio/<slug>_<index>.m4a
 *
 * 设计原则：provider 核心 fetch + 重试 + ffprobe 测时长。
 * 这里不抽象共享模块——案例/旧版脚本调用形态不同（caption 是字符串数组还是分镜稿），
 * 共享反而引入额外胶水代码。当前直接复用本逻辑即可。
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  CASE_META,
  CASE_SLUG,
  CASE_SHOTS,
} from "../src/case.generated.ts";

// ---- 配置 ----
const ROOT = resolve(import.meta.dirname, "..");
const AUDIO_DIR = join(ROOT, "public", "case-audio");
const WORK_DIR = join(tmpdir(), `case-tts-${process.pid}`);

// 读 .env 为 { KEY: value }。无文件返回 {}。供 provider 选择与各服务配置共用。
const readDotEnv = () => {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return {};
  const parsed = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) parsed[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return parsed;
};

// 配音服务：命令行 TTS_PROVIDER > .env 里的 TTS_PROVIDER > 默认 volcano
const ENV = readDotEnv();
const PROVIDER = (
  process.env.TTS_PROVIDER ?? ENV.TTS_PROVIDER ?? "volcano"
).toLowerCase();

const FPS = 30;
const LEAD_IN = 0.35; // 段首留白
const GAP = 0.22; // 句间停顿（速览卡通常一镜一句，影响小，但保留）
const TAIL = 0.5; // 段尾留白：留一拍呼吸再切

const FALLBACK_CPS = 5.0; // 估算兜底

// ---- 小工具 ----
const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const secondsToFrames = (sec) => Math.max(1, Math.round(sec * FPS));

const durationOf = (file) =>
  parseFloat(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]).trim(),
  );

const toWav = (input, wav) => {
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    input,
    "-ar",
    "44100",
    "-ac",
    "1",
    wav,
  ]);
  return durationOf(wav);
};

const silence = (sec, wav) => {
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=44100",
    "-t",
    String(sec),
    wav,
  ]);
};

const concatWavs = (files, out) => {
  const listFile = join(WORK_DIR, "concat.txt");
  writeFileSync(listFile, files.map((f) => `file '${f}'`).join("\n"));
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c",
    "copy",
    out,
  ]);
};

const toM4a = (wav, m4a) => {
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    wav,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    m4a,
  ]);
};

// ---- 各配音服务 provider ----
// 配置全部来自 .env（+ 可选进程环境变量覆盖）。见 .env.example 与项目根 README-ZH.md 末尾。

// ---------- 火山引擎 · 豆包语音合成大模型 (Seed TTS) ----------
// 新版控制台鉴权：X-Api-Key（单头）。旧版控制台鉴权：X-Api-App-Id + X-Api-Access-Key。
// 脚本会自动判断：填了 VOLCANO_API_KEY 走新版单头；只填了 APP_ID/ACCESS_KEY 走旧版双头。
// 模型版本由 VOLCANO_RESOURCE_ID 决定（seed-tts-2.0 用 2.0 音色 / seed-tts-1.0 用 1.0 音色）。
const synthOneVolcano = async (text, index, segment) => {
  const apiKey =
    process.env.VOLCANO_API_KEY ?? ENV.VOLCANO_API_KEY ?? "";
  const appId = process.env.VOLCANO_APP_ID ?? ENV.VOLCANO_APP_ID ?? "";
  const accessKey =
    process.env.VOLCANO_ACCESS_KEY ?? ENV.VOLCANO_ACCESS_KEY ?? "";
  if (!apiKey && !(appId && accessKey)) {
    throw new Error(
      "火山配音未配置：请在 .env 填 VOLCANO_API_KEY（新版）或 VOLCANO_APP_ID+VOLCANO_ACCESS_KEY（旧版），并填 VOLCANO_SPEAKER 音色",
    );
  }

  const resourceId =
    process.env.VOLCANO_RESOURCE_ID ?? ENV.VOLCANO_RESOURCE_ID ?? "seed-tts-2.0";
  const speaker =
    process.env.VOLCANO_SPEAKER ??
    ENV.VOLCANO_SPEAKER ??
    CASE_META.voice ??
    "";
  if (!speaker) {
    throw new Error(
      "未指定火山音色：请在 .env 填 VOLCANO_SPEAKER（控制台发音人列表里的 speaker id，如 zh_female_xxx_bigtts）",
    );
  }
  const sampleRate = Number(
    process.env.VOLCANO_SAMPLE_RATE ?? ENV.VOLCANO_SAMPLE_RATE ?? 24000,
  );

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    // 新版控制台：单头鉴权
    headers["X-Api-Key"] = apiKey;
  } else {
    // 旧版控制台：双头鉴权
    headers["X-Api-App-Id"] = appId;
    headers["X-Api-Access-Key"] = accessKey;
  }
  headers["X-Api-Resource-Id"] = resourceId;
  headers["X-Api-Request-Id"] = `${process.pid}-${randomUUID().slice(0, 12)}`;

  const body = {
    user: { uid: `case-${process.pid}` },
    req_params: {
      text,
      speaker,
      // V2 接口不需要 additions / disable_markdown_filter（那是 1.0 老接口的字段）。
      audio_params: { format: "mp3", sample_rate: sampleRate },
    },
  };

  let lastErr = "";
  const url =
    "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const raw = Buffer.from(await res.arrayBuffer());
      const text = raw.toString("utf8");
      if (!res.ok) {
        // 失败时 body 是 JSON 错误信息，尝试读 message 提高可读性
        let msg = text.slice(0, 200);
        try {
          const j = JSON.parse(msg);
          msg = j.message || JSON.stringify(j);
        } catch {
          /* 保持原文 */
        }
        lastErr = `${res.status}: ${msg}`;
        continue;
      }

      // 火山 TTS V2 返回「流式逐行 JSON」：每行是一个 chunk
      //   {"reqid":"...","code":0,"message":"","done":false,"data":"<base64 音频段>"}
      //   音频被切成多段，须把所有行的 data base64 解码后按序拼接；
      //   末行 done=true 或 code=20000000 表示流结束。
      // 只解析第一个 chunk 会导致音频极短/近乎无声，务必整流拼接。
      const parts = [];
      let streamDone = false;
      let sawChunk = false;
      for (const line of raw.toString("utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let j;
        try {
          j = JSON.parse(trimmed);
        } catch {
          // 某行非法则跳过（正常流不会出现）
          continue;
        }
        if (typeof j.code === "number" && j.code !== 0 && j.code !== 20000000) {
          lastErr = `${j.code}: ${j.message ?? "流错误"}`;
          streamDone = true;
          break;
        }
        if (j.data && typeof j.data === "string" && j.data.length > 0) {
          parts.push(Buffer.from(j.data, "base64"));
          sawChunk = true;
        }
        if (j.done === true || j.code === 20000000) {
          streamDone = true;
          break;
        }
      }
      if (lastErr) continue;
      if (!sawChunk || parts.length === 0) {
        lastErr = "流内无音频数据（服务端可能未真正合成）";
        continue;
      }
      const audio = parts.length === 1 ? parts[0] : Buffer.concat(parts);
      const mp3 = join(WORK_DIR, `${segment}-${index}.mp3`);
      const wav = join(WORK_DIR, `${segment}-${index}.wav`);
      writeFileSync(mp3, audio);
      return toWav(mp3, wav);
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, Math.min(2000, 500 * (attempt + 1))));
  }
  throw new Error(`火山配音重试失败 ${lastErr}`);
};

// ---------- ElevenLabs（原有，保留可选）----------
const synthOneEleven = async (text, index, segment) => {
  const apiKey =
    process.env.ELEVENLABS_API_KEY ?? ENV.ELEVENLABS_API_KEY ?? "";
  const voiceId =
    process.env.ELEVENLABS_VOICE_ID ?? ENV.ELEVENLABS_VOICE_ID ?? "";
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY 未配置（见 .env.example）");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID 未配置（见 .env.example）");
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
    await new Promise((r) => setTimeout(r, Math.min(2000, 400 * (attempt + 1))));
  }
  throw new Error(`ElevenLabs 重试失败 ${lastErr}`);
};

// ---------- macOS 本地 fallback（零成本预览用）----------
const synthOneSay = (text, index, segment) => {
  const voice = process.env.TTS_VOICE ?? "Tingting";
  const rate = Number(process.env.TTS_RATE ?? 210);
  const aiff = join(WORK_DIR, `${segment}-${index}.aiff`);
  const wav = join(WORK_DIR, `${segment}-${index}.wav`);
  run("say", ["-v", voice, "-r", String(rate), "-o", aiff, text]);
  return toWav(aiff, wav);
};

const PROVIDER_IMPL = {
  volcano: synthOneVolcano,
  elevenlabs: synthOneEleven,
  say: synthOneSay,
};
const synthOne =
  PROVIDER_IMPL[PROVIDER] ??
  (() => {
    throw new Error(
      `未知 TTS_PROVIDER: ${PROVIDER}（可选 volcano / elevenlabs / say）`,
    );
  });

// ---- 主流程 ----
const synthShot = async (shotIndex) => {
  const shot = CASE_SHOTS[shotIndex];
  const cap = shot.fields.caption;
  const lines = cap
    ? Array.isArray(cap)
      ? cap
      : [cap]
    : [];
  if (lines.length === 0) {
    // 静音镜：留 1.2s 占位时长，避免镜头 0 帧
    const emptyFrames = secondsToFrames(1.2);
    return { timings: [], totalFrames: emptyFrames };
  }

  const parts = [];
  const timings = [];
  let cursor = LEAD_IN;
  silence(LEAD_IN, join(WORK_DIR, `s${shotIndex}-lead.wav`));
  parts.push(join(WORK_DIR, `s${shotIndex}-lead.wav`));

  for (let i = 0; i < lines.length; i++) {
    const dur = await synthOne(lines[i], i, `s${shotIndex}`);
    if (PROVIDER !== "say" && i < lines.length - 1) {
      // 云 TTS 限流保护：句间小幅节流
      await new Promise((r) => setTimeout(r, 300));
    }
    timings.push({
      start: secondsToFrames(cursor),
      end: secondsToFrames(cursor + dur),
    });
    // 把这一句的语音 wav 拼进 parts（各 provider 统一输出 ${segment}-${index}.wav）
    parts.push(join(WORK_DIR, `s${shotIndex}-${i}.wav`));
    cursor += dur;
    const gapSec = i === lines.length - 1 ? TAIL : GAP;
    silence(gapSec, join(WORK_DIR, `s${shotIndex}-gap-${i}.wav`));
    parts.push(join(WORK_DIR, `s${shotIndex}-gap-${i}.wav`));
    cursor += gapSec;
  }

  // concat + 转 m4a
  const segWav = join(WORK_DIR, `s${shotIndex}.wav`);
  concatWavs(parts, segWav);
  toM4a(segWav, join(AUDIO_DIR, `${CASE_SLUG}_${shotIndex}.m4a`));

  return { timings, totalFrames: secondsToFrames(cursor) };
};

const estimateTimings = (lines) => {
  const timings = [];
  let cursor = LEAD_IN;
  lines.forEach((text, i) => {
    const dur = Array.from(text).length / FALLBACK_CPS;
    timings.push({ start: secondsToFrames(cursor), end: secondsToFrames(cursor + dur) });
    cursor += dur + (i === lines.length - 1 ? TAIL : GAP);
  });
  return timings;
};

const main = async () => {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR, { recursive: true });

  console.log(`配音服务: ${PROVIDER}  (TTS_PROVIDER=${PROVIDER}，改 .env 或命令行可换)`);

  const segmentFrames = [];
  const captionTimings = [];
  let degraded = false;

  for (let i = 0; i < CASE_SHOTS.length; i++) {
    const shot = CASE_SHOTS[i];
    const cap = shot.fields.caption;
    const lines = cap ? (Array.isArray(cap) ? cap : [cap]) : [];
    try {
      const { timings, totalFrames } = await synthShot(i);
      segmentFrames.push(totalFrames);
      captionTimings.push(timings);
      const sec = (totalFrames / FPS).toFixed(2);
      const tag = shot.type.padEnd(6);
      console.log(`  ✓ [${tag}] 镜 ${i}: ${lines.length} 句 → ${sec}s`);
    } catch (err) {
      console.warn(`  ! 镜 ${i} 生成失败：${err.message}`);
      console.warn(`    改用估算时长（FALLBACK_CPS=${FALLBACK_CPS}），不挂音频`);
      const fallbackFrames = lines.length === 0
        ? secondsToFrames(1.2)
        : secondsToFrames(
            lines.reduce((s, t) => s + Array.from(t).length / FALLBACK_CPS, 0) +
              LEAD_IN +
              TAIL +
              Math.max(0, lines.length - 1) * GAP,
          );
      segmentFrames.push(fallbackFrames);
      captionTimings.push(lines.length === 0 ? [] : estimateTimings(lines));
      degraded = true;
    }
  }

  writeTimings(segmentFrames, captionTimings, degraded);

  const total = segmentFrames.reduce((a, b) => a + b, 0);
  console.log(
    `\n总时长 ${(total / FPS).toFixed(2)}s（${total} 帧）→ src/caseTimings.generated.ts`,
  );
  rmSync(WORK_DIR, { recursive: true, force: true });
};

const writeTimings = (segmentFrames, captionTimings, degraded) => {
  const content = `// 由 scripts/case-tts.mjs 自动生成 —— 不要手改。
// 想调整请改 content/${CASE_SLUG}.md 的 caption，再跑 \`node scripts/case-tts.mjs ${CASE_SLUG}\`

export const CASE_AUDIO_AVAILABLE = ${!degraded};

export const CASE_SEGMENT_FRAMES: number[] = ${JSON.stringify(segmentFrames)};

export const CASE_CAPTION_TIMINGS: { start: number; end: number }[][] = ${JSON.stringify(
    captionTimings,
  )};
`;

  const out = join(ROOT, "src", "caseTimings.generated.ts");
  writeFileSync(out, content);
  console.log(`  已写入 ${out.replace(ROOT + "/", "")}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});