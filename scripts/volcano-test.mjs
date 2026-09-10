/**
 * volcano-test.mjs —— 单独验证「火山引擎 · 豆包语音 Seed TTS」配置能否调通。
 *
 * 只测一件事：拿 .env 里的 VOLCANO_API_KEY + VOLCANO_RESOURCE_ID + VOLCANO_SPEAKER
 * 合成一句中文，看能否拿到非空 mp3 且 ffprobe 能读出时长。
 * 不碰渲染链路，方便快速定位「配置/鉴权/音色」问题。
 *
 * 用法（项目根目录）：
 *   node scripts/volcano-test.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const readDotEnv = () => {
  const envPath = join(import.meta.dirname, "..", ".env");
  try {
    const parsed = {};
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) parsed[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    return parsed;
  } catch {
    return {};
  }
};

const ENV = readDotEnv();
const apiKey = ENV.VOLCANO_API_KEY ?? "";
const appId = ENV.VOLCANO_APP_ID ?? "";
const accessKey = ENV.VOLCANO_ACCESS_KEY ?? "";
const resourceId = ENV.VOLCANO_RESOURCE_ID ?? "seed-tts-2.0";
const speaker = ENV.VOLCANO_SPEAKER ?? "";
const sampleRate = Number(ENV.VOLCANO_SAMPLE_RATE ?? 24000);

const mask = (s) =>
  s && s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s ? "(已填但过短)" : "(空)";

console.log("===== 火山 Seed TTS 配置自检 =====");
console.log(`VOLCANO_API_KEY        : ${mask(apiKey)}`);
console.log(`VOLCANO_APP_ID         : ${appId ? "(已填·旧版)" : "(空)"}`);
console.log(`VOLCANO_ACCESS_KEY     : ${accessKey ? "(已填·旧版)" : "(空)"}`);
console.log(`VOLCANO_RESOURCE_ID    : ${resourceId}`);
console.log(`VOLCANO_SPEAKER        : ${speaker || "(空! 必需)"}`);
console.log(`VOLCANO_SAMPLE_RATE    : ${sampleRate}`);
console.log("");

if (!apiKey && !(appId && accessKey)) {
  console.error("✗ 缺少鉴权：新版需 VOLCANO_API_KEY，旧版需 VOLCANO_APP_ID + VOLCANO_ACCESS_KEY，二者填其一。");
  process.exit(1);
}
if (!speaker) {
  console.error("✗ 缺少 VOLCANO_SPEAKER 音色 id（控制台 发音人列表 里复制，如 zh_female_xxx_bigtts）。");
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (apiKey) headers["X-Api-Key"] = apiKey;
else {
  headers["X-Api-App-Id"] = appId;
  headers["X-Api-Access-Key"] = accessKey;
}
headers["X-Api-Resource-Id"] = resourceId;
headers["X-Api-Request-Id"] = `test-${Date.now()}`;

const body = {
  user: { uid: "volcano-test" },
  req_params: {
    text: "深度洞察，看透心理疏导底层逻辑。这是一段火山语音合成接口的自检音频，请完整读出这句话。",
    speaker,
    audio_params: { format: "mp3", sample_rate: sampleRate },
  },
};

const url = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
console.log(`→ POST ${url}`);
console.log("  合成文本：深度洞察，看透心理疏导底层逻辑。……");

let lastErr = "";
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok) {
      console.log(`✓ HTTP ${res.status}，返回 ${buf.length} 字节`);

      // 火山 TTS V2 是「流式逐行 JSON」：每行一个 chunk {"reqid","code","data":"base64","done"}，
      // 需把所有行的 data base64 解码后拼接，末行 done/code=20000000 结束。
      const parts = [];
      let chunkCount = 0;
      for (const line of buf.toString("utf8").split("\n")) {
        const t = line.trim();
        if (!t) continue;
        let j;
        try { j = JSON.parse(t); } catch { continue; }
        if (typeof j.code === "number" && j.code !== 0 && j.code !== 20000000) {
          console.error(`✗ 流错误 code=${j.code}: ${j.message ?? ""}`);
          process.exit(2);
        }
        if (j.data && typeof j.data === "string" && j.data.length > 0) {
          parts.push(Buffer.from(j.data, "base64"));
          chunkCount++;
        }
        if (j.done === true || j.code === 20000000) break;
      }
      console.log(`✓ 流式 chunk 数：${chunkCount}`);
      if (parts.length === 0) {
        console.error("✗ 流内无音频数据");
        process.exit(2);
      }
      const audio = parts.length === 1 ? parts[0] : Buffer.concat(parts);

      const work = mkdtempSync(join(tmpdir(), "volcano-test-"));
      const mp3 = join(work, "sample.mp3");
      writeFileSync(mp3, audio);

      // 探测：先转 wav（流式 mp3 常无完整时长头，ffprobe 直接读会显示 N/A）
      const wav = join(work, "sample.wav");
      try {
        execFileSync(
          "ffmpeg",
          ["-y", "-loglevel", "error", "-i", mp3, "-ar", "44100", "-ac", "1", wav],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        );
      } catch (e) {
        console.error("⚠ ffmpeg 转码失败：");
        console.error(String(e.stderr || e).slice(0, 400));
        console.error("\n这可能意味着返回内容并非有效音频。请核对账号是否开通该模型/音色。");
        process.exit(2);
      }
      const dur = execFileSync(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
        { encoding: "utf8" },
      ).trim();
      // 音量检测：排除「能解析但近乎静音」的异常音色/接口问题
      let volNote = "";
      try {
        const vol = execFileSync(
          "ffmpeg", ["-i", wav, "-af", "volumedetect", "-f", "null", "-"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        );
        const mv = vol.match(/mean_volume: ([-\d.]+) dB/);
        volNote = mv ? `（mean ${mv[1]} dB）` : "";
      } catch { /* 音量检测失败不阻断 */ }
      console.log(`✓ ffmpeg 转码成功 → wav ${dur}s ${volNote} → 确认是有效音频`);
      console.log(`\n✅ 火山 Seed TTS 配置可用，音色 ${speaker} 可正常合成。`);
      console.log(`   可直接跑：npm run case-publish energy-case-qingyuan`);
      process.exit(0);
    }
    // 非 200：body 为 JSON 错误
    let msg = buf.toString("utf8").slice(0, 300);
    try {
      const j = JSON.parse(msg);
      msg = j.message || JSON.stringify(j);
    } catch { /* keep raw */ }
    lastErr = `${res.status}: ${msg}`;
    console.log(`✗ 第 ${attempt} 次 HTTP ${res.status}: ${msg}`);
  } catch (e) {
    lastErr = e.message;
    console.log(`✗ 第 ${attempt} 次网络错误: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1000 * attempt));
}

console.error(`\n✗ 火山 Seed TTS 调用失败（重试 4 次）：${lastErr}`);
console.error("  常见原因：KEY 无效/账号未开通该模型/音色 id 不属于当前账号/欠费。");
process.exit(1);
