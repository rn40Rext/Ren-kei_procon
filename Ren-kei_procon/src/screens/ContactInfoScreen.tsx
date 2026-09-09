import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import { colors, spacing, typography } from '../theme';

export default function ConatctInfoScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={22} color={colors.gold} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>お問い合わせ</Text>
        <AppMenu />
      </View>
      <View style={styles.body}>
        <Text style={styles.placeholder}>連絡先一覧</Text>
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
  placeholder: { ...typography.body, color: colors.textMuted },
});
