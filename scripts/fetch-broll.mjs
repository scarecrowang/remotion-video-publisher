#!/usr/bin/env node
// 从 Pexels 搜索并下载竖屏 B-roll 素材到 public/broll/
//
// 用法：
//   1. 复制 .env.example 为 .env，填入你的 PEXELS_API_KEY
//   2. node scripts/fetch-broll.mjs "咖啡馆" "城市夜景" "雨天"
//      或从 script.ts 各段的 brollQuery 字段读，按 --from-script 模式
//
// 依赖：Node 22+（用全局 fetch），无需装包

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "broll");

// 简易 .env 解析：KEY=VALUE 行，忽略注释和空行
async function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

await loadEnv();

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) {
  console.error(
    "缺少 PEXELS_API_KEY。\n" +
      "  1. 复制 .env.example 为 .env\n" +
      "  2. 在 .env 里填入 https://www.pexels.com/api/ 申请的 key\n" +
      "  3. 重跑此脚本",
  );
  process.exit(1);
}

const queries = process.argv.slice(2);
if (queries.length === 0) {
  console.error(
    "用法: node scripts/fetch-broll.mjs \"关键词1\" \"关键词2\" ...\n" +
      "示例: node scripts/fetch-broll.mjs \"咖啡馆\" \"城市夜景\" \"雨天\"",
  );
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function search(q) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=5&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text()}`);
  return res.json();
}

// 选最合适的文件：竖屏 + 接近 1080×1920 优先
function pickFile(video) {
  const files = video.video_files ?? [];
  const scored = files
    .map((f) => {
      const w = f.width ?? 0;
      const h = f.height ?? 0;
      const isPortrait = h > w;
      const closeness = w >= 1080 ? 1 : w / 1080;
      return { f, score: (isPortrait ? 1000 : 0) + closeness * 100 };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.f;
}

const manifest = {};
const existing = existsSync(path.join(OUT_DIR, "manifest.json"))
  ? JSON.parse(await readFile(path.join(OUT_DIR, "manifest.json"), "utf8"))
  : {};
Object.assign(manifest, existing);

for (const q of queries) {
  const name = `${slug(q)}.mp4`;
  const dest = path.join(OUT_DIR, name);
  if (existsSync(dest)) {
    console.log(`· 跳过已存在: ${name}`);
    continue;
  }
  let data;
  try {
    data = await search(q);
  } catch (e) {
    console.warn(`✗ 搜索失败 [${q}]: ${e.message}`);
    continue;
  }
  const video = data.videos?.[0];
  if (!video) {
    console.warn(`✗ 无结果: ${q}`);
    continue;
  }
  const file = pickFile(video);
  if (!file) {
    console.warn(`✗ 无可下载文件: ${q}`);
    continue;
  }
  const res = await fetch(file.link);
  if (!res.ok) {
    console.warn(`✗ 下载失败: ${q} (${res.status})`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  manifest[slug(q)] = {
    query: q,
    file: `broll/${name}`,
    pexelsUrl: video.url,
    sizeBytes: buf.length,
    width: file.width,
    height: file.height,
  };
  console.log(
    `✓ ${q} -> broll/${name} (${(buf.length / 1024 / 1024).toFixed(1)} MB, ${file.width}×${file.height})`,
  );
}

await writeFile(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(`\nmanifest: public/broll/manifest.json (${Object.keys(manifest).length} 条)`);
console.log(
  "接下来：把 file 字段路径（如 'broll/coffee-shop.mp4'）填到 src/script.ts 各段的 broll 字段。",
);
