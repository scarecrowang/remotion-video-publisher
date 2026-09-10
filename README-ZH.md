# 🎬 Remotion Video Publisher — 文字稿一键生成竖屏视频

> English version: [README.md](./README.md)

你好！这是一份**给你也能轻松上手**的使用说明。
你**不需要会写代码**、不需要懂"程序"。只要会**复制文件、改文字、敲一条命令**，就能把一篇文字稿变成一条竖屏短视频。

> 本手册只讲**日常出片**这一条路，全部照着做即可。文中出现的 `$` 开头的命令，复制整行到"终端"里按回车即可。

---

## 一、这套东西能帮你做什么

你给它**一篇"分镜稿"**（一种很简单的文字格式，下面教你怎么写），它就自动帮你：

1. 读出每屏要讲的口播台词
2. 自动生成**真人感配音**（AI 男声）
3. 自动配上**卡拉OK式字幕**（讲到哪亮到哪）
4. 自动拼成一条**竖屏短视频**（9:16，适合抖音/视频号/小红书）
5. 顺手帮你截一张**封面图**

最后你拿到：一条 `.mp4` 视频 + 一张 `.png` 封面图。

---

## 二、开始前：先知道两个概念

| 名词 | 是什么 | 你需要记住 |
|---|---|---|
| **分镜稿** | 一份写在 `.md` 文件里的文字稿 | 你就把它当成"一次视频的剧本" |
| **终端（Terminal）** | 电脑上让你输入命令的黑窗口 | 你只要会"复制命令 + 回车" |

> 每做**一条视频** = 准备 **1 份分镜稿** + 敲 **1 条命令**。

---

## 三、做一条视频，总共 4 步

### 第 1 步：获取项目

如果你还没这个项目，在终端里跑这条命令把它下载到本地：

```bash
git clone https://github.com/scarecrowang/remotion-video-publisher.git
cd remotion-video-publisher
```

如果你已经拿到了项目，直接跳到第 2 步。

### 第 2 步：复制一份"稿子模板"

视频的稿子都放在 `content/` 文件夹里。
电脑上打开文件夹，找到：

```
content/energy-case-01.md
```

右键它 → **复制** → 粘贴在同一个文件夹里，会得到一个"energy-case-01 副本.md"。
把副本改个**简单的名字**（只能是英文或数字，别用中文和空格），例如：

```
content/my-case.md
```

> 这个名字就是"这条视频的编号"。你写几期就建几个文件，互不干扰。

### 第 3 步：照模板改内容（关键）

用任何文本编辑器（记事本、VS Code、备忘录都行）打开你刚建的 `my-case.md`。

你会看到稿子长这样（这就是"分镜稿格式"）。**你只需要改 `值` 的部分，别动格式符号**：

```markdown
## meta
title: 第一眼就定生死了吗？        ← 整条视频的大标题
theme: counseling                 ← 色彩风格：counseling（暖色心理）/ energy（科技蓝）/ warm（通用暖）
voice: Brian                      ← 不用改，配音声音

## head      （这一屏是"片头"）
subtitle: 心理疏导 · 每周拆一个真相   ← 片头副标题
caption: 你以为沟通靠的是能说会道？其实对方早就在观察你了。  ← 这句会被"念出来"

## theory    （这一屏是"认知拆解"，心理疏导/科普高频用）
kicker: 梅拉宾法则               ← 左上角小标签
headline: 7-38-55                 ← 居中大概念
row: 7% 你说了什么                ← 每组一行：比例 + 说明
row: 38% 你的语气
row: 55% 你的表情和肢体
caption: 心理学有个梅拉宾法则，说话内容只占百分之七，剩下九十三靠语气和身体。  ← 这句会被念出来

## points    （这一屏是"要点"，讲 2~3 条）
kicker: 给你的建议               ← 左上角小标签
point: 别只顾准备话术            ← 一条要点（可写多条 point）
point: 把状态调到最好
caption: 所以别只顾准备话术，把状态调到最好，比什么都管用。  ← 这句会被念出来

## data      （这一屏是"一个大数字"）
kicker: 研究数据
value: 93%                       ← 放大显示的大数字
label: 非语言信息占比             ← 数字下面说明
caption: 人际沟通中九成三的信息，其实来自你的语气和身体。  ← 这句会被念出来

## out       （这一屏是"片尾"）
slogan: 深度洞察                 ← 结尾口号
tagline: 关注我 · 看透人际关系底层逻辑  ← 关注引导
caption: 所以别只顾准备话术，把状态调到最好，比什么都管用。  ← 这句会被念出来
```

**"分镜稿"共 6 种卡片**（每屏画面不同），你按需要组合、可多可少：

