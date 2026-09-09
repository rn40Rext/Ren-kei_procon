import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, G, Rect, Line, Defs, Pattern } from 'react-native-svg';
import { colors, fontFamily } from '../theme';

/**
 * 阿波踊りの意匠モチーフ（SVG）。
 * 提灯・青海波（鳴門の波）・組み紐・連紋など、和の装飾を画面に散らすための部品。
 * 画像アセットに依存せず、色はテーマトークンから取る。
 */

/* ------------------------------------------------------------------ */
/* 高張提灯                                                            */
/* ------------------------------------------------------------------ */
export function Chochin({
  size = 22,
  color = colors.aka,
  glow = colors.goldBright,
  lit = true,
  style,
}: {
  size?: number;
  color?: string;
  glow?: string;
  lit?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const w = size;
  const h = size * 1.35;
  return (
    <Svg width={w} height={h} viewBox="0 0 20 27" style={style}>
      {/* 上下の口木 */}
      <Rect x="7" y="1" width="6" height="2.4" rx="0.6" fill={colors.kinari} />
      <Rect x="7" y="23.6" width="6" height="2.4" rx="0.6" fill={colors.kinari} />
      {/* 火袋 */}
      <Path
        d="M6 3.4h8c1.4 2.6 2 5 2 8.1 0 3.1-.6 5.5-2 8.1H6c-1.4-2.6-2-5-2-8.1 0-3.1.6-5.5 2-8.1z"
        fill={lit ? glow : color}
        opacity={lit ? 0.92 : 1}
      />
      <Path
        d="M6 3.4h8c1.4 2.6 2 5 2 8.1 0 3.1-.6 5.5-2 8.1H6c-1.4-2.6-2-5-2-8.1 0-3.1.6-5.5 2-8.1z"
        fill="none"
        stroke={color}
        strokeWidth="1.1"
      />
      {/* 骨（横筋） */}
      {[6.4, 9, 11.6, 14.2, 16.8].map((y) => (
        <Line key={y} x1="4.2" y1={y} x2="15.8" y2={y} stroke={color} strokeWidth="0.5" opacity={0.55} />
      ))}
      {/* 房 */}
      <Line x1="10" y1="26" x2="10" y2="27" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

/** 提灯を横に並べた飾り（ヘッダー・フッター用） */
export function ChochinRow({
  count = 5,
  size = 18,
  style,
}: {
  count?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
        style,
      ]}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Chochin key={i} size={size} lit={i % 2 === 0} />
      ))}
    </View>
  );
}

/**
 * 提灯の吊り飾り（弓なりの綱から提灯がぶら下がる）。
 * 祭りの会場を横断する提灯行列の見立て。ヘッダー・ヒーロー上部などに全幅で置く。
 */
