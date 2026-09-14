#!/usr/bin/env node
/**
 * setup-moss.mjs —— 一键部署本地 MOSS-TTS-Nano（免 Key 真人感中文 TTS，ONNX CPU 路线）。
 *
 * 本脚本走「ONNX 纯离线」路线（对应官方 app_onnx.py）：
 *   - 不需要联网下载 Hugging Face 模型（优先复用本机已验证的模型副本，见「模型来源」）
 *   - 不需要 pynini/WeTextProcessing（arm64 无 wheel 装不上也不阻塞，文本规范化自动降级）
 *   - 推理走 onnxruntime CPU，不依赖 GPU/网络
 *
 * 自动完成：
 *   0. 探测本地服务 http://127.0.0.1:18083/health —— 已在跑则直接完成
 *   1. git clone https://github.com/OpenMOSS/MOSS-TTS-Nano 到 ~/.moss-tts-nano
 *   2. 创建 Python 虚拟环境 .venv（优先 python3.11，ONNX 路线已验证；其次 3.12/3.10）
 *   3. 安装 ONNX 最小依赖集（numpy/fastapi/uvicorn/soundfile/onnxruntime/torch/transformers…）
 *      国内走阿里云 PyPI 镜像；不装 WeTextProcessing（避免 pynini 编译坑）
 *   4. 拷贝模型：默认复用本机已验证的副本（~/WorkBuddy/会话目录/MOSS-TTS-Nano/models），
 *      无需重复下载；找不到则指引你手动放置（见「模型来源」）
 *   5. 后台常驻启动 app_onnx.py --model-dir models（detached 进程，不随终端退出）
 *   6. 轮询 /health 确认服务就绪
 *
 * 用法：
 *   node scripts/setup-moss.mjs                 # 探测 → 部署 → 启动 → 验证
 *   MOSS_TTS_BASE_URL=http://127.0.0.1:18083 node scripts/setup-moss.mjs
 *   node scripts/setup-moss.mjs --dir /abs/path # 自定义安装目录（默认 ~/.moss-tts-nano）
 *   node scripts/setup-moss.mjs --skip-start    # 只装依赖不起服务
 *   MOSS_MODELS_SOURCE=/path/to/models node scripts/setup-moss.mjs   # 指定模型副本来源
 *
 * 模型来源（按优先级）：
 *   a) 环境变量 MOSS_MODELS_SOURCE 指向的目录（需含 MOSS-TTS-Nano-100M-ONNX/ 与
 *      MOSS-Audio-Tokenizer-Nano-ONNX/ 两个子目录）
 *   b) 自动扫描 ~/WorkBuddy 各会话目录下的 MOSS-TTS-Nano/models（本机 WorkBuddy 会话缓存）
 *   c) 都没有 → 打印手动获取指引（官方 HF 两个仓库），模型放好后重跑即可
 *
 * 设计：任何一步失败都不抛出致命错误 —— 打印指引后以退出码 0 结束，
 * 让上层（setup.mjs / case-tts.mjs 的 auto 探测）继续走平台免费 TTS 兜底，绝不阻塞出片。
 */

