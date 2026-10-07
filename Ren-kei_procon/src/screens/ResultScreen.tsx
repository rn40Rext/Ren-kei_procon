/**
 * U-03 解析結果。仕様書 5章 U-03 / 7.7、docs/design/ai-basic-motion.md 10章。
 *
 * FN-01 がサーバで確定した analysisResults を表示する。
 * LIVE SCORE(Game Score)はチーム判断でユーザーには表示しない(2026-10-01)。
 * gameScore自体の算出・保存は変更していない。
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
import { Play, X } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AnalysisResult, subscribeAnalysisResult } from '../repositories/analysis';
import { fetchVideo, videoDownloadUrl } from '../repositories/videos';
import { attachPostToChallenge, publishExistingVideo, POST_TAG_OPTIONS } from '../repositories/posts';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { KumihimoRule, NarutoLoader, AwaDivider } from '../components/motifs';
import { Chip } from '../components/ui';
import { ScoreRevealAnimation } from '../components/ScoreRevealAnimation';
import PracticeVideoModal from '../components/PracticeVideoModal';

/** この画面で使う画面遷移と、前の画面から受け取る値(解析IDと動画ID)の型 */
type ResultNav = NativeStackNavigationProp<RootStackParamList, 'Result'>;
type ResultRoute = RouteProp<RootStackParamList, 'Result'>;

/**
 * 「初心者がここを目指せばいい」という目安として表示する参考値。
 * RULE-07等の閾値はTBD-02で未検証なので、厳密な合否ラインではなく
 * あくまで目安(参考値)として扱う。項目別バーにも同じ値を目印として出す。
 */
const BEGINNER_TARGET = 60;

/** 項目別に表示する点数の一覧。「参考」の2項目は極め度の平均には含めない */
const ITEMS: { key: keyof AnalysisResult; label: string; note?: string }[] = [
  { key: 'handHeightScore', label: '手の高さ' },
  { key: 'hipHeightScore', label: '腰の低さ' },
  { key: 'stopScore', label: '手を止める' },
  { key: 'rhythmScore', label: 'リズム' },
  { key: 'handPositionScore', label: '手の位置', note: '参考（極め度に含まず）' },
  { key: 'basePostureScore', label: '基本姿勢', note: '参考（極め度に含まず）' },
];

// 点数に応じて表示色を変える(80点以上は金、60点以上は明るい金、それ未満は赤)
function scoreColor(v: number): string {
  if (v >= 80) return colors.gold;
  if (v >= 60) return colors.goldBright;
  return colors.aka;
}

