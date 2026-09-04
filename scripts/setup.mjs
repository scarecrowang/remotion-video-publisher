/**
 * setup.mjs —— 一键安装 + 环境检测。
 *
 * 跨平台（macOS / Linux / Windows），自动检测依赖、安装 Chromium。
 *
 * 用法：
 *   node scripts/setup.mjs
 *
 * 步骤：
 *   1. 检查 Node.js 版本（≥18）
 *   2. npm install（装 remotion 等依赖）
 *   3. 检测 ffmpeg/ffprobe（提醒安装）
 *   4. 检测/下载 Chromium
 *   5. TypeScript 编译检查
 *   6. 创建 .env（如不存在）
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const NODE = process.execPath;

// 工具：打印带颜色的消息
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// ---- 步骤 1: Node.js 版本 ----
function checkNodeVersion() {
  const v = process.version;
  const major = parseInt(v.slice(1));
  if (major < 18) {
    console.error(c.red(`❌ Node.js 版本过低: ${v}，需要 ≥18`));
    console.error("   请升级: https://nodejs.org/");
    process.exit(1);
  }
  console.log(c.green("  ✅") + ` Node.js ${v}`);
}

// ---- 步骤 2: npm install ----
function npmInstall() {
  if (existsSync(resolve(ROOT, "node_modules", "remotion"))) {
    console.log(c.green("  ✅") + ` node_modules 已存在，跳过 npm install`);
    return;
  }
  console.log("  ⏳ 安装依赖 (npm install)...");
  execSync("npm install", { cwd: ROOT, stdio: "inherit" });
  console.log(c.green("  ✅") + " 依赖安装完成");
}

// ---- 步骤 3: 检测 ffmpeg ----
function checkFfmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    console.log(c.green("  ✅") + " ffmpeg");
  } catch {
    console.warn(c.yellow("  ⚠️") + " ffmpeg 未安装");
    console.warn(c.dim("     配音脚本(case-tts.mjs)需要 ffmpeg 处理音频"));
    if (process.platform === "darwin") {
      console.warn(c.dim("     安装: brew install ffmpeg"));
    } else if (process.platform === "linux") {
      console.warn(c.dim("     安装: sudo apt install ffmpeg  或  sudo pacman -S ffmpeg"));
    } else if (process.platform === "win32") {
      console.warn(c.dim("     下载: https://ffmpeg.org/download.html"));
    }
  }
  try {
    execSync("ffprobe -version", { stdio: "ignore" });
    console.log(c.green("  ✅") + " ffprobe");
  } catch {
    console.warn(c.yellow("  ⚠️") + " ffprobe 未安装（ffmpeg 自带）");
  }
}

// ---- 步骤 4: 检测/下载 Chromium ----
async function checkChromium() {
  const fromEnv = process.env.CHROME_EXECUTABLE || process.env.REMOTION_BROWSER || "";
  if (fromEnv && existsSync(fromEnv)) {
    console.log(c.green("  ✅") + ` Chrome: ${fromEnv}`);
    return;
  }

  // 平台默认路径检测
  const p = process.platform;
  const candidates = [];
  if (p === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    candidates.push("/Applications/Chromium.app/Contents/MacOS/Chromium");
  } else if (p === "linux") {
    candidates.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser");
  } else if (p === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    const prog = process.env.PROGRAMFILES || "C:\\Program Files";
    const prog86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    candidates.push(
      `${local}\\Google\\Chrome\\Application\\chrome.exe`,
      `${prog}\\Google\\Chrome\\Application\\chrome.exe`,
      `${prog86}\\Google\\Chrome\\Application\\chrome.exe`,
    );
  }

  for (const path of candidates) {
    if (existsSync(path)) {
      console.log(c.green("  ✅") + ` 自动检测到 Chrome: ${path}`);
      return;
    }
  }

  // 尝试自动下载
  console.log("  ⏳ 未检测到 Chrome，正在自动下载 Chromium...");
  try {
    const { ensureBrowser } = await import("@remotion/renderer");
    const { executablePath } = await ensureBrowser({
      browser: "google-chrome",
      logLevel: "info",
    });
    console.log(c.green("  ✅") + ` 已自动下载 Chromium: ${executablePath}`);
  } catch (err) {
    console.warn(c.yellow("  ⚠️") + ` 自动下载 Chromium 失败: ${err.message}`);
    console.warn(c.dim("     请手动安装 Chrome 后，设置环境变量:"));
    console.warn(c.dim("       CHROME_EXECUTABLE=/path/to/chrome"));
    console.warn(c.dim("       或在运行前通过 `export CHROME_EXECUTABLE=...` 指定"));
  }
}

// ---- 步骤 5: TypeScript 编译检查 ----
function checkTypescript() {
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
    console.log(c.green("  ✅") + " TypeScript 编译通过");
  } catch (err) {
    const output = err.stdout?.toString() || "";
    // 只显示类型错误数，不打印全部
    const errors = (output.match(/error TS\d+/g) || []).length;
    if (errors > 0) {
      console.warn(c.yellow(`  ⚠️  TypeScript 有 ${errors} 个类型错误`));
      console.warn(c.dim("     运行 `npx tsc --noEmit` 查看详情"));
    } else {
      console.log(c.green("  ✅") + " TypeScript 编译通过");
    }
  }
}

// ---- 步骤 6: 创建 .env 模板 ----
function ensureDotenv() {
  const envPath = resolve(ROOT, ".env");
  if (existsSync(envPath)) {
    console.log(c.green("  ✅") + " .env 已存在");
    return;
  }

  const examplePath = resolve(ROOT, ".env.example");
  if (existsSync(examplePath)) {
    // 从 .env.example 复制，但清空所有 key 值（保留注释）
    const example = require("fs").readFileSync(examplePath, "utf8");
    const lines = example.split("\n");
    const cleaned = lines.map((line) => {
      // 把 KEY=xxx 清空为 KEY=，但保留注释
      const m = line.match(/^([A-Z0-9_]+)=/);
      if (m) return `${m[1]}=`;
      return line;
    });
    writeFileSync(envPath, cleaned.join("\n"));
    console.log(c.yellow("  ⚠️") + " 已从 .env.example 创建 .env（请填写 API Key）");
    console.log(c.dim("     编辑 .env 填入以下 key:"));
    console.log(c.dim("       PEXELS_API_KEY  — https://www.pexels.com/api/"));
    console.log(c.dim("       VOLCANO_API_KEY — https://console.volcengine.com/speech/new"));
    console.log(c.dim("       VOLCANO_SPEAKER — 火山引擎控制台·发音人列表"));
  } else {
    // 创建最小 .env 模板
    writeFileSync(envPath, [
      "# =========================================",
      "# Remotion 案例引擎配置",
      "# 复制此文件为 .env 并填入真实 API Key",
      "# =========================================",
      "",
      "# TTS 配音服务（volcano / elevenlabs / say）",
      "TTS_PROVIDER=volcano",
      "",
      "# 火山引擎·豆包语音合成",
      "# 开通: https://console.volcengine.com/speech/new",
      "VOLCANO_API_KEY=",
      "VOLCANO_RESOURCE_ID=seed-tts-2.0",
      "VOLCANO_SPEAKER=",
      "",
      "# Pexels 视频素材（免费）",
      "# 注册: https://www.pexels.com/api/",
      "PEXELS_API_KEY=",
      "",
      "# Chrome 路径（可选，自动检测/下载）",
      "# CHROME_EXECUTABLE=",
    ].join("\n"));
    console.log(c.yellow("  ⚠️") + " 已创建 .env 模板（请填写 API Key）");
  }
}

// ---- 主流程 ----
async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  Remotion 案例引擎 — 环境检测与安装");
  console.log("════════════════════════════════════════════\n");

  console.log("[1/6] Node.js 版本");
  checkNodeVersion();

  console.log("\n[2/6] 安装依赖");
  npmInstall();

  console.log("\n[3/6] 检测多媒体工具");
  checkFfmpeg();

  console.log("\n[4/6] 检测浏览器");
  await checkChromium();

  console.log("\n[5/6] TypeScript 编译检查");
  checkTypescript();

  console.log("\n[6/6] API Key 配置");
  ensureDotenv();

  console.log("\n════════════════════════════════════════════");
  console.log(c.green("  环境检测完成 ✅"));
  console.log("  下一步: 编辑 .env 填写 API Key，然后运行:");
  console.log(c.dim("    node scripts/case-publish.mjs <slug>"));
  console.log("════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});