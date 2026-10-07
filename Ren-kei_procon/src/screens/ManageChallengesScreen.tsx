/**
 * 師匠からのチャレンジの出題(連の管理者向け)。出題フォームと、この連が出したお題の一覧。
 * docs/design/challenges.md。仕様書v0.3には無い追加機能。
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Flag, Plus, Trash2, Film, X } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Alert } from '../utils/alert';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import { Chip } from '../components/ui';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { useAdminRens } from '../hooks/useAdminRens';
import {
  CHALLENGE_ADVICE_MAX,
  CHALLENGE_CATEGORY_LABEL,
  CHALLENGE_DIFFICULTY_LABEL,
  createChallenge,
  deleteChallenge,
  subscribeRenChallenges,
} from '../repositories/challenges';
import type { ChallengeCategory, ChallengeDifficulty, ChallengeDoc } from '../types/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageChallenges'>;

/** フォームの選択肢(保存値の並び順) */
const CATEGORIES: ChallengeCategory[] = ['male', 'female', 'narimono'];
const DIFFICULTIES: ChallengeDifficulty[] = ['beginner', 'intermediate', 'advanced'];

/** 入力中のコツ1件 */
type AdviceDraft = { point: string; detail: string };
const emptyAdvice = (): AdviceDraft => ({ point: '', detail: '' });

