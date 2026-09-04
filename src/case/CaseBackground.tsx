import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import type { CasePalette } from "./caseTheme";

// 纯信息卡背景：题材渐变 + 细网格装饰。
// 当有 broll 视频时，底层播放竖屏视频 + 暗色渐变叠加层，文字在顶层保持可读。
// 重要：B-roll 视频必须静音（volume={0}），原声会与 TTS 配音冲突，观众听到的是旁白而非素材原声。
type Props = {
  palette: CasePalette;
  brollVideo?: string | null; // public/ 下的视频路径（如 broll/xxx.mp4）
};

export const CaseBackground: React.FC<Props> = ({ palette, brollVideo }) => {
  return (
    <AbsoluteFill>
      {/* B-roll 视频背景（如果有） */}
      {brollVideo && (
        <AbsoluteFill>
          <OffthreadVideo
            src={staticFile(brollVideo)}
            volume={0}
            style={{
              objectFit: "cover",
              width: "100%",
              height: "100%",
            }}
          />
          {/* 可读性遮罩层：深浅随题材 palette.brollOverlay 定（energy暗/counseling暖），文字在视频上保持可读 */}
          <AbsoluteFill style={{ background: palette.brollOverlay }} />
        </AbsoluteFill>
      )}

      {/* 纯信息卡渐变背景（无 broll 时显示，有 broll 时作为底层兜底） */}
      <AbsoluteFill
        style={{
          background: brollVideo
            ? "transparent"
            : `linear-gradient(155deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`,
        }}
      >
        {/* 顶部一抹氛围光 */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(120% 40% at 50% -10%, ${palette.accentSoft}, transparent 70%)`,
            opacity: 0.6,
          }}
        />
        {/* 细网格——只在无 broll 时显示，避免遮挡视频 */}
        {!brollVideo && (
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(${palette.accentSoft} 1px, transparent 1px), linear-gradient(90deg, ${palette.accentSoft} 1px, transparent 1px)`,
              backgroundSize: "90px 90px",
              opacity: 0.12,
            }}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};