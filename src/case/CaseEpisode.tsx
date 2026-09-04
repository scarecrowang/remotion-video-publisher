import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { buildCaseShots, caseAudioSrc } from "./caseData";
import { CaseScene } from "./CaseScene";

// 主合成：把多镜信息卡用 <Series> 串成一支竖屏速览片。
// 每镜 = Sequence(时长=配音实测) + 场景 + 对应音频轨道。
export const CaseEpisode: React.FC = () => {
  const shots = buildCaseShots();
  return (
    <AbsoluteFill>
      <Series>
        {shots.map((shot, i) => {
          const audio = caseAudioSrc(i);
          return (
            <Series.Sequence key={i} durationInFrames={shot.duration}>
              <CaseScene shot={shot} theme={shot.fields.theme as string} />
              {audio ? <Audio src={staticFile(audio)} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
