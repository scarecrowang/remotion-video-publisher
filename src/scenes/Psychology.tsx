import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  COLORS,
  FONT_FAMILY,
  useSceneFade,
} from "../theme";
import { Subtitles } from "../Subtitles";
import { Background } from "../Background";
import { VoiceOver } from "../VoiceOver";
import type { TimedCaption } from "../timings";

type Point = { value: string; text: string };
type Props = {
  durationInFrames: number;
  label: string;
  headline: string;
  points: readonly Point[];
  captions: readonly TimedCaption[];
  broll?: string;
  audio?: string | null;
};

export const PsychologyScene: React.FC<Props> = ({
  durationInFrames,
  label,
  headline,
  points,
  captions,
  broll,
  audio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useSceneFade(durationInFrames);

  const labelIn = spring({ frame, fps, config: { damping: 200 } });
  const headlineIn = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, mass: 0.7 },
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_FAMILY,
        opacity: fade,
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 360,
      }}
    >
      <Background broll={broll} />
      <VoiceOver audio={audio} />
      <div
        style={{
          opacity: labelIn,
          transform: `translateY(${(1 - labelIn) * 18}px)`,
          padding: "14px 28px",
          borderRadius: 999,
          border: `1.5px solid ${COLORS.cardBorder}`,
          background: "rgba(255, 255, 255, 0.5)",
          fontSize: 38,
          fontWeight: 500,
          color: COLORS.accent,
          letterSpacing: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          opacity: headlineIn,
          transform: `scale(${0.7 + 0.3 * headlineIn})`,
          marginTop: 60,
          fontSize: 200,
          fontWeight: 800,
          color: COLORS.textPrimary,
          letterSpacing: 6,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {headline}
      </div>

      <div
        style={{
          marginTop: 120,
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        {points.map((p, i) => {
          const delay = 30 + i * 18;
          const pIn = spring({
            frame: frame - delay,
            fps,
            config: { damping: 200 },
          });
          return (
            <div
              key={p.value}
              style={{
                opacity: pIn,
                transform: `translateX(${(1 - pIn) * -40}px)`,
                display: "flex",
                alignItems: "baseline",
                gap: 28,
                fontFamily: FONT_FAMILY,
              }}
            >
              <span
                style={{
                  fontSize: 72,
                  fontWeight: 800,
                  color: COLORS.accent,
                  minWidth: 200,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {p.value}
              </span>
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 500,
                  color: COLORS.textPrimary,
                }}
              >
                {p.text}
              </span>
            </div>
          );
        })}
      </div>
      <Subtitles captions={captions} />
    </AbsoluteFill>
  );
};
