import React from 'react';
import { View, Text, Animated, Easing, AccessibilityInfo, StyleProp, ViewStyle } from 'react-native';
import { RenMon, NarutoSpiral } from './motifs';
import { colors, spacing, typography } from '../theme';

/**
 * 採点結果の数値を「ためて→数え上げて→花を咲かせる」演出で見せる。
 * 合否や達成度を断定する演出にはしない(RULE-07等の閾値はTBD-02で未検証のため、
 * 「◯点」を正確な評価として強調しすぎない — docs/rules/safety.md)。
 * 下の一言(message)は呼び出し側が決める。ここでは既定の控えめな一言のみ持つ。
 */

/** 数字のまわりに咲かせる飾り(渦)を置く角度。5つを等間隔に配置する */
const SPARKLE_ANGLES = [0, 72, 144, 216, 288];

/** message が指定されなかったときの一言。点数で断定せず、続ける気持ちを応援する文にする */
function defaultMessage(score: number): string {
  if (score >= 70) return 'とても良い調子です！';
  if (score >= 40) return 'いい感じです。続けていきましょう。';
  return 'ここからが伸びしろです。次も続けてみましょう。';
}

/** ScoreRevealAnimation に渡す値 */
export type ScoreRevealAnimationProps = {
  /** 0〜100 */
  score: number;
  /** 数値の下に出す一言。省略時は score から控えめな既定文を出す */
  message?: string;
  /** モンの直径 */
  size?: number;
  onFinish?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** 紋が広がる→数字が0から数え上がる→飾りと一言が出る、の順に演出する */
export function ScoreRevealAnimation({ score, message, size = 132, onFinish, style }: ScoreRevealAnimationProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const sparkleRadius = size * 0.56;

  // 演出の各段階で動かす値(紋の大きさ・濃さ、数え上げる数字、飾りと一言の濃さ)
  const ringScale = React.useRef(new Animated.Value(0.6)).current;
  const ringOpacity = React.useRef(new Animated.Value(0)).current;
  const countUp = React.useRef(new Animated.Value(0)).current;
  const sparkleOpacity = React.useRef(new Animated.Value(0)).current;
  const sparkleScale = React.useRef(new Animated.Value(0.4)).current;
  const captionOpacity = React.useRef(new Animated.Value(0)).current;

  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const listenerId = countUp.addListener(({ value }) => setDisplayValue(Math.round(value)));

    // 端末で「視差効果を減らす」が有効な人には、演出を省いて最終の状態をすぐ出す
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        ringScale.setValue(1);
        ringOpacity.setValue(1);
        countUp.setValue(clamped);
        sparkleOpacity.setValue(1);
        sparkleScale.setValue(1);
        captionOpacity.setValue(1);
        onFinish?.();
        return;
      }
      // 1) 紋がはねるように現れる 2) 数字を数え上げる(点が高いほど少し長く) 3) 飾りと一言を出す
      Animated.sequence([
        Animated.parallel([
          Animated.spring(ringScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
        Animated.timing(countUp, {
          toValue: clamped,
          duration: 700 + clamped * 4,
          easing: Easing.out(Easing.cubic),
          // Text の表示を更新するリスナーで使うため、ネイティブドライバは使えない
          useNativeDriver: false,
        }),
        Animated.parallel([
          Animated.spring(sparkleScale, { toValue: 1, friction: 4, useNativeDriver: true }),
          Animated.timing(sparkleOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(captionOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]).start(() => onFinish?.());
    });

    return () => {
      cancelled = true;
      countUp.removeListener(listenerId);
    };
    // score は演出開始時の値を使う。再生中に変えて作り直す想定ではないため意図的に空配列
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <Animated.View style={{ transform: [{ scale: ringScale }], opacity: ringOpacity }}>
        <RenMon size={size} color={colors.gold}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={[typography.displaySerif, { fontSize: size * 0.33, color: colors.goldBright }]}>
              {displayValue}
            </Text>
            <Text style={[typography.bodyStrong, { color: colors.textSecondary, marginBottom: size * 0.05, marginLeft: 2 }]}>
              点
            </Text>
          </View>
        </RenMon>
        {/* 紋の外周に飾りの渦を並べる */}
        {SPARKLE_ANGLES.map((deg) => (
          <Animated.View
            key={deg}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              opacity: sparkleOpacity,
              transform: [{ rotate: `${deg}deg` }, { translateY: -sparkleRadius }, { scale: sparkleScale }],
            }}
          >
            <NarutoSpiral size={14} color={colors.goldBright} />
          </Animated.View>
        ))}
      </Animated.View>
      <Animated.Text
        style={[
          typography.body,
          { color: colors.textSecondary, marginTop: spacing.md, opacity: captionOpacity, textAlign: 'center' },
        ]}
      >
        {message ?? defaultMessage(clamped)}
      </Animated.Text>
    </View>
  );
}
