import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, ChevronRight, Play, Hand, Send } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { Badge, Chip, WashiCard, MetricRow, SectionHeader, Panel } from '../components/ui';
import { RenMon, NarutoLoader, SeigaihaBand, AsanohaBackground } from '../components/motifs';
import RenkeiVideo from '../components/RenkeiVideo';
import AppMenu from '../components/AppMenu';
import { useAdminRens } from '../hooks/useAdminRens';
import {
  todaysEnbu,
  masterEnbu,
  monkaEnbu,
  masterTeachings,
  monkaComments,
} from '../data/mockEnbu';
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
import { formatAiScore, formatAiScoreShort } from '../features/analysis/format';
import { fetchRenName } from '../repositories/renProfile';
import { instructorLabel } from '../utils/renLabel';

/** サンプル表示で探す演舞(本日の演舞・師範・門下生の全部) */
const ALL_ENBU = [todaysEnbu, ...masterEnbu, ...monkaEnbu];

/** 投稿詳細画面。postIdがあれば実データ、無ければサンプル演舞を表示する */
export default function VideoDetailScreen({ navigation, route }: any) {
  const postId: string | undefined = route?.params?.postId;
  // 実データ（交流広場の投稿）ならこちら
  if (postId) return <RealPostDetail postId={postId} navigation={navigation} />;
  return <SampleDetail navigation={navigation} route={route} />;
}

/* ================================================================== */
/* 実データ：交流広場の投稿（posts/{postId}）                            */
/* ================================================================== */
/** 実データ(posts/{postId})の投稿詳細。コメント・拍手はFirestoreへ反映する */
function RealPostDetail({ postId, navigation }: { postId: string; navigation: any }) {
  const { width: SCREEN_W } = useWindowDimensions();
  // 投稿 / 読み込み中か / コメント一覧 / 表示中のタブ(師匠の教え/門下生の声)
  // 拍手したか・拍手の数・拍手の送信中か
  const [post, setPost] = useState<PostDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [tab, setTab] = useState<'teaching' | 'voice'>('voice');
  // 師匠の教えの肩書き(「○○連の連長」)に使う連の名前(連のIDごと)。取れなかった連は null
  const [renNames, setRenNames] = useState<Record<string, string | null>>({});
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

  // 指導者コメントが付いている連の名前を取る(同じ連は1回だけ)
  useEffect(() => {
    const ids = [...new Set(comments.filter((c) => c.type === 'instructor' && c.renId).map((c) => c.renId as string))].filter(
      (id) => !(id in renNames)
    );
    if (ids.length === 0) return;
    let alive = true;
    Promise.all(
      ids.map((id) =>
        fetchRenName(id).then(
          (name) => [id, name] as const,
          () => [id, null] as const
        )
      )
    ).then((entries) => {
      if (alive) setRenNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => {
      alive = false;
    };
  }, [comments, renNames]);

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
                        {c.type === 'instructor' ? instructorLabel(c.renId ? renNames[c.renId] : null) : '門下生の声'}
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

/* ================================================================== */
/* サンプル（ダミーデータ）表示 — 従来どおり                             */
/* ================================================================== */
/** サンプル(ダミーデータ)の演舞詳細。見本であることを明示して表示する */
function SampleDetail({ navigation, route }: any) {
  const { width: SCREEN_W } = useWindowDimensions();
  // どの見本の演舞を表示するか(見つからなければ本日の演舞)
  const enbuId: string | undefined = route?.params?.id;
  const enbu = useMemo(() => ALL_ENBU.find((e) => e.id === enbuId) ?? todaysEnbu, [enbuId]);

  // 表示中のタブ / 拍手の数 / 拍手したか / 入力中のコメント(見本なので送信はしない)
  const [tab, setTab] = useState<'teaching' | 'voice'>('teaching');
  const [claps, setClaps] = useState(enbu.cheers);
  const [clapped, setClapped] = useState(false);
  const [draft, setDraft] = useState('');
  // 連打でonPressが同一イベントループ内で二重発火しても二重に増減しないようにする
  const clapBusyRef = useRef(false);

  /** 見本の拍手。端末の中だけで数を増減する */
  const sendClap = () => {
    if (clapBusyRef.current) return;
    clapBusyRef.current = true;
    setClaps((c) => Math.max(0, clapped ? c - 1 : c + 1));
    setClapped((v) => !v);
    setTimeout(() => {
      clapBusyRef.current = false;
    }, 0);
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
        <SeigaihaBand width={SCREEN_W} height={8} color={colors.gold} opacity={0.2} />

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
          {/* 演舞の情報: 見本の印などのバッジ・題名・踊り手・説明・極め度/演舞尺/調子 */}
          <View style={styles.metaBlock}>
            <View style={styles.metaBadges}>
              {/* 見本データの極め度は本物の採点と同じ表記なので、見本であることを必ず示す(AGENTS.md 5章) */}
              <Badge label="見本(サンプル)" tone="dark" style={{ marginRight: spacing.sm }} />
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
                  { label: lexicon.aiScore, value: formatAiScoreShort(enbu.kimeRate) },
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
              <Text style={styles.toKeikoText}>自主稽古・演舞解析へ</Text>
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

          {/* 師匠の教え(和紙風のカード)/ 門下生の声(拍手の数つき) */}
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
                <Text style={styles.relatedMeta}>{m.performer}／{formatAiScore(m.kimeRate)}</Text>
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

  // サンプル用の動画プレイヤー枠(写真の上に再生ボタンを重ねて見せる)
  player: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.sm, overflow: 'hidden' },
  playerImage: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center' },
  playerScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  // 写真の中央の丸い再生ボタンと、下端のテンポ・長さの表示
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
  performerRole: { ...typography.caption, color: colors.textSecondary },
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

  // タブの中身の余白と、師匠の教えのカード(和紙風の明るい背景なので文字は濃い色)
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

  // コメント1件分の吹き出し
  comment: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  // コメントの見出し行(頭文字の丸・名前・種類)・拍手の数・本文
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

  // 「同じ型に取り組む門下生」を横スクロールで並べるエリア
  relatedScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  relatedCard: { width: 150, marginRight: spacing.md },
  relatedThumb: { width: '100%', height: 92, backgroundColor: colors.indigoRaised },
  relatedTitle: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.sm, fontWeight: '700' },
  relatedMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },

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
  // 入力欄の上の定型文チップ・入力欄と送信ボタンの行
  inputChips: { flexDirection: 'row', marginBottom: spacing.sm },
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
