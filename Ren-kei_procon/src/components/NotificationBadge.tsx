import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  count: number;
  /** trueのとき件数を出さず小さいドットのみ表示する(BottomNavのアイコン用、#44)。 */
  dotOnly?: boolean;
}

/** 通知の未読件数バッジ。0件のときは何も描画しない。 */
export default function NotificationBadge({ count, dotOnly = false }: Props) {
  if (count <= 0) return null;
  if (dotOnly) return <View style={styles.dot} />;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.vermilion,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.textOnDark,
    fontSize: 10,
    fontWeight: 'bold',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.vermilion,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
