import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography } from '../theme';
import { Badge, WashiCard, Panel, SectionHeader } from '../components/ui';
import { RenMon } from '../components/motifs';
import { IconEnbuPlay, IconGeta, categoryIcon } from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import { challengeById, DIFFICULTY_TONE } from '../data/mockChallenges';
import { monkaEnbu } from '../data/mockEnbu';

export default function ChallengeDetailScreen({ navigation, route }: any) {
  const id: string | undefined = route?.params?.id;
  const ch = useMemo(() => challengeById(id), [id]);
  const CatIcon = categoryIcon(ch.category);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>チャレンジ</Text>
        <AppMenu />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* お題の演舞 */}
        <View style={styles.banner}>
          <ImageBackground source={{ uri: ch.image }} style={styles.bannerImg}>
            <LinearGradient
              colors={['rgba(11,19,43,0.25)', 'rgba(11,19,43,0.85)']}
              style={styles.bannerScrim}
            >
              <View style={styles.bannerTop}>
                <Badge label="チャレンジ" tone="aka" />
                <Badge label={ch.difficulty} tone={DIFFICULTY_TONE[ch.difficulty]} style={{ marginLeft: spacing.sm }} />
              </View>
              <View style={styles.playCircle}>
                <IconEnbuPlay size={24} color={colors.textOnGold} />
              </View>
              <View style={styles.catTag}>
                <CatIcon size={12} color={colors.goldBright} />
                <Text style={styles.catTagText}>　{ch.move}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* お題と出題者 */}
        <View style={styles.head}>
          <Text style={styles.title}>{ch.title}</Text>

          <View style={styles.posterRow}>
            <RenMon size={34} color={colors.gold}>
              <Text style={styles.posterInitial}>{ch.poster.slice(0, 1)}</Text>
            </RenMon>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.posterName}>{ch.poster}</Text>
              <Text style={styles.posterRole}>{ch.posterRole}</Text>
            </View>
          </View>

          <Text style={styles.participants}>{ch.participants} 人が挑戦中</Text>
        </View>

        {/* 見どころ・課題 */}
        <Panel style={styles.focusPanel}>
          <Text style={styles.focusLabel}>先輩が見てほしいところ</Text>
          <Text style={styles.focusText}>{ch.focus}</Text>
        </Panel>

        {/* 先輩からのアドバイス */}
        <SectionHeader title="先輩からのアドバイス" />
        <View style={styles.adviceList}>
          {ch.advice.map((a, i) => (
            <WashiCard key={a.id} eyebrow={`コツ ${i + 1}`} style={styles.adviceCard}>
              <Text style={styles.advicePoint}>{a.point}</Text>
              <Text style={styles.adviceDetail}>{a.detail}</Text>
            </WashiCard>
          ))}
        </View>

        {/* 挑戦する */}
        <TouchableOpacity
          style={styles.challengeBtn}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Scoring')}
        >
          <IconGeta size={17} color={colors.textOnGold} />
          <Text style={styles.challengeBtnText}>　自分の演舞で挑戦する</Text>
        </TouchableOpacity>

        {/* 挑戦した人の演舞 */}
        <SectionHeader title="挑戦した人の演舞" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tryScroll}
        >
          {monkaEnbu.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.tryCard}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('VideoDetail', { id: m.id })}
            >
              <ImageBackground source={{ uri: m.image }} style={styles.tryThumb} imageStyle={{ borderRadius: radius.sm }} />
              <Text style={styles.tryName}>{m.performer}</Text>
              <Text style={styles.tryMeta}>極め度 {m.kimeRate}%</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 90 },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
  topTitle: { ...typography.headingSerif, color: colors.textPrimary },

  scroll: { paddingBottom: spacing.xl },

  banner: { height: 200 },
  bannerImg: { flex: 1 },
  bannerScrim: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  bannerTop: { flexDirection: 'row', alignItems: 'center' },
  playCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTag: { flexDirection: 'row', alignItems: 'center' },
  catTagText: { ...typography.metric, color: colors.goldBright },

  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.titleSerif, color: colors.textPrimary },
  posterRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  posterInitial: { ...typography.bodyStrong, color: colors.gold, fontSize: 13 },
  posterName: { ...typography.bodyStrong, color: colors.textPrimary },
  posterRole: { ...typography.caption, color: colors.gold, marginTop: 2 },
  participants: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },

  focusPanel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md },
  focusLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  focusText: { ...typography.body, color: colors.textSecondary },

  adviceList: { paddingHorizontal: spacing.lg },
  adviceCard: { marginBottom: spacing.md },
  advicePoint: { ...typography.headingSerif, color: colors.indigoDeep },
  adviceDetail: { ...typography.body, color: '#3A3427', marginTop: spacing.sm, lineHeight: 22 },

  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  challengeBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },

  tryScroll: { paddingHorizontal: spacing.lg },
  tryCard: { width: 132, marginRight: spacing.md },
  tryThumb: { width: '100%', height: 84, backgroundColor: colors.indigoRaised },
  tryName: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.sm },
  tryMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },
});
