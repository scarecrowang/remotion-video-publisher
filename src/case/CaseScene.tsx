import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaseBackground } from "./CaseBackground";
import { CaseSubtitles } from "./CaseSubtitles";
import { fval, type CaseShotData } from "./caseData";
import { casePalette, PAD_X, PAD_TOP } from "./caseTheme";
import { CASE_META } from "../case.generated";

// 把一镜的数据按卡型渲染成竖屏信息卡。
// 共用版式：背景 → (上部 kicker 标签 → 内容区) → 底部卡拉OK字幕。
type Props = { shot: CaseShotData; theme?: string };

export const CaseScene: React.FC<Props> = ({ shot, theme }) => {
  const palette = casePalette(theme);
  const type = shot.type;

  // 统一的入场节奏：内容元素错峰淡入上移
  if (type === "head") return <HeadShot shot={shot} palette={palette} />;
  if (type === "out") return <OutShot shot={shot} palette={palette} />;
  if (type === "data") return <DataShot shot={shot} palette={palette} />;
  if (type === "stats") return <StatsShot shot={shot} palette={palette} />;
  if (type === "theory")
    return <TheoryShot shot={shot} palette={palette} />;
  // points 及未知类型都走要点布局
  return <PointsShot shot={shot} palette={palette} />;
};

// ---- 共用小组件 ----
const KickLabel: React.FC<{ text: string; palette: ReturnType<typeof casePalette>; enter: number }> = ({
  text,
  palette,
  enter,
}) => (
  <div
    style={{
      opacity: enter,
      transform: `translateY(${(1 - enter) * 20}px)`,
      alignSelf: "flex-start",
      padding: "16px 32px",
      borderRadius: 999,
      border: `1.5px solid ${palette.accentSoft}`,
      background: "rgba(255,255,255,0.05)",
      color: palette.accent,
      fontSize: 36,
      fontWeight: 500,
      letterSpacing: 4,
    }}
  >
    {text}
  </div>
);

const useEnters = (fps: number, frame: number, base = 8, step = 10) => {
  const fade = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const e = (i: number) =>
    spring({ frame: frame - (base + i * step), fps, config: { damping: 200 } });
  return { fade, e };
};

