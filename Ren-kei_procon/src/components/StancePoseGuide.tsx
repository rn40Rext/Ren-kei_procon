import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { ScorePart } from '../features/rules/types';

/**
 * 構え待ち中に、阿波踊りを知らない人でも真似しやすいよう
 * お手本の構えを半透明のシルエットでカメラ映像に重ねて見せる。
 * 採点部位(ScorePart)に応じて見せる範囲を変える:
 * 手だけ→上半身、足だけ→下半身、全体→全身。
 * assets/images/stance-guide/ の3枚は同じ構図から切り出しており、
 * 上半身・下半身の境目付近は重なりを持たせてある。
 */
const SOURCES: Record<ScorePart, number> = {
  hands: require('../../assets/images/stance-guide/hands.png'),
  feet: require('../../assets/images/stance-guide/feet.png'),
  whole: require('../../assets/images/stance-guide/whole.png'),
};

/** 元写真に近い濃さ(画像自体はほぼ不透明なシルエット)。右へ少し傾けて静止感を抑える */
const DEFAULT_OPACITY = 0.9;
const ROTATE = '10deg';

export function StancePoseGuide({
  scorePart,
  opacity = DEFAULT_OPACITY,
  style,
}: {
  scorePart: ScorePart;
  opacity?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={SOURCES[scorePart]}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: '100%', height: '100%', opacity, transform: [{ rotate: ROTATE }] }, style]}
    />
  );
}
