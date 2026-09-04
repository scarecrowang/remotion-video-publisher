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

type Props = {
  durationInFrames: number;
  heading: string;
  maleLabel: string;
  maleText: string;
  femaleLabel: string;
  femaleText: string;
  captions: readonly TimedCaption[];
  broll?: string;
  audio?: string | null;
};

export const EmpathyScene: React.FC<Props> = ({
  durationInFrames,
  heading,
  maleLabel,
  maleText,
  femaleLabel,
  femaleText,
  captions,
  broll,
  audio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useSceneFade(durationInFrames);

  const headingIn = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_FAMILY,
        opacity: fade,
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 280,
      }}
    >
      <Background broll={broll} />
      <VoiceOver audio={audio} />
      <div
        style={{
          opacity: headingIn,
          transform: `translateY(${(1 - headingIn) * 18}px)`,
          padding: "16px 36px",
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.6)",
          border: `1.5px solid ${COLORS.cardBorder}`,
          fontSize: 44,
          fontWeight: 500,
          color: COLORS.textPrimary,
          letterSpacing: 4,
        }}
      >
        {heading}
      </div>

      <div
        style={{
          marginTop: 100,
          display: "flex",
          width: "100%",
          padding: "0 60px",
          gap: 40,
        }}
      >
        <Perspective
          label={maleLabel}
          text={maleText}
          avatarColor={COLORS.avatarMale}
          delay={10}
          from="left"
        />
        <div
          style={{
            width: 2,
            background: COLORS.cardBorder,
            alignSelf: "stretch",
            marginTop: 60,
          }}
        />
        <Perspective
          label={femaleLabel}
          text={femaleText}
          avatarColor={COLORS.avatarFemale}
          delay={22}
          from="right"
        />
      </div>

      <Subtitles captions={captions} />
    </AbsoluteFill>
  );
};

const Perspective: React.FC<{
  label: string;
  text: string;
  avatarColor: string;
  delay: number;
  from: "left" | "right";
}> = ({ label, text, avatarColor, delay, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inAnim = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });
  const direction = from === "left" ? -1 : 1;
  return (
    <div
      style={{
        flex: 1,
        opacity: inAnim,
        transform: `translateX(${(1 - inAnim) * direction * 60}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 36,
      }}
    >
      <div
        style={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: avatarColor,
          color: "#FFF",
          fontSize: 60,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 40,
          lineHeight: 1.55,
          color: COLORS.textPrimary,
          textAlign: "center",
          letterSpacing: 1,
        }}
      >
        {text}
      </div>
    </div>
  );
};
