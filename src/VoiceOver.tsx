import { Audio, staticFile } from "remotion";

/**
 * 段落配音轨道。
 *
 * 放在场景组件内部（而不是 Root），这样独立分镜单独渲染时也自带配音，
 * 且帧号是段落内的相对帧，音频天然从段落开头播起。
 *
 * audio 为 null 表示还没跑过 `npm run tts`，此时不渲染，片子保持静音可渲染。
 */
export const VoiceOver: React.FC<{ audio?: string | null }> = ({ audio }) => {
  if (!audio) return null;
  return <Audio src={staticFile(audio)} />;
};
