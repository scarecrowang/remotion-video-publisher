import { useCurrentFrame } from "remotion";
import type { CasePalette } from "./caseTheme";
import type { CaseCaption } from "./caseData";

// 案例片的卡拉OK字幕：配色由题材 palette 决定。
// caption 若超过一定字数自动放大字号处理；底部字幕留白防止被平台UI挡。
type Props = {
  captions: readonly CaseCaption[];
  palette: CasePalette;
};

export const CaseSubtitles: React.FC<Props> = ({ captions, palette }) => {
  const frame = useCurrentFrame();
  const active = captions.find((c) => frame >= c.start && frame < c.end);
  if (!active) return null;

  const progress = (frame - active.start) / (active.end - active.start);
  const chars = Array.from(active.text);
  const activeCount = Math.round(progress * chars.length);
  const enter = Math.min(1, progress * 10);

  // 越长的句子用越小字号，避免一行爆宽
  const len = chars.length;
  const fontSize = len > 26 ? 44 : len > 18 ? 50 : 58;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 130,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 60px",
        opacity: enter,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          fontFamily:
            '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          fontSize,
          fontWeight: 600,
          letterSpacing: 1,
          lineHeight: 1.5,
          textAlign: "center",
          textShadow: "0 2px 10px rgba(0,0,0,0.7)",
        }}
      >
        {chars.map((ch, i) => (
          <span
            key={i}
            style={{
              color: i < activeCount ? palette.accent : palette.textMain,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
};