export function ChochinGarland({
  width,
  count = 6,
  height = 46,
  sag = 10,
  style,
}: {
  width: number;
  count?: number;
  height?: number;
  sag?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const cordY = 6;
  const cordMidY = cordY + sag;
  const bodyW = 12;
  const bodyH = 17;
  // 綱上の等間隔位置と、そこでの綱の高さ（放物線近似）
  const nodes = Array.from({ length: count }).map((_, i) => {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const x = t * width;
    const y = cordY + sag * 4 * t * (1 - t); // 0→中央最大→0
    return { x, y };
  });
  return (
    <View style={style} pointerEvents="none">
      <Svg width={width} height={height}>
        {/* 綱 */}
        <Path
          d={`M0 ${cordY} Q ${width / 2} ${cordMidY + 4} ${width} ${cordY}`}
          fill="none"
          stroke={colors.gold}
          strokeWidth={1}
          opacity={0.6}
        />
        {nodes.map((n, i) => {
          const lit = i % 2 === 0;
          const bodyFill = lit ? colors.goldBright : colors.akaDeep;
          const frame = lit ? colors.gold : colors.aka;
          const topY = n.y + 3;
          return (
            <G key={i}>
              {/* 吊り紐 */}
              <Line x1={n.x} y1={n.y} x2={n.x} y2={topY} stroke={colors.gold} strokeWidth={0.8} opacity={0.7} />
              {/* 口木 */}
              <Rect x={n.x - 3} y={topY} width={6} height={1.6} rx={0.5} fill={colors.kinari} />
              {/* 火袋 */}
              <Path
                d={`M ${n.x - bodyW / 2 + 1} ${topY + 2}
                    h ${bodyW - 2}
                    q 2 ${bodyH * 0.28} 2 ${bodyH * 0.5}
                    q 0 ${bodyH * 0.28} -2 ${bodyH * 0.5}
                    h -${bodyW - 2}
                    q -2 -${bodyH * 0.28} -2 -${bodyH * 0.5}
                    q 0 -${bodyH * 0.28} 2 -${bodyH * 0.5} z`}
                fill={bodyFill}
                stroke={frame}
                strokeWidth={0.9}
              />
              {/* 横骨 */}
              {[0.3, 0.5, 0.7].map((k) => (
                <Line
                  key={k}
                  x1={n.x - bodyW / 2 + 0.5}
                  y1={topY + 2 + bodyH * k}
                  x2={n.x + bodyW / 2 - 0.5}
                  y2={topY + 2 + bodyH * k}
                  stroke={frame}
                  strokeWidth={0.4}
                  opacity={0.5}
                />
              ))}
              {/* 房 */}
              <Line x1={n.x} y1={topY + 2 + bodyH} x2={n.x} y2={topY + 4 + bodyH} stroke={frame} strokeWidth={1} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 青海波（鳴門の波）— 帯・背景                                          */
/* ------------------------------------------------------------------ */
export function SeigaihaBand({
  width,
  height = 16,
  color = colors.gold,
  opacity = 0.5,
  style,
}: {
  width: number;
  height?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const unit = height * 2;
  const cols = Math.ceil(width / unit) + 1;
  const arcs = (cx: number, cy: number) =>
    [1, 0.66, 0.33].map((k, i) => (
      <Path
        key={i}
        d={`M ${cx - height * k} ${cy} A ${height * k} ${height * k} 0 0 1 ${cx + height * k} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={opacity}
      />
    ));
  return (
    <View style={style}>
      <Svg width={width} height={height}>
        <G>
          {Array.from({ length: cols }).map((_, c) => (
            <G key={c}>
              {arcs(c * unit, height)}
              {arcs(c * unit + height, height)}
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}

/** 麻の葉パターンの薄い背景（カードの隅などに敷く） */
export function AsanohaBackground({
  width,
  height,
  color = colors.gold,
  opacity = 0.06,
  style,
}: {
  width: number;
  height: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const s = 26;
  return (
    <View style={[{ position: 'absolute' }, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="asanoha" width={s} height={s} patternUnits="userSpaceOnUse">
            <G stroke={color} strokeWidth={0.8} opacity={opacity} fill="none">
              <Path d={`M${s / 2} 0 L${s} ${s / 4} L${s} ${(s * 3) / 4} L${s / 2} ${s} L0 ${(s * 3) / 4} L0 ${s / 4} Z`} />
              <Path d={`M${s / 2} 0 L${s / 2} ${s} M0 ${s / 4} L${s} ${(s * 3) / 4} M${s} ${s / 4} L0 ${(s * 3) / 4}`} />
            </G>
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#asanoha)" />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 全幅の飾り罫（阿波おどり公式サイト風のセクション区切り）              */
/* ------------------------------------------------------------------ */
export function AwaDivider({
  width,
  label,
  color = colors.gold,
  style,
}: {
  width: number;
  label?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const h = 22;
  const cx = width / 2;
  const gap = label ? 42 : 9;
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={width} height={h}>
        <G stroke={color} strokeWidth={1} opacity={0.7}>
          <Line x1={0} y1={h / 2} x2={cx - gap} y2={h / 2} />
          <Line x1={cx + gap} y1={h / 2} x2={width} y2={h / 2} />
        </G>
        <G stroke={color} strokeWidth={0.6} opacity={0.35}>
          <Line x1={0} y1={h / 2 + 3} x2={cx - gap} y2={h / 2 + 3} />
          <Line x1={cx + gap} y1={h / 2 + 3} x2={width} y2={h / 2 + 3} />
        </G>
        {/* 中央の菱（木札の意匠） */}
        <Path
          d={`M ${cx} ${h / 2 - 5} L ${cx + 5} ${h / 2} L ${cx} ${h / 2 + 5} L ${cx - 5} ${h / 2} Z`}
          fill={color}
        />
        <Path
          d={`M ${cx - 9} ${h / 2} L ${cx - 5} ${h / 2 - 3} M ${cx - 9} ${h / 2} L ${cx - 5} ${h / 2 + 3}`}
          stroke={color}
          strokeWidth={1}
          fill="none"
        />
        <Path
          d={`M ${cx + 9} ${h / 2} L ${cx + 5} ${h / 2 - 3} M ${cx + 9} ${h / 2} L ${cx + 5} ${h / 2 + 3}`}
          stroke={color}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
      {label ? <Text style={{ ...dividerLabel, color }}>{label}</Text> : null}
    </View>
  );
}

const dividerLabel = {
  position: 'absolute' as const,
  fontSize: 10,
  letterSpacing: 3,
  fontFamily: fontFamily.serif,
};

/* ------------------------------------------------------------------ */
/* 組み紐風の区切り線                                                   */
/* ------------------------------------------------------------------ */
export function KumihimoRule({
  width = 40,
  color = colors.aka,
  style,
}: {
  width?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const h = 6;
  const step = 8;
  const pts = Math.ceil(width / step);
  let up = `M0 ${h / 2}`;
  let dn = `M0 ${h / 2}`;
  for (let i = 0; i < pts; i++) {
    const x = i * step;
    up += ` Q ${x + step / 2} 0 ${x + step} ${h / 2}`;
    dn += ` Q ${x + step / 2} ${h} ${x + step} ${h / 2}`;
  }
  return (
    <View style={style}>
      <Svg width={width} height={h}>
        <Path d={up} fill="none" stroke={color} strokeWidth={1.6} />
        <Path d={dn} fill="none" stroke={colors.gold} strokeWidth={1.6} opacity={0.8} />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 連紋（丸に紋）フレーム                                                */
/* ------------------------------------------------------------------ */
export function RenMon({
  size = 44,
  color = colors.gold,
  children,
  style,
}: {
  size?: number;
  color?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const notch = 6;
  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }} viewBox="0 0 44 44">
        <Circle cx="22" cy="22" r="20.5" fill="none" stroke={color} strokeWidth="1.4" />
        <Circle cx="22" cy="22" r="17" fill="none" stroke={color} strokeWidth="0.8" opacity={0.6} />
        {[0, 90, 180, 270].map((deg) => (
          <Line
            key={deg}
            x1="22"
            y1="1"
            x2="22"
            y2={1 + notch}
            stroke={color}
            strokeWidth="1.4"
            transform={`rotate(${deg} 22 22)`}
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 渦（鳴門）                                                           */
/* ------------------------------------------------------------------ */
export function NarutoSpiral({
  size = 20,
  color = colors.gold,
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 12 m0 0 a2 2 0 1 1 3.4 1.4 a5 5 0 1 1 -8.4 -3.6 a8 8 0 1 1 13.6 5.8"
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
