# 🎬 Remotion Video Publisher — Script-to-Video Engine

> 🇨🇳 中文版请见 [README-ZH.md](./README-ZH.md)

Convert a **script** (markdown storyboard) into a **9:16 vertical short video** with AI voiceover, karaoke subtitles, and B-roll footage — in one command.

Cross-platform: macOS ✅ Windows ✅ Linux ✅

---

## Quick Start

```bash
# 1. Clone the project
git clone https://github.com/scarecrowang/remotion-video-publisher.git
cd remotion-video-publisher

# 2. One-command setup (install deps + detect environment)
npm run setup

# 3. Edit .env with your API keys
#    PEXELS_API_KEY   → https://www.pexels.com/api/  (free)
#    VOLCANO_API_KEY  → https://console.volcengine.com/speech/new  (TTS)
#    VOLCANO_SPEAKER  → speaker ID from Volcengine console

# 4. Generate a video
node scripts/case-publish.mjs <slug>
```

> **How it works**: You write a storyboard in `content/<slug>.md` → the engine parses it → downloads B-roll (Pexels) → generates AI voiceover → renders MP4 (1080×1920, 30fps) → extracts a cover image. All in one pipeline.

---

## System Requirements

| Requirement | Notes |
|---|---|
| Node.js | ≥ 18 (recommended 20+) |
| npm | Bundled with Node.js |
| ffmpeg | Optional — audio processing; falls back to estimation if missing |
| Chrome/Chromium | Optional — auto-detected or auto-downloaded by Remotion |

---

## Commands

```bash
npm run setup              # One-time: install + detect environment
npm run case-publish <slug>           # Full pipeline: ingest → broll → tts → render → cover
npm run case-publish <slug> --no-tts   # Skip TTS (re-render only)
npm run case-publish <slug> --no-broll # Skip B-roll (offline mode)
npm run case-publish <slug> --no-cover # Skip cover extraction
```

---

## Storyboard Format

Write your script in `content/<slug>.md`. Example:

```markdown
## meta
title: The Digital Leap of Power Grids
theme: energy
voice: Brian

## head
subtitle: Energy Digital Transformation · Case Study
caption: When a power line faults, how long did it take to find it?

## points
kicker: The Old Way
point: Equipment inspected manually
point: Faults reported only after downtime
caption: Manual inspection meant faults were only found after failures

## data
kicker: After Unified Platform
value: -70%
label: Inspection manpower
caption: 70% reduction in inspection costs

## out
slogan: Smart Energy, Every Alert Matters
tagline: Subscribe for more cases
caption: Digital transformation means letting the system think for you
```

### Card Types

| Card (`## type`) | What it shows | Fields |
|---|---|---|
| `head` | Opening title | `subtitle`, `caption` |
| `points` | Bullet list | `kicker`, `point` (multiple), `caption` |
| `data` | Single large number | `kicker`, `value`, `label`, `caption` |
| `stats` | Multiple numbers grid | `kicker`, `row` (multiple), `caption` |
| `theory` | Concept breakdown | `kicker`, `headline`, `row`/`point`, `caption` |
| `out` | Closing screen | `slogan`, `tagline`, `caption` |

---

## Theme Palette

| Theme ID | Style | Use Case |
|---|---|---|
| `energy` | Tech blue (dark) | Energy, enterprise digital transformation |
| `counseling` | Warm soft tone | Psychology, emotional storytelling, soft科普 |
| `warm` | General warm | Default for friendly content |

Add new themes in `src/case/caseTheme.ts` (`CASE_PALETTES`).

---

## API Keys Required

| Service | Purpose | How to Get |
|---|---|---|
| **Pexels** | B-roll video footage | https://www.pexels.com/api/ — free registration |
| **Volcengine TTS** | AI voiceover (Chinese) | https://console.volcengine.com/speech/new — enable "Seed TTS" |
| **ElevenLabs** | Alternative TTS (optional) | https://elevenlabs.io/ |

All keys go into `.env` (`.env.example` is provided as a template).

---

## Output

```
out/<slug>/<slug>.mp4        ← 1080×1920 30fps MP4 video
out/<slug>/<slug>-thumb.png  ← Cover image (frame ~27s)
```

---

## Architecture

```
content/<slug>.md          ← Your storyboard (markdown)
        │
scripts/case-ingest.mjs    ← Parse → src/case.generated.ts
scripts/case-broll.mjs     ← Download B-roll from Pexels
scripts/case-tts.mjs       ← TTS voiceover + subtitle timings
scripts/case-render.mjs    ← Render with @remotion/renderer (Node API)
        │
        ▼
out/<slug>/<slug>.mp4 + cover ← Final video
```

---

## FAQ

| Problem | Solution |
|---|---|
| "Command not found" | Node.js not installed. Run `node -v` to check |
| B-roll download fails | Check PEXELS_API_KEY in .env; try different keywords |
| TTS produces silent/short audio | Volcengine streaming JSON needs multi-chunk assembly (already handled) |
| Content clipped/overflow | Shorten caption to ≤40 chars or split into multiple shots |
| Wrong color palette | Check `theme:` in `## meta` matches a registered palette id |
| Chrome not found | Run `npm run setup` to auto-download, or set `CHROME_EXECUTABLE` env var |
| `@remotion/renderer` import error | Run `npm install` to reinstall dependencies |

---

## Notes for Different Platforms

- **macOS**: Use `TTS_PROVIDER=say` for free local preview voiceover
- **Windows**: Run in cmd/PowerShell directly — no WSL needed
- **Linux**: Chromium is auto-downloaded by `setup.mjs` if not detected

---

## License

UNLICENSED — for personal/project use. Contact the author for commercial licensing.