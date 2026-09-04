// 把「文案」和「配音时间轴」拼起来的地方。
//
// 时间轴的唯一来源是 src/timings.generated.ts（scripts/tts.mjs 按真实音频时长生成）。
// 仓库里默认带的是一份估算值，跑过 `npm run tts` 之后被真实值覆盖——
// 所以没配音也能渲染，有配音就自动同步，不需要改任何组件代码。

import { SEGMENT_KEYS, SCRIPT, type SegmentKey } from "./script";
import {
  AUDIO_AVAILABLE,
  CAPTION_TIMINGS,
  SEGMENT_FRAMES,
} from "./timings.generated";

export type TimedCaption = {
  text: string;
  start: number; // 起止帧，来自音频实测
  end: number;
};

export const segmentDuration = (key: SegmentKey): number =>
  SEGMENT_FRAMES[key];

export const totalDuration = (): number =>
  SEGMENT_KEYS.reduce((sum, key) => sum + SEGMENT_FRAMES[key], 0);

export const buildCaptions = (key: SegmentKey): readonly TimedCaption[] =>
  SCRIPT[key].captions.map((text, i) => {
    const t = CAPTION_TIMINGS[key][i];
    return { text, start: t.start, end: t.end };
  });

// 音频文件（相对 public/）。没生成过配音时返回 null，组件就不挂 <Audio>
export const audioSrc = (key: SegmentKey): string | null =>
  AUDIO_AVAILABLE ? `audio/${key}.m4a` : null;

// 预先算好，避免在组件里重复计算
export const TIMED_CAPTIONS: Record<SegmentKey, readonly TimedCaption[]> =
  Object.fromEntries(
    SEGMENT_KEYS.map((key) => [key, buildCaptions(key)]),
  ) as Record<SegmentKey, readonly TimedCaption[]>;
