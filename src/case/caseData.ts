// 归一化「分镜稿数据」+「配音时间轴」，产出渲染组件直接消费的结构。
// 文本来自 src/case.generated.ts（case-ingest.mjs 生成），
// 时间轴来自 src/caseTimings.generated.ts（case-tts.mjs 按真实配音时长生成）。

import { CASE_META, CASE_SLUG, CASE_SHOTS } from "../case.generated";
import {
  CASE_AUDIO_AVAILABLE,
  CASE_CAPTION_TIMINGS,
  CASE_SEGMENT_FRAMES,
} from "../caseTimings.generated";

export type CaseCaption = { text: string; start: number; end: number };

export type CaseShotData = {
  type: string;
  fields: Record<string, string | string[] | undefined>;
  // 本镜总帧数（由配音时长决定）
  duration: number;
  // 本镜卡拉OK字幕（可由多条 caption 组成，但速览卡通常一镜一句）
  captions: CaseCaption[];
  // B-roll 视频文件路径（public/broll/ 下），由 case-broll.mjs 下载
  brollVideo: string | null;
};

// 从 possibly-array 字段取值：单值返回 string，多值返回 string[]（首值取回）
const fval = (
  fields: CaseShotData["fields"],
  key: string,
): string | string[] | undefined => fields[key];

export const CASE_SLUG_META = { slug: CASE_SLUG, meta: CASE_META };

// 题材级主题：优先读 md 里 ## meta 的 theme（如 energy/warm/counseling），
// 供渲染层取用。旧稿可能只在单镜写 theme，这里兜底归一。
export const caseMetaTheme = (): string =>
  String((CASE_META as { theme?: string }).theme ?? "energy") || "energy";

export const caseSegmentFrames = (): Record<number, number> =>
  CASE_SEGMENT_FRAMES;

// 把每一镜补上时长 + caption 时间轴
export const buildCaseShots = (): CaseShotData[] =>
  CASE_SHOTS.map((shot, i) => {
    // 每镜 theme：优先该镜自带；否则继承 meta 题材级主题（旧稿单镜无 theme 也不至于漏色）
    if (!shot.fields.theme) shot.fields.theme = caseMetaTheme();
    const rawCaps = shot.fields.caption;
    const capTexts = rawCaps
      ? Array.isArray(rawCaps)
        ? rawCaps
        : [rawCaps]
      : [];
    const timings = CASE_CAPTION_TIMINGS[i] || [];
    const captions: CaseCaption[] = capTexts.map((text, ci) => {
      const t = timings[ci] || { start: 0, end: 0 };
      return { text, start: t.start, end: t.end };
    });
    // B-roll：分镜稿里写了 broll 关键词 → 对应下载的视频文件
    const hasBroll = !!shot.fields.broll;
    return {
      type: shot.type,
      fields: shot.fields,
      duration: CASE_SEGMENT_FRAMES[i] ?? 30,
      captions,
      brollVideo: hasBroll ? `broll/${CASE_SLUG}_${i}.mp4` : null,
    };
  });

// 音频文件（public/case-audio/<slug>_<index>.m4a）
export const caseAudioSrc = (shotIndex: number): string | null =>
  CASE_AUDIO_AVAILABLE
    ? `case-audio/${CASE_SLUG}_${shotIndex}.m4a`
    : null;

export const caseTotalDuration = (): number =>
  CASE_SEGMENT_FRAMES.reduce((a, b) => a + b, 0);

export { fval };