| 卡片名（`## 后面）` | 它是一屏什么画面 | 可填字段 |
|---|---|---|
| `head` | 片头（大标题页） | `subtitle` `caption` |
| `points` | 要点列表页 | `kicker` + 多个`point` + `caption` |
| `data` | 单个超大数字页 | `kicker` `value` `label` `caption` |
| `stats` | 一排多个数字页 | `kicker` + 多个`row`（数字+说明）+ `caption` |
| `theory` | 认知拆解页（心理/科普核心） | `kicker` `headline` + 多个`row`/`point` + `caption` |
| `out` | 片尾关注页 | `slogan` `tagline` `caption` |

**"caption"是什么？** 每屏你写一句 `caption: 你想说的话`，这一句就会被念出来并显示为字幕。
如果你想让某一屏**只有画面不说话**，那这一屏就**不写 `caption` 这一行**即可。

**几个小技巧：**
- `caption` 一句话最好 ≤ 40 字（约 2 行），太长就分到连续两屏说
- `data` 卡的 `value` 越短冲击力越强（如 `-91.8%`、`千亿级`），别写长句子
- 每屏可以加一行 `broll: 英文关键词` 来指定背景画面素材（如 `broll: person thinking cafe`），不加也会自动配图

改完保存，第 3 步就完成了 ✅

### 第 4 步：跑一条命令，自动生成视频

打开**终端**，先让终端"走到"项目文件夹（即包含 `scripts/case-publish.mjs` 的那个目录），输入下面这行并回车：

```bash
cd /path/to/your/project
```
（把 `/path/to/your/project` 换成你实际放项目的路径）

然后输入这条，把 `my-case` 换成你第 2 步起的名字：

```bash
npm run case-publish my-case
```

回车后，它会**自动执行 5 件事**（你看着它跑就行，别关窗口）：

```
[1/5] 解析分镜稿 ...
[2/5] 下载 B-roll 素材（Pexels）...
[3/5] 生成配音 + 字幕时间轴 ...
[4/5] 渲染成片 → out/my-case/my-case.mp4 ...
[5/5] 抽封面帧 ...
完成 ✅
```

等出现 **"完成 ✅"**，就成功了！

### 第 5 步：去拿你的视频

打开 `out/` 文件夹，你会看到每条视频独立一个文件夹：

```
out/my-case/
├── my-case.mp4        ← 你的视频
└── my-case-thumb.png  ← 封面图
```

双击就能播放/上传 ✅🎉

---

## 四、关于配音：真人声 / 免费声 怎么选

系统默认是 **自动模式（TTS_PROVIDER=auto）**，会先探测本机有没有装本地真人 TTS（MOSS-TTS-Nano），装了就用它（真人感、免 Key），没装才按电脑系统选免费配音：

| 你的系统 | 会用哪个 | 需要安装？ |
|---|---|---|
| 任意（已装 MOSS） | **MOSS-TTS-Nano（本地真人声）** | 一键部署（见下），免 Key、中文标准普通话 |
| macOS | `say` 命令 | ✅ 零配置，直接可用 |
| Windows | PowerShell `System.Speech` | ✅ 零配置，直接可用 |
| Linux | `espeak-ng` | ❌ 需 `sudo apt install espeak-ng`（只需一次） |

> **推荐：装本地 MOSS-TTS-Nano（免费真人感）**。开源 Apache-2.0，0.1B 参数纯 CPU 实时运行，中文标准普通话，3 秒参考音频还能克隆声线。**推荐一键部署**（自动完成 clone → 建 venv → 装依赖 → 后台启动 → 健康检查，约 5 分钟下载模型）：
> ```bash
> node scripts/setup-moss.mjs     # 一键部署 + 启动（未装则自动装，已在跑则跳过）
> # 或运行 npm run setup 也会自动探测/部署 MOSS（第 7 步）
> ```
> 手动画兜底：`git clone https://github.com/OpenMOSS/MOSS-TTS-Nano.git && cd MOSS-TTS-Nano` → `pip install -r requirements.txt && pip install -e .` → `moss-tts-nano serve`（常驻，默认 http://127.0.0.1:18083）。Windows 遇 `pynini` 安装失败：脚本会自动先单独装 pynini 再重试，仍失败请按仓库 Issue #6 配匹配平台 wheel。
> 之后 `auto` 模式自动优先用它；可用 `MOSS_PROMPT_AUDIO=` 指定参考音频固定声线。
>
> **内置音色（demo_id）选择**：默认 `demo-1`（案例讲解/商务，正式感）。在 `.env` 里设 `MOSS_DEMO_ID=` 切换，常用：
>
> | demo_id | 音色 | 适合场景 |
> |---|---|---|
> | `demo-1` | 正式商务感（默认） | **案例讲解**、口播、课程 |
> | `demo-5` | 稳重讲课/旁白男声 | 纪录片、知识讲课 |
> | `demo-2` | 温柔治愈女声 | 心理科普、情感陪伴、晚安 |
> | `demo-6` | 情绪饱满女声（杨幂气质） | 口播金句、情感短片 |
> | `demo-3` | 台湾腔 | 轻松闲聊类 |
> | `demo-4` | 京味胡同 | 烟火气叙事 |
> | 其他语言 | demo-7~29 为各国新闻同一声线 | 仅对应语言 |
>
> 音色只是"声音特质"，说什么完全由你传入的文本决定；也可用 `MOSS_PROMPT_AUDIO` 传 3 秒参考音频做任意声线克隆。
>
> 想让配音有"更强真人感"（中文母语、自然），可以在 `.env` 文件里配火山引擎 Key（管理员做一次就行），然后在命令前加 `TTS_PROVIDER=volcano` 即可。

