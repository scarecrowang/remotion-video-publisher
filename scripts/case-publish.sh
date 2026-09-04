#!/usr/bin/env bash
# 一键出案例速览片：分镜稿 → B-roll素材 → 配音 → 渲染 → 封面
#
# 用法（项目根目录）：
#   bash scripts/case-publish.sh energy-case-01                # 全流程
#   bash scripts/case-publish.sh energy-case-01 --no-tts       # 跳过配音（稿子没改只重渲染用）
#   bash scripts/case-publish.sh energy-case-01 --no-broll     # 跳过 B-roll 下载（离线用）
#   bash scripts/case-publish.sh energy-case-01 --no-cover     # 不抽封面
#
# 完整工作流：
#   1) 在 content/<slug>.md 里写分镜稿（每镜可配 broll: 关键词）
#   2) bash scripts/case-publish.sh <slug>
#   => out/<slug>.mp4 + out/<slug>-thumb.png
# 配音服务默认走 .env 的 TTS_PROVIDER（默认 volcano 火山豆包语音 Seed TTS）；
# 想临时换本地免费声：TTS_PROVIDER=say bash scripts/case-publish.sh <slug>
# B-roll 素材走 Pexels 免费视频库，需在 .env 配 PEXELS_API_KEY。
#
# 依赖：scripts/case-ingest.mjs / scripts/case-broll.mjs / scripts/case-tts.mjs / scripts/render.sh / ffmpeg

set -euo pipefail
cd "$(dirname "$0")/.."

SLUG="${1:-}"
[ -z "$SLUG" ] && { echo "用法: bash scripts/case-publish.sh <slug>"; exit 1; }
shift || true

DO_TTS=1
DO_BROLL=1
DO_COVER=1
COVER_FRAME=820  # 默认抽约 27s 的帧，落在 data2 或 stats 附近

for arg in "$@"; do
  case "$arg" in
    --no-tts)   DO_TTS=0 ;;
    --no-broll) DO_BROLL=0 ;;
    --no-cover) DO_COVER=0 ;;
    --frame=*)  COVER_FRAME="${arg#*=}" ;;
    *) echo "未知参数: $arg（支持 --no-tts / --no-broll / --no-cover / --frame=N）"; exit 1 ;;
  esac
done

OUT="out/${SLUG}.mp4"
COVER="out/${SLUG}-thumb.png"

echo "════════════════════════════════════════════"
echo "  案例速览片  |  ${SLUG}  |  题材: energy"
echo "════════════════════════════════════════════"

# 1) 解析分镜稿
echo ""
echo "[1/5] 解析分镜稿 → src/case.generated.ts ..."
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    -u NODE_OPTIONS -u CODEBUDDY_BROKERED_FS_HOOK_ENABLED \
    -u CODEBUDDY_SAFE_DELETE_BULK_GUARD \
    /opt/homebrew/bin/bun scripts/case-ingest.mjs "$SLUG"

# 2) B-roll 素材下载
if [ "$DO_BROLL" = "1" ]; then
  echo ""
  echo "[2/5] 下载 B-roll 素材（Pexels）..."
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
      -u NODE_OPTIONS -u CODEBUDDY_BROKERED_FS_HOOK_ENABLED \
      -u CODEBUDDY_SAFE_DELETE_BULK_GUARD \
      /opt/homebrew/bin/bun scripts/case-broll.mjs "$SLUG"
else
  echo ""
  echo "[2/5] 跳过 B-roll 下载（--no-broll）"
fi

# 3) 配音 + 时间轴
if [ "$DO_TTS" = "1" ]; then
  echo ""
  echo "[3/5] 生成配音 + 字幕时间轴 ..."
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
      -u NODE_OPTIONS -u CODEBUDDY_BROKERED_FS_HOOK_ENABLED \
      -u CODEBUDDY_SAFE_DELETE_BULK_GUARD \
      /opt/homebrew/bin/bun scripts/case-tts.mjs "$SLUG"
else
  echo ""
  echo "[3/5] 跳过配音（--no-tts），沿用现有时间轴"
fi

# 4) 渲染
echo ""
echo "[4/5] 渲染成片 → $OUT ..."
bash scripts/render.sh CaseEpisode "$OUT"

# 5) 抽封面
if [ "$DO_COVER" = "1" ]; then
  echo ""
  echo "[5/5] 抽封面帧（frame=$COVER_FRAME）→ $COVER ..."
  ffmpeg -y -loglevel error -i "$OUT" -vf "select=eq(n\,$COVER_FRAME)" -vframes 1 "$COVER"
else
  echo ""
  echo "[5/5] 跳过封面（--no-cover）"
fi

echo ""
echo "════════════════════════════════════════════"
echo "  完成 ✅"
ls -lh "$OUT"
[ "$DO_COVER" = "1" ] && ls -lh "$COVER"
echo "════════════════════════════════════════════"
echo "耗时：${SECONDS}s"
echo "提示：改 content/${SLUG}.md 换稿子后，再跑本脚本即可出新片。"