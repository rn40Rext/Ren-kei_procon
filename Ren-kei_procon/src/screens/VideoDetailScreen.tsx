import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronLeft, ChevronRight, Play, Hand, Send } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { Badge, Chip, WashiCard, MetricRow, SectionHeader, Panel } from '../components/ui';
import { RenMon } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import {
  todaysEnbu,
  masterEnbu,
  monkaEnbu,
  masterTeachings,
  monkaComments,
} from '../data/mockEnbu';

const ALL_ENBU = [todaysEnbu, ...masterEnbu, ...monkaEnbu];

export default function VideoDetailScreen({ navigation, route }: any) {
  const enbuId: string | undefined = route?.params?.id;
  const enbu = useMemo(() => ALL_ENBU.find((e) => e.id === enbuId) ?? todaysEnbu, [enbuId]);

  const [tab, setTab] = useState<'teaching' | 'voice'>('teaching');
  const [claps, setClaps] = useState(enbu.cheers);
  const [clapped, setClapped] = useState(false);
  const [draft, setDraft] = useState('');

  const sendClap = () => {
    setClaps((c) => (clapped ? c - 1 : c + 1));
    setClapped((v) => !v);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 上部バー */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft color={colors.gold} size={22} />
            <Text style={styles.backText}>広場へ戻る</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>稽古録</Text>
          <AppMenu />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 演舞プレイヤー */}
          <View style={styles.player}>
            <ImageBackground source={{ uri: enbu.image }} style={styles.playerImage}>
              <LinearGradient
                colors={['rgba(11,19,43,0.1)', 'rgba(11,19,43,0.75)']}
                style={styles.playerScrim}
              >
                <View style={styles.playCircle}>
                  <Play size={26} fill={colors.textOnGold} color={colors.textOnGold} />
                </View>
                <View style={styles.playerBottom}>
                  <Badge label={`${enbu.bpm} BPM ${enbu.cho}`} tone="dark" />
                  <Text style={styles.playerTime}>{enbu.duration}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>

          {/* 演舞情報 */}
          <View style={styles.metaBlock}>
            <View style={styles.metaBadges}>
              {enbu.isShihan ? <Badge label="阿波公認師範" tone="outline" /> : null}
              <Badge label={`${enbu.category}演舞`} tone="aka" style={{ marginLeft: spacing.sm }} />
            </View>

            <Text style={styles.enbuTitle}>{enbu.title}</Text>

            <View style={styles.performerRow}>
              <RenMon size={32} color={colors.gold}>
                <Text style={styles.performerInitial}>{enbu.performer.slice(0, 1)}</Text>
              </RenMon>
              <View style={styles.performerText}>
                <Text style={styles.performerName}>
                  {enbu.performer}
                  <Text style={styles.performerRole}>　{enbu.role}</Text>
                </Text>
                <Text style={styles.performerRen}>{enbu.ren}</Text>
              </View>
            </View>

            <Text style={styles.enbuDesc}>{enbu.description}</Text>

            <Panel style={styles.metricsPanel}>
              <MetricRow
                items={[
                  { label: lexicon.aiScore, value: `${enbu.kimeRate}%` },
                  { label: '演舞尺', value: enbu.duration },
                  { label: '調子', value: `${enbu.bpm} BPM ${enbu.cho}` },
                ]}
              />
            </Panel>

            {/* 拍手を送る */}
            <TouchableOpacity
              style={[styles.clapBtn, clapped && styles.clapBtnActive]}
              onPress={sendClap}
              activeOpacity={0.85}
            >
              <Hand
                size={18}
                color={clapped ? colors.textOnAka : colors.aka}
                fill={clapped ? colors.textOnAka : 'transparent'}
              />
              <Text style={[styles.clapText, clapped && styles.clapTextActive]}>
                {lexicon.like}　{claps.toLocaleString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toKeikoBtn}
              onPress={() => navigation.navigate('Scoring')}
              activeOpacity={0.85}
            >
              <Text style={styles.toKeikoText}>この演舞を手本に稽古する</Text>
              <ChevronRight size={15} color={colors.gold} />
            </TouchableOpacity>
          </View>

          {/* 師匠の教え / 門下生の声 */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, tab === 'teaching' && styles.tabItemActive]}
              onPress={() => setTab('teaching')}
            >
              <Text style={[styles.tabLabel, tab === 'teaching' && styles.tabLabelActive]}>
                {lexicon.masterTeaching}・極意録
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, tab === 'voice' && styles.tabItemActive]}
              onPress={() => setTab('voice')}
            >
              <Text style={[styles.tabLabel, tab === 'voice' && styles.tabLabelActive]}>
                {lexicon.comment}
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'teaching' ? (
            <View style={styles.tabBody}>
              {masterTeachings.map((t) => (
                <WashiCard key={t.id} eyebrow="秘伝・身体操法の指南" style={styles.washiGap}>
                  <Text style={styles.washiTitle}>{t.title}</Text>
                  <Text style={styles.washiBody}>{t.body}</Text>
                  <Text style={styles.washiMaster}>{t.master}</Text>
                </WashiCard>
              ))}
            </View>
          ) : (
            <View style={styles.tabBody}>
              {monkaComments.map((c) => (
                <View key={c.id} style={styles.comment}>
                  <View style={styles.commentHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{c.name.slice(0, 1)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>{c.name}</Text>
                      <Text style={styles.commentRen}>{c.rank}・{c.ren}</Text>
                    </View>
                    <View style={styles.commentClap}>
                      <Hand size={12} color={colors.gold} />
                      <Text style={styles.commentClapText}>{c.claps}</Text>
                    </View>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 関連する門下生の稽古演舞 */}
          <SectionHeader title="同じ型に取り組む門下生" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedScroll}
          >
            {monkaEnbu.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.relatedCard}
                activeOpacity={0.9}
                onPress={() => navigation.push('VideoDetail', { id: m.id })}
              >
                <ImageBackground
                  source={{ uri: m.image }}
                  style={styles.relatedThumb}
                  imageStyle={{ borderRadius: radius.sm }}
                />
                <Text style={styles.relatedTitle} numberOfLines={2}>{m.title}</Text>
                <Text style={styles.relatedMeta}>{m.performer}／極め度 {m.kimeRate}%</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* 言の葉を届ける（投稿欄） */}
        <View style={styles.inputDock}>
          <View style={styles.inputChips}>
            <Chip label="礼をこめて" />
            <Chip label="教えを乞う" />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={`${lexicon.commentInput}…`}
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
              disabled={!draft.trim()}
              onPress={() => setDraft('')}
            >
              <Send size={18} color={colors.textOnGold} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    borderBottomColor: colors.indigoLine,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 120 },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
  topTitle: { ...typography.headingSerif, color: colors.textPrimary },

  scroll: { paddingBottom: spacing.xl },

  player: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.sm, overflow: 'hidden' },
  playerImage: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center' },
  playerScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  playCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerTime: { ...typography.metric, color: colors.goldBright },

  metaBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  metaBadges: { flexDirection: 'row', marginBottom: spacing.md },
  enbuTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 22, lineHeight: 32 },

  performerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  performerInitial: { ...typography.bodyStrong, color: colors.gold, fontSize: 13 },
  performerText: { flex: 1, marginLeft: spacing.md },
  performerName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 14 },
  performerRole: { ...typography.caption, color: colors.textSecondary },
  performerRen: { ...typography.caption, color: colors.gold, marginTop: 2 },

  enbuDesc: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  metricsPanel: { marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },

  clapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.aka,
    backgroundColor: colors.akaSoft,
  },
  clapBtnActive: { backgroundColor: colors.aka },
  clapText: { ...typography.button, color: colors.aka, marginLeft: spacing.sm },
  clapTextActive: { color: colors.textOnAka },

  toKeikoBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.sm },
  toKeikoText: { ...typography.bodyStrong, color: colors.gold },

  tabBar: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.indigoLine,
  },
  tabItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabLabel: { ...typography.bodyStrong, color: colors.textMuted },
  tabLabelActive: { color: colors.gold },

  tabBody: { padding: spacing.lg },
  washiGap: { marginBottom: spacing.md },
  washiTitle: { ...typography.headingSerif, color: colors.indigoDeep },
  washiBody: {
    ...typography.body,
    color: '#3A3427',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  washiMaster: { ...typography.caption, color: colors.akaDeep, marginTop: spacing.md, textAlign: 'right' },

  comment: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.indigoRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { ...typography.bodyStrong, color: colors.gold },
  commentName: { ...typography.bodyStrong, color: colors.textPrimary },
  commentRen: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  commentClap: { flexDirection: 'row', alignItems: 'center' },
  commentClapText: { ...typography.caption, color: colors.gold, marginLeft: 3 },
  commentText: { ...typography.body, color: colors.textSecondary },

  relatedScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  relatedCard: { width: 150, marginRight: spacing.md },
  relatedThumb: { width: '100%', height: 92, backgroundColor: colors.indigoRaised },
  relatedTitle: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.sm, fontWeight: '700' },
  relatedMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },

  inputDock: {
    borderTopWidth: 1,
    borderTopColor: colors.indigoLine,
    backgroundColor: colors.indigo,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  inputChips: { flexDirection: 'row', marginBottom: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    backgroundColor: colors.indigoRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
