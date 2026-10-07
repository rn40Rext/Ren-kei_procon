/**
 * お問い合わせ画面(仮)。
 * 運営への連絡先や、連の世話役への相談窓口を載せる予定だが、今は案内文だけのプレースホルダー。
 */

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { KumihimoRule } from '../components/motifs';
import { colors, spacing, typography } from '../theme';

/** お問い合わせ画面(準備中の案内だけを出す) */
export default function ConatctInfoScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー(共通): 戻るボタン・画面名・メニュー */}
      <ScreenHeader title="お問い合わせ" onBack={() => navigation.goBack()} />
      {/* 仮表示：連絡先一覧ができるまでの案内文。実装したらここを差し替える */}
      <View style={styles.body}>
        <KumihimoRule width={36} />
        <Text style={styles.placeholder}>連絡先一覧</Text>
        <Text style={styles.sub}>運営への連絡先や、連の世話役への相談窓口をここに載せる予定です。</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  // 「準備中」の案内を画面の中央にまとめて表示するエリア
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  placeholder: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', maxWidth: 260 },
});
