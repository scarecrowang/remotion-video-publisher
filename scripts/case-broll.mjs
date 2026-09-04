#!/usr/bin/env node
/**
 * case-broll.mjs —— 从分镜稿的 broll 字段自动下载 Pexels 竖屏视频素材。
 *
 * 用法（项目根目录）：
 *   node scripts/case-broll.mjs energy-case-qingyuan
 *     => 读取 content/energy-case-qingyuan.md
 *     => 提取每镜的 broll 关键词
 *     => 搜索 Pexels 竖屏视频，下载到 public/broll/<slug>_<index>.mp4
 *
 * 依赖：PEXELS_API_KEY 在 .env 中
 * 失败时静默跳过（不影响渲染，只是降级为纯信息卡背景）。
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public", "broll");

// 简单 .env 解析
const ENV = (() => {
  const p = {};
  try {
    for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) p[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* 无 .env 文件 */ }
  return p;
})();

const KEY = process.env.PEXELS_API_KEY ?? ENV.PEXELS_API_KEY ?? "";
if (!KEY) {
  console.error("缺少 PEXELS_API_KEY（在 .env 中配置）");
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  console.error("用法: node scripts/case-broll.mjs <slug>");
  process.exit(1);
}

// ---- 解析分镜稿，提取 broll 字段 ----
const mdPath = join(ROOT, "content", `${slug}.md`);
let raw;
try {
  raw = readFileSync(mdPath, "utf8");
} catch {
  console.error(`找不到 ${mdPath}，请先写分镜稿`);
  process.exit(1);
}

// 逐块解析：找到 ## 开头的块，在块内找 broll: 行
const brollQueries = []; // [{ index, query }]
let currentType = null;
let currentBroll = null;
let shotIndex = -1; // 镜序（跳过 meta 块）

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  const heading = trimmed.match(/^##\s+([A-Za-z_]+)\s*$/);
  if (heading) {
    // 保存上一块
    if (currentType && currentType !== "meta" && currentBroll) {
      brollQueries.push({ index: shotIndex, query: currentBroll });
    }
    currentType = heading[1];
    currentBroll = null;
    if (currentType !== "meta") shotIndex++;
    continue;
  }
  const kv = trimmed.match(/^broll:\s*(.*)$/i);
  if (kv && currentType !== "meta") {
    currentBroll = kv[1].trim();
  }
}
// 文件末尾的块
if (currentType && currentType !== "meta" && currentBroll) {
  brollQueries.push({ index: shotIndex, query: currentBroll });
}

if (brollQueries.length === 0) {
  console.log("分镜稿中没有 broll 字段，跳过下载");
  process.exit(0);
}

console.log(`分镜稿中 ${brollQueries.length} 镜有 B-roll 需求`);
await mkdir(OUT_DIR, { recursive: true });

// ---- 从 Pexels 搜索竖屏视频 ----
const slugName = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function searchVideo(query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text()}`);
  return res.json();
}

function pickBestFile(video) {
  const files = video.video_files ?? [];
  const scored = files
    .map((f) => {
      const w = f.width ?? 0;
      const h = f.height ?? 0;
      const isPortrait = h > w;
      const closeness = w >= 1080 ? 1 : w / 1080;
      // 同时偏好较高分辨率
      const quality = Math.min(w * h, 1920 * 1080) / (1920 * 1080);
      return { f, score: (isPortrait ? 1000 : 0) + closeness * 100 + quality * 50 };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.f;
}

let successCount = 0;
let skipCount = 0;
let failCount = 0;

for (const { index, query } of brollQueries) {
  const name = `${slug}_${index}.mp4`;
  const dest = join(OUT_DIR, name);

  if (existsSync(dest)) {
    console.log(`  · 跳过已存在: ${name}`);
    skipCount++;
    continue;
  }

  let data;
  try {
    data = await searchVideo(query);
  } catch (e) {
    console.warn(`  ✗ [${index}] 搜索失败 "${query}": ${e.message}`);
    failCount++;
    continue;
  }

  const video = data.videos?.[0];
  if (!video) {
    console.warn(`  ✗ [${index}] 无搜索结果 "${query}"`);
    failCount++;
    continue;
  }

  const file = pickBestFile(video);
  if (!file?.link) {
    console.warn(`  ✗ [${index}] 无可下载文件 "${query}"`);
    failCount++;
    continue;
  }

  try {
    const res = await fetch(file.link);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    const mb = (buf.length / 1024 / 1024).toFixed(1);
    console.log(`  ✓ [${index}] "${query}" → broll/${name} (${mb}MB, ${file.width}×${file.height})`);
    successCount++;
  } catch (e) {
    console.warn(`  ✗ [${index}] 下载失败 "${query}": ${e.message}`);
    failCount++;
  }

  // Pexels API 限流：每查询间隔 500ms
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\n完成：${successCount} 成功 / ${skipCount} 跳过 / ${failCount} 失败`);
if (failCount > 0) {
  console.log("（失败镜会降级为纯信息卡背景，不影响渲染）");
}