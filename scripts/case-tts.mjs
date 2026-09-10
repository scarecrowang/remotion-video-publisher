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
 * 配音服务（TTS_PROVIDER）——全部在 .env 里配置或命令行指定：
 *   - moss       本地 MOSS-TTS-Nano（开源 Apache-2.0 · CPU 实时 · 免 Key · 中文真人感）
 *                部署：git clone https://github.com/OpenMOSS/MOSS-TTS-Nano && pip install -e . && moss-tts-nano serve
 *                默认 http://127.0.0.1:18083；可选 MOSS_PROMPT_AUDIO=<参考音频> 做 3s 语音克隆
 *   - volcano    火山引擎·豆包语音合成大模型(Seed TTS)，推荐（真人感强、中文母语）
 *   - elevenlabs ElevenLabs，原默认
 *   - openai     OpenAI TTS（需 OPENAI_API_KEY）
 *   - azure      Azure Speech（需 AZURE_SPEECH_KEY + AZURE_SPEECH_REGION）
 *   - google     Google Cloud TTS（需 GOOGLE_TTS_CREDENTIALS）
 *   - say        macOS 本地免费配音（草稿/预览用，零配置）
 *   - powershell Windows 本地免费 TTS（System.Speech，零配置）
 *   - espeak     Linux 本地免费 TTS（espeak-ng，需 apt install）
 *   - auto       自动选路：本地 MOSS 服务可达 → moss（真人感、免 Key）；否则按平台免费 TTS（macOS→say, Windows→powershell, Linux→espeak）
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
import { tmpdir, platform } from "node:os";
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

// 配音服务：命令行 TTS_PROVIDER > .env 里的 TTS_PROVIDER > 默认 auto（自动选路：本地 MOSS 优先，否则平台免费 TTS）
const ENV = readDotEnv();
let PROVIDER = (
  process.env.TTS_PROVIDER ?? ENV.TTS_PROVIDER ?? "auto"
).toLowerCase();

// auto 是异步探测占位：真正选路延迟到 main() 开头（moss 服务可达性检测在本函数内 async 完成）

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

// ---------- OpenAI TTS ----------
// 使用 OpenAI 的 TTS API，支持多种音色和模型。
// 环境变量：OPENAI_API_KEY（必填）、OPENAI_TTS_VOICE（可选，默认 alloy）、OPENAI_TTS_MODEL（可选，默认 tts-1）
const synthOneOpenAI = async (text, index, segment) => {
  const apiKey = process.env.OPENAI_API_KEY ?? ENV.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置（见 .env.example）");
  }
  const voice = process.env.OPENAI_TTS_VOICE ?? ENV.OPENAI_TTS_VOICE ?? "alloy";
  const model = process.env.OPENAI_TTS_MODEL ?? ENV.OPENAI_TTS_MODEL ?? "tts-1";
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: "mp3",
        }),
      });
      if (res.ok) {
        const mp3 = join(WORK_DIR, `${segment}-${index}.mp3`);
        const wav = join(WORK_DIR, `${segment}-${index}.wav`);
        writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
        return toWav(mp3, wav);
      }
      lastErr = `${res.status}: ${(await res.text()).slice(0, 120)}`;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, Math.min(2000, 400 * (attempt + 1))));
  }
  throw new Error(`OpenAI TTS 重试失败 ${lastErr}`);
};