---

## 五、视频色彩风格

稿子顶部 `theme:` 那行控制整片配色：

| 题材 | 视觉风格 | 适合什么内容 |
|---|---|---|
| `counseling` | 暖色 Soft Signal（浅暖底 + 珊瑚橙） | 心理疏导、情感口播、软科普 |
| `energy` | 科技蓝深底（电光青 accent） | 能源/企业数智化转型案例 |
| `warm` | 通用暖色 | 其他亲和向内容 |

---

## 六、常见问题

| 我遇到… | 怎么办 |
|---|---|
| 命令提示 `未找到命令/npm: command not found` | 说明还没装好基础软件，看文末"第一次准备" |
| 命令提示 `未知参数/文件不存在` | 名字拼错：文件在 `content/` 下且**不带 `.md`** 输入；只能英文数字 |
| 命令提示 `需要登录/额度不足/报错` | 默认走免费 TTS（auto模式），不依赖外部服务。如果 TTS 报错，试试 `TTS_PROVIDER=auto` 强制使用本地免费配音 |
| 视频里配音是"机器声" | 说明本地 MOSS 未装、也没有火山 key，走到了免费 TTS。想听真人中文声：运行 `node scripts/setup-moss.mjs` 一键部署本地 MOSS（见「四、关于配音」），或让管理员确认火山 key/音色已配好，把 `.env` 里的 `TTS_PROVIDER=auto` 改成 `TTS_PROVIDER=volcano` 再重跑 |
| 字幕和声音对不上 | 少见。多数是改了稿子后**忘了重新跑**那条命令，重跑即可 |
| 我改了稿子想重出一次 | 直接再跑一次第 3 步的命令即可，会覆盖旧文件 |
| 跑一半报一堆英文红色字 | 别慌，多半是网络/额度问题。把报错截图发给懂的人看，或先切本地免费配音 |
| B-roll 素材下载失败 | 检查 `.env` 里的 `PEXELS_API_KEY` 是否有效；或加 `--no-broll` 跳过素材，只出纯画面 |
| **Linux 用户** 配音报错 | 免费 TTS 需安装 espeak-ng：`sudo apt install espeak-ng`（一次即可） |

---

## 七、想多学一点（可选）

- **每期一条视频怎么做？** 复制模板 → 改成 `ep-02.md` → 跑 `npm run case-publish ep-02`。如此反复。
- **想换视频的颜色？** 稿子顶部 `theme:` 那行：`energy` 是科技蓝，改成 `counseling` 就是暖色心理健康风。
- **字幕怎么是"讲到哪亮到哪"？** 这是自动的，配音多长，字幕就跟着亮多长，你不用管。
- **每屏的配图从哪来？** 自动从 Pexels 免费视频库下载，你可以在每屏加一行 `broll: 英文关键词` 来指定要找什么画面。

---

## 八、第一次使用前准备（只用做一次）

下面的步骤**只在第一次**做。如果这些已经装好、或者你之前跑通过，直接跳到第三节。

```bash
# 1. 从 GitHub 拉取项目（如果还没下载）
git clone https://github.com/scarecrowang/remotion-video-publisher.git
cd remotion-video-publisher

# 2. 一键安装 + 环境检测（自动安装依赖、检测 ffmpeg、自动下载 Chrome）
npm run setup

# 3. （管理员做）配 API Key
#    在项目根目录找到 .env 文件，填入：
#    - PEXELS_API_KEY   → https://www.pexels.com/api/ 免费注册
#    - VOLCANO_API_KEY  → https://console.volcengine.com/speech/new 开通
#    - VOLCANO_SPEAKER  → 控制台「发音人列表」复制 speaker id
```

> 全部准备就绪后，日常就只做第三节的"4 步"。

---

**恭喜，你已经会用了 🎉 现在就复制一份模板，试着写你的第一条视频稿吧。**