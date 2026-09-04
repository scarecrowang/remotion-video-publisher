import { interpolate, useCurrentFrame } from "remotion";
import { FPS } from "./script";

// ---- 画布常量 ----
// FPS 定义在 script.ts（数据层），这里再导出，视觉组件照旧从 theme 取
export { FPS };
export const WIDTH = 1080;
export const HEIGHT = 1920;

// 平台底部 UI（点赞/评论/头像）大致会覆盖这一区，CTA 按钮别贴到这里
export const SAFE_BOTTOM = 280;

// ---- 视觉规范：Soft Signal 暖色调 ----
export const COLORS = {
  bgFrom: "#FFF6EE",
  bgTo: "#FFE2C8",
  textPrimary: "#3D2B1F",
  textSecondary: "#8A6A52",
  accent: "#E8885A",
  cardBorder: "rgba(232, 136, 90, 0.25)",
  // 双向共情段的双视角头像，用同色系深浅区分，不破坏暖色调
  avatarMale: "#8A6A52",
  avatarFemale: "#E8885A",
};

export const FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const gradientBackground = `linear-gradient(160deg, ${COLORS.bgFrom} 0%, ${COLORS.bgTo} 100%)`;

// ---- 通用 hook：段落级淡出（最后 fadeFrames 帧 opacity 1→0，方便串联时叠化） ----
export const useSceneFade = (durationInFrames: number, fadeFrames = 14) => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [Math.max(0, durationInFrames - fadeFrames), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};