// ---------- Azure Speech ----------
// 使用 Azure Cognitive Services Speech TTS。
// 环境变量：AZURE_SPEECH_KEY（必填）、AZURE_SPEECH_REGION（必填，如 eastasia）、AZURE_SPEECH_VOICE（可选，默认 zh-CN-XiaoxiaoNeural）
const synthOneAzure = async (text, index, segment) => {
  const key = process.env.AZURE_SPEECH_KEY ?? ENV.AZURE_SPEECH_KEY ?? "";
  const region = process.env.AZURE_SPEECH_REGION ?? ENV.AZURE_SPEECH_REGION ?? "";
  if (!key) throw new Error("AZURE_SPEECH_KEY 未配置（见 .env.example）");
  if (!region) throw new Error("AZURE_SPEECH_REGION 未配置（见 .env.example）");
  const voice = process.env.AZURE_SPEECH_VOICE ?? ENV.AZURE_SPEECH_VOICE ?? "zh-CN-XiaoxiaoNeural";
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
  <voice name="${voice}">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</voice>
</speak>`,
        },
      );
      if (res.ok) {
        const mp3 = join(WORK_DIR, `${segment}-${index}.mp3`);
        const wav = join(WORK_DIR, `${segment}-${index}.wav`);
        writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
        return toWav(mp3, wav);
      }
      lastErr = `${res.status}: ${(await res.text()).slice(0, 120)}`;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, Math.min(2000, 400 * (attempt + 1))));
  }
  throw new Error(`Azure Speech 重试失败 ${lastErr}`);
};

// ---------- Google Cloud TTS ----------
// 使用 Google Cloud Text-to-Speech API。
// 环境变量：GOOGLE_TTS_CREDENTIALS（必填，JSON 字符串或文件路径）、GOOGLE_TTS_VOICE（可选，默认 zh-CN-Standard-A）
// 使用 Node.js 内置 crypto 进行 JWT 签名，无需额外依赖。
const synthOneGoogle = async (text, index, segment) => {
  const credentials = process.env.GOOGLE_TTS_CREDENTIALS ?? ENV.GOOGLE_TTS_CREDENTIALS ?? "";
  if (!credentials) {
    throw new Error("GOOGLE_TTS_CREDENTIALS 未配置（见 .env.example）");
  }
  const voice = process.env.GOOGLE_TTS_VOICE ?? ENV.GOOGLE_TTS_VOICE ?? "zh-CN-Standard-A";
  // 如果 credentials 是文件路径，读取文件内容
  let creds;
  try {
    creds = JSON.parse(credentials);
  } catch {
    // 可能是文件路径
    try {
      const { readFileSync } = await import("node:fs");
      creds = JSON.parse(readFileSync(credentials, "utf8"));
    } catch {
      throw new Error("GOOGLE_TTS_CREDENTIALS 格式错误：应为 JSON 字符串或有效的文件路径");
    }
  }
  const { createPrivateKey } = await import("node:crypto");
  // 使用 Node.js 内置 crypto 构建 JWT
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signatureInput = `${b64(header)}.${b64(claimSet)}`;
  const { sign } = await import("node:crypto");
  const sig = sign("sha256", Buffer.from(signatureInput), createPrivateKey(creds.private_key));
  const jwt = `${signatureInput}.${sig.toString("base64url")}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Google OAuth 失败：${JSON.stringify(tokenData)}`);
  }
  const accessToken = tokenData.access_token;

  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: voice.split("-").slice(0, 2).join("-"), name: voice },
            audioConfig: { audioEncoding: "MP3" },
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const mp3 = join(WORK_DIR, `${segment}-${index}.mp3`);
        const wav = join(WORK_DIR, `${segment}-${index}.wav`);
        writeFileSync(mp3, Buffer.from(data.audioContent, "base64"));
        return toWav(mp3, wav);
      }
      lastErr = `${res.status}: ${(await res.text()).slice(0, 120)}`;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, Math.min(2000, 400 * (attempt + 1))));
  }
  throw new Error(`Google Cloud TTS 重试失败 ${lastErr}`);
};

// ---------- macOS 本地免费 fallback（零成本预览用）----------
const synthOneSay = (text, index, segment) => {
  const voice = process.env.TTS_VOICE ?? "Tingting";
  const rate = Number(process.env.TTS_RATE ?? 210);
  const aiff = join(WORK_DIR, `${segment}-${index}.aiff`);
  const wav = join(WORK_DIR, `${segment}-${index}.wav`);
  run("say", ["-v", voice, "-r", String(rate), "-o", aiff, text]);
  return toWav(aiff, wav);
};

// ---------- Windows 本地免费 TTS（PowerShell System.Speech）----------
// 使用 Windows 内置的 System.Speech 语音合成，无需安装任何额外软件。
// 中文语音名：Microsoft Huihui Desktop / Microsoft Yaoyao Desktop / Microsoft Kangkang Desktop
// 英文语音名：Microsoft Zira Desktop / Microsoft David Desktop
const synthOnePowerShell = (text, index, segment) => {
  const voice = process.env.TTS_VOICE ?? "Microsoft Huihui Desktop";
  const wav = join(WORK_DIR, `${segment}-${index}.wav`);
  const script = `
Add-Type -AssemblyName System.Speech;
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
try {
  $s.SelectVoice('${voice.replace(/'/g, "''")}');
} catch {}
$s.SetOutputToWaveFile('${wav.replace(/\\/g, "\\\\")}');
$s.Speak('${text.replace(/'/g, "''")}');
$s.Dispose();
`;
  run("powershell", ["-Command", script]);
  return durationOf(wav);
};

// ---------- Linux 本地免费 TTS（espeak-ng）----------
// espeak-ng 是 Linux 最广泛使用的开源 TTS，支持中文（zh）和多种语言。
// 安装：sudo apt install espeak-ng  或  sudo yum install espeak-ng  或  sudo pacman -S espeak-ng
const synthOneEspeak = (text, index, segment) => {
  const voice = process.env.TTS_VOICE ?? "zh";
  const rate = Number(process.env.TTS_RATE ?? 160);
  const wav = join(WORK_DIR, `${segment}-${index}.wav`);
  try {
    run("espeak-ng", ["-v", voice, "-s", String(rate), "-w", wav, text]);
  } catch {
    // 尝试用 espeak 作为 fallback（旧版名称）
    run("espeak", ["-v", voice, "-s", String(rate), "-w", wav, text]);
  }
  return durationOf(wav);
};

// ---------- MOSS-TTS-Nano 本地 TTS（默认 auto 首选：免 Key、中文真人感）----------
// 开源：https://github.com/OpenMOSS/MOSS-TTS-Nano （Apache-2.0，CPU 实时，0.1B + 20M tokenizer）
// 部署（首次，一次性）：见下方 installMossHint() 的平台分步指引。
// 常驻服务默认 http://127.0.0.1:18083；可用 MOSS_TTS_BASE_URL 覆盖。
// 可选 MOSS_PROMPT_AUDIO=<参考音频路径>：3 秒语音克隆（给品牌固声线，参考音频是普通中文说话人即可）。
const mossBaseUrl = () =>
  (process.env.MOSS_TTS_BASE_URL ?? ENV.MOSS_TTS_BASE_URL ?? "http://127.0.0.1:18083").replace(/\/$/, "");

// 首次 MOSS 失败时打印完整部署指引，后续只简短报错（避免逐镜刷屏）
let mossHintShown = false;

// 平台对应的 MOSS 部署指引（首选一键脚本；以下为手动分步兜底）
const installMossHint = () => {
  const lines = [];
  lines.push("# 方式一（推荐）：一键自动部署（检测→clone→venv→装依赖→后台启动→健康检查）");
  lines.push("node scripts/setup-moss.mjs");
  lines.push("# 或整包环境都装一遍时：node scripts/setup.mjs（同样会自动部署 MOSS）");
  const p = platform();
  lines.push("");
  lines.push("# 方式二：手动分步");
  if (p === "darwin") {
    lines.push("# macOS（命令行一行装完）");
    lines.push("brew install python@3.12 ffmpeg");
    lines.push("git clone https://github.com/OpenMOSS/MOSS-TTS-Nano.git && cd MOSS-TTS-Nano");
    lines.push("python3.12 -m venv .venv && source .venv/bin/activate");
    lines.push("pip install -r requirements.txt && pip install -e .");
  } else if (p === "win32") {
    lines.push("# Windows（PowerShell）");
    lines.push('winget install Python.Python.3.12 Git.Git FFmpeg');
    lines.push("git clone https://github.com/OpenMOSS/MOSS-TTS-Nano.git; cd MOSS-TTS-Nano");
    lines.push("python -m venv .venv; .\\.venv\\Scripts\\activate");
    lines.push("# pynini 是已知安装坑：非 Conda 需先按 Issue #6 装匹配平台的 pynini wheel");
    lines.push("pip install -r requirements.txt; pip install -e .");
  } else {
    lines.push("# Linux");
    lines.push("sudo apt install -y python3.12-venv ffmpeg git");
    lines.push("git clone https://github.com/OpenMOSS/MOSS-TTS-Nano.git && cd MOSS-TTS-Nano");
    lines.push("python3.12 -m venv .venv && source .venv/bin/activate");
    lines.push("pip install -r requirements.txt && pip install -e .");
  }
  lines.push("# 启动常驻服务（模型首启约 5 分钟下载，之后秒开）：");
  lines.push("moss-tts-nano serve  # 或 python app.py，默认 http://127.0.0.1:18083");
  return lines.join("\n");
};

// 轮询任务直到出结果；tick：非 200 视为未就绪，最多 ~90s
const pollMossResult = async (base, streamId) => {
  const deadline = Date.now() + 90000;
  let lastStatus = "";
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/generate-stream/${streamId}/result`, { method: "GET" });
    const text = await res.text();
    if (res.status === 200) {
      try {
        return JSON.parse(text);
      } catch {
        lastStatus = `  result 200 非 JSON: ${text.slice(0, 120)}`;
      }
    } else {
      lastStatus = `  result ${res.status}: ${text.slice(0, 120)}`;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`MOSS 合成超时（90s）${lastStatus}`);
};

