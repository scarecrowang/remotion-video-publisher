// 用真实 MOSS-TTS-Nano 服务合成分句，验证不同 demo_id 音色效果
// 用法: node test-moss-voice.mjs [demo_id...]
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const BASE = process.env.MOSS_TTS_BASE_URL || "http://127.0.0.1:18083";
const OUT = "/Users/wanghongpeng/Personal/Demo/remotion-video-publisher/out/moss-voice-samples";
mkdirSync(OUT, { recursive: true });

// 讲课/纪录片风格的例句
const TEXT =
  "在中国人的时间观念里，春生、夏长、秋收、冬藏，年复一年，周而复始。时间不是被消耗的，而是被等待和积累的。";

const demoIds = process.argv.slice(2).length ? process.argv.slice(2) : ["demo-5", "demo-2"];

const pollResult = async (streamId, deadline = Date.now() + 100000) => {
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/api/generate-stream/${streamId}/result`);
    if (res.status === 200) return res.json();
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`poll timeout for ${streamId}`);
};

const synth = async (demoId) => {
  const form = new FormData();
  form.append("text", TEXT);
  form.append("demo_id", demoId);
  form.append("max_new_frames", "375");
  form.append("seed", "0");
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/generate-stream/start`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`start ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const { stream_id } = await res.json();
  const result = await pollResult(stream_id);
  if (!result.audio_base64) throw new Error("no audio_base64");
  // 裸 PCM → wav
  const raw = Buffer.from(result.audio_base64, "base64");
  const sr = result.sample_rate || 48000;
  const ch = result.channels || 2;
  const pcmPath = join(OUT, `__raw_${demoId}.pcm`);
  const wavPath = join(OUT, `${demoId}.wav`);
  writeFileSync(pcmPath, raw);
  execSync(`ffmpeg -y -f s16le -ar ${sr} -ac ${ch} -i "${pcmPath}" -ar 44100 -ac 1 "${wavPath}" 2>/dev/null`, { stdio: "ignore" });
  const dur = await new Promise((resolve) => {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${wavPath}"`, { encoding: "utf8" });
    resolve(parseFloat(out.trim()));
  });
  console.log(`✅ ${demoId} → ${dur.toFixed(2)}s (${Date.now() - t0}ms) → ${wavPath}`);
  return wavPath;
};

const main = async () => {
  console.log(`真实 MOSS: ${BASE}`);
  for (const id of demoIds) {
    try {
      await synth(id);
    } catch (e) {
      console.error(`❌ ${id}: ${e.message}`);
    }
  }
  console.log(`\n输出目录: ${OUT}`);
};

main().catch((e) => { console.error(e); process.exit(1); });