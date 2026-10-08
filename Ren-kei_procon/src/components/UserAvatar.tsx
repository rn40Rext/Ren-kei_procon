/**
 * 投稿者・コメントした人などの丸いアイコン。
 * アイコン画像(iconUrl)があればそれを、無ければ名前の頭文字を出す。
 *  - variant 'mon':   頭文字のときは連紋の枠(RenMon)の中に出す(投稿者の表示など)。
 *                     アイコン画像があるときは、枠を付けず丸い画像だけにする
 *  - variant 'plain': 枠なしの丸(コメント欄など)
 */
import React from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors, radius } from '../theme';
import { RenMon } from './motifs';

export default function UserAvatar({
  size,
  name,
  iconUrl,
  variant = 'mon',
  charStyle,
}: {
  size: number;
  /** 頭文字に使う名前 */
  name: string;
  /** プロフィールのアイコン画像。空なら頭文字 */
  iconUrl?: string;
  variant?: 'mon' | 'plain';
  /** 頭文字の文字スタイル(画面ごとの大きさに合わせる) */
  charStyle?: StyleProp<TextStyle>;
}) {
  const initial = <Text style={charStyle}>{name.slice(0, 1)}</Text>;

  if (variant === 'plain') {
    return (
      <View style={[styles.plain, { width: size, height: size, borderRadius: size / 2 }]}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={{ width: size, height: size }} accessibilityLabel={`${name}のアイコン`} />
        ) : (
          initial
        )}
      </View>
    );
  }

  // アイコン画像があるときは枠(丸と十字の紋)を出さず、画像だけを丸く出す。
  // 紋の外径(枠の約93%)に合わせた大きさにして、頭文字のときと並べても大きさが揃うようにする
  if (iconUrl) {
    const d = Math.round(size * 0.93);
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={{ uri: iconUrl }}
          style={{ width: d, height: d, borderRadius: radius.pill }}
          accessibilityLabel={`${name}のアイコン`}
        />
      </View>
    );
  }
  return (
    <RenMon size={size} color={colors.gold}>
      {initial}
    </RenMon>
  );
}

const styles = StyleSheet.create({
  plain: { backgroundColor: colors.indigoRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
