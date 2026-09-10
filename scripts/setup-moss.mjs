#!/usr/bin/env node
/**
 * setup-moss.mjs —— 一键部署本地 MOSS-TTS-Nano（免 Key 真人感中文 TTS）。
 *
 * 自动完成：
 *   1. 探测本地服务 http://127.0.0.1:18083/health —— 已在跑则直接跳过
 *   2. git clone https://github.com/OpenMOSS/MOSS-TTS-Nano 到 ~/.moss-tts-nano
 *   3. 创建 Python 虚拟环境 .venv（优先 python3.12）
 *   4. pip install -r requirements.txt && pip install -e .
 *      （自动处理 pynini/WeTextProcessing 安装坑：先单独装 pynini，失败给平台指引但不阻塞）
 *   5. 后台常驻启动 app.py（detached 进程，不随终端退出）
 *   6. 轮询 /health 确认服务就绪（首次使用模型会自动下载，约 1GB）
 *
 * 用法：
 *   node scripts/setup-moss.mjs                 # 探测 → 部署 → 启动 → 验证
 *   MOSS_TTS_BASE_URL=http://127.0.0.1:18083 node scripts/setup-moss.mjs
 *   node scripts/setup-moss.mjs --dir /abs/path # 自定义安装目录（默认 ~/.moss-tts-nano）
 *   node scripts/setup-moss.mjs --skip-start    # 只装依赖不起服务
 *
 * 设计：任何一步失败都不抛出致命错误 —— 打印指引后以退出码 0 结束，
 * 让上层（setup.mjs / case-tts.mjs 的 auto 探测）继续走平台免费 TTS 兜底，绝不阻塞出片。
 */

