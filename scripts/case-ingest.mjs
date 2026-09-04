#!/usr/bin/env node
/**
 * case-ingest.mjs —— 把一期「分镜稿 markdown」解析成 Remotion 可读的数据文件。
 *
 * 用法（项目根目录）：
 *   node scripts/case-ingest.mjs energy-case-01
 *     => 读取 content/energy-case-01.md
 *     => 生成 src/case.generated.ts（结构化的 SHOTS 数组，渲染 + 配音共用）
 *
 * 设计动机：
 *   案例引擎：分镜稿驱动，无需改代码。
 *   这里把「一期内容」抽成 content/<slug>.md —— 你只写稿子，引擎读稿出数据。
 *   渲染阶段（bundle 内）无法读磁盘文件，所以 ingest 先把 md 转成一份
 *   TS 数据文件，Remotion import 它即可。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const slug = process.argv[2];
if (!slug) {
  console.error("用法: node scripts/case-ingest.mjs <slug>  (如 energy-case-01)");
  process.exit(1);
}

const mdPath = join(ROOT, "content", `${slug}.md`);
let raw;
try {
  raw = readFileSync(mdPath, "utf8");
} catch {
  console.error(`找不到 ${mdPath}`);
  process.exit(1);
}

// ---- 迷你解析器：## 卡型 开块，块内 `字段: 值` ----
// 注释（# 开头行）、空行、块结束被忽略。同一字段重复出现 → 收集成数组。
const shots = [];
let current = null; // { type, fields: { key: string|string[] } }
let metaPend = null; // 捕获 ## meta 块，不入 shots
let meta = { title: "", theme: "energy", voice: "" };

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  const heading = trimmed.match(/^##\s+([A-Za-z_]+)\s*$/);
  if (heading) {
    if (current && current.type !== "meta") shots.push(current);
    current = { type: heading[1], fields: {} };
    if (heading[1] === "meta") metaPend = current;
    continue;
  }
  // 跳过注释、空行、以及非 k:v 行
  if (trimmed.startsWith("#") || trimmed === "") continue;
  const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
  if (!kv) continue;
  const key = kv[1];
  const val = kv[2];
  if (!current) {
    // 文件头（无 ##）直接出现的 meta 字段
    if (key === "theme" || key === "voice" || key === "title") meta[key] = val;
    continue;
  }
  const existing = current.fields[key];
  if (existing === undefined) current.fields[key] = val;
  else if (Array.isArray(existing)) existing.push(val);
  else current.fields[key] = [existing, val];
}
if (current && current.type !== "meta") shots.push(current);

// 合并 ## meta 块字段
if (metaPend) {
  for (const [k, v] of Object.entries(metaPend.fields)) {
    if (k === "theme" || k === "voice" || k === "title") meta[k] = String(v);
  }
}

// meta 里的 title 若写在 ## 前可能已被吞；取第一个 head 卡兜底
const firstHead = shots.find((s) => s.type === "head");
const title =
  meta.title ||
  (firstHead && firstHead.fields.title) ||
  slug;
const effectiveMeta = { ...meta, title };
effectiveMeta.theme = meta.theme || "energy";
effectiveMeta.voice = meta.voice || "";

if (shots.length === 0) {
  console.error(`「${mdPath}」里没有任何 ## 卡块`);
  process.exit(1);
}

// ---- 写 src/case.generated.ts ----
const serialize = (v) => JSON.stringify(v);
const content = `// 由 scripts/case-ingest.mjs 自动生成 —— 不要手改。
// 改稿子请编辑 content/${slug}.md，然后重跑：
//   node scripts/case-ingest.mjs ${slug}
export const CASE_SLUG = ${serialize(slug)};
export const CASE_META = ${serialize(effectiveMeta)};
export type CaseShot = {
  type: string;
  fields: Record<string, string | string[] | undefined>;
};
export const CASE_SHOTS: CaseShot[] = ${serialize(shots)};
`;

const outPath = join(ROOT, "src", "case.generated.ts");
writeFileSync(outPath, content);

// 打印摘要
console.log(`✔ 解析 ${mdPath.replace(ROOT + "/", "")}`);
console.log(`  标题: ${effectiveMeta.title}  |  题材: ${effectiveMeta.theme}`);
console.log(`  ${shots.length} 镜:`);
for (const s of shots) {
  const extra =
    (s.fields.kicker || s.fields.subtitle || s.fields.title || s.fields.slogan) ?? "";
  const captions = s.fields.caption;
  const capStr = captions ? `  台词: ${String(captions)}` : "  (静音)";
  console.log(`   - [${s.type}] ${extra}${capStr}`);
}
console.log(`✔ 已写入 src/case.generated.ts`);
