// 集中管理视频文案——改这里，整个项目的所有合成自动同步
// 既给主合成 MyComp 用，也给独立分镜（Opening / Psychology / Empathy / CTA）用
// scripts/tts.mjs 也直接 import 这里的 SCRIPT，文案只有这一份来源

// 帧率定义在这里（数据层），theme.ts 再导出给视觉组件用
// 这样 TTS 脚本不用碰 remotion 依赖就能拿到 FPS
export const FPS = 30;

// 无配音时的兜底时长（秒）。跑 `npm run tts` 生成配音后，
// 段落时长会由音频真实长度决定，这里的常量只作为回退值。
export const OPENING_DUR = 150; // 5s
export const PSYCH_DUR = 210; // 7s
export const EMPATHY_DUR = 240; // 8s
export const CTA_DUR = 180; // 6s
export const TOTAL_DUR =
  OPENING_DUR + PSYCH_DUR + EMPATHY_DUR + CTA_DUR; // 26s

// 口播文案只写文本——每句占多少帧由 scripts/tts.mjs 按真实音频时长算出来，
// 写死帧数必然和配音对不上（字幕切走了话还没说完），所以这里不存时长
export const SCRIPT = {
  opening: {
    hook: "社交冷场，真不是因为你不会聊",
    punchline: "是把力气全用错了地方",
    captions: ["你以为社交靠的是会聊天", "其实第一眼早就定了"],
    // B-roll 关键词提示（scripts/fetch-broll.mjs 用）；下载后填到 broll 字段
    brollQuery: "nervous first date waiting",
    broll: "broll/nervous-first-date-waiting.mp4",
  },
  psychology: {
    label: "梅拉宾法则",
    headline: "7-38-55",
    points: [
      { value: "7%", text: "说话内容" },
      { value: "38%", text: "语音语调" },
      { value: "55%", text: "表情肢体" },
    ],
    captions: [
      "心理学有个梅拉宾法则",
      "说话内容只占百分之七",
      "语调和肢体占剩下九十三",
    ],
    brollQuery: "conversation body language",
    broll: "broll/conversation-body-language.mp4",
  },
  empathy: {
    heading: "同一场社交，两种紧张",
    maleLabel: "他",
    maleText: "他怕说错话，每句都在心里过一遍",
    femaleLabel: "她",
    femaleText: "她以为他敷衍，其实他手心也在出汗",
    captions: [
      "男生在想，我这样说会不会太刻意",
      "女生在想，他是不是对我没兴趣",
      "其实两个人都在紧张",
    ],
    brollQuery: "two people coffee shop",
    broll: "broll/two-people-coffee-shop.mp4",
  },
  cta: {
    slogan: "晚遇知缘",
    tagline: "看透社交的底层逻辑",
    hint: "关注我 · 脱单不靠运气",
    captions: ["所以别再背话术了", "把状态调到最好", "比背十套开场白都管用"],
    brollQuery: "sunset city warm light",
    broll: "broll/sunset-city-warm-light.mp4",
  },
} as const;

export type SegmentKey = keyof typeof SCRIPT;
export const SEGMENT_KEYS = [
  "opening",
  "psychology",
  "empathy",
  "cta",
] as const satisfies readonly SegmentKey[];

// 段落名 → 兜底时长，tts 脚本与 timings.ts 共用
export const FALLBACK_FRAMES: Record<SegmentKey, number> = {
  opening: OPENING_DUR,
  psychology: PSYCH_DUR,
  empathy: EMPATHY_DUR,
  cta: CTA_DUR,
};