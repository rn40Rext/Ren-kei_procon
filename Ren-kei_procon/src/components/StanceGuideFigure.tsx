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
 * そのため構えの条件に合わせた専用の棒人間をここで用意する。
 */

type Props = {
  scorePart: ScorePart;
  size?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
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
  const needsHandsUp = scorePart === 'hands' || scorePart === 'whole';
  const needsKneeBend = scorePart === 'feet' || scorePart === 'whole';

  // 頭・胴は共通。腕と脚だけ構えの条件に応じて変える
  const hipY = needsKneeBend ? 14.6 : 14; // 腰を落とす分だけわずかに胴を沈める
  const arms = needsHandsUp
    ? // 両手を頭より高く上げる。肘を曲げ、右手を左手より高く上げることで
      // 本物の阿波踊りの構え(片手は顔の横で折り畳み、もう片手を高く掲げる)に近づける
      ['M12 7 L8.5 5 L6.5 2', 'M12 7 L15.5 4.5 L17.5 1']
    : // 自然に下げる(脚だけの構えでは腕の条件なし)
      ['M12 8 L9 13', 'M12 8 L15 13'];
  const legs = needsKneeBend
    ? // 腰を落として膝を曲げる。左右で高さを変え、片足を踏み出す動きを出す
      [`M12 ${hipY} L9.5 17.5 L10 21`, `M12 ${hipY} L15 16.5 L17 18.5`]
    : ['M12 14 L10 21', 'M12 14 L14 21'];

  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ scale }] }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G stroke={color} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={opacity}>
          <Circle cx="12" cy="4" r="2" />
          <Path d={`M12 6 L12 ${hipY}`} />
          {arms.map((d) => (
            <Path key={d} d={d} />
          ))}
          {legs.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}