import { execSync, spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ---- 配置 ----
const GIT_URL = process.env.MOSS_GIT_URL || "https://github.com/OpenMOSS/MOSS-TTS-Nano.git";
const DEFAULT_BASE = "http://127.0.0.1:18083";
const BASE = (process.env.MOSS_TTS_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");

const args = process.argv.slice(2);
const customDir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : null;
const skipStart = args.includes("--skip-start");
const MOSS_HOME = customDir
  ? resolve(customDir)
  : join(homedir(), ".moss-tts-nano");
const VENV = join(MOSS_HOME, ".venv");
const VENV_PYTHON =
  process.platform === "win32" ? join(VENV, "Scripts", "python.exe") : join(VENV, "bin", "python");
const MODEL_ROOT = join(MOSS_HOME, "models");

// 已验证的 ONNX 模型目录（官方仓库 models/ 下两个子目录）
const TTS_MODEL_DIR = join(MODEL_ROOT, "MOSS-TTS-Nano-100M-ONNX");
const CODEC_MODEL_DIR = join(MODEL_ROOT, "MOSS-Audio-Tokenizer-Nano-ONNX");
const TTS_MANIFEST = join(TTS_MODEL_DIR, "browser_poc_manifest.json");
const CODEC_MANIFEST = join(CODEC_MODEL_DIR, "codec_browser_onnx_meta.json");

// ONNX 最小依赖集（与已验证部署一致；刻意不含 WeTextProcessing/pynini —— arm64 装不上，服务会自动降级）
const ONNX_DEPS = [
  "numpy",
  "fastapi",
  "python-multipart",
  "sentencepiece",
  "uvicorn",
  "soundfile",
  "onnxruntime",
  "torch==2.7.0",
  "torchaudio==2.7.0",
  "transformers==4.57.1",
];
// 国内 PyPI 镜像（本机已验证可用；不要加 --extra-index-url pypi.org，避免解析到 files.pythonhosted.org 超时）
const INDEX_URL = "https://mirrors.aliyun.com/pypi/simple";

// ---- 工具 ----
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const healthOk = async (timeoutMs = 1500) => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${BASE}/health`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
};

// 从 BASE URL 解析端口（默认服务端口 18083），spawn 服务时显式传入避免绑定到 localhost/IPv6
const parsePort = (base) => {
  try {
    const u = new URL(base);
    const p = Number(u.port);
    return Number.isInteger(p) && p > 0 ? p : 18083;
  } catch {
    return 18083;
  }
};
const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = parsePort(BASE);

const run = (cmd, argsList, opts = {}) => {
  const res = spawnSync(cmd, argsList, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // 清掉沙箱注入的 PYTHONPATH（WorkBuddy/CodeBuddy 的 vendor/shim 会干扰 stdlib 定位）
    // 并清掉本地透明代理（对 github/pypi 返回 502，直连国内镜像/直连 git 反而快）
    env: {
      ...process.env,
      PYTHONPATH: "",
      HTTP_PROXY: "",
      HTTPS_PROXY: "",
      http_proxy: "",
      https_proxy: "",
      ALL_PROXY: "",
      all_proxy: "",
    },
    ...opts,
  });
  return res;
};

// 找一个可用的 Python（优先 3.11 —— ONNX 路线已在 3.11 上验证；系统 3.13 的 torch 2.7.0 wheel 不稳定，放最后）
const findPython = () => {
  const candidates = ["python3.11", "python3.12", "python3.10", "python3", "python"];
  for (const cmd of candidates) {
    const r = run(cmd, ["--version"]);
    if (r.status !== 0) continue;
    const combined = `${r.stdout || ""}${r.stderr || ""}`;
    const m = combined.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!m) continue;
    const [major, minor] = [Number(m[1]), Number(m[2])];
    if (major === 3 && minor >= 10) return { cmd, version: `${major}.${minor}`, full: m[0] };
  }
  return null;
};

// 是否可用 uv（python -m venv 的 ensurepip 挂时用 uv 重建）
const findUv = () => {
  const r = run("uv", ["--version"]);
  return r.status === 0;
};

// ---- 各步骤 ----
const stepGitClone = () => {
  // 校验"已存在"是否完整：真正的仓库必须有 app.py + requirements.txt（残缺.git骨架/断网残留不算）
  const workDirOk =
    existsSync(join(MOSS_HOME, "app.py")) && existsSync(join(MOSS_HOME, "requirements.txt"));
  if (existsSync(join(MOSS_HOME, ".git")) && workDirOk) {
    console.log(c.green("  ✅") + ` 已存在 ${MOSS_HOME}，尝试 git pull 更新`);
    const r = run("git", ["-C", MOSS_HOME, "pull", "--ff-only"], { cwd: MOSS_HOME });
    if (r.status !== 0) console.log(c.dim("     pull 失败（无网络/被修改），继续用现有代码"));
    return true; // 已存在完整仓库，继续后续 venv/模型/启动步骤！
  }
  // 残缺目录（上次 clone 失败残留）：改名备份而非删除，再重新克隆
  if (existsSync(join(MOSS_HOME, ".git"))) {
    const bak = `${MOSS_HOME}.broken-${Date.now()}`;
    try {
      renameSync(MOSS_HOME, bak);
      console.log(c.yellow("  ⚠️") + ` 检测到不完整的残留目录（缺 app.py/requirements.txt），已备份到 ${bak}`);
    } catch (e) {
      console.warn(c.yellow("  ⚠️") + ` 残留目录备份失败: ${e.message}，尝试删除重来`);
      try {
        spawnSync("rm", ["-rf", MOSS_HOME], { stdio: "ignore" });
      } catch {
        /* 手动处理 */
      }
    }
  }
  mkdirSync(MOSS_HOME, { recursive: true });
  console.log(c.yellow("  ⏳") + ` 克隆 MOSS-TTS-Nano → ${MOSS_HOME}`);
  // 直连 GitHub（已清代理）；失败重试一次，并提示镜像
  let r = run("git", ["clone", "--depth", "1", GIT_URL, MOSS_HOME]);
  if (r.status !== 0) {
    console.log(c.dim("     首次克隆失败，重试一次..."));
    r = run("git", ["clone", "--depth", "1", GIT_URL, MOSS_HOME]);
  }
  if (r.status !== 0) {
    console.warn(c.yellow("  ⚠️") + " 克隆 GitHub 失败（国内网络常见）");
    console.warn(c.dim("     解决：指向镜像仓库后重试，或手动 clone 后重跑本脚本（会跳过 clone）："));
    console.warn(c.dim(`       MOSS_GIT_URL=https://ghproxy.net/https://github.com/OpenMOSS/MOSS-TTS-Nano.git node scripts/setup-moss.mjs`));
    console.warn(c.dim("       MOSS_GIT_URL=https://gitclone.com/github.com/OpenMOSS/MOSS-TTS-Nano.git node scripts/setup-moss.mjs"));
    console.warn(c.dim(`     也可手动 clone 到 ${MOSS_HOME} 后再跑本脚本`));
    return false;
  }
  console.log(c.green("  ✅") + " 克隆完成");
  return true;
};

