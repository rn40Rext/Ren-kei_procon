import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import { KasaGarland } from '../components/motifs';
import { IconWagasa } from '../components/awaIcons';
import { colors, spacing, typography } from '../theme';

const SCREEN_W = Dimensions.get('window').width;

export default function GroupScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container}>
      <KasaGarland width={SCREEN_W} count={7} height={40} style={styles.garland} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={22} color={colors.gold} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>所属連・役職</Text>
        <AppMenu />
      </View>
      <View style={styles.body}>
        <IconWagasa size={40} color={colors.gold} />
        <Text style={styles.placeholder}>所属している連のグループ</Text>
        <Text style={styles.sub}>連への参加が決まると、ここに連の稽古連絡や仲間が表示されます。</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  garland: { backgroundColor: colors.indigoDeep },
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
