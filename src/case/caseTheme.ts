// 题材级调色。每个题材 = 一份 palette，渲染组件按 CASE_META.theme 取用。

export type CasePalette = {
  id: string;
  // 背景渐变（深底科技感，信息卡适合深底亮字）
  bgFrom: string;
  bgTo: string;
  textMain: string; // 大标题/正文主字
  textSub: string; // 次要文字
  accent: string; // 强调：大数字、kicker 标签、进度
  accentSoft: string; // accent 的浅色描边
  cardBg: string; // 卡片半透明底
  cardBorder: string;
  // 有 broll 视频时的文字可读性遮罩（叠加在视频上）。深浅随题材定：
  //   深底题材(energy)用暗色遮罩；暖底题材(warm/counseling)用柔和浅色遮罩，避免盖掉暖调。
  brollOverlay: string; // CSS 渐变字符串（叠加层背景）
};

// energy：企业数智化转型案例 —— 深蓝 + 电光青
export const ENERGY: CasePalette = {
  id: "energy",
  bgFrom: "#0A1A33",
  bgTo: "#0F2E52",
  textMain: "#F1F6FD",
  textSub: "#9DB3CC",
  accent: "#4FD1E5",
  accentSoft: "rgba(79, 209, 229, 0.35)",
  cardBg: "rgba(255, 255, 255, 0.05)",
  cardBorder: "rgba(79, 209, 229, 0.28)",
  brollOverlay:
    "linear-gradient(135deg, rgba(10,26,51,0.88) 0%, rgba(10,26,51,0.68) 50%, rgba(10,26,51,0.88) 100%)",
};

// warm：备用暖色（若某些案例想走亲和路线）
export const WARM: CasePalette = {
  id: "warm",
  bgFrom: "#FFF6EE",
  bgTo: "#FFE2C8",
  textMain: "#3D2B1F",
  textSub: "#8A6A52",
  accent: "#E8885A",
  accentSoft: "rgba(232, 136, 90, 0.25)",
  cardBg: "rgba(255, 255, 255, 0.5)",
  cardBorder: "rgba(232, 136, 90, 0.25)",
  brollOverlay:
    "linear-gradient(150deg, rgba(255,243,232,0.86) 0%, rgba(255,230,210,0.72) 50%, rgba(255,243,232,0.86) 100%)",
};

// counseling：心理疏导赛道 —— 暖调、柔和亲近（9:16 竖屏口播向）
// 文字用深棕保证在暖底/视频上都可读，accent 用偏红的活力色吸引注意力。
export const COUNSELING: CasePalette = {
  id: "counseling",
  bgFrom: "#FFF4EA",
  bgTo: "#FFDCC9",
  textMain: "#3A2B22",
  textSub: "#96705A",
  accent: "#F06449",
  accentSoft: "rgba(240, 100, 73, 0.28)",
  cardBg: "rgba(255, 255, 255, 0.55)",
  cardBorder: "rgba(240, 100, 73, 0.25)",
  brollOverlay:
    "linear-gradient(150deg, rgba(255,244,234,0.86) 0%, rgba(255,230,214,0.72) 50%, rgba(255,244,234,0.86) 100%)",
};

export const CASE_PALETTES: Record<string, CasePalette> = {
  energy: ENERGY,
  warm: WARM,
  counseling: COUNSELING,
};

export const casePalette = (theme?: string): CasePalette =>
  CASE_PALETTES[theme || "energy"] || ENERGY;

// 信息卡安全边距（9:16 竖屏，避免贴近边缘 + 底部字幕遮挡）
export const PAD_X = 90;
export const PAD_TOP = 240;