import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { KumihimoRule } from '../components/motifs';
import { colors, spacing, typography } from '../theme';

/** アプリ設定画面(未実装・プレースホルダー) */
export default function SettingScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー(共通): 戻るボタン・画面名・メニュー */}
      <ScreenHeader title="アプリ設定" onBack={() => navigation.goBack()} />
      {/* 準備中の案内(画面中央) */}
      <View style={styles.body}>
        <KumihimoRule width={36} />
        <Text style={styles.placeholder}>設定ページ</Text>
        <Text style={styles.sub}>通知・表示・アカウントの設定をここにまとめる予定です。</Text>
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
