/**
 * 成長曲線用の簡易折れ線グラフ(#37)。専用チャートライブラリは使わず、
 * react-native-svg で直接描画する(Web/ネイティブ両対応、依存を増やさない)。
 * 記録の等間隔配置(横軸=記録の順序)で、真の時間比例ではない簡易版。
 */
import React from 'react';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '../theme';

export interface ChartPoint {
  value: number;
  /** 直前の記録から analysisVersion が変わった点にのみ設定する(#37) */
  versionLabel?: string;
}

interface Props {
  points: ChartPoint[];
  width: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  minValue?: number;
  maxValue?: number;
}

/** グラフの上下左右に空ける余白(px)。端の点や線が切れないようにする */
const PADDING = 12;

/** 点数の推移を折れ線で描く。目盛り線・バージョン変更の点線・折れ線・点の順に重ねる */
export default function GrowthLineChart({
  points,
  width,
  height = 120,
  color = colors.gold,
  showDots = true,
  minValue = 0,
  maxValue = 100,
}: Props) {
  const innerW = Math.max(width - PADDING * 2, 1);
  const innerH = Math.max(height - PADDING * 2, 1);

  // i番目の記録の横位置。記録が1件だけなら中央に置く
  const xFor = (i: number) => (points.length <= 1 ? PADDING + innerW / 2 : PADDING + (innerW * i) / (points.length - 1));
  // 点数の縦位置。範囲外の値は上下端にそろえ、高い点ほど上に来るよう反転する
  const yFor = (v: number) => {
    const clamped = Math.max(minValue, Math.min(maxValue, v));
    const ratio = (clamped - minValue) / (maxValue - minValue || 1);
    return PADDING + innerH * (1 - ratio);
  };

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.value) }));
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {/* 最小・中央・最大の3本の目盛り線 */}
      {[minValue, (minValue + maxValue) / 2, maxValue].map((v) => (
        <Line key={v} x1={PADDING} y1={yFor(v)} x2={width - PADDING} y2={yFor(v)} stroke={colors.indigoLine} strokeWidth={1} />
      ))}

      {/* 採点の仕組み(analysisVersion)が変わった記録に縦の点線を引き、単純比較できないことを示す */}
      {coords.map((c, i) =>
        points[i].versionLabel ? (
          <Line
            key={`version-${i}`}
            x1={c.x}
            y1={PADDING}
            x2={c.x}
            y2={height - PADDING}
            stroke={colors.textMuted}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        ) : null
      )}

      {points.length >= 2 && (
        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {showDots && coords.map((c, i) => <Circle key={i} cx={c.x} cy={c.y} r={3.5} fill={color} />)}
    </Svg>
  );
}
