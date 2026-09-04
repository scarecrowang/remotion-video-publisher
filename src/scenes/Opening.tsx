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
  hook: string;
  punchline: string;
  captions: readonly TimedCaption[];
  broll?: string;
  audio?: string | null;
};

export const OpeningScene: React.FC<Props> = ({
  durationInFrames,
  hook,
  punchline,
  captions,
  broll,
  audio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useSceneFade(durationInFrames);

  // 钩子用带回弹的 spring 弹入，制造"亮出来"的感觉
  const hookIn = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });
  const punchIn = spring({
    frame: frame - 22,
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_FAMILY,
        opacity: fade,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 80px",
        textAlign: "center",
      }}
    >
      <Background broll={broll} />
      <VoiceOver audio={audio} />
      <div
        style={{
          opacity: hookIn,
          transform: `scale(${0.85 + 0.15 * hookIn}) translateY(${
            (1 - hookIn) * 30
          }px)`,
          fontSize: 108,
          fontWeight: 700,
          color: COLORS.textPrimary,
          letterSpacing: 4,
          lineHeight: 1.25,
        }}
      >
        {hook}
      </div>
      <div
        style={{
          opacity: punchIn,
          transform: `translateY(${(1 - punchIn) * 24}px)`,
          marginTop: 56,
          fontSize: 56,
          fontWeight: 400,
          color: COLORS.textSecondary,
          letterSpacing: 2,
        }}
      >
        {punchline}
      </div>
      <Subtitles captions={captions} />
    </AbsoluteFill>
  );
};
