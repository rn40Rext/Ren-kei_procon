import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import { HeaderSeam, KumihimoRule } from '../components/motifs';
import { colors, spacing, typography } from '../theme';

export default function SettingScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={22} color={colors.gold} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>アプリ設定</Text>
        <AppMenu />
      </View>
      <HeaderSeam />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
  headerTitle: { ...typography.headingSerif, color: colors.textPrimary },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  placeholder: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', maxWidth: 260 },
});
