import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Play } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { monkaEnbu } from '../data/mockEnbu';

// ダミーの自分の稽古録（実データ連携時は Firestore の自分の videos を取得）
const MY_ENBU = [...monkaEnbu, ...monkaEnbu.map((e) => ({ ...e, id: e.id + '-b', kimeRate: e.kimeRate - 6 }))];

export default function VideoListScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
          <Text style={styles.backText}>稽古手帳</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>自分の演舞・稽古録</Text>
        <AppMenu />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.count}>{MY_ENBU.length} 本の演舞　／　通算稽古 18 日</Text>

        {MY_ENBU.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.row}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VideoDetail', { id: e.id.replace('-b', '') })}
          >
            <ImageBackground source={{ uri: e.image }} style={styles.thumb} imageStyle={{ borderRadius: radius.sm }}>
              <View style={styles.playDot}>
                <Play size={12} fill={colors.textOnGold} color={colors.textOnGold} />
              </View>
            </ImageBackground>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={2}>{e.title}</Text>
              <Text style={styles.rowMeta}>{e.category}・{e.cho}　{e.duration}</Text>
              <Text style={styles.rowKime}>{lexicon.aiScore} {e.kimeRate}%</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
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
  content: { padding: spacing.lg },
  count: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },

  row: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  thumb: { width: 84, height: 84, backgroundColor: colors.indigoRaised, alignItems: 'flex-end', justifyContent: 'flex-end' },
  playDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  rowBody: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
  rowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  rowKime: { ...typography.caption, color: colors.gold, marginTop: 4 },
});
