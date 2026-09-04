import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FONT_FAMILY,
  SAFE_BOTTOM,
  useSceneFade,
} from "../theme";
import { Subtitles } from "../Subtitles";
import { Background } from "../Background";
import { VoiceOver } from "../VoiceOver";
import type { TimedCaption } from "../timings";

type Props = {
  durationInFrames: number;
  slogan: string;
  tagline: string;
  hint: string;
  captions: readonly TimedCaption[];
  broll?: string;
  audio?: string | null;
};

export const CTAScene: React.FC<Props> = ({
  durationInFrames,
  slogan,
  tagline,
  hint,
  captions,
  broll,
  audio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useSceneFade(durationInFrames);

  const sloganIn = spring({
    frame,
    fps,
    config: { damping: 16, mass: 0.6 },
  });
  const taglineIn = spring({
    frame: frame - 18,
    fps,
    config: { damping: 200 },
  });

  // 引导按钮呼吸：每 60 帧（2s）一个循环。
  // 用取模而不是写死一串关键帧——段落时长由配音长度决定后会变，取模能自适应。
  const breath = interpolate(frame % 60, [0, 30, 60], [0.95, 1.05, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_FAMILY,
        opacity: fade,
        justifyContent: "space-between",
        alignItems: "center",
        padding: "320px 80px 80px",
      }}
    >
      <Background broll={broll} />
      <VoiceOver audio={audio} />
      <div
        style={{
          opacity: sloganIn,
          transform: `scale(${0.7 + 0.3 * sloganIn}) translateY(${
            (1 - sloganIn) * 40
          }px)`,
          fontSize: 168,
          fontWeight: 800,
          color: "#3D2B1F",
          letterSpacing: 12,
        }}
      >
        {slogan}
      </div>
      <div
        style={{
          opacity: taglineIn,
          transform: `translateY(${(1 - taglineIn) * 30}px)`,
          fontSize: 56,
          fontWeight: 400,
          color: "#8A6A52",
          letterSpacing: 4,
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          transform: `scale(${breath})`,
          padding: "24px 56px",
          borderRadius: 999,
          background: "#E8885A",
          color: "#FFF",
          fontSize: 48,
          fontWeight: 600,
          letterSpacing: 3,
          boxShadow: "0 12px 30px rgba(232, 136, 90, 0.35)",
          marginBottom: SAFE_BOTTOM - 80,
        }}
      >
        {hint}
      </div>
      {/* CTA 底部呼吸按钮占位，字幕整体抬高一些避免遮挡 */}
      <Subtitles captions={captions} bottomOffset={200} />
    </AbsoluteFill>
  );
};
