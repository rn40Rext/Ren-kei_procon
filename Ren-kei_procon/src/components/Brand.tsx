import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { fontFamily } from '../theme';

/**
 * Ren-Kei のブランドロゴ。
 * RenKeiWordmark: 「Ren-Kei」のワードマークをテキストで再現（青 Ren／橙 ハイフン／緑 Kei）。
 * 画像に依存せず、どの解像度でも鮮明。
 * RenKeiMark: 円形エンブレム（踊り手＋連結ネットワーク）。assets/ren-kei-mark.png を表示する。
 */

export const brandColors = {
  ren: '#4C7FD0', // 青
  hyphen: '#F49B1E', // 橙
  kei: '#57B24A', // 緑
} as const;

export function RenKeiWordmark({
  size = 20,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = {
    fontSize: size,
    lineHeight: size * 1.12,
    fontWeight: '800' as const,
    fontStyle: 'italic' as const,
    fontFamily: fontFamily.sans,
    letterSpacing: -0.5,
  };
  return (
    <View style={[styles.row, style]} accessibilityLabel="Ren-Kei">
      <Text style={[t, { color: brandColors.ren }]}>Ren</Text>
      <Text style={[t, { color: brandColors.hyphen }]}>-</Text>
      <Text style={[t, { color: brandColors.kei }]}>Kei</Text>
    </View>
  );
}

export function RenKeiMark({
  size = 26,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require('../../assets/ren-kei-mark.png')}
      accessibilityLabel="Ren-Kei"
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
});