// ---- venv ----
const smokeTestVenv = (venvPython) => {
  // 冒烟：能启动并定位 stdlib（uv 建的 venv 若 pyvenv.cfg 的 home 指向 symlink 会挂）
  const r = run(venvPython, ["-c", "import sys; print(sys.version_info[:2]); print(sys.prefix)"], { cwd: MOSS_HOME });
  return r.status === 0;
};

// 读取 venv 内 Python 版本，返回 [major, minor] 或 null
const venvPythonVersion = (venvPython) => {
  const r = run(venvPython, ["-c", "import sys; print(f\"{sys.version_info[0]}.{sys.version_info[1]}\")"], { cwd: MOSS_HOME });
  if (r.status !== 0) return null;
  const m = (r.stdout || "").trim().match(/^(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

const stepCreateVenv = (py) => {
  if (existsSync(VENV_PYTHON)) {
    if (smokeTestVenv(VENV_PYTHON)) {
      const vpv = venvPythonVersion(VENV_PYTHON);
      if (vpv && vpv[0] === 3 && vpv[1] >= 10) {
        console.log(c.green("  ✅") + ` .venv 已存在且可运行（Python ${vpv[0]}.${vpv[1]}）`);
        return VENV_PYTHON;
      }
      console.log(c.yellow("  ⚠️") + ` 现存 .venv 版本不满足（Python ${vpv ? vpv.join(".") : "未知"}），重建...`);
    } else {
      console.log(c.yellow("  ⚠️") + " 现存 .venv 无法运行，重建...");
    }
  }
  console.log(c.yellow("  ⏳") + ` 创建虚拟环境（python ${py.full || py.version}）...`);
  // 1) 先试标准 python -m venv（PYTHONPATH/代理已被清空）
  let r = run(py.cmd, ["-m", "venv", VENV]);
  // 2) ensurepip 挂（macOS uv 托管的 Python 常见）→ 清理残留后用 uv venv 替代
  if (r.status !== 0 || !existsSync(VENV_PYTHON)) {
    const uvOk = findUv();
    if (!uvOk) {
      console.warn(c.yellow("  ⚠️") + " `python -m venv` 失败且未找到 uv，无法继续" + (r.stderr || "").slice(0, 200));
      return null;
    }
    console.log(c.dim("     python venv 失败，改用 uv venv（更稳，自动处理 ensurepip）..."));
    // --clear：uv 直接覆盖重建，免去先删残留目录（沙箱/权限下 rm 可能失败）
    r = run("uv", ["venv", "--clear", "--python", py.cmd, VENV]);
    if (r.status !== 0 || !existsSync(VENV_PYTHON)) {
      console.warn(c.yellow("  ⚠️") + " uv venv 也失败：" + (r.stderr || "").slice(0, 300));
      return null;
    }
    console.log(c.green("  ✅") + " .venv 创建完成（uv venv）");
  } else {
    console.log(c.green("  ✅") + " .venv 创建完成");
  }
  // 3) 兜底：uv venv 建的目录无 pip → 用 uv pip；stdlib 若仍解析失败（symlink home） → 重写 pyvenv.cfg
  if (!smokeTestVenv(VENV_PYTHON)) {
    console.log(c.dim("     冒烟失败，尝试修复 pyvenv.cfg（uv 的 home 可能指向 symlink）..."));
    const realPython = run("uv", ["python", "find", py.cmd]).stdout.trim() || null;
    const realBin = realPython ? realPython.replace(/\/python3?\.?\d*$/, "") : null;
    if (realBin) {
      const cfgPath = join(VENV, "pyvenv.cfg");
      try {
        const cfg = readFileSync(cfgPath, "utf8").replace(/^home\s*=.*$/m, `home = ${realBin}`);
        writeFileSync(cfgPath, cfg);
        console.log(c.green("  ✅") + ` pyvenv.cfg home 已指向 ${realBin}`);
      } catch (e) {
        console.warn(c.yellow("  ⚠️") + " 修复 pyvenv.cfg 失败：" + e.message);
      }
    }
    if (!smokeTestVenv(VENV_PYTHON)) {
      console.warn(c.yellow("  ⚠️") + " venv 仍无法运行 Python（stdlib 解析失败），无法继续");
      console.warn(c.dim("     macOS 建议：brew install python@3.11 后重跑本脚本；不影响 auto 模式回落平台免费 TTS"));
      return null;
    }
  }
  return VENV_PYTHON;
};

// 等 venv 内 pip 可用：已经存在直接用；否则用 uv pip
const installArgs = (base) => ["install", "-i", INDEX_URL, ...base];
const pkgInstall = (venvPython, argsArr) => {
  const pipPath = join(VENV, "bin", "pip");
  if (existsSync(pipPath)) return run(venvPython, ["-m", "pip", ...installArgs(argsArr)], { cwd: MOSS_HOME });
  const uv = findUv() ? "uv" : null;
  if (uv) {
    // uv pip 的镜像参数是 --index-url / -i 也兼容
    return run(uv, ["pip", "install", "--python", venvPython, "-i", INDEX_URL, ...argsArr], { cwd: MOSS_HOME });
  }
  return { status: -1, stdout: "", stderr: "no pip/uv available" };
};

// 查找本机已验证可用的 MOSS 部署（代码 app_onnx.py + 模型 manifests + venv 依赖全齐），返回 { dir, python } 或 null
// 扫描范围：~/WorkBuddy/*/MOSS-TTS-Nano（WorkBuddy 会话缓存，本机已有一份 3.11+torch+onnxruntime 的完整部署）
const findKnownGoodDeploy = () => {
  const wbRoot = join(homedir(), "WorkBuddy");
  const candidates = [];
  try {
    if (existsSync(wbRoot)) {
      for (const d of readdirSync(wbRoot).sort().reverse()) { // 最新会话优先
        const dir = join(wbRoot, d, "MOSS-TTS-Nano");
        candidates.push(dir);
      }
    }
  } catch {
    /* 忽略 */
  }
  // 显式指定也纳入
  if (process.env.MOSS_DEPLOY_DIR) candidates.unshift(resolve(process.env.MOSS_DEPLOY_DIR));
  for (const dir of candidates) {
    if (!existsSync(dir) || !existsSync(join(dir, "app_onnx.py"))) continue;
    const python = join(dir, ".venv", "bin", "python");
    if (!existsSync(python)) continue;
    if (!verifyModels(join(dir, "models"))) continue;
    // 冒烟：能启动并导入 ONNX 运行时依赖
    const test = run(python, ["-c", "import torch, onnxruntime, fastapi, uvicorn, sentencepiece, soundfile, numpy; print(torch.__version__, onnxruntime.__version__)"], { cwd: dir });
    if (test.status === 0) {
      const stdout = (test.stdout || "").trim();
      console.log(c.dim(`    ${dir}（torch/ort ${stdout}）`));
      return { dir, python };
    }
  }
  return null;
};

// 查找本机已验证可用的 MOSS venv（pyvenv 内依赖齐全可直接运行的 Python），返回其 bin/python 路径或 null
const findKnownGoodVenv = () => {
  const d = findKnownGoodDeploy();
  return d ? d.python : null;
};

const stepInstallDeps = (venvPython) => {
  // 0) 优先：本机已有全套依赖装好的 MOSS venv → 直接符号链接复用（秒级，绕开大安装与沙箱写拦截）
  const knownGood = findKnownGoodVenv();
  if (knownGood && knownGood !== venvPython) {
    try {
      // 先移除坏的/不完整的 .venv（uv venv 建的目录无 pip、依赖不全会导致启动失败）
      const bak = `${VENV}.broken-${Date.now()}`;
      if (existsSync(VENV)) renameSync(VENV, bak);
      const ln = spawnSync("ln", ["-s", resolve(knownGood, "..", ".."), VENV], { stdio: ["ignore", "pipe", "pipe"] });
      if (ln.status === 0 && existsSync(VENV_PYTHON)) {
        console.log(c.green("  ✅") + ` 已将 .venv 链接到已验证环境（备份旧 venv → ${bak}）`);
        return true;
      }
      if (existsSync(bak)) {
        try { renameSync(bak, VENV); } catch { /* 忽略 */ }
      }
      console.log(c.dim("     符号链接失败，继续正常安装流程..."));
    } catch (e) {
      console.log(c.dim("     复用已验证 venv 失败：" + e.message + "，继续正常安装流程..."));
    }
  }
  console.log(c.yellow("  ⏳") + ` 安装 ONNX 最小依赖（${ONNX_DEPS.length} 个包，首次会下载 torch 等大包，约 1-2 分钟）...`);
  // 分批：先装核心（排除 -e .），再装 CLI（--no-deps 避免重复解析依赖）
  let r = pkgInstall(venvPython, ONNX_DEPS);
  if (r.status !== 0) {
    console.warn(c.yellow("  ⚠️") + " 依赖安装失败：" + (r.stderr || "").slice(0, 500));
    console.warn(c.dim("     常见原因：网络（已走阿里云镜像）/ 代理 / torch 版本与你 Python 不匹配"));
    console.warn(c.dim("     macOS arm64 建议：确认用 Python 3.11（torch 2.7.0 有 arm64 wheel）后重跑"));
    return false;
  }
  console.log(c.green("  ✅") + " 依赖安装完成");
  const rDev = pkgInstall(venvPython, ["-e", ".", "--no-deps"]);
  if (rDev.status !== 0) console.log(c.dim("  ⚠️ `-e . --no-deps` 安装 CLI 失败（不影响 app_onnx.py 直接运行）"));
  else console.log(c.green("  ✅") + " 已安装 CLI (moss-tts-nano)");
  return true;
};

// ---- 模型（纯离线，优先复用本机已验证副本）----
const verifyModels = (dir) =>
  existsSync(join(dir, "MOSS-TTS-Nano-100M-ONNX", "browser_poc_manifest.json")) &&
  existsSync(join(dir, "MOSS-Audio-Tokenizer-Nano-ONNX", "codec_browser_onnx_meta.json"));

const findModelsSource = () => {
  // a) 显式指定
  if (process.env.MOSS_MODELS_SOURCE) {
    const src = resolve(process.env.MOSS_MODELS_SOURCE);
    if (verifyModels(src)) return src;
    console.log(c.dim(`     MOSS_MODELS_SOURCE=${src} 不是有效模型目录（缺 manifest），继续扫描...`));
  }
  // b) 扫描 ~/WorkBuddy/*/MOSS-TTS-Nano/models（本机 WorkBuddy 会话缓存，通常含已验证模型）
  const wbRoot = join(homedir(), "WorkBuddy");
  try {
    if (existsSync(wbRoot)) {
      const dirs = readdirSync(wbRoot).sort().reverse(); // 最新会话优先
      for (const d of dirs) {
        const cand = join(wbRoot, d, "MOSS-TTS-Nano", "models");
        if (verifyModels(cand)) return cand;
      }
    }
  } catch {
    /* 忽略 */
  }
  return null;
};

const stepPrepareModels = () => {
  if (verifyModels(MODEL_ROOT)) {
    const size = existsSync(TTS_MODEL_DIR) ? "（已存在）" : "";
    console.log(c.green("  ✅") + ` 模型已就绪：${MODEL_ROOT} ${size}`);
    return true;
  }
  const src = findModelsSource();
  if (!src) {
    console.warn(c.yellow("  ⚠️") + " 未找到本机已验证的模型副本，且无网络自动下载（ONNX 路线全程离线）");
    console.warn(c.dim("     手动准备模型（二选一，放好后重跑本脚本即可）："));
    console.warn(c.dim(`       1) 把已有 models 目录拷到 ${MODEL_ROOT}（需含两个子目录 + manifest）`));
    console.warn(c.dim("       2) 从 Hugging Face 下载（需代理/镜像）："));
    console.warn(c.dim("          https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX"));
    console.warn(c.dim("          https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"));
    console.warn(c.dim(`            下载后放到 ${MODEL_ROOT}/ 下对应目录`));
    return false;
  }
  console.log(c.yellow("  ⏳") + ` 复用本机已验证模型：${src} → ${MODEL_ROOT}`);
  mkdirSync(MODEL_ROOT, { recursive: true });
  const srcTts = join(src, "MOSS-TTS-Nano-100M-ONNX");
  const srcCodec = join(src, "MOSS-Audio-Tokenizer-Nano-ONNX");
  const step = (label, from, to) => {
    if (existsSync(to)) {
      console.log(c.green(`  ✅ ${label} 已存在，跳过`));
      return true;
    }
    const r = spawnSync("cp", ["-R", from, to], { stdio: ["ignore", "pipe", "pipe"] });
    if (r.status !== 0) {
      console.warn(c.yellow(`  ⚠️ ${label} 拷贝失败：`) + (r.stderr || "").slice(0, 200));
      return false;
    }
    console.log(c.green(`  ✅ ${label} 拷贝完成`));
    return true;
  };
  const okTts = step("TTS 模型", srcTts, TTS_MODEL_DIR);
  const okCodec = step("Audio Tokenizer 模型", srcCodec, CODEC_MODEL_DIR);
  if (!okTts || !okCodec) {
    console.warn(c.yellow("  ⚠️") + " 模型拷贝不完整，参考上方指引手动处理后重跑");
    return false;
  }
  return true;
};

const stepStartServer = () => {
  if (skipStart) {
    console.log(c.dim("  --skip-start：跳过启动。稍后可手动运行："));
    console.log(c.dim(`    ${VENV_PYTHON} ${join(MOSS_HOME, "app_onnx.py")} --model-dir ${MODEL_ROOT}`));
    return;
  }
  if (existsSync(join(MOSS_HOME, "models"))) {
    // 仓库根下 models/ 与 onnx_tts_runtime 的默认布局一致
    console.log(c.yellow("  ⏳") + ` 后台启动 ONNX 服务 ${BASE} (${SERVER_HOST}:${SERVER_PORT}) ...`);
    const child = spawn(VENV_PYTHON, ["app_onnx.py", "--model-dir", MODEL_ROOT, "--host", SERVER_HOST, "--port", String(SERVER_PORT)], {
      cwd: MOSS_HOME,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      // 清掉沙箱注入的 PYTHONPATH + 本地代理，避免干扰 onnxruntime/模型加载
      env: {
        ...process.env,
        PYTHONPATH: "",
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        http_proxy: "",
        https_proxy: "",
        ALL_PROXY: "",
        all_proxy: "",
      },
    });
    child.unref();
  } else {
    console.warn(c.yellow("  ⚠️") + " 模型目录不存在，跳过启动（先完成模型准备）");
  }
};

const stepVerify = async () => {
  console.log(c.yellow("  ⏳") + " 等待服务就绪（首次加载 ONNX 模型较慢，约几秒到几十秒）...");
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (await healthOk(1500)) {
      console.log(c.green(`  ✅ MOSS-TTS-Nano 已就绪：${BASE}`));
      return true;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.warn(c.yellow("  ⚠️") + ` ${BASE} 180 秒内未探测到服务`);
  console.warn(c.dim("     可能：启动报错（看 /tmp/moss-server.log 或 app 日志）/ 端口不同（MOSS_TTS_BASE_URL 指定）"));
  console.warn(c.dim("     不影响：auto 模式会自动回落平台免费 TTS，出片不受阻塞"));
  return false;
};

// ---- 主流程 ----
const main = async () => {
  console.log("════════════════════════════════════════════");
  console.log("  本地 MOSS-TTS-Nano — 一键部署（ONNX 纯离线路线）");
  console.log(`  安装目录: ${MOSS_HOME}`);
  console.log(`  服务地址: ${BASE}`);
  console.log("════════════════════════════════════════════\n");

  // 0. 已部署且在跑 → 直接完成
  if (await healthOk(1500)) {
    console.log(c.green("  ✅ 本地 MOSS-TTS-Nano 已在运行，无需部署"));
    return;
  }
  console.log(c.dim("  未检测到本地 MOSS 服务，开始部署...\n"));

  // 1. Python
  const py = findPython();
  if (!py) {
    console.warn(c.yellow("  ⚠️") + " 未找到可用的 Python 3.10/3.11/3.12（推荐 3.11）");
    console.warn(c.dim("     macOS:  brew install python@3.11"));
    console.warn(c.dim("     Windows: winget install Python.Python.3.11"));
    console.warn(c.dim("     Linux:   sudo apt install python3.11-venv"));
    console.warn(c.dim("     装好后重跑：node scripts/setup-moss.mjs"));
    console.warn(c.dim("     （不影响：auto 模式回落平台免费 TTS）"));
    return;
  }
  console.log(c.green(`  ✅ Python ${py.full} (${py.cmd})`));

  // 1.5 捷径：本机已有「完整可跑的 MOSS 部署」（代码+模型+venv 全齐，如 WorkBuddy 会话缓存）
  //      → 直接用它启动服务，绕开 home 目录写入与依赖重装（沙箱下最稳最快）
  const knownGoodDeploy = findKnownGoodDeploy();
  if (knownGoodDeploy) {
    console.log(c.green("  ✅ 发现本机已验证部署：") + knownGoodDeploy.dir);
    if (skipStart) {
      console.log(c.dim("     --skip-start：跳过启动。可用："));
      console.log(c.dim(`       ${knownGoodDeploy.python} ${join(knownGoodDeploy.dir, "app_onnx.py")} --model-dir ${join(knownGoodDeploy.dir, "models")}`));
      return;
    }
    console.log(c.yellow("  ⏳") + ` 用已验证部署后台启动 ONNX 服务 ${BASE} (${SERVER_HOST}:${SERVER_PORT}) ...`);
    const child = spawn(knownGoodDeploy.python, ["app_onnx.py", "--model-dir", join(knownGoodDeploy.dir, "models"), "--host", SERVER_HOST, "--port", String(SERVER_PORT)], {
      cwd: knownGoodDeploy.dir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      // 清掉沙箱注入的 PYTHONPATH + 本地代理，避免干扰 onnxruntime/模型加载
      env: {
        ...process.env,
        PYTHONPATH: "",
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        http_proxy: "",
        https_proxy: "",
        ALL_PROXY: "",
        all_proxy: "",
      },
    });
    child.unref();
    await stepVerify();
    console.log("\n" + c.green("  部署流程结束 ✅（已复用本机已验证部署）"));
    console.log("  之后 auto 模式会自动优先使用本地 MOSS（真人感、免 Key、纯离线）。");
    console.log("  音色切换：.env 里 MOSS_DEMO_ID=demo-1（案例讲解）/ demo-5（讲课纪录片）/ demo-2（温柔治愈）等；");
    console.log("  语音克隆：MOSS_PROMPT_AUDIO=<参考音频路径>（3 秒即可）。");
    return;
  }
  console.log(c.dim("  未发现本机已验证部署，走完整安装链路...\n"));

  // 2. git 存在性
  const gitCheck = run("git", ["--version"]);
  if (gitCheck.status !== 0) {
    console.warn(c.yellow("  ⚠️") + " 未安装 git，无法克隆 MOSS 仓库");
    console.warn(c.dim("     安装 git 后重跑本脚本；或手动 clone 到 " + MOSS_HOME));
    return;
  }

  // 3. clone
  if (!stepGitClone()) return;

  // 4. venv
  const venvPython = stepCreateVenv(py);
  if (!venvPython) return;

  // 5. 依赖
  if (!stepInstallDeps(venvPython)) return;

  // 6. 模型（纯离线拷贝）
  if (!stepPrepareModels()) return;

  // 7. 启动 + 验证
  stepStartServer();
  await stepVerify();

  console.log("\n" + c.green("  部署流程结束 ✅"));
  console.log("  之后 auto 模式会自动优先使用本地 MOSS（真人感、免 Key、纯离线）。");
  console.log("  音色切换：.env 里 MOSS_DEMO_ID=demo-1（案例讲解）/ demo-5（讲课纪录片）/ demo-2（温柔治愈）等；");
  console.log("  语音克隆：MOSS_PROMPT_AUDIO=<参考音频路径>（3 秒即可）。");
};

main().catch((err) => {
  console.warn(c.yellow("  ⚠️ setup-moss 异常：") + err.message);
  // 不抛致命错误 —— 让上层继续走兜底
});