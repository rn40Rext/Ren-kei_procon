import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, ChevronRight, Play, Hand, Send } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { Badge, MetricRow, Panel } from '../components/ui';
import { RenMon, NarutoLoader, SeigaihaBand, AsanohaBackground } from '../components/motifs';
import RenkeiVideo from '../components/RenkeiVideo';
import AppMenu from '../components/AppMenu';
import { useAdminRens } from '../hooks/useAdminRens';
import {
  fetchPost,
  subscribeComments,
  addComment,
  isLiked,
  toggleLike,
  loadCachedPosts,
  loadCachedComments,
} from '../repositories/posts';
import type { Post as PostDoc, PostComment as CommentDoc } from '../types/firestore';
import { formatAiScoreShort } from '../features/analysis/format';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoDetail'>;
type VideoDetailNav = Props['navigation'];

/** 投稿詳細画面。交流広場の投稿(posts/{postId})を表示する */
export default function VideoDetailScreen({ navigation, route }: Props) {
  return <RealPostDetail postId={route.params.postId} navigation={navigation} />;
}

/* ================================================================== */
/* 実データ：交流広場の投稿（posts/{postId}）                            */
/* ================================================================== */
/** 実データ(posts/{postId})の投稿詳細。コメント・拍手はFirestoreへ反映する */
function RealPostDetail({ postId, navigation }: { postId: string; navigation: VideoDetailNav }) {
  const { width: SCREEN_W } = useWindowDimensions();
  // 投稿 / 読み込み中か / コメント一覧 / 表示中のタブ(師匠の教え/門下生の声)
  // 拍手したか・拍手の数・拍手の送信中か
  const [post, setPost] = useState<PostDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [tab, setTab] = useState<'teaching' | 'voice'>('voice');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [busy, setBusy] = useState(false);
  // stateのbusyは非同期更新のため同一イベントループ内の連打(react-native-web
  // でonPressが二重発火することがある)を防げない。refで即座にガードする
  const busyRef = useRef(false);
  // 入力中のコメントと、送信中か
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const { adminRens } = useAdminRens();
  // 指導者コメント(師匠の教え)は連管理者のみ投稿できる(#31と同じ制約。
  // 複数連の管理者を兼任している場合は、暫定的に最初の連の管理者として投稿する)
  const canPostInstructor = adminRens.length > 0;

  // 投稿・コメント・拍手したかを読み込む。前回の保存分で先に表示し、届いた最新の内容で置き換える
  useEffect(() => {
    let alive = true;
    let gotPost = false;
    let gotComments = false;

    // 前回セッションの保存分で即座に埋める（オフライン・応答前でも消えない）
    loadCachedPosts().then((cached) => {
      const hit = cached.find((x) => x.id === postId);
      if (alive && hit && !gotPost) {
        setPost(hit);
        setLikeCount(hit.likeCount);
        setLoading(false);
      }
    });
    loadCachedComments(postId).then((cc) => {
      if (alive && !gotComments && cc.length) setComments(cc);
    });

    fetchPost(postId)
      .then((p) => {
        if (!alive) return;
        gotPost = true;
        if (p) {
          setPost(p);
          setLikeCount(p.likeCount);
        }
      })
      // 通信失敗・権限エラーでも「開いています…」のまま止まらないようにする(キャッシュがあればそれを表示)
      .catch((e) => console.warn('投稿の取得に失敗しました', e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    isLiked(postId)
      .then((v) => alive && setLiked(v))
      .catch(() => undefined);
    const unsub = subscribeComments(
      postId,
      (c) => {
        if (!alive) return;
        gotComments = true;
        setComments(c);
      },
      (error) => console.error('コメントの取得に失敗しました', error)
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [postId]);

  /** 拍手を送る/取り消す。先に画面を更新し、失敗したら元に戻す */
  const onClap = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    // 楽観更新（マイナスにはならないようクランプする）
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      await toggleLike(postId, liked);
    } catch (e) {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
      Alert.alert('エラー', '拍手の送信に失敗しました');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  /** コメント(門下生の声/師匠の教え)を送信する */
  const onSend = async () => {
    if (!draft.trim() || sending) return;
    if (tab === 'teaching' && !canPostInstructor) return;
    setSending(true);
    try {
      await addComment(postId, {
        text: draft,
        type: tab === 'teaching' ? 'instructor' : 'normal',
        renId: tab === 'teaching' ? adminRens[0].renId : undefined,
      });
      setDraft('');
    } catch (e) {
      Alert.alert('エラー', '声の送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  // 表示中のタブに合うコメントだけを出す(師匠の教え=指導者コメント、門下生の声=通常のコメント)
  const shown = comments.filter((c) => (tab === 'teaching' ? c.type === 'instructor' : c.type === 'normal'));

  // 読み込み中はくるくるだけを出す
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <NarutoLoader size={34} color={colors.gold} />
        <Text style={styles.loadingText}>演舞を開いています…</Text>
      </SafeAreaView>
    );
  }
  // 投稿が見つからない(削除済みなど)ときは、その旨と戻るボタンを出す
  if (!post) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.enbuDesc}>投稿が見つかりませんでした</Text>
        <TouchableOpacity style={styles.toKeikoBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.toKeikoText}>戻る</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ヘッダー: 広場へ戻るボタン・画面名・メニューと、その下の波の飾り */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft color={colors.gold} size={22} />
            <Text style={styles.backText}>広場へ戻る</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>演舞</Text>
          <AppMenu />
        </View>
        <SeigaihaBand width={SCREEN_W} height={8} color={colors.gold} opacity={0.2} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 動画の再生(動画がない投稿は模様と再生アイコンだけ) */}
          <View style={styles.player}>
            {post.videoUrl ? (
              <RenkeiVideo
                uri={post.videoUrl}
                style={styles.playerVideo}
                contentFit="contain"
                nativeControls
                muted={false}
              />
            ) : (
              <View style={[styles.playerVideo, styles.center]}>
                <AsanohaBackground width={SCREEN_W} height={(SCREEN_W * 16) / 9} color={colors.gold} opacity={0.08} />
                <Play size={26} color={colors.gold} />
              </View>
            )}
          </View>

          {/* 投稿の情報: タグ・題名・投稿者・説明・極め度/拍手/声の数 */}
          <View style={styles.metaBlock}>
            {post.tags.length > 0 ? (
              <View style={styles.metaBadges}>
                {post.tags.slice(0, 3).map((t) => (
                  <Badge key={t} label={t} tone="dark" style={{ marginRight: spacing.sm }} />
                ))}
              </View>
            ) : null}

            <Text style={styles.enbuTitle}>{post.title}</Text>

            <View style={styles.performerRow}>
              <RenMon size={32} color={colors.gold}>
                <Text style={styles.performerInitial}>{post.authorName.slice(0, 1)}</Text>
              </RenMon>
              <View style={styles.performerText}>
                <Text style={styles.performerName}>{post.authorName}</Text>
                <Text style={styles.performerRen}>交流広場の投稿</Text>
              </View>
            </View>

            {post.description ? <Text style={styles.enbuDesc}>{post.description}</Text> : null}

            <Panel style={styles.metricsPanel}>
              <MetricRow
                items={[
                  { label: lexicon.aiScore, value: formatAiScoreShort(post.score) },
                  { label: '拍手', value: `${likeCount}` },
                  { label: '声', value: `${post.commentCount}` },
                ]}
              />
            </Panel>

            {/* 拍手ボタン(拍手済みは朱色に塗る)と、自主稽古への入口 */}
            <TouchableOpacity
              style={[styles.clapBtn, liked && styles.clapBtnActive]}
              onPress={onClap}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Hand
                size={18}
                color={liked ? colors.textOnAka : colors.aka}
                fill={liked ? colors.textOnAka : 'transparent'}
              />
              <Text style={[styles.clapText, liked && styles.clapTextActive]}>
                {lexicon.like}　{likeCount.toLocaleString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toKeikoBtn}
              onPress={() => navigation.navigate('Scoring')}
              activeOpacity={0.85}
            >
              <Text style={styles.toKeikoText}>自主稽古・演舞解析へ</Text>
              <ChevronRight size={15} color={colors.gold} />
            </TouchableOpacity>
          </View>

          {/* 門下生の声 / 師匠の教え のタブ(件数つき) */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, tab === 'voice' && styles.tabItemActive]}
              onPress={() => setTab('voice')}
            >
              <Text style={[styles.tabLabel, tab === 'voice' && styles.tabLabelActive]}>
                {lexicon.comment}（{comments.filter((c) => c.type === 'normal').length}）
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, tab === 'teaching' && styles.tabItemActive]}
              onPress={() => setTab('teaching')}
            >
              <Text style={[styles.tabLabel, tab === 'teaching' && styles.tabLabelActive]}>
                {lexicon.masterTeaching}（{comments.filter((c) => c.type === 'instructor').length}）
              </Text>
            </TouchableOpacity>
          </View>

          {/* 選んだタブのコメント一覧。0件なら案内文を出す */}
          <View style={styles.tabBody}>
            {shown.length === 0 ? (
              <Text style={styles.emptyComment}>
                {tab === 'teaching' ? 'まだ師匠の教えはありません。' : 'まだ声は届いていません。最初のひとことを。'}
              </Text>
            ) : (
              shown.map((c) => (
                <View key={c.id} style={styles.comment}>
                  <View style={styles.commentHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{c.userName.slice(0, 1)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>{c.userName}</Text>
                      <Text style={styles.commentRen}>
                        {c.type === 'instructor' ? '師匠の教え' : '門下生の声'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* 画面下の入力欄。師匠の教えのタブでは、連の管理者でなければ案内文だけを出す */}
        {tab === 'teaching' && !canPostInstructor ? (
          <View style={styles.inputDockDisabled}>
            <Text style={styles.inputDockDisabledText}>指導者コメントは連の管理者のみ投稿できます</Text>
          </View>
        ) : (
          <View style={styles.inputDock}>
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
                style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                disabled={!draft.trim() || sending}
                onPress={onSend}
              >
                {sending ? (
                  <ActivityIndicator color={colors.textOnGold} size="small" />
                ) : (
                  <Send size={18} color={colors.textOnGold} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 画面全体の背景と、中央寄せの補助スタイル
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  center: { justifyContent: 'center', alignItems: 'center' },
  // 稽古動画はスマホを縦に持って撮るため縦長(9:16)。固定の低い高さでcoverすると
  // 横長の枠に収めようとして上下が大きく切れていたため、縦長の比率で全体を映す
  playerVideo: { width: '100%', aspectRatio: 9 / 16, backgroundColor: colors.indigoRaised },
  // コメントが0件のときと、読み込み中の文
  emptyComment: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  loadingText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },

  // 画面上部のヘッダー。「広場へ戻る」・画面名・メニューを横一列に並べる
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

  // スクロール部分の下の余白
  scroll: { paddingBottom: spacing.xl },

  // 動画プレイヤーの枠(角を丸めて余白を取る)
  player: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.sm, overflow: 'hidden' },

  // 演舞の情報のまとまりと、バッジの並び・題名(大きめの明朝体)
  metaBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  metaBadges: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xs, marginBottom: spacing.md },
  enbuTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 22, lineHeight: 32 },

  // 踊り手の行(頭文字の紋・名前・役職・所属)
  performerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  performerInitial: { ...typography.bodyStrong, color: colors.gold, fontSize: 13 },
  performerText: { flex: 1, marginLeft: spacing.md },
  performerName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 14 },
  performerRen: { ...typography.caption, color: colors.gold, marginTop: 2 },

  // 説明文と、極め度などの数字の枠
  enbuDesc: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  metricsPanel: { marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },

  // 拍手ボタン。押した状態(active)では背景を塗りつぶして色を反転する
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

  // 「自主稽古・演舞解析へ」のリンク
  toKeikoBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.sm },
  toKeikoText: { ...typography.bodyStrong, color: colors.gold },

  // 「師匠の教え」「門下生の声」を切り替えるタブ
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

  // タブの中身の余白
  tabBody: { padding: spacing.lg },

  // コメント1件分の吹き出し
  comment: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  // コメントの見出し行(頭文字の丸・名前・種類)・本文
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
  commentText: { ...typography.body, color: colors.textSecondary },

  // 画面下部に固定された、コメント入力欄のエリア
  inputDock: {
    borderTopWidth: 1,
    borderTopColor: colors.indigoLine,
    backgroundColor: colors.indigo,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  // 投稿できないときの案内の帯
  inputDockDisabled: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.indigoLine,
    backgroundColor: colors.indigo,
  },
  inputDockDisabledText: { textAlign: 'center', fontSize: 12, color: colors.textMuted },
  // 入力欄と送信ボタンの行
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  // コメントの入力欄(複数行)
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
  // 送信ボタン(金色。文が空のときは薄くする)
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