/** 稽古1回分の解析結果(極め度・項目別の点数・アドバイス)を見せ、交流広場への投稿や次の稽古へ進む画面 */
export default function ResultScreen() {
  const navigation = useNavigation<ResultNav>();
  const route = useRoute<ResultRoute>();
  // どの解析結果を表示するか(前の画面から受け取る)
  const { analysisId, videoId } = route.params;
  // 師匠からのチャレンジへの挑戦として採点したときのお題。あれば交流広場ではなくこのお題に投稿する
  const { challengeId, challengeTitle } = route.params;
  // 解析結果(undefined=読み込み中、null=見つからない) / 読み込みのエラー文
  const [result, setResult] = useState<AnalysisResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // 投稿ダイアログを開いているか / 投稿の題名・ひとこと・タグ / 投稿中か / 投稿のエラー文 / 投稿済みか
  const [shareVisible, setShareVisible] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareTags, setShareTags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  // 撮った動画の再生用URL(取れなかった・動画が無いときは null で、「撮った動画を見る」を出さない) / 再生画面を開いているか
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  // 撮った動画の再生用URLを取る
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const video = await fetchVideo(videoId);
        const url = video?.downloadUrl ?? (video?.storagePath ? await videoDownloadUrl(video.storagePath) : null);
        if (!cancelled) setVideoUrl(url);
      } catch (e) {
        console.warn('動画のURL取得に失敗しました', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // 解析結果をリアルタイム購読する(サーバでの確定を待つため)
  useEffect(() => {
    return subscribeAnalysisResult(analysisId, setResult, (e) => setError(e.message));
  }, [analysisId]);

  /** 投稿ダイアログを開く(前回のエラー表示は消す) */
  const openShare = () => {
    setShareError(null);
    setShareVisible(true);
  };

  // タグを押すたびに、選択中なら外し、未選択なら追加する
  const toggleShareTag = (tag: string) => {
    setShareTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  /** 解析結果の動画を交流広場へ投稿する(チャレンジへの挑戦なら、そのお題への挑戦として投稿する) */
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
      const { postId } = await publishExistingVideo({
        videoUrl: video.downloadUrl,
        title: shareTitle,
        description: shareDescription || undefined,
        tags: shareTags,
        videoId,
      });
      // 挑戦の投稿には印(challengeId)を付け、交流広場には出さずお題の詳細にだけ出す
      if (challengeId) {
        try {
          await attachPostToChallenge(postId, challengeId);
        } catch (e) {
          console.error('チャレンジへの登録に失敗しました', e);
          setShareError('投稿はできましたが、チャレンジへの登録に失敗しました。交流広場に表示されています');
          setPosted(true);
          setShareVisible(false);
          return;
        }
      }
      setPosted(true);
      setShareVisible(false);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : '投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  // 読み込み中はくるくるだけを出す
  if (result === undefined && !error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <NarutoLoader size={34} color={colors.gold} />
        <Text style={styles.muted}>結果を読み込んでいます…</Text>
      </SafeAreaView>
    );
  }
  // 読み込みに失敗したか結果が見つからないときは、その旨と戻るボタンを出す
  if (error || result === null) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error ?? '解析結果が見つかりませんでした'}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Home', undefined, { pop: true })}>
          <Text style={styles.secondaryButtonText}>踊り広場へ戻る</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  const r = result as AnalysisResult;
  // 点数が付いている項目だけを表示する
  const items = ITEMS.filter((it) => typeof r[it.key] === 'number');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 見出しと説明 */}
        <KumihimoRule width={30} />
        <Text style={styles.title}>解析結果</Text>
        <Text style={styles.lead}>基本動作トレーニング（AI解析①）。判定ルールの根拠から算出した評価です。</Text>

        {/* 極め度 = 手の高さ・腰の低さ・手を止める・リズムのうち評価できた項目の平均(サーバで確定。functions/src/analysis/score.ts) */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{lexicon.aiScore}</Text>
          <ScoreRevealAnimation score={r.totalScore} style={styles.totalReveal} />
          <Text style={styles.totalNote}>手の高さ・腰の低さ・手を止める・リズムのうち、評価できた項目の平均です（100点満点）。</Text>
          <Text style={styles.totalBenchmark}>初心者の目安：{BEGINNER_TARGET}点前後(参考値。上級者の踊りを厳密に測るものではありません)</Text>
        </View>

        {/* 項目別の点数: 項目ごとに点数と棒グラフ(点数で色が変わる)を出し、初心者の目安の位置に縦線を引く */}
        <View style={styles.sectionHead}>
          <KumihimoRule width={18} />
          <Text style={styles.sectionTitle}>　項目別</Text>
        </View>
        {items.length > 0 && (
          <Text style={styles.barLegend}>
            <Text style={styles.barLegendMark}>｜</Text> は初心者の目安({BEGINNER_TARGET}点、参考値)
          </Text>
        )}
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
                {/* 初心者の目安(参考値)。合否ラインではなく、どのくらいで目安に届くかの目印 */}
                <View style={[styles.barTarget, { left: `${BEGINNER_TARGET}%` }]} />
              </View>
            </View>
          );
        })}

        {/* アドバイス: 改善点(朱色の枠)とできている点(金色の枠) */}
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

        <AwaDivider width={320} style={{ marginTop: spacing.xl, marginBottom: spacing.lg }} />

        {/* 撮った動画を再生する(動画のURLが取れたときだけ) */}
        {videoUrl ? (
          <TouchableOpacity style={styles.watchButton} onPress={() => setWatching(true)} activeOpacity={0.85}>
            <Play size={15} color={colors.gold} />
            <Text style={styles.watchButtonText}>撮った動画を見る</Text>
          </TouchableOpacity>
        ) : null}

        {/* 投稿ボタン(チャレンジへの挑戦ならそのお題へ、それ以外は交流広場へ)。投稿後は「投稿しました」の表示に変える */}
        {posted ? (
          <>
            <View style={styles.postedNote}>
              <Text style={styles.postedNoteText}>{challengeId ? 'チャレンジに投稿しました' : '交流広場へ投稿しました'}</Text>
            </View>
            {shareError ? <Text style={styles.shareModalError}>{shareError}</Text> : null}
            {challengeId ? (
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => navigation.navigate('Challenge', { challengeId })}
                activeOpacity={0.85}
              >
                <Text style={styles.shareButtonText}>お題と挑戦した人の演舞を見る</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <TouchableOpacity style={styles.shareButton} onPress={openShare} activeOpacity={0.85}>
            <Text style={styles.shareButtonText}>
              {challengeId ? 'この演舞をチャレンジに投稿する' : 'この演舞を交流広場へ投稿する'}
            </Text>
          </TouchableOpacity>
        )}

        {/* もう一度稽古する / 踊り広場へ戻る */}
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Scoring', challengeId ? { challengeId, challengeTitle } : undefined, { pop: true })} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>もう一度稽古する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Home', undefined, { pop: true })} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>踊り広場へ戻る</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* 撮った動画の再生画面(採点中のBGMは動画の音声として入っている) */}
      <PracticeVideoModal uri={watching ? videoUrl : null} onClose={() => setWatching(false)} />

      {/* 交流広場への投稿ダイアログ: 題名(必須)・ひとこと・タグと投稿ボタン */}
      <Modal visible={shareVisible} transparent animationType="slide" onRequestClose={() => setShareVisible(false)}>
        <KeyboardAvoidingView
          style={styles.shareModalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.shareModalCard}>
            <View style={styles.shareModalHead}>
              <Text style={styles.shareModalTitle}>{challengeId ? 'チャレンジに投稿' : '交流広場へ投稿'}</Text>
              <TouchableOpacity onPress={() => setShareVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.shareModalLead}>
              {challengeId
                ? `この稽古の演舞を、お題「${challengeTitle ?? ''}」の「挑戦した人の演舞」に公開します（交流広場には出ません）。`
                : 'この稽古の演舞を、みんなが見られる交流広場に公開します。'}
            </Text>

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
            <Text style={styles.shareModalLabel}>調子・型のしるし（任意）</Text>
            <View style={styles.shareModalTagWrap}>
              {POST_TAG_OPTIONS.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  active={shareTags.includes(tag)}
                  onPress={() => toggleShareTag(tag)}
                  style={styles.shareModalTag}
                />
              ))}
            </View>
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
  // 画面全体の背景と余白。読み込み中・エラー時は中身を中央に置く
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.xl, alignItems: 'stretch' },

  // 見出しと説明文
  title: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  lead: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 17 },


  // セクションの見出し(組紐の飾り + 明朝体の文字)
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  sectionTitle: { ...typography.headingSerif, color: colors.textPrimary },

  // 項目別スコア1行分(ラベル・数値・バー)
  itemRow: { marginBottom: spacing.md },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  itemNote: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  itemValue: { ...typography.bodyStrong },
  // 棒グラフの背景と、点数ぶんだけ伸びる色付き部分
  barTrack: { height: 10, backgroundColor: colors.indigoRaised, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barTarget: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.textPrimary, opacity: 0.55 },
  // 「｜は初心者の目安」という棒グラフの凡例
  barLegend: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.md },
  barLegendMark: { color: colors.textPrimary, opacity: 0.55, fontWeight: '900' },

  // 改善点・良かった点のフィードバック1件分の枠。種類によって色を変える
  feedback: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  feedbackImprove: { backgroundColor: colors.akaSoft, borderColor: colors.aka },
  feedbackGood: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  feedbackTag: { ...typography.sectionLabel, marginBottom: 4 },
  feedbackText: { ...typography.body, color: colors.textPrimary },

  // 総合スコア(極め度)を大きく見せるカード
  totalCard: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.indigo,
    alignItems: 'center',
  },
  totalLabel: { ...typography.sectionLabel, color: colors.gold },
  // 極め度の数字を演出付きで表示するアニメーションの余白
  totalReveal: { marginTop: spacing.sm, marginBottom: spacing.xs },
  totalNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center', alignSelf: 'stretch' },
  // 初心者向けの目安点数の注記
  totalBenchmark: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', alignSelf: 'stretch' },

  // 「もう一度稽古する」(金色)と「踊り広場へ戻る」(枠線)のボタン
  primaryButton: { backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', marginBottom: spacing.sm },
  primaryButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.indigo },
  secondaryButtonText: { ...typography.button, color: colors.textPrimary },

  // 「撮った動画を見る」ボタン(投稿ボタンと同じ金色の枠。投稿ボタンの上に置く)
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  watchButtonText: { ...typography.button, color: colors.gold },
  // 「交流広場へ投稿する」ボタン(金色の枠線)と、投稿後の「投稿しました」の表示
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

  // 補足の小さな文字と、エラー文(朱色)
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
  // 投稿ダイアログの見出し・説明・入力欄の見出し(金色)
  shareModalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  shareModalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  shareModalLead: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },
  shareModalLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm, marginTop: spacing.sm },
  // 題名・ひとことの入力欄と、タグのチップの並び
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
  shareModalTagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  shareModalTag: { marginRight: spacing.sm, marginBottom: spacing.sm },
  // 投稿のエラー文と投稿ボタン(題名が空か投稿中は薄くする)
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
