import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { gradientBackground } from "./theme";

type Props = {
  // public/ 下的相对路径，如 'broll/coffee-shop.mp4'。不传则回退到渐变背景
  broll?: string;
  // B-roll 之上的浅色遮罩强度 (0-1)，保证文字可读
  // 默认 0.72 是为了在 9:16 竖屏里用浅暖色保 Soft Signal 调性
  dim?: number;
};

export const Background: React.FC<Props> = ({ broll, dim = 0.72 }) => {
  // 渐进增强：没传 broll 直接走渐变，传了但文件不存在 staticFile 不会抛错（静默回退）
  if (!broll) {
    return <AbsoluteFill style={{ background: gradientBackground }} />;
  }
  return (
    <>
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(broll)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          muted
        />
      </AbsoluteFill>
      {/* 暖色浅遮罩：压暗 + 拉回 Soft Signal 调性 */}
      <AbsoluteFill
        style={{ background: `rgba(255, 246, 238, ${dim})` }}
      />
    </>
  );
};
