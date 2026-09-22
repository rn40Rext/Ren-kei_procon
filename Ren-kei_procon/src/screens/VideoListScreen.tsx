import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Play } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { KumihimoRule, HeaderSeam } from '../components/motifs';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { monkaEnbu } from '../data/mockEnbu';
import {
  subscribeMyVideos,
  ANALYSIS_STATUS_LABEL,
  DANCE_TYPE_LABEL,
  SCORE_PART_LABEL,
  type VideoDoc,
} from '../data/practice';

// 見本（サンプル）の稽古録。実データの下に表示する
const SAMPLE_ENBU = [...monkaEnbu, ...monkaEnbu.map((e) => ({ ...e, id: e.id + '-b', kimeRate: e.kimeRate - 6 }))];

function formatDate(v: VideoDoc): string {
  const d = v.createdAt?.toDate?.();
  if (!d) return 'たった今';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function VideoListScreen() {
  const navigation = useNavigation<any>();
  const [myVideos, setMyVideos] = useState<VideoDoc[]>([]);

  useEffect(() => {
    const unsub = subscribeMyVideos(
      (v) => setMyVideos(v),
      (e) => console.warn('subscribeMyVideos', e),
    );
    return unsub;
  }, []);

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
      <HeaderSeam />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.count}>
          自主稽古 {myVideos.length} 本（非公開で保存）
        </Text>

        {myVideos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>まだ保存した演舞はありません</Text>
            <Text style={styles.emptySub}>自主稽古から演舞を撮ると、ここに非公開で保存されます</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Scoring')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>自主稽古へ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          myVideos.map((v) => {
            const meta = [
              v.danceType ? DANCE_TYPE_LABEL[v.danceType] : null,
              v.scorePart ? SCORE_PART_LABEL[v.scorePart] : null,
            ]
              .filter(Boolean)
              .join('・');
            return (
              <View key={v.id} style={styles.row}>
                <View style={styles.thumb}>
                  {v.downloadUrl ? (
                    <RenkeiVideo uri={v.downloadUrl} style={styles.thumbVideo} contentFit="cover" muted />
                  ) : null}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{formatDate(v)} の演舞</Text>
                  {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
                  <View style={styles.statusRow}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{ANALYSIS_STATUS_LABEL[v.analysisStatus]}</Text>
                    </View>
                    <Text style={styles.privateTag}>非公開</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.sampleDivider}>
          <KumihimoRule width={16} />
          <Text style={styles.sampleDividerText}>　ここから下は見本（サンプル）</Text>
        </View>

        {SAMPLE_ENBU.map((e) => (
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

  emptyCard: {
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, textAlign: 'center' },
  emptyBtn: { backgroundColor: colors.gold, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.sm },
  emptyBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 13 },

  sampleDivider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
  sampleDividerText: { ...typography.caption, color: colors.textMuted },

  row: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 84,
    height: 84,
    backgroundColor: colors.indigoRaised,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  thumbVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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

  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusPill: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillText: { ...typography.caption, color: colors.gold, fontSize: 10 },
  privateTag: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginLeft: spacing.sm },
});
