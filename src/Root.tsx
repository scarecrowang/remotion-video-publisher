import { AbsoluteFill, Composition, Series } from "remotion";
import { CaseEpisode } from "./case/CaseEpisode";
import { caseTotalDuration } from "./case/caseData";
import {
  FPS,
  HEIGHT,
  WIDTH,
  FONT_FAMILY,
  gradientBackground,
} from "./theme";
import { OpeningScene } from "./scenes/Opening";
import { PsychologyScene } from "./scenes/Psychology";
import { EmpathyScene } from "./scenes/Empathy";
import { CTAScene } from "./scenes/CTA";
import { SCRIPT } from "./script";
import {
  TIMED_CAPTIONS,
  audioSrc,
  segmentDuration,
  totalDuration,
} from "./timings";

// 段落时长不再写死——由配音的真实长度决定（scripts/tts.mjs 实测）。
// 好处：改文案 → 重跑 npm run tts → 片长自动跟着变，不用手动调帧数。
const DUR = {
  opening: segmentDuration("opening"),
  psychology: segmentDuration("psychology"),
  empathy: segmentDuration("empathy"),
  cta: segmentDuration("cta"),
};
const TOTAL = totalDuration();

// 主合成：四段串联
// Opening → Psychology → Empathy → CTA
// 匹配"幽默开场破冰 → 认知拆解 → 双向共情 → slogan 收尾"的内容框架
const MyComponent: React.FC = () => {
  const { opening, psychology, empathy, cta } = SCRIPT;
  return (
    <AbsoluteFill
      style={{ background: gradientBackground, fontFamily: FONT_FAMILY }}
    >
      <Series>
        <Series.Sequence durationInFrames={DUR.opening}>
          <OpeningScene
            durationInFrames={DUR.opening}
            hook={opening.hook}
            punchline={opening.punchline}
            captions={TIMED_CAPTIONS.opening}
            broll={opening.broll}
            audio={audioSrc("opening")}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={DUR.psychology}>
          <PsychologyScene
            durationInFrames={DUR.psychology}
            label={psychology.label}
            headline={psychology.headline}
            points={psychology.points}
            captions={TIMED_CAPTIONS.psychology}
            broll={psychology.broll}
            audio={audioSrc("psychology")}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={DUR.empathy}>
          <EmpathyScene
            durationInFrames={DUR.empathy}
            heading={empathy.heading}
            maleLabel={empathy.maleLabel}
            maleText={empathy.maleText}
            femaleLabel={empathy.femaleLabel}
            femaleText={empathy.femaleText}
            captions={TIMED_CAPTIONS.empathy}
            broll={empathy.broll}
            audio={audioSrc("empathy")}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={DUR.cta}>
          <CTAScene
            durationInFrames={DUR.cta}
            slogan={cta.slogan}
            tagline={cta.tagline}
            hint={cta.hint}
            captions={TIMED_CAPTIONS.cta}
            broll={cta.broll}
            audio={audioSrc("cta")}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 主合成：完整四段串联 */}
      <Composition
        id="MyComp"
        component={MyComponent}
        durationInFrames={TOTAL}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* 独立分镜：方便在 Studio 里单独预览 / 渲染 */}
      <Composition
        id="Opening"
        component={OpeningScene}
        durationInFrames={DUR.opening}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          durationInFrames: DUR.opening,
          hook: SCRIPT.opening.hook,
          punchline: SCRIPT.opening.punchline,
          captions: TIMED_CAPTIONS.opening,
          broll: SCRIPT.opening.broll,
          audio: audioSrc("opening"),
        }}
      />
      <Composition
        id="Psychology"
        component={PsychologyScene}
        durationInFrames={DUR.psychology}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          durationInFrames: DUR.psychology,
          label: SCRIPT.psychology.label,
          headline: SCRIPT.psychology.headline,
          points: SCRIPT.psychology.points,
          captions: TIMED_CAPTIONS.psychology,
          broll: SCRIPT.psychology.broll,
          audio: audioSrc("psychology"),
        }}
      />
      <Composition
        id="Empathy"
        component={EmpathyScene}
        durationInFrames={DUR.empathy}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          durationInFrames: DUR.empathy,
          heading: SCRIPT.empathy.heading,
          maleLabel: SCRIPT.empathy.maleLabel,
          maleText: SCRIPT.empathy.maleText,
          femaleLabel: SCRIPT.empathy.femaleLabel,
          femaleText: SCRIPT.empathy.femaleText,
          captions: TIMED_CAPTIONS.empathy,
          broll: SCRIPT.empathy.broll,
          audio: audioSrc("empathy"),
        }}
      />
      <Composition
        id="CTA"
        component={CTAScene}
        durationInFrames={DUR.cta}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          durationInFrames: DUR.cta,
          slogan: SCRIPT.cta.slogan,
          tagline: SCRIPT.cta.tagline,
          hint: SCRIPT.cta.hint,
          captions: TIMED_CAPTIONS.cta,
          broll: SCRIPT.cta.broll,
          audio: audioSrc("cta"),
        }}
      />
      {/* 案例速览片引擎：内容来自 content/<slug>.md → src/case.generated.ts */}
      <Composition
        id="CaseEpisode"
        component={CaseEpisode}
        durationInFrames={caseTotalDuration()}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
