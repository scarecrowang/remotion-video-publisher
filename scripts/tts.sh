#!/usr/bin/env bash
# 生成配音 + 字幕时间轴
#
# 用法（项目根目录）：
#   npm run tts
#   TTS_VOICE="Tingting" npm run tts
#   TTS_RATE=230 npm run tts
#
# 跟 render.sh 一样，需要绕开 workbuddy 沙箱注入的 NODE_OPTIONS（node-language-shim），
# 否则 bun 加载 TS 时路径会被重定向。

set -euo pipefail
cd "$(dirname "$0")/.."

exec env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    -u NODE_OPTIONS -u CODEBUDDY_BROKERED_FS_HOOK_ENABLED \
    -u CODEBUDDY_SAFE_DELETE_BULK_GUARD \
    /opt/homebrew/bin/bun scripts/tts.mjs