// 镜尾统一淡出，方便切换
const useOut = (duration: number, fadeFrames = 12) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [Math.max(0, duration - fadeFrames), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

// ---- 片头卡 ----
const HeadShot: React.FC<{ shot: CaseShotData; palette: ReturnType<typeof casePalette> }> = ({
  shot,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = String(fval(shot.fields, "title") ?? metaTitle());
  const subtitle = String(fval(shot.fields, "subtitle") ?? "");
  const { fade } = useEnters(fps, frame, 4);
  const titleIn = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const subIn = spring({ frame: frame - 12, fps, config: { damping: 200 } });
  const out = useOut(shot.duration);

  return (
    <Shell shot={shot} palette={palette} opacity={fade * out}>
      <div style={{ flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div
          style={{
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 20}px)`,
            color: palette.accent,
            fontSize: 40,
            letterSpacing: 4,
            marginBottom: 48,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            opacity: titleIn,
            transform: `scale(${0.92 + 0.08 * titleIn}) translateY(${(1 - titleIn) * 30}px)`,
            color: palette.textMain,
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.25,
            textAlign: "center",
            maxWidth: 860,
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: 140,
            height: 6,
            borderRadius: 3,
            background: palette.accent,
            marginTop: 56,
            opacity: titleIn,
          }}
        />
      </div>
    </Shell>
  );
};
const CASE_TITLE_FALLBACK = "数智化转型案例";
const metaTitle = (): string => String((CASE_META as { title?: string }).title ?? CASE_TITLE_FALLBACK);

// ---- 片尾卡 ----
const OutShot: React.FC<{ shot: CaseShotData; palette: ReturnType<typeof casePalette> }> = ({
  shot,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slogan = String(fval(shot.fields, "slogan") ?? "");
  const tagline = String(fval(shot.fields, "tagline") ?? "");
  const sloganIn = spring({ frame, fps, config: { damping: 16, mass: 0.6 } });
  const tagIn = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const breath = interpolate(frame % 60, [0, 30, 60], [0.96, 1.04, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = useOut(shot.duration);
  return (
    <Shell shot={shot} palette={palette} opacity={out}>
      <div style={{ flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div
          style={{
            opacity: sloganIn,
            transform: `scale(${0.9 + 0.1 * sloganIn})`,
            color: palette.textMain,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.3,
            textAlign: "center",
            maxWidth: 880,
          }}
        >
          {slogan}
        </div>
        <div
          style={{
            opacity: tagIn,
            transform: `scale(${tagIn * breath})`,
            marginTop: 90,
            padding: "26px 60px",
            borderRadius: 999,
            background: palette.accent,
            color: "#0A1A33",
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {tagline}
        </div>
      </div>
    </Shell>
  );
};

// ---- 要点卡（痛点/方案通用）----
const PointsShot: React.FC<{ shot: CaseShotData; palette: ReturnType<typeof casePalette> }> = ({
  shot,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  const points = fval(shot.fields, "point");
  const list = (Array.isArray(points) ? points : points ? [points] : []).slice(0, 4);
  const { fade, e } = useEnters(fps, frame, 14, 12);
  const out = useOut(shot.duration);
  const scale = Math.min(1, AVAILABLE_H / (estimatePointsH(shot) || 1));

  return (
    <Shell shot={shot} palette={palette} opacity={fade * out} contentScale={scale}>
      <div style={{ flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
        {kicker && (
          <KickLabel text={kicker} palette={palette} enter={e(0)} />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 44,
            marginTop: 72,
            width: "100%",
          }}
        >
          {list.map((p, i) => (
            <div
              key={i}
              style={{
                opacity: e(i + 1),
                transform: `translateX(${(1 - e(i + 1)) * -36}px)`,
                display: "flex",
                alignItems: "flex-start",
                gap: 30,
                padding: "40px 44px",
                borderRadius: 24,
                background: palette.cardBg,
                border: `1.5px solid ${palette.cardBorder}`,
              }}
            >
              <div
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: 6,
                  background: palette.accent,
                  marginTop: 18,
                }}
              />
              <div
                style={{
                  color: palette.textMain,
                  fontSize: 52,
                  fontWeight: 500,
                  lineHeight: 1.45,
                }}
              >
                {p}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ---- 大数字卡 ----
const DataShot: React.FC<{ shot: CaseShotData; palette: ReturnType<typeof casePalette> }> = ({
  shot,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  const value = String(fval(shot.fields, "value") ?? "");
  const label = String(fval(shot.fields, "label") ?? "");
  const { fade, e } = useEnters(fps, frame, 10, 10);
  const out = useOut(shot.duration);
  const valueIn = spring({ frame: frame - 20, fps, config: { damping: 12, mass: 0.6 } });

  return (
    <Shell shot={shot} palette={palette} opacity={fade * out}>
      <div style={{ flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
        {kicker && <KickLabel text={kicker} palette={palette} enter={e(0)} />}
        <div style={{ marginTop: 60 }} />
        <div
          style={{
            opacity: valueIn,
            transform: `scale(${0.6 + 0.4 * valueIn})`,
            color: palette.accent,
            fontSize: 260,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: 2,
          }}
        >
          {value}
        </div>
        <div
          style={{
            opacity: e(2),
            marginTop: 48,
            color: palette.textSub,
            fontSize: 60,
            fontWeight: 400,
            letterSpacing: 3,
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 56,
            width: 200,
            height: 5,
            borderRadius: 3,
            background: palette.accent,
            opacity: valueIn,
          }}
        />
      </div>
    </Shell>
  );
};

// ---- 认知拆解卡（theory）----
// 适用「拆开一个规律/概念/比例」的科普向内容（心理疏导、知识科普等通用）。
// 版式：kicker 标签 + 居中大 headline（如 7-38-55 / 概念词）+ 若干「数值 说明」要点行。
const TheoryShot: React.FC<{
  shot: CaseShotData;
  palette: ReturnType<typeof casePalette>;
}> = ({ shot, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  const headline = String(fval(shot.fields, "headline") ?? "");
  const rows = fval(shot.fields, "row") ?? fval(shot.fields, "point");
  const list = (Array.isArray(rows) ? rows : rows ? [rows] : []).slice(0, 4);
  const { fade, e } = useEnters(fps, frame, 10, 10);
  const out = useOut(shot.duration);
  const headIn = spring({ frame: frame - 16, fps, config: { damping: 14, mass: 0.7 } });
  const scale = Math.min(1, AVAILABLE_H / (estimateTheoryH(shot) || 1));

  return (
    <Shell shot={shot} palette={palette} opacity={fade * out} contentScale={scale}>
      <div style={{ flexDirection: "column", alignItems: "center", width: "100%" }}>
        {kicker && (
          <div style={{ alignSelf: "flex-start" }}>
            <KickLabel text={kicker} palette={palette} enter={e(0)} />
          </div>
        )}
        <div
          style={{
            opacity: headIn,
            transform: `scale(${0.7 + 0.3 * headIn})`,
            marginTop: 48,
            color: palette.accent,
            fontSize: 180,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: 2,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {headline}
        </div>
        <div
          style={{
            width: 200,
            height: 5,
            borderRadius: 3,
            background: palette.accent,
            marginTop: 28,
            opacity: headIn,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            marginTop: 56,
            width: "100%",
          }}
        >
          {list.map((r, i) => {
            const [val, ...rest] = String(r).split(" ");
            const desc = rest.join(" ");
            return (
              <div
                key={i}
                style={{
                  opacity: e(i + 1),
                  transform: `translateX(${(1 - e(i + 1)) * -36}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 40,
                  width: "100%",
                  padding: "30px 40px",
                  borderRadius: 22,
                  background: palette.cardBg,
                  border: `1.5px solid ${palette.cardBorder}`,
                }}
              >
                <span
                  style={{
                    color: palette.accent,
                    fontSize: 76,
                    fontWeight: 800,
                    minWidth: 200,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {val}
                </span>
                <span
                  style={{
                    color: palette.textMain,
                    fontSize: 50,
                    fontWeight: 500,
                    flex: 1,
                    wordBreak: "break-word",
                  }}
                >
                  {desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
};

// 估算 theory 卡自然高度（headline + 标题 + rows），供自适应缩放。
const estimateTheoryH = (shot: CaseShotData): number => {
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  const headline = String(fval(shot.fields, "headline") ?? "");
  const rows = getArr(fval(shot.fields, "row") ?? fval(shot.fields, "point")).slice(0, 4);
  let h = 0;
  if (kicker) h += 71; // KickLabel
  if (headline) h += 48 + 180 + 28 + 5 + 56; // headline 块（含 accent 线 + 上方间距）
  else h += 56;
  for (const r of rows) {
    const [val, ...rest] = String(r).split(" ");
    const desc = rest.join(" ");
    const valW = Math.max(200, val.length * 76); // 76px 字号数字实际宽
    const descW = CARD_INNER_W - valW - 40;
    const cpl = Math.max(1, Math.floor(descW / FONT_SIZE));
    const lines = Math.max(1, Math.ceil(desc.length / cpl));
    h += 60 + Math.max(76, lines * LINE_H); // padding + 行高
  }
  h += Math.max(0, rows.length - 1) * 26;
  return Math.round(h * SAFETY_MARGIN);
};

// ---- 多组数字卡 ----
const StatsShot: React.FC<{ shot: CaseShotData; palette: ReturnType<typeof casePalette> }> = ({
  shot,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  const rows = fval(shot.fields, "row");
  const list = (Array.isArray(rows) ? rows : rows ? [rows] : []).slice(0, 4);
  const { fade, e } = useEnters(fps, frame, 12, 12);
  const out = useOut(shot.duration);
  const scale = Math.min(1, AVAILABLE_H / (estimateStatsH(shot) || 1));

  return (
    <Shell shot={shot} palette={palette} opacity={fade * out} contentScale={scale}>
      <div style={{ flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
        {kicker && <KickLabel text={kicker} palette={palette} enter={e(0)} />}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 40,
            marginTop: 64,
            width: "100%",
          }}
        >
          {list.map((row, i) => {
            const [num, ...rest] = String(row).split(" ");
            const desc = rest.join(" ");
            return (
              <div
                key={i}
                style={{
                  opacity: e(i + 1),
                  transform: `translateY(${(1 - e(i + 1)) * 30}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 44,
                  padding: "36px 44px",
                  borderRadius: 24,
                  background: palette.cardBg,
                  border: `1.5px solid ${palette.cardBorder}`,
                }}
              >
                <span
                  style={{
                    color: palette.accent,
                    fontSize: 92,
                    fontWeight: 800,
                    minWidth: 300,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {num}
                </span>
                <span
                  style={{
                    color: palette.textMain,
                    fontSize: 52,
                    fontWeight: 500,
                    flex: 1,
                    wordBreak: "break-word",
                  }}
                >
                  {desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
};

// ---- 内容自适应缩放 ----
// 估算内容自然高度，超出可用空间时自动缩小，保证全部可见不裁剪。
const AVAILABLE_H = 1920 - PAD_TOP - 320; // 内容区可用高度 1360px
const SAFETY_MARGIN = 1.35; // 安全系数：估算值 × 1.35，防止渲染偏差导致溢出

const getArr = (v: string | string[] | undefined): string[] =>
  v ? (Array.isArray(v) ? v : [v]) : [];

// 卡片内可用 width: 1080 - PAD_X*2 - 44*2(卡片padding) = 812px
const CARD_INNER_W = 1080 - PAD_X * 2 - 44 * 2;
const POINT_TEXT_W = CARD_INNER_W - 22 - 30; // 减去 bullet + gap ≈760px
const FONT_SIZE = 52;
const CHARS_PER_LINE_POINT = Math.floor(POINT_TEXT_W / FONT_SIZE); // ≈14
const LINE_H = FONT_SIZE * 1.45; // 行高≈75.4px

// 估算要点卡（PointsShot）的内容高度
const estimatePointsH = (shot: CaseShotData): number => {
  const points = getArr(fval(shot.fields, "point")).slice(0, 4);
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  let h = 0;
  if (kicker) h += 71 + 72; // KickLabel + marginTop
  for (const p of points) {
    const lines = Math.max(1, Math.ceil(p.length / CHARS_PER_LINE_POINT));
    h += 80 + lines * LINE_H; // 卡片padding + 文字高度
  }
  h += Math.max(0, points.length - 1) * 44; // 卡片间距
  return Math.round(h * SAFETY_MARGIN);
};

// 估算数据行卡（StatsShot）的内容高度
// 注意：数字在 92px 字号下每字约 92px，实际描述宽度 = 卡片内宽 - 数字实际宽度 - gap
const estimateStatsH = (shot: CaseShotData): number => {
  const rows = getArr(fval(shot.fields, "row")).slice(0, 4);
  const kicker = String(fval(shot.fields, "kicker") ?? "");
  let h = 0;
  if (kicker) h += 71 + 64; // KickLabel + marginTop
  for (const r of rows) {
    const [num, ...rest] = String(r).split(" ");
    const desc = rest.join(" ");
    // 数字在 92px 字号下每字实际占据 ≈92px，minWidth=300 兜底
    const numW = Math.max(300, num.length * 92);
    const descW = CARD_INNER_W - numW - 44; // gap=44
    const cpl = Math.max(1, Math.floor(descW / FONT_SIZE));
    const lines = Math.max(1, Math.ceil(desc.length / cpl));
    h += 72 + Math.max(92, lines * LINE_H); // padding + 数字/文字最高者
  }
  h += Math.max(0, rows.length - 1) * 40; // 卡片间距
  return Math.round(h * SAFETY_MARGIN);
};

// ---- 外壳：背景 + 内容容器 + 底部字幕 ----
const Shell: React.FC<{
  shot: CaseShotData;
  palette: ReturnType<typeof casePalette>;
  opacity: number;
  children: React.ReactNode;
  contentScale?: number; // 内容自适应缩放系数（0~1）
}> = ({ shot, palette, opacity, children, contentScale = 1 }) => (
  <AbsoluteFill
    style={{
      fontFamily:
        '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    }}
  >
    <CaseBackground palette={palette} brollVideo={shot.brollVideo} />
    <AbsoluteFill
      style={{
        padding: `${PAD_TOP}px ${PAD_X}px 320px`,
      }}
    >
      {/* 内容区：overflow:hidden 是安全兜底，正常情况下 contentScale 已让内容自适应适配 */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflow: "hidden",
          opacity,
        }}
      >
        <div
          style={{
            transform: `scale(${contentScale})`,
            transformOrigin: "top center",
            width: "100%",
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
    <CaseSubtitles captions={shot.captions} palette={palette} />
  </AbsoluteFill>
);
