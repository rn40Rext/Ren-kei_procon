import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
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

/** 元写真に近い濃さを基準に、見やすさ優先で少し薄める。右へ少し傾けて静止感を抑える */
const DEFAULT_OPACITY = 0.75;
const ROTATE = '10deg';
// カメラ画面に収まるよう少し小さくし、左寄りに置く(等身大だと画面からはみ出すため)
const IMAGE_WIDTH = '78%';
const IMAGE_HEIGHT = '82%';
// 画像自体がやや濃いめの灰色(#4B4B4B)で書き出されているため、
// 明るい場所(白飛びした映像)でも見分けやすい
// (Image の tintColor は Expo Web では効かないため、アセット側で着色している)

export function StancePoseGuide({
  scorePart,
  opacity = DEFAULT_OPACITY,
  style,
}: {
  scorePart: ScorePart;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: '100%', height: '100%', alignItems: 'flex-start', justifyContent: 'center' }, style]}>
      <Image
        source={SOURCES[scorePart]}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, opacity, transform: [{ rotate: ROTATE }] }}
      />
    </View>
  );
}