/** 連の管理者が「師匠からのチャレンジ」を出題し、出題済みのお題を確認・削除する画面 */
export default function ManageChallengesScreen({ navigation, route }: Props) {
  const { renId } = route.params;
  // 自分が管理者を務める連(この連の管理者でなければ出題させない。最終的な判定はfirestore.rules)
  const { adminRens, loading: rensLoading } = useAdminRens();
  const ren = adminRens.find((r) => r.renId === renId);

  // この連が出したお題 / 読み込み中か
  const [challenges, setChallenges] = useState<ChallengeDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // 出題フォームの入力値
  const [title, setTitle] = useState('');
  const [move, setMove] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('male');
  const [difficulty, setDifficulty] = useState<ChallengeDifficulty>('beginner');
  const [posterRole, setPosterRole] = useState('');
  const [focus, setFocus] = useState('');
  const [advice, setAdvice] = useState<AdviceDraft[]>([emptyAdvice()]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // この連のお題をリアルタイム購読する
  useEffect(() => {
    return subscribeRenChallenges(
      renId,
      (list) => {
        setChallenges(list);
        setLoading(false);
      },
      (error) => {
        console.error('チャレンジの取得に失敗しました', error);
        setLoading(false);
      }
    );
  }, [renId]);

  /** コツ1件の見出し・説明を書き換える */
  const updateAdvice = (index: number, patch: Partial<AdviceDraft>) => {
    setAdvice((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  /** お手本動画を端末から選ぶ */
  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (!res.canceled && res.assets?.[0]?.uri) setVideoUri(res.assets[0].uri);
  };

  /** フォームを空に戻す */
  const resetForm = () => {
    setTitle('');
    setMove('');
    setCategory('male');
    setDifficulty('beginner');
    setPosterRole('');
    setFocus('');
    setAdvice([emptyAdvice()]);
    setVideoUri(null);
  };

  /** 入力を確かめて出題する */
  const handleSubmit = async () => {
    if (!ren) return;
    // 見出しも説明も空のコツは無視する。説明だけで見出しが無いものはエラーにする
    const filled = advice.filter((a) => a.point.trim() || a.detail.trim());
    if (!title.trim() || !move.trim() || !focus.trim()) {
      Alert.alert('入力が足りません', '題名・型・詳細を入力してください');
      return;
    }
    if (filled.length === 0 || filled.some((a) => !a.point.trim())) {
      Alert.alert('入力が足りません', 'コツを1つ以上、見出しを付けて入力してください');
      return;
    }
    // お手本動画は必須(動画のないお題は出題できない)
    if (!videoUri) {
      Alert.alert('お手本動画がありません', 'お手本動画を選んでから出題してください');
      return;
    }
    setSending(true);
    try {
      await createChallenge({
        renId,
        renName: ren.name,
        posterRole,
        title,
        move,
        category,
        difficulty,
        focus,
        advice: filled,
        videoUri,
      });
      resetForm();
      Alert.alert('出題しました', 'ホーム画面の「師匠からのチャレンジ」に表示されます');
    } catch (e) {
      console.error('チャレンジの出題に失敗しました', e);
      Alert.alert('エラー', '出題に失敗しました。時間をおいて再度お試しください');
    } finally {
      setSending(false);
    }
  };

  /** 確認してからお題を削除する */
  const confirmDelete = (c: ChallengeDoc) => {
    Alert.alert('お題を削除', `「${c.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: () => {
          deleteChallenge(c).catch((e) => {
            console.error('チャレンジの削除に失敗しました', e);
            Alert.alert('エラー', '削除に失敗しました');
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー: 戻るボタン・画面名・メニュー */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('AdminHome'))}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft color={colors.gold} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>チャレンジの出題</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      {rensLoading ? (
        <NarutoLoader size={26} color={colors.gold} style={{ marginTop: 60, alignSelf: 'center' }} />
      ) : !ren ? (
        <Text style={[styles.emptyText, { padding: spacing.lg }]}>この連の管理者だけが出題できます</Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* 出題フォーム */}
          <View style={styles.formCard}>
            <Text style={styles.lead}>{ren.name} の名義で、ホーム画面の「師匠からのチャレンジ」に出題します。</Text>

            <Text style={styles.label}>題名（1〜100文字）</Text>
            <TextInput
              style={styles.input}
              placeholder="例：網打ちの構えから踏み込んでみよう"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <Text style={styles.label}>型・所作（1〜50文字）</Text>
            <TextInput
              style={styles.input}
              placeholder="例：男踊り・網打ち"
              placeholderTextColor={colors.textMuted}
              value={move}
              onChangeText={setMove}
              maxLength={50}
            />

            <Text style={styles.label}>踊りの種類</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={CHALLENGE_CATEGORY_LABEL[c]}
                  active={category === c}
                  onPress={() => setCategory(c)}
                  style={styles.chip}
                />
              ))}
            </View>

            <Text style={styles.label}>難易度</Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d}
                  label={CHALLENGE_DIFFICULTY_LABEL[d]}
                  active={difficulty === d}
                  onPress={() => setDifficulty(d)}
                  style={styles.chip}
                />
              ))}
            </View>

            <Text style={styles.label}>出題者の肩書き（任意・50文字まで）</Text>
            <TextInput
              style={styles.input}
              placeholder="例：指導方・踊り歴20年"
              placeholderTextColor={colors.textMuted}
              value={posterRole}
              onChangeText={setPosterRole}
              maxLength={50}
            />

            <Text style={styles.label}>詳細（1〜500文字）</Text>
            <TextInput
              style={styles.textArea}
              placeholder="例：腰を落とすのではなく「預ける」感覚で、膝が固まっていないか"
              placeholderTextColor={colors.textMuted}
              value={focus}
              onChangeText={setFocus}
              multiline
              maxLength={500}
            />

            {/* 意識してほしいところ(コツ1〜5件)。見出しと説明を1組にして入力する */}
            <Text style={styles.label}>意識してほしいところ（1〜{CHALLENGE_ADVICE_MAX}件）</Text>
            {advice.map((a, i) => (
              <View key={i} style={styles.adviceCard}>
                <View style={styles.adviceHead}>
                  <Text style={styles.adviceIndex}>コツ {i + 1}</Text>
                  {advice.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => setAdvice((prev) => prev.filter((_, j) => j !== i))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="見出し（例：骨盤を真下へ預ける）"
                  placeholderTextColor={colors.textMuted}
                  value={a.point}
                  onChangeText={(v) => updateAdvice(i, { point: v })}
                  maxLength={50}
                />
                <TextInput
                  style={[styles.textArea, { minHeight: 64 }]}
                  placeholder="説明（任意）"
                  placeholderTextColor={colors.textMuted}
                  value={a.detail}
                  onChangeText={(v) => updateAdvice(i, { detail: v })}
                  multiline
                  maxLength={300}
                />
              </View>
            ))}
            {advice.length < CHALLENGE_ADVICE_MAX ? (
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setAdvice((prev) => [...prev, emptyAdvice()])}>
                <Plus size={15} color={colors.gold} />
                <Text style={styles.outlineBtnText}>コツを追加</Text>
              </TouchableOpacity>
            ) : null}

            {/* お手本動画(必須) */}
            <Text style={[styles.label, { marginTop: spacing.lg }]}>お手本動画（必須）</Text>
            {videoUri ? (
              <View>
                <RenkeiVideo uri={videoUri} style={styles.preview} contentFit="contain" nativeControls />
                <TouchableOpacity style={styles.outlineBtn} onPress={pickVideo}>
                  <Film size={15} color={colors.gold} />
                  <Text style={styles.outlineBtnText}>動画を選び直す</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.outlineBtn} onPress={pickVideo}>
                <Film size={15} color={colors.gold} />
                <Text style={styles.outlineBtnText}>動画を選ぶ</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={handleSubmit}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color={colors.textOnGold} />
              ) : (
                <>
                  <Flag size={16} color={colors.textOnGold} />
                  <Text style={styles.sendBtnText}>出題する</Text>
                </>
              )}
            </TouchableOpacity>
            {sending && videoUri ? <Text style={styles.hint}>動画をアップロードしています…</Text> : null}
          </View>

          {/* 出題済みのお題。タップで詳細、ゴミ箱で削除 */}
          <Text style={styles.sectionLabel}>出題済みのお題</Text>
          {loading ? (
            <NarutoLoader size={22} color={colors.gold} style={{ marginTop: spacing.lg, alignSelf: 'center' }} />
          ) : challenges.length === 0 ? (
            <Text style={styles.emptyText}>まだ出題したお題はありません</Text>
          ) : (
            challenges.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.itemCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Challenge', { challengeId: c.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{c.title}</Text>
                  <Text style={styles.itemMeta}>
                    {CHALLENGE_CATEGORY_LABEL[c.category]}・{CHALLENGE_DIFFICULTY_LABEL[c.difficulty]}
                    {c.videoUrl ? '・お手本動画あり' : ''}　出題：{c.posterName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(c)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={18} color={colors.aka} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 画面全体の背景と、戻るボタン・画面名を並べるヘッダー
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { marginRight: spacing.sm },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 17 },

  // スクロール部分の余白と、出題フォームを囲むカード
  list: { flex: 1, padding: spacing.lg },
  formCard: {
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    marginBottom: spacing.xl,
  },
  lead: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 17 },
  // 入力欄の見出し(金色)と、1行・複数行の入力欄
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
    ...typography.body,
  },
  textArea: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 90,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
  // 踊りの種類・難易度のチップの並び
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: { marginRight: spacing.sm, marginBottom: spacing.sm },

  // コツ1件分の枠(番号と削除ボタン、見出し・説明の入力欄)
  adviceCard: {
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    padding: spacing.sm,
    paddingBottom: 0,
    marginBottom: spacing.md,
  },
  adviceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  adviceIndex: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },

  // 「コツを追加」「動画を選ぶ」などの枠線ボタン
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  outlineBtnText: { ...typography.caption, color: colors.gold, fontWeight: '700', marginLeft: 6 },
  // 選んだお手本動画のプレビュー
  preview: { width: '100%', height: 240, backgroundColor: colors.indigoRaised, borderRadius: radius.sm, marginBottom: spacing.sm },

  // 出題ボタン(金色。送信中は薄くする)と、送信中の補足
  sendBtn: {
    flexDirection: 'row',
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { ...typography.button, color: colors.textOnGold, marginLeft: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },

  // 出題済み一覧の見出し・0件の案内・1件分のカード
  sectionLabel: { ...typography.sectionLabel, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  itemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 10 },
});
