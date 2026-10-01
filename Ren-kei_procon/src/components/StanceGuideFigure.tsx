import React from 'react';
import { StyleProp, ViewStyle, Animated, Easing, AccessibilityInfo } from 'react-native';
import Svg, { G, Circle, Path } from 'react-native-svg';
import { colors } from '../theme';
import { ScorePart } from '../features/rules/types';

/**
 * 阿波踊りをまったく知らない人向けの「構え」の見本(半透明の棒人間)。
 * src/components/awaIcons.tsx の IconOdoriko / IconOnnaOdori は実際の踊りの
 * ポーズ(男踊り=片手を高く上げてもう片方は横に張る、女踊り=編笠)なので、
 * ここでの「構え」(src/features/analysis/stance.ts の isStance の条件。
 * 両手を頭より上げる/腰を落として膝を曲げる)とは姿勢が異なる。
 * そのため構えの条件に合わせた専用の棒人間をここで用意する(骨格はユーザーの手描きラフに準拠)。
 *
 * scorePart が hands/feet のときは、その部位しか採点しないことが伝わるよう、
 * 上半身・下半身だけを切り出して表示する(全身を出すと脚/腕の条件があるように誤解されるため)。
 */

type Props = {
  scorePart: ScorePart;
  size?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

const HEAD = { cx: 12, cy: 7, r: 2.2 };
const SHOULDER = { x: 12, y: 9.5 };
const WAIST_Y = 12; // 上半身/下半身を切り出すときの境目
const HIP = { x: 12, y: 17 };

// 左手は顔の横あたりまで、右手は肘を曲げて大きく高く掲げる(非対称にして踊りの途中らしさを出す)
const LEFT_ARM = 'M12 9.5 L7 5';
const RIGHT_ARM = 'M12 9.5 L17 7 L20 1';
// 腰を落として膝を曲げ、幅広く片足を踏み出す
const LEFT_LEG = 'M12 17 L8 21 L6 24';
const RIGHT_LEG = 'M12 17 L16 21 L18 24';

const VIEW_BOX: Record<ScorePart, string> = {
  hands: `0 0 24 ${WAIST_Y + 1}`,
  feet: `0 ${WAIST_Y - 1} 24 ${26 - (WAIST_Y - 1)}`,
  whole: '0 0 24 26',
};

/** 構え待ちの間、呼吸するようにゆっくり拡縮して目を引く(視差効果を減らす設定では静止)。 */
function useBreathing(enabled: boolean): Animated.AnimatedInterpolation<number> {
  const value = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!enabled) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [enabled, value]);

  return value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
}

export function StanceGuideFigure({ scorePart, size = 160, color = colors.goldBright, opacity = 0.45, style }: Props) {
  const scale = useBreathing(true);
  const showUpper = scorePart === 'hands' || scorePart === 'whole';
  const showLower = scorePart === 'feet' || scorePart === 'whole';

  let torso: string;
  if (scorePart === 'hands') torso = `M${SHOULDER.x} ${SHOULDER.y} L12 ${WAIST_Y}`;
  else if (scorePart === 'feet') torso = `M12 ${WAIST_Y} L${HIP.x} ${HIP.y}`;
  else torso = `M${SHOULDER.x} ${SHOULDER.y} L${HIP.x} ${HIP.y}`;

  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ scale }] }, style]}>
      <Svg width={size} height={size} viewBox={VIEW_BOX[scorePart]}>
        <G stroke={color} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={opacity}>
          {showUpper && <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />}
          <Path d={torso} />
          {showUpper && <Path d={LEFT_ARM} />}
          {showUpper && <Path d={RIGHT_ARM} />}
          {showLower && <Path d={LEFT_LEG} />}
          {showLower && <Path d={RIGHT_LEG} />}
        </G>
      </Svg>
    </Animated.View>
  );
}
