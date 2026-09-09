import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { colors } from '../theme';

/**
 * 阿波踊りの持ち物・道具をかたどった線アイコン。
 * lucide と同じ体裁（24x24・線画・丸端）で作り、既存のアイコン枠にそのまま差し込める。
 */
type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

function Base({
  size = 22,
  color = colors.gold,
  strokeWidth = 2,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {children}
      </G>
    </Svg>
  );
}

/** 団扇（うちわ）— 女踊り・披露 */
export function IconUchiwa(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12 3c4.2 0 7 3 7 6.5S16.2 16 12 16 5 12 5 9.5 7.8 3 12 3z" />
      <Path d="M8.4 9.5h7.2M12 4.2v11.6M9.6 5.2l4.8 9.6M14.4 5.2l-4.8 9.6" />
      <Path d="M12 16l-1.4 4.2M12 16l1.4 4.2M10.6 20.2h2.8" />
    </Base>
  );
}

/** 編笠（あみがさ）— 女踊り・踊り手 */
export function IconAmigasa(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3.5 15c1.2-5.6 4.6-9 8.5-9s7.3 3.4 8.5 9z" />
      <Path d="M3.5 15c2.4 1.6 5.3 2.4 8.5 2.4s6.1-.8 8.5-2.4" />
      <Path d="M9.5 15c.5-3.8 1.4-6.4 2.5-8 1.1 1.6 2 4.2 2.5 8" />
    </Base>
  );
}

/** 鳴子（なるこ）— 拍手・囃子 */
export function IconNaruko(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 3.5h6l1 8.5H8z" />
      <Line x1="12" y1="12" x2="12" y2="20.5" />
      <Path d="M8 6h8M8 9h8" />
      <Path d="M6.5 5.5 5 4M17.5 5.5 19 4" />
    </Base>
  );
}

/** 巻物（まきもの）— 稽古録・門下生の声 */
export function IconMakimono(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M7 6.5h8.5c1.4 0 2.5 1.1 2.5 2.5v6c0 1.4-1.1 2.5-2.5 2.5H7" />
      <Path d="M7 6.5C5.6 6.5 4.5 7.6 4.5 9S5.6 11.5 7 11.5V6.5z" />
      <Path d="M15.5 17.5c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5V17.5z" />
      <Path d="M8 9.5h6M8 12.5h4" />
    </Base>
  );
}

/** 締太鼓（しめだいこ）— 鳴り物 */
export function IconTaiko(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="6.5" />
      <Circle cx="12" cy="12" r="2.4" />
      <Path d="M12 5.5v-2M12 20.5v-2M5.5 12h-2M20.5 12h-2" />
      <Path d="M4 4l3.5 3.5M20 4l-3.5 3.5" />
    </Base>
  );
}

/** 下駄（げた）— 男踊り・足捌き */
export function IconGeta(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 7h14l-1.5 9.5a3 3 0 0 1-3 2.5H9.5a3 3 0 0 1-3-2.5z" />
      <Path d="M12 7v11.5" />
      <Path d="M9 4c0 1.2.8 2 1.8 2M15 4c0 1.2-.8 2-1.8 2M12 3v3" />
    </Base>
  );
}

/** 提灯（ちょうちん）— 灯り・お知らせ */
export function IconChochinLine(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M8 4.5h8M8 19.5h8" />
      <Path d="M7.5 4.5c-1.2 2.2-1.8 4.5-1.8 7.5s.6 5.3 1.8 7.5h9c1.2-2.2 1.8-4.5 1.8-7.5s-.6-5.3-1.8-7.5z" />
      <Path d="M5.9 9h12.2M5.7 15h12.6" />
      <Line x1="12" y1="19.5" x2="12" y2="21.5" />
    </Base>
  );
}

/** 演舞再生（扇の要から開く三角）— 再生ボタン */
export function IconEnbuPlay(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M8 5.5 18 12 8 18.5z" />
      <Path d="M8 5.5 8 18.5" />
      <Path d="M11 8.2 11 15.8M14 10 14 14" />
    </Base>
  );
}

/** 手拭い（てぬぐい）— 絞り込み・仕分け */
export function IconTenugui(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 6h16M6 10.5h12M8.5 15h7M10.5 19.5h3" />
    </Base>
  );
}

export type AwaCategory = '男踊り' | '女踊り' | '鳴り物';

/** 踊りの型からアイコンを返す */
export function categoryIcon(category: AwaCategory) {
  if (category === '女踊り') return IconAmigasa;
  if (category === '鳴り物') return IconTaiko;
  return IconGeta;
}
