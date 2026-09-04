import { useCurrentFrame } from "remotion";
import { COLORS, FONT_FAMILY, SAFE_BOTTOM } from "./theme";
import type { TimedCaption } from "./timings";

type Props = {
  // 起止帧来自真实配音时长，不是手写估算
  captions: readonly TimedCaption[];
  // 需要给底部按钮/其他元素让位时，整体再抬高一些
  bottomOffset?: number;
};

export const Subtitles: React.FC<Props> = ({ captions, bottomOffset = 0 }) => {
  const frame = useCurrentFrame();

  // 句与句之间的空档 = 说话的自然停顿，这段时间不显示字幕，跟真实口播一致
  const active = captions.find((c) => frame >= c.start && frame < c.end);
  if (!active) return null;

  const progress = (frame - active.start) / (active.end - active.start);
  return (
    <CaptionLine
      text={active.text}
      progress={progress}
      bottomOffset={bottomOffset}
    />
  );
};

const CaptionLine: React.FC<{
  text: string;
  progress: number;
  bottomOffset: number;
}> = ({ text, progress, bottomOffset }) => {
  const chars = Array.from(text);
  const activeCount = Math.round(progress * chars.length);
  // 每句开头快速淡入，避免硬切
  const enter = Math.min(1, progress * 12);

  return (
    <div
      style={{
        position: "absolute",
        bottom: SAFE_BOTTOM - 40 + bottomOffset,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 90px",
        opacity: enter,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 62,
          fontWeight: 600,
          letterSpacing: 2,
          lineHeight: 1.4,
          textAlign: "center",
          // 浅色背景上保证可读性
          textShadow: "0 2px 8px rgba(255, 255, 255, 0.9)",
        }}
      >
        {chars.map((ch, i) => (
          <span
            key={i}
            style={{
              color: i < activeCount ? COLORS.accent : COLORS.textPrimary,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
};
