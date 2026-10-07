/**
 * 画面上部のバー(共通)。画面ごとにバーの見た目がずれないよう、ここ1か所で作る。
 *  - 題名は必ず中央(左右の枠を同じ幅にしている)。その下に、任意で注釈を小さく出す
 *  - 右はメニューボタン。左は onBack を渡したときだけ「‹ 戻る」を出す
 *  - 下に模様の帯(HeaderSeam)を付ける
 * 使い分け: メニューから行く画面(稽古手帳・リクエスト・自主稽古)は戻るなし、
 * その下の階層の画面(成長の記録・練習動画一覧・お問い合わせ・アプリ設定)は戻るあり。
 * ホームとマイ連は、それぞれ独自のバー(ロゴ・連の作成ボタン付き)のままにしている。
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '../theme';
import AppMenu from './AppMenu';
import { HeaderSeam } from './motifs';

/** 左右の枠の幅。「‹ 戻る」が収まり、メニューボタン(38px)より広い大きさ */
const SIDE_WIDTH = 64;

export default function ScreenHeader({
  title,
  note,
  onBack,
}: {
  title: string;
  /** 題名の下に出す一行の説明(任意) */
  note?: string;
  /** 渡すと、左に「‹ 戻る」を出す */
  onBack?: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="戻る"
            >
              <ChevronLeft size={22} color={colors.gold} />
              <Text style={styles.backText}>戻る</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {note ? (
            <Text style={styles.note} numberOfLines={2}>
              {note}
            </Text>
          ) : null}
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <AppMenu />
        </View>
      </View>
      <HeaderSeam />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    backgroundColor: colors.indigoDeep,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  side: { width: SIDE_WIDTH, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headingSerif, color: colors.textPrimary, textAlign: 'center' },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
});