import { execSync, spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
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

const run = (cmd, argsList, opts = {}) => {
  const res = spawnSync(cmd, argsList, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  return res;
};

// 找一个可用的 Python（优先 3.12+，其次 3.10/3.11）
const findPython = () => {
  const candidates = ["python3.12", "python3.11", "python3.10", "python3", "python"];
  for (const cmd of candidates) {
    const r = run(cmd, ["--version"]);
    if (r.status === 0) {
      const v = (r.stdout || "") + (r.stderr || "");
      const m = v.match(/(\d+)\.(\d+)/);
      const [major, minor] = m ? [Number(m[1]), Number(m[2])] : [0, 0];
      if (major >= 3 && minor >= 10) return { cmd, version: `${major}.${minor}` };
    }
  }
  return null;
};

// ---- 各步骤 ----
const stepGitClone = () => {
  if (existsSync(join(MOSS_HOME, ".git"))) {
    console.log(c.green("  ✅") + ` 已存在 ${MOSS_HOME}，尝试 git pull 更新`);
    const r = run("git", ["-C", MOSS_HOME, "pull", "--ff-only"], { cwd: MOSS_HOME });
    if (r.status !== 0) console.log(c.dim("     pull 失败（无网络/被修改），继续用现有代码"));
    return;
  }
  mkdirSync(MOSS_HOME, { recursive: true });
  console.log(c.yellow("  ⏳") + ` 克隆 MOSS-TTS-Nano → ${MOSS_HOME}`);
  // 浅克隆（省时间）；失败重试一次，并提示网络问题
  let r = run("git", ["clone", "--depth", "1", GIT_URL, MOSS_HOME]);
  if (r.status !== 0) {
    console.log(c.dim("     首次克隆失败，重试一次..."));
    r = run("git", ["clone", "--depth", "1", GIT_URL, MOSS_HOME]);
  }
  if (r.status !== 0) {
    console.warn(c.yellow("  ⚠️") + " 克隆 GitHub 失败（国内网络常见）");
    console.warn(c.dim("     解决：设置 git 代理后重试，或指定镜像："));
    console.warn(c.dim("       git config --global http.proxy http://127.0.0.1:<端口>"));
    console.warn(c.dim(`       MOSS_GIT_URL=https://gitclone.com/github.com/OpenMOSS/MOSS-TTS-Nano.git node scripts/setup-moss.mjs`));
    console.warn(c.dim("     也可手动 clone 后重跑本脚本（检测到目录会跳过 clone）"));
    return false;
  }
  console.log(c.green("  ✅") + " 克隆完成");
  return true;
};

const stepCreateVenv = (py) => {
  if (existsSync(VENV_PYTHON)) {
    console.log(c.green("  ✅") + " .venv 已存在");
    return VENV_PYTHON;
  }
  console.log(c.yellow("  ⏳") + ` 创建虚拟环境（python ${py.version}）...`);
  const r = run(py.cmd, ["-m", "venv", VENV]);
  if (r.status !== 0 || !existsSync(VENV_PYTHON)) {
    console.warn(c.yellow("  ⚠️") + " 创建虚拟环境失败：" + (r.stderr || "").slice(0, 300));
    return null;
  }
  console.log(c.green("  ✅") + " .venv 创建完成");
  return VENV_PYTHON;
};

const pip = (venvPython, ...rest) =>
  run(venvPython, ["-m", "pip", ...rest], { cwd: MOSS_HOME });

const stepInstallDeps = (venvPython) => {
  // 1) 先尝试常规安装
  console.log(c.yellow("  ⏳") + " 安装依赖（pip install -r requirements.txt + -e .，首次较慢）...");
  let r = pip(venvPython, "install", "-r", "requirements.txt");
  if (r.status !== 0) {
    // 2) pynini/WeTextProcessing 是已知安装坑：尝试先单独装 pynini 再重装剩余
    console.log(c.dim("     常规安装失败，疑似 pynini/WeTextProcessing 问题，尝试绕过..."));
    try {
      const r2 = pip(venvPython, "install", "pynini==2.1.6.post1");
      if (r2.status === 0) r = pip(venvPython, "install", "-r", "requirements.txt");
    } catch {
      /* 不管 */
    }
  }
  if (r.status !== 0) {
    // 3) 仍失败：给平台指引（不阻塞）
    console.warn(c.yellow("  ⚠️") + " 依赖安装失败：" + (r.stderr || "").slice(0, 300));
    console.warn(c.dim("     MOSS-TTS-Nano 的 pynini/WeTextProcessing 是已知安装坑，按官方文档处理："));
    if (process.platform === "win32") {
      console.warn(c.dim("       Windows：先下载匹配你 Python 版本的 pynini wheel（见仓库 Issue #6），再重跑本脚本"));
      console.warn(c.dim("       或改用 Conda：conda install -c conda-forge pynini=2.1.6.post1"));
    } else if (process.platform === "darwin") {
      console.warn(c.dim("       macOS：brew install openfst 后重试，或改用 Conda（conda install -c conda-forge pynini=2.1.6.post1）"));
    } else {
      console.warn(c.dim("       Linux：sudo apt install libfst-dev openfst-tools 后重试，或改用 Conda"));
    }
    return false;
  }
  console.log(c.green("  ✅") + " 依赖安装完成");
  // -e .（安装 CLI，失败不致命）
  const rDev = pip(venvPython, "install", "-e", ".");
  if (rDev.status !== 0) console.log(c.dim("  ⚠️ `-e .` 安装 CLI 失败（不影响 app.py 直接运行）"));
  else console.log(c.green("  ✅") + " 已安装 CLI (moss-tts-nano)");
  return true;
};

const stepStartServer = () => {
  if (skipStart) {
    console.log(c.dim("  --skip-start：跳过启动。稍后可手动运行："));
    console.log(c.dim(`    ${VENV_PYTHON} ${join(MOSS_HOME, "app.py")}`));
    return;
  }
  console.log(c.yellow("  ⏳") + ` 后台启动服务 ${BASE} ...`);
  const child = spawn(VENV_PYTHON, ["app.py"], {
    cwd: MOSS_HOME,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
};

const stepVerify = async () => {
  console.log(c.yellow("  ⏳") + " 等待服务就绪（首次使用会自动下载模型，合成时稍慢）...");
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await healthOk(1500)) {
      console.log(c.green(`  ✅ MOSS-TTS-Nano 已就绪：${BASE}`));
      return true;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.warn(c.yellow("  ⚠️") + ` ${BASE} 120 秒内未探测到服务`);
  console.warn(c.dim("     可能：app.py 启动较慢/端口不同（可用 MOSS_TTS_BASE_URL 指定）；或本机无 Python 3.10+"));
  console.warn(c.dim("     不影响：auto 模式会自动回落平台免费 TTS，出片不受阻塞"));
  return false;
};

// ---- 主流程 ----
const main = async () => {
  console.log("════════════════════════════════════════════");
  console.log("  本地 MOSS-TTS-Nano — 一键部署");
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
    console.warn(c.yellow("  ⚠️") + " 未找到 Python 3.10+，无法部署 MOSS");
    console.warn(c.dim("     macOS:  brew install python@3.12"));
    console.warn(c.dim("     Windows: winget install Python.Python.3.12"));
    console.warn(c.dim("     Linux:   sudo apt install python3.12-venv"));
    console.warn(c.dim("     装好后重跑：node scripts/setup-moss.mjs"));
    console.warn(c.dim("     （不影响：auto 模式回落平台免费 TTS）"));
    return;
  }
  console.log(c.green(`  ✅ Python ${py.version} (${py.cmd})`));

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

  // 6. 启动 + 验证
  stepStartServer();
  await stepVerify();

  console.log("\n" + c.green("  部署流程结束 ✅"));
  console.log("  之后 auto 模式会自动优先使用本地 MOSS（真人感、免 Key）。");
  console.log("  也可用 MOSS_PROMPT_AUDIO=<参考音频> 做 3 秒语音克隆。");
};

main().catch((err) => {
  console.warn(c.yellow("  ⚠️ setup-moss 异常：") + err.message);
  // 不抛致命错误 —— 让上层继续走兜底
});