import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';
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

/** 団扇（うちわ）— 女踊り・披露。丸い扇面＋柄のみの単純な形にして小さくても判別できるようにする。 */
export function IconUchiwa(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="9.5" r="6.3" />
      <Path d="M12 15.8v5.2" />
      <Path d="M10.6 20.6h2.8" />
      <Path d="M6.3 9.5h11.4" />
      <Path d="M12 4.4v10.2" />
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

/** 巻物（まきもの）— 稽古録・門下生の声。左右の軸を同じ高さに揃えた横向きの巻物。 */
export function IconMakimono(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="7" cy="12" r="4" />
      <Circle cx="17" cy="12" r="4" />
      <Path d="M7 8h10M7 16h10" />
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

/** 下駄（げた）— 男踊り・足捌き。台（俵形）に鼻緒のＶ字だけの単純な形。 */
export function IconGeta(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x="3.5" y="9" width="17" height="8" rx="4" ry="4" />
      <Path d="M12 10 8.6 15M12 10 15.4 15" />
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

/** 踊り子（男踊り）— アプリの顔・踊る。腰を落とし片手を高く上げた構え。 */
export function IconOdoriko(p: IconProps) {
  return (
    <Base {...p}>
      {/* 頭 */}
      <Circle cx="14.4" cy="4.3" r="1.9" />
      {/* 胴（前傾） */}
      <Path d="M13.6 6.1 10.8 12.4" />
      {/* 右腕：高く上げる */}
      <Path d="M12.5 7.7 18 3.6" />
      {/* 左腕：横へ張る */}
      <Path d="M12.9 8.6 7 10.2" />
      {/* 左脚：踏み込み */}
      <Path d="M10.8 12.4 7.4 15.6 8.8 20.4" />
      {/* 右脚：蹴り出し */}
      <Path d="M10.8 12.4 14.4 15 16 20" />
    </Base>
  );
}

/** 踊り子（女踊り）— 編笠をかぶり両腕をしなやかに上げ、爪先立つ姿。 */
export function IconOnnaOdori(p: IconProps) {
  return (
    <Base {...p}>
      {/* 編笠 */}
      <Path d="M7.4 6.6Q12 1.8 16.6 6.6" />
      {/* 首・胴 */}
      <Path d="M12 6.8 12 14.2" />
      {/* 両腕を高く */}
      <Path d="M11.6 9.4 8 4.4" />
      <Path d="M12.4 9.4 16 4.4" />
      {/* 脚（爪先立ち） */}
      <Path d="M12 14.2 10.6 19.2 10.6 20.8" />
      <Path d="M12 14.2 13.4 19.2 13.4 20.8" />
    </Base>
  );
}

/** 和傘（開いた傘）— 連（れん）。傘連にちなみ、連・仲間を表す。定番の傘の意匠（丸い屋根＋軸＋柄）。 */
export function IconWagasa(p: IconProps) {
  return (
    <Base {...p}>
      {/* 傘の面（丸屋根） */}
      <Path d="M4 13a8 8 0 0 1 16 0" />
      <Path d="M4 13h16" />
      {/* 中棒と柄 */}
      <Path d="M12 13v8" />
      <Path d="M12 21q0 1.6 -2 1.6" />
    </Base>
  );
}

export type AwaCategory = '男踊り' | '女踊り' | '鳴り物';

/** 踊りの型からアイコンを返す */
export function categoryIcon(category: AwaCategory) {
  if (category === '女踊り') return IconOnnaOdori;
  if (category === '鳴り物') return IconTaiko;
  return IconOdoriko;
}
