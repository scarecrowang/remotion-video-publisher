#!/usr/bin/env bash
# =============================================================================
# 一键出片：改文案 -> 重新配音 -> 渲染成片 -> 抽封面
#
# 用法（项目根目录）：
#   bash scripts/publish.sh                          # 完整流程（配音+渲染+封面）
#   bash scripts/publish.sh --no-tts                 # 跳过配音（文案没变只重渲染用）
#   bash scripts/publish.sh --frame=820              # 指定封面帧（默认 CTA 段末 830）
#   bash scripts/publish.sh --no-cover               # 不抽封面
#
# 典型工作流：
#   1) 改 src/script.ts 里的文案
#   2) bash scripts/publish.sh
#   => 得到 out/MyComp/MyComp.mp4 + out/MyComp/MyComp-thumb.png，配音与字幕自动按新文案时长重算
#
# 依赖：
#   - scripts/tts.sh   （配音 + 时间轴，默认 ElevenLabs；无 key 自动回退 say）
#   - scripts/render.sh（渲染成片）
#   - ffmpeg            （抽封面帧，macOS 自带或 brew 装）
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")/.."

DO_TTS=1
DO_COVER=1
COVER_FRAME=830
COMP=MyComp

for arg in "$@"; do
  case "$arg" in
    --no-tts)    DO_TTS=0 ;;
    --no-cover)  DO_COVER=0 ;;
    --frame=*)   COVER_FRAME="${arg#*=}" ;;
    --comp=*)    COMP="${arg#*=}" ;;
    *) echo "未知参数: $arg（支持 --no-tts / --no-cover / --frame=N / --comp=NAME）"; exit 1 ;;
  esac
done

OUT_DIR="out/${COMP}"
mkdir -p "${OUT_DIR}"
OUT="${OUT_DIR}/${COMP}.mp4"

echo "════════════════════════════════════════════"
echo "  一键出片  |  ${COMP}  |  帧率FPS来自数据层"
echo "════════════════════════════════════════════"

# 1. 配音 + 时间轴
if [ "$DO_TTS" = "1" ]; then
  echo ""
  echo "[1/3] 生成配音 + 字幕时间轴 ..."
  bash scripts/tts.sh
else
  echo ""
  echo "[1/3] 跳过配音（--no-tts），沿用现有时间轴"
fi

# 2. 渲染成片
echo ""
echo "[2/3] 渲染成片 → $OUT ..."
bash scripts/render.sh "$COMP" "$OUT"

# 3. 抽封面
if [ "$DO_COVER" = "1" ]; then
  echo ""
  echo "[3/3] 抽封面帧（frame=$COVER_FRAME）→ out/${COMP}-thumb.png ..."
  ffmpeg -y -loglevel error -i "$OUT" -vf "select=eq(n\,$COVER_FRAME)" -vframes 1 "out/${COMP}-thumb.png"
else
  echo ""
  echo "[3/3] 跳过封面（--no-cover）"
fi

# 汇总
echo ""
echo "════════════════════════════════════════════"
echo "  完成 ✅"
ls -lh "$OUT"
[ "$DO_COVER" = "1" ] && ls -lh "out/${COMP}-thumb.png"
echo "════════════════════════════════════════════"
echo "耗时：${SECONDS}s"
echo "提示：改 src/script.ts 换文案后，直接再跑一次本脚本即可出新片。"