// 把 moss 返回的 base64 写成 wav。自动识别两种形态：
//   - 完整 WAV（RIFF 头）：直接交给 ffmpeg 自动探测并转 44.1k mono
//   - 裸 PCM：用 result 响应里的 sample_rate/channels（拿不到回退 48k/2ch）
const writePcmWav = (base64, wav, { sampleRate = 48000, channels = 2 } = {}) => {
  const buf = Buffer.from(base64, "base64");
  const stem = wav.replace(/\.wav$/i, ""); // WORK_DIR/<seg>-<idx>
  const isRiff = buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF";
  if (isRiff) {
    const rawWav = `${stem}.raw.wav`;
    writeFileSync(rawWav, buf);
    return toWav(rawWav, wav);
  }
  const pcm = `${stem}.pcm`;
  writeFileSync(pcm, buf);
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "s16le", "-ar", String(sampleRate), "-ac", String(channels), "-i", pcm,
    "-ar", "44100", "-ac", "1", wav,
  ]);
  return durationOf(wav);
};

// MOSS 原生流式端点——单句语音合成（与其它 provider 一致：返回 wav 时长）
const synthOneMoss = async (text, index, segment) => {
  const base = mossBaseUrl();
  const t0 = Date.now();
  // demo_id = 内置音色（真实服务必须传！空值会 400 "demo_id is required"）。
  // 可用 MOSS_DEMO_ID 覆盖，默认 demo-5（讲课/纪录片旁白，稳重叙事感）。
  const demoId = process.env.MOSS_DEMO_ID ?? ENV.MOSS_DEMO_ID ?? "demo-5";
  // 提交任务（form 字段与 app.py 的 /api/generate-stream/start 一致）
  const form = new FormData();
  form.append("text", text);
  form.append("demo_id", demoId);
  const promptAudio =
    process.env.MOSS_PROMPT_AUDIO ?? ENV.MOSS_PROMPT_AUDIO ?? "";
  if (promptAudio) {
    if (!existsSync(promptAudio)) {
      throw new Error(`MOSS_PROMPT_AUDIO 不存在：${promptAudio}（应为参考 wav/mp3）`);
    }
    const buf = readFileSync(promptAudio);
    const ext = promptAudio.toLowerCase().endsWith(".mp3") ? "mp3" : "wav";
    form.append("prompt_audio", new Blob([buf], { type: ext === "mp3" ? "audio/mpeg" : "audio/wav" }), `ref.${ext}`);
  }
  form.append("max_new_frames", "375");
  form.append("seed", "0");

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${base}/api/generate-stream/start`, { method: "POST", body: form });
      if (!res.ok) {
        lastErr = `start ${res.status}: ${(await res.text()).slice(0, 120)}`;
        // 快速重试前稍等
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      const data = await res.json();
      const streamId = data.stream_id;
      if (!streamId) {
        lastErr = `响应无 stream_id: ${JSON.stringify(data).slice(0, 200)}`;
        continue;
      }
      const result = await pollMossResult(base, streamId);
      const b64 = result.audio_base64;
      if (!b64) {
        lastErr = "result 无 audio_base64（合成可能失败）";
        continue;
      }
      const wav = join(WORK_DIR, `${segment}-${index}.wav`);
      const sr = Number(result.sample_rate || 48000);
      const ch = Number(result.channels || 2);
      const dur = writePcmWav(b64, wav, { sampleRate: sr, channels: ch });
      console.log(`  [moss] 句 ${index} ${dur.toFixed(2)}s（${Date.now() - t0}ms）`);
      return dur;
    } catch (e) {
      lastErr = e.message;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  // 首次失败打印完整部署指引（含平台命令），后续只报简短错误，避免逐镜刷屏
  if (!mossHintShown) {
    mossHintShown = true;
    console.warn(
      `\n[MOSS] 本地 TTS 不可用：${lastErr}\n` +
        `      请确认 MOSS-TTS-Nano 服务已启动（默认 http://127.0.0.1:18083）。\n` +
        `${installMossHint().split("\n").map((l) => `      ${l}`).join("\n")}\n`,
    );
  }
  throw new Error(`MOSS 本地 TTS 失败：${lastErr}（服务未启动？部署指引已在上方输出）`);
};

// ---------- 自动检测平台兜底 ----------
// auto 首选本地 MOSS（真人感、免 Key），不可达则按平台免费 TTS
const autoSelectProvider = async () => {
  const base = mossBaseUrl();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return "moss"; // 本地服务可用 → 默认真人感
    }
  } catch {
    // 服务未启动/不可达 → 平台兜底
  }
  const p = platform();
  if (p === "darwin") return "say";
  if (p === "win32") return "powershell";
  if (p === "linux") return "espeak";
  return "say"; // 默认 fallback
};

const PROVIDER_IMPL = {
  moss: synthOneMoss,
  volcano: synthOneVolcano,
  elevenlabs: synthOneEleven,
  openai: synthOneOpenAI,
  azure: synthOneAzure,
  google: synthOneGoogle,
  say: synthOneSay,
  powershell: synthOnePowerShell,
  espeak: synthOneEspeak,
};

// 注意：不能用顶层 const 固化 PROVIDER_IMPL[PROVIDER]——
// auto 模式在 main() 开头才把 PROVIDER 从 "auto" 解析成具体 provider，
// 顶层取一次会拿到 PROVIDER_IMPL["auto"]=undefined（进而走 throw 闭包）。
// 这里必须每次调用时动态查找，保证 auto 解析后生效。
const synthOne = (text, index, segment) => {
  const impl = PROVIDER_IMPL[PROVIDER];
  if (!impl) {
    throw new Error(
      `未知 TTS_PROVIDER: ${PROVIDER}（可选 moss / volcano / openai / azure / google / elevenlabs / say / powershell / espeak / auto）`,
    );
  }
  return impl(text, index, segment);
};

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
    // 云 TTS 限流保护：句间小幅节流（本地 provider moss/say/powershell/espeak 跳过）
    const isCloud = ["volcano", "elevenlabs", "openai", "azure", "google"].includes(PROVIDER);
    if (isCloud && i < lines.length - 1) {
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

  // auto 选路：探测本地 MOSS 服务，可达则优先 moss，否则按平台免费 TTS
  if (PROVIDER === "auto") {
    PROVIDER = await autoSelectProvider();
    console.log(
      PROVIDER === "moss"
        ? `  TTS_PROVIDER=auto → 本地 MOSS-TTS-Nano（真人感、免 Key）`
        : `  TTS_PROVIDER=auto → ${PROVIDER}（本地 MOSS 不可达，按平台回落：${platform()}）`,
    );
  }

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