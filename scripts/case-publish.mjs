/**
 * case-publish.mjs —— 一键出案例速览片（跨平台编排器）。
 *
 * 替代旧版 case-publish.sh + render.sh，纯 Node.js 实现。
 * 支持 macOS / Linux / Windows。
 *
 * 用法（项目根目录）：
 *   node scripts/case-publish.mjs <slug>              # 全流程
 *   node scripts/case-publish.mjs <slug> --no-tts     # 跳过配音
 *   node scripts/case-publish.mjs <slug> --no-broll   # 跳过 B-roll
 *   node scripts/case-publish.mjs <slug> --no-cover   # 不抽封面
 *   node scripts/case-publish.mjs <slug> --frame=500  # 指定封面帧
 *
 * 工作流：
 *   1) content/<slug>.md 写分镜稿
 *   2) node scripts/case-publish.mjs <slug>
 *   => out/<slug>/<slug>.mp4 + out/<slug>/<slug>-thumb.png
 *
 * 环境变量：
 *   PEXELS_API_KEY     — Pexels API Key（B-roll 下载）
 *   VOLCANO_API_KEY    — 火山引擎 Key（TTS 配音）
 *   CHROME_EXECUTABLE  — Chrome 路径（可选，自动检测/下载）
 */

import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---- 参数解析 ----
const SLUG = process.argv[2];
if (!SLUG) {
  console.error("用法: node scripts/case-publish.mjs <slug> [--no-tts] [--no-broll] [--no-cover] [--frame=N]");
  process.exit(1);
}

const args = process.argv.slice(3);
const DO_TTS = !args.includes("--no-tts");
const DO_BROLL = !args.includes("--no-broll");
const DO_COVER = !args.includes("--no-cover");

const coverArg = args.find((a) => a.startsWith("--frame="));
const COVER_FRAME = coverArg ? Number(coverArg.split("=")[1]) : 820;

const OUT_DIR = resolve(ROOT, "out", SLUG);
const OUT = resolve(OUT_DIR, `${SLUG}.mp4`);
const COVER = resolve(OUT_DIR, `${SLUG}-thumb.png`);

// ---- 跨平台 Node 执行 ----
const NODE = process.execPath;

// ---- 跨平台 ffmpeg 查找 ----
function findFfmpeg() {
  // 优先 .env 或环境变量
  const fromEnv = process.env.FFMPEG_PATH || "";
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  // PATH 查找
  const candidates = platform() === "win32" ? ["ffmpeg.exe"] : ["ffmpeg"];
  try {
    const result = execFileSync(platform() === "win32" ? "where" : "which", candidates, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const path = result.trim().split("\n")[0];
    if (path) return path;
  } catch {
    // 没找到，返回 null
  }
  return null;
}

// ---- 主流程 ----
async function main() {
  const startTime = Date.now();

  console.log("════════════════════════════════════════════");
  console.log(`  案例速览片  |  ${SLUG}`);
  console.log("════════════════════════════════════════════");

  // 验证分镜稿存在
  const mdPath = resolve(ROOT, "content", `${SLUG}.md`);
  if (!existsSync(mdPath)) {
    console.error(`❌ 找不到分镜稿: ${mdPath}`);
    console.error(`  请在 content/ 目录下创建 ${SLUG}.md`);
    process.exit(1);
  }

  // 确保输出目录
  mkdirSync(OUT_DIR, { recursive: true });

  // 1) 解析分镜稿
  console.log("\n[1/5] 解析分镜稿 → src/case.generated.ts ...");
  execSync(`${NODE} scripts/case-ingest.mjs "${SLUG}"`, {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 2) B-roll 素材下载
  if (DO_BROLL) {
    console.log("\n[2/5] 下载 B-roll 素材（Pexels）...");
    execSync(`${NODE} scripts/case-broll.mjs "${SLUG}"`, {
      cwd: ROOT,
      stdio: "inherit",
    });
  } else {
    console.log("\n[2/5] 跳过 B-roll 下载（--no-broll）");
  }

  // 3) 配音 + 时间轴
  if (DO_TTS) {
    console.log("\n[3/5] 生成配音 + 字幕时间轴 ...");
    execSync(`${NODE} scripts/case-tts.mjs "${SLUG}"`, {
      cwd: ROOT,
      stdio: "inherit",
    });
  } else {
    console.log("\n[3/5] 跳过配音（--no-tts），沿用现有时间轴");
  }

  // 4) 渲染
  console.log(`\n[4/5] 渲染成片 → ${OUT} ...`);
  execSync(`${NODE} scripts/case-render.mjs CaseEpisode "${OUT}"`, {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 5) 抽封面
  if (DO_COVER) {
    console.log(`\n[5/5] 抽封面帧（frame=${COVER_FRAME}）→ ${COVER} ...`);
    const ffmpeg = findFfmpeg();
    if (!ffmpeg) {
      console.warn("  ⚠️ 未找到 ffmpeg，跳过封面抽取");
    } else {
      try {
        execFileSync(ffmpeg, [
          "-y", "-loglevel", "error",
          "-i", OUT,
          "-vf", `select=eq(n\\,${COVER_FRAME})`,
          "-vframes", "1",
          COVER,
        ]);
        console.log("  ✅ 封面已生成");
      } catch (err) {
        console.warn(`  ⚠️ 封面抽取出错: ${err.message}`);
      }
    }
  } else {
    console.log("\n[5/5] 跳过封面（--no-cover）");
  }

  // ---- 完成 ----
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n════════════════════════════════════════════");
  console.log("  完成 ✅");
  if (existsSync(OUT)) {
    const size = (statSync(OUT).size / 1024 / 1024).toFixed(1);
    console.log(`  ${OUT}  — ${size}MB`);
  }
  if (DO_COVER && existsSync(COVER)) {
    const size = (statSync(COVER).size / 1024).toFixed(0);
    console.log(`  ${COVER}  — ${size}KB`);
  }
  console.log("  耗时: " + elapsed + "s");
  console.log("  提示: 改 content/" + SLUG + ".md 换稿子后，再跑本脚本即可出新片。");
  console.log("════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});