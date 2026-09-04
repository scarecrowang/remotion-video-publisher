/**
 * case-render.mjs —— 跨平台 Remotion 渲染入口。
 *
 * 使用 @remotion/renderer 的 Node API，替代旧版 Shell 脚本。
 * 自动检测/下载 Chromium，不再硬编码 macOS 路径。
 *
 * 用法：
 *   node scripts/case-render.mjs CaseEpisode out/<slug>/<slug>.mp4
 *
 * 环境变量：
 *   CHROME_EXECUTABLE  — 指定 Chrome/Chromium 路径（可选，自动检测）
 *   REMOTION_BROWSER   — 同 CHROME_EXECUTABLE（兼容 remotion 生态）
 *   REMOTION_CONCURRENCY — 并发线程数（默认根据 CPU 核数自动）
 */

import { existsSync, mkdirSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cpus, platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---- 动态导入 @remotion/renderer ----
let renderer;
try {
  renderer = await import("@remotion/renderer");
} catch {
  console.error("❌ 缺少 @remotion/renderer 依赖，请运行: npm install @remotion/renderer");
  process.exit(1);
}

// ---- 解析参数 ----
const COMP = process.argv[2] || "CaseEpisode";
const OUT = process.argv[3] || resolve(ROOT, "out", COMP, `${COMP}.mp4`);
const ENTRY = resolve(ROOT, "src", "index.ts");

if (!existsSync(ENTRY)) {
  console.error(`❌ 找不到入口文件: ${ENTRY}`);
  process.exit(1);
}

// ---- 查找或下载 Chrome ----
async function resolveBrowser() {
  // 优先环境变量
  const fromEnv = process.env.CHROME_EXECUTABLE || process.env.REMOTION_BROWSER || "";
  if (fromEnv && existsSync(fromEnv)) {
    console.log(`  使用指定 Chrome: ${fromEnv}`);
    return fromEnv;
  }

  // 平台默认路径探测
  const p = platform();
  const candidates = [];
  if (p === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else if (p === "linux") {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    );
  } else if (p === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    const prog = process.env.PROGRAMFILES || "C:\\Program Files";
    const prog86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    candidates.push(
      `${local}\\Google\\Chrome\\Application\\chrome.exe`,
      `${prog}\\Google\\Chrome\\Application\\chrome.exe`,
      `${prog86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${local}\\Chromium\\Application\\chrome.exe`,
      `${prog}\\Microsoft\\Edge\\Application\\msedge.exe`,
    );
  }

  for (const path of candidates) {
    if (existsSync(path)) {
      console.log(`  自动检测到 Chrome: ${path}`);
      return path;
    }
  }

  // 找不到 → 自动下载 Chromium
  console.log("  ⏳ 未检测到 Chrome，正在自动下载 Chromium（仅首次）...");
  try {
    const { executablePath } = await renderer.ensureBrowser({
      browser: "google-chrome",
      logLevel: "info",
    });
    console.log(`  ✅ 已下载 Chromium: ${executablePath}`);
    return executablePath;
  } catch (err) {
    console.warn(`  ⚠️ 自动下载失败: ${err.message}`);
    console.warn("  请手动安装 Chrome 后设置 CHROME_EXECUTABLE 环境变量");
    return null;
  }
}

// ---- 渲染 ----
async function main() {
  console.log("════════════════════════════════════════════");
  console.log(`  Remotion 渲染`);
  console.log(`  合成: ${COMP}`);
  console.log(`  输出: ${OUT}`);
  console.log("════════════════════════════════════════════");
  console.log("");

  // 1. 确保输出目录
  const outDir = dirname(OUT);
  mkdirSync(outDir, { recursive: true });

  // 2. 查找浏览器
  const browserExecutable = await resolveBrowser();

  // 3. 获取合成列表
  console.log("\n[1/3] 读取远程合成...");
  const compositions = await renderer.getCompositions(ENTRY, {
    browserExecutable,
    logLevel: "warn",
  });

  const composition = compositions.find((c) => c.id === COMP);
  if (!composition) {
    const ids = compositions.map((c) => c.id).join(", ");
    console.error(`❌ 未找到合成 "${COMP}"。可用: ${ids}`);
    process.exit(1);
  }
  const totalFrames = composition.durationInFrames;
  const fps = composition.fps;
  const dur = (totalFrames / fps).toFixed(1);
  console.log(`  ✓ ${COMP} — ${totalFrames} 帧 / ${fps}fps / ${dur}s`);

  // 4. 渲染
  console.log("\n[2/3] 渲染中...");
  const concurrency = Number(process.env.REMOTION_CONCURRENCY) || Math.max(1, cpus().length - 1);

  try {
    await renderer.renderMedia({
      composition,
      serveUrl: ENTRY,
      codec: "h264",
      outputLocation: OUT,
      browserExecutable,
      concurrency,
      logLevel: "warn",
      overwrite: true,
      onBrowserDownload: () => {
        console.log("  ⏳ 下载浏览器...");
      },
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        if (progress > 0 && progress < 1) {
          const pct = (progress * 100).toFixed(0);
          process.stdout.write(`\r  ⏳ ${pct}% (${renderedFrames}/${totalFrames} 帧)`);
        }
      },
    });
    process.stdout.write("\n");
    console.log("  ✅ 渲染完成");

    // 5. 验证
    console.log("\n[3/3] 验证输出...");
    if (existsSync(OUT)) {
      const stats = await import("node:fs/promises").then((m) => m.stat(OUT));
      const size = (stats.size / 1024 / 1024).toFixed(1);
      console.log(`  ✅ ${OUT} — ${size}MB`);
    } else {
      console.error("  ❌ 输出文件未生成");
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ 渲染失败: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});