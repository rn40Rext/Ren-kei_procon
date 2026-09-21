/**
 * U-03 解析結果。仕様書 5章 U-03 / 7.7、docs/design/ai-basic-motion.md 10章。
 *
 * FN-01 がサーバで確定した analysisResults を表示する。
 * 極め度（Analysis Score・0〜100・履歴用）と LIVE SCORE（練習中の参考値）は
 * 混同させない表示にする(D-04)。
 */
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AnalysisResult, subscribeAnalysisResult } from '../repositories/analysis';
import { fetchVideo } from '../repositories/videos';
import { publishExistingVideo } from '../data/community';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { KumihimoRule, NarutoLoader, Chochin, AwaDivider } from '../components/motifs';

type ResultNav = NativeStackNavigationProp<RootStackParamList, 'Result'>;
type ResultRoute = RouteProp<RootStackParamList, 'Result'>;

const ITEMS: { key: keyof AnalysisResult; label: string; note?: string }[] = [
  { key: 'handHeightScore', label: '手の高さ' },
  { key: 'hipHeightScore', label: '腰の低さ' },
  { key: 'stopScore', label: '手を止める' },
  { key: 'rhythmScore', label: 'リズム' },
  { key: 'handPositionScore', label: '手の位置', note: '参考（総合に含まず）' },
  { key: 'basePostureScore', label: '基本姿勢', note: '参考（総合に含まず）' },
];

function scoreColor(v: number): string {
  if (v >= 80) return colors.gold;
  if (v >= 60) return colors.goldBright;
  return colors.aka;
}

export default function ResultScreen() {
  const navigation = useNavigation<ResultNav>();
  const route = useRoute<ResultRoute>();
  const { analysisId, videoId } = route.params;
  const [result, setResult] = useState<AnalysisResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [shareVisible, setShareVisible] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [posting, setPosting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    return subscribeAnalysisResult(analysisId, setResult, (e) => setError(e.message));
  }, [analysisId]);

  const openShare = () => {
    setShareError(null);
    setShareVisible(true);
  };

  const submitShare = async () => {
    if (!shareTitle.trim()) {
      setShareError('タイトルを入力してください');
      return;
    }
    setPosting(true);
    setShareError(null);
    try {
      const video = await fetchVideo(videoId);
      if (!video?.downloadUrl) {
        setShareError('動画の準備がまだできていません。少し待ってからもう一度お試しください');
        return;
      }
      await publishExistingVideo({
        videoUrl: video.downloadUrl,
        title: shareTitle,
        description: shareDescription || undefined,
      });
      setPosted(true);
      setShareVisible(false);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : '投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  if (result === undefined && !error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <NarutoLoader size={34} color={colors.gold} />
        <Text style={styles.muted}>結果を読み込んでいます…</Text>
      </SafeAreaView>
    );
  }
  if (error || result === null) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error ?? '解析結果が見つかりませんでした'}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.secondaryButtonText}>踊り広場へ戻る</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  const r = result as AnalysisResult;
  const items = ITEMS.filter((it) => typeof r[it.key] === 'number');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <KumihimoRule width={30} />
        <Text style={styles.title}>解析結果</Text>
        <Text style={styles.lead}>基本動作トレーニング（AI解析①）。判定ルールの根拠から算出した0〜100の評価です。</Text>

        <View style={styles.totalCard}>
          <Chochin size={22} lit style={{ marginBottom: spacing.sm }} />
          <Text style={styles.totalLabel}>{lexicon.aiScore}</Text>
          <Text style={[styles.totalValue, { color: scoreColor(r.totalScore) }]}>{Math.round(r.totalScore)}</Text>
          <Text style={styles.totalUnit}>/ 100</Text>
          <Text style={styles.version}>判定ルール {r.analysisVersion}</Text>
        </View>

        <View style={styles.sectionHead}>
          <KumihimoRule width={18} />
          <Text style={styles.sectionTitle}>　項目別</Text>
        </View>
        {items.length === 0 && <Text style={styles.muted}>評価できた項目がありません（全身が映る位置でもう一度お試しください）</Text>}
        {items.map((it) => {
          const v = r[it.key] as number;
          return (
            <View key={it.key} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemLabel}>
                  {it.label}
                  {it.note ? <Text style={styles.itemNote}>　{it.note}</Text> : null}
                </Text>
                <Text style={[styles.itemValue, { color: scoreColor(v) }]}>{Math.round(v)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, v))}%`, backgroundColor: scoreColor(v) }]} />
              </View>
            </View>
          );
        })}

        <View style={styles.sectionHead}>
          <KumihimoRule width={18} />
          <Text style={styles.sectionTitle}>　{lexicon.aiAdvice}</Text>
        </View>
        {r.feedback?.length ? (
          r.feedback.map((f, i) => (
            <View key={`${f.ruleId}-${i}`} style={[styles.feedback, f.type === 'improve' ? styles.feedbackImprove : styles.feedbackGood]}>
              <Text style={[styles.feedbackTag, { color: f.type === 'improve' ? colors.aka : colors.gold }]}>
                {f.type === 'improve' ? '改善点' : 'できている'}
              </Text>
              <Text style={styles.feedbackText}>{f.message}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>コメントはありません</Text>
        )}

        <AwaDivider width={320} style={{ marginTop: spacing.xl, marginBottom: spacing.sm }} />

        <View style={styles.gameCard}>
          <Text style={styles.gameLabel}>練習中のLIVE SCORE（参考値）</Text>
          <Text style={styles.gameValue}>{r.gameScore}</Text>
          <Text style={styles.gameCounts}>
            GREAT {r.greatCount} / GOOD {r.goodCount} / MISS {r.missCount}
            {typeof r.maxCombo === 'number' ? ` / 最大 ${r.maxCombo} COMBO` : ''}
          </Text>
          <Text style={styles.gameNote}>ゲーム感覚で練習するための累積点で、上の{lexicon.aiScore}とは別物です。</Text>
        </View>

        {posted ? (
          <View style={styles.postedNote}>
            <Text style={styles.postedNoteText}>交流広場へ投稿しました</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.shareButton} onPress={openShare} activeOpacity={0.85}>
            <Text style={styles.shareButtonText}>この演舞を交流広場へ投稿する</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Scoring')} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>もう一度稽古する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>踊り広場へ戻る</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <Modal visible={shareVisible} transparent animationType="slide" onRequestClose={() => setShareVisible(false)}>
        <KeyboardAvoidingView
          style={styles.shareModalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.shareModalCard}>
            <View style={styles.shareModalHead}>
              <Text style={styles.shareModalTitle}>交流広場へ投稿</Text>
              <TouchableOpacity onPress={() => setShareVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.shareModalLead}>この稽古の演舞を、みんなが見られる交流広場に公開します。</Text>

            <Text style={styles.shareModalLabel}>タイトル</Text>
            <TextInput
              style={styles.shareModalInput}
              placeholder="例）今日の女踊り、手の高さを意識しました"
              placeholderTextColor={colors.textMuted}
              value={shareTitle}
              onChangeText={setShareTitle}
              maxLength={100}
            />
            <Text style={styles.shareModalLabel}>ひとこと（任意）</Text>
            <TextInput
              style={[styles.shareModalInput, styles.shareModalTextarea]}
              placeholder="演舞についてのコメントがあれば"
              placeholderTextColor={colors.textMuted}
              value={shareDescription}
              onChangeText={setShareDescription}
              multiline
              maxLength={1000}
            />
            {shareError ? <Text style={styles.shareModalError}>{shareError}</Text> : null}

            <TouchableOpacity
              style={[styles.shareModalSubmit, (posting || !shareTitle.trim()) && styles.shareModalSubmitDisabled]}
              onPress={submitShare}
              disabled={posting || !shareTitle.trim()}
              activeOpacity={0.85}
            >
              {posting ? (
                <ActivityIndicator color={colors.textOnGold} size="small" />
              ) : (
                <Text style={styles.shareModalSubmitText}>投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.xl, alignItems: 'stretch' },

  title: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  lead: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 17 },

  totalCard: {
    alignItems: 'center',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  totalLabel: { ...typography.sectionLabel, color: colors.gold },
  totalValue: { fontSize: 72, fontWeight: '900', lineHeight: 80, fontFamily: typography.displaySerif.fontFamily },
  totalUnit: { ...typography.caption, color: colors.textMuted, marginTop: -6 },
  version: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },

  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  sectionTitle: { ...typography.headingSerif, color: colors.textPrimary },

  itemRow: { marginBottom: spacing.md },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  itemNote: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  itemValue: { ...typography.bodyStrong },
  barTrack: { height: 10, backgroundColor: colors.indigoRaised, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },

  feedback: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  feedbackImprove: { backgroundColor: colors.akaSoft, borderColor: colors.aka },
  feedbackGood: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  feedbackTag: { ...typography.sectionLabel, marginBottom: 4 },
  feedbackText: { ...typography.body, color: colors.textPrimary },

  gameCard: {
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.indigo,
  },
  gameLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  gameValue: { fontSize: 28, fontWeight: '900', color: colors.goldBright, marginTop: 2 },
  gameCounts: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  gameNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },

  primaryButton: { backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', marginBottom: spacing.sm },
  primaryButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.indigo },
  secondaryButtonText: { ...typography.button, color: colors.textPrimary },

  shareButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shareButtonText: { ...typography.button, color: colors.gold },
  postedNote: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  postedNoteText: { ...typography.button, color: colors.gold },

  muted: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  errorText: { color: colors.aka, marginBottom: spacing.lg, textAlign: 'center' },

  /* --- 投稿モーダル --- */
  shareModalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,19,43,0.7)' },
  shareModalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  shareModalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  shareModalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  shareModalLead: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },
  shareModalLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm, marginTop: spacing.sm },
  shareModalInput: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  shareModalTextarea: { minHeight: 64, textAlignVertical: 'top' },
  shareModalError: { ...typography.caption, color: colors.aka, marginTop: spacing.sm },
  shareModalSubmit: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  shareModalSubmitDisabled: { opacity: 0.4 },
  shareModalSubmitText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
});
