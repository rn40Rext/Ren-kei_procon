/**
 * 連管理者向けの投稿一覧（検索・並び替え・詳細からアドバイス送信へ）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Modal } from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, Search, Heart, MessageSquare, Award, User as UserIcon, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { formatAiScore } from '../features/analysis/format';
import { subscribePosts, hasInstructorAdvice } from '../repositories/posts';
import type { Post as PostDoc } from '../types/firestore';
import { subscribeActiveMembers } from '../repositories/renMembership';

/** 一覧の並び順(新着順/極め度の高い順/まだアドバイスしていない投稿を先に) */
type SortMode = 'newest' | 'score' | 'noAdvice';

/** 並び順の選択肢と表示名 */
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'newest', label: '新着順' },
  { key: 'score', label: '極め度順' },
  { key: 'noAdvice', label: '未アドバイス優先' },
];

/** 連の管理者が、自分の連のメンバーの投稿を検索・並べ替えし、詳細からアドバイスを送る画面 */
export default function ManagePostsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // どの連の投稿を見るか(前の画面から受け取る)
  const { renId } = route.params;

  // 全投稿 / 読み込み中か / 自連メンバーのuid / メンバーを読み込み済みか
  // 投稿ごとのアドバイス済みか / 検索キーワード / 並び順 / 詳細を開いている投稿
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberUids, setMemberUids] = useState<Set<string>>(new Set());
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [hasAdviceMap, setHasAdviceMap] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedPost, setSelectedPost] = useState<PostDoc | null>(null);

  // 自連の所属メンバーをリアルタイム購読する(投稿の絞り込みに使う)
  useEffect(() => {
    return subscribeActiveMembers(
      renId,
      (members) => {
        setMemberUids(new Set(members.map((m) => m.uid)));
        setMembersLoaded(true);
      },
      (error) => console.error('自連メンバーの取得に失敗しました', error),
    );
  }, [renId]);

  // 「未アドバイス優先」判定のクエリを投稿ごとに一度だけ発行するための既読集合。
  // stateをuseEffect内のクロージャで直接見ると古い値のままになるため、refで管理する。
  const requestedAdviceIdsRef = useRef<Set<string>>(new Set());

  // 投稿一覧をリアルタイム購読し、まだ調べていない投稿についてアドバイス済みかを調べる
  useEffect(() => {
    return subscribePosts(
      (list) => {
        setPosts(list);
        setLoading(false);
        list.forEach((p) => {
          if (requestedAdviceIdsRef.current.has(p.id)) return;
          requestedAdviceIdsRef.current.add(p.id);
          hasInstructorAdvice(p.id)
            .then((hasAdvice) => setHasAdviceMap((prev) => ({ ...prev, [p.id]: hasAdvice })))
            .catch(() => undefined);
        });
      },
      (error) => {
        console.error('投稿一覧の取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', '投稿一覧の取得に失敗しました。時間をおいて再度お試しください');
      },
    );
  }, []);

  // 連管理者は自連メンバー(自分含む)の投稿のみ確認できる(#120。
  // 2026-09-11の#30時点の決定(全公開投稿を閲覧可)を覆した)。
  const ownRenPosts = useMemo(
    () => posts.filter((p) => memberUids.has(p.userId)),
    [posts, memberUids],
  );

  // 検索キーワードで絞り込み、選んだ並び順で並べ替えた一覧を作る
  const filteredSortedPosts = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = ownRenPosts;
    if (kw) {
      list = list.filter((p) => `${p.title} ${p.authorName} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(kw));
    }
    const sorted = [...list];
    if (sortMode === 'score') {
      sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else if (sortMode === 'noAdvice') {
      sorted.sort((a, b) => Number(!!hasAdviceMap[a.id]) - Number(!!hasAdviceMap[b.id]));
    }
    return sorted;
  }, [ownRenPosts, keyword, sortMode, hasAdviceMap]);

  /** 選んだ投稿への指導者コメント作成画面(AdviceCompose)へ遷移する */
  const handleSendAdvice = () => {
    if (!selectedPost) return;
    setSelectedPost(null);
    navigation.navigate('AdviceCompose', {
      postId: selectedPost.id,
      renId,
      postTitle: selectedPost.title,
      authorName: selectedPost.authorName,
      videoUrl: selectedPost.videoUrl,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー: 戻るボタン・画面名・メニュー */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft color={colors.gold} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿一覧</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      {/* キーワード検索欄と並び順の切り替え */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={17} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="タイトル・投稿者・タグで検索"
            placeholderTextColor={colors.textMuted}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORT_OPTIONS.map((s) => (
            <TouchableOpacity key={s.key} style={[styles.sortPill, sortMode === s.key && styles.sortPillActive]} onPress={() => setSortMode(s.key)} activeOpacity={0.85}>
              <Text style={[styles.sortPillText, sortMode === s.key && styles.sortPillTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 投稿の一覧。読み込み中・0件の場合は案内を出す */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading || !membersLoaded ? (
          <NarutoLoader size={22} color={colors.gold} style={{ marginTop: spacing.xl, alignSelf: 'center' }} />
        ) : filteredSortedPosts.length === 0 ? (
          <Text style={styles.emptyText}>該当する投稿はありません</Text>
        ) : (
          filteredSortedPosts.map((p) => {
            return (
              // 投稿1件分のカード: 動画のサムネイル・題名・投稿者・極め度・いいね数・コメント数と、未アドバイスの印。タップで詳細を開く
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => setSelectedPost(p)} activeOpacity={0.85}>
                <View style={styles.thumbWrapper}>
                  <RenkeiVideo uri={p.videoUrl} style={StyleSheet.absoluteFill} contentFit="cover" muted />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <View style={styles.authorRow}>
                    <Text style={styles.authorName}>{p.authorName}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Award size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{formatAiScore(p.score)}</Text>
                    <Heart size={13} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
                    <Text style={styles.metaText}>{p.likeCount}</Text>
                    <MessageSquare size={13} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
                    <Text style={styles.metaText}>{p.commentCount}</Text>
                    {!hasAdviceMap[p.id] && (
                      <View style={styles.noAdviceBadge}>
                        <Text style={styles.noAdviceBadgeText}>未アドバイス</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 投稿の詳細(画面全体): 動画・題名・極め度と、投稿者のプロフィールへのリンク・アドバイスを送るボタン */}
      <Modal visible={!!selectedPost} animationType="slide" onRequestClose={() => setSelectedPost(null)}>
        <SafeAreaView style={styles.detailContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedPost(null)} style={{ flexDirection: 'row', alignItems: 'center' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ChevronLeft size={22} color={colors.gold} />
              <Text style={styles.modalBackText}>戻る</Text>
            </TouchableOpacity>
          </View>
          {selectedPost && (
            <ScrollView>
              <View style={styles.detailVideoBox}>
                <RenkeiVideo uri={selectedPost.videoUrl} style={{ width: '100%', height: '100%' }} contentFit="contain" muted={false} nativeControls />
              </View>
              <View style={styles.detailBody}>
                <Text style={styles.detailTitle}>{selectedPost.title}</Text>

                <View style={styles.scoreCard}>
                  <Award size={20} color={colors.gold} />
                  <Text style={styles.scoreCardText}>{formatAiScore(selectedPost.score)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() => {
                    setSelectedPost(null);
                    navigation.navigate('UserProfile', { userId: selectedPost.userId, userName: selectedPost.authorName });
                  }}
                  activeOpacity={0.85}
                >
                  <UserIcon size={16} color={colors.gold} />
                  <Text style={styles.profileBtnText}>{selectedPost.authorName} のプロフィールを見る</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.adviceBtn} onPress={handleSendAdvice} activeOpacity={0.85}>
                  <Send size={16} color={colors.textOnGold} />
                  <Text style={styles.adviceBtnText}>アドバイスを送る</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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

  // キーワード検索欄と並び替えタブをまとめたエリア
  searchSection: { paddingTop: spacing.md, paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.indigoLine },
  // 検索欄(角を少し丸めた枠)
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    marginHorizontal: spacing.lg,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.textPrimary, ...typography.body, fontSize: 13 },
  // 並び順のピル形ボタン。選んでいるものは金色に塗る
  sortRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sortPill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  sortPillActive: { backgroundColor: colors.gold },
  sortPillText: { fontSize: 12, color: colors.textSecondary },
  sortPillTextActive: { color: colors.textOnGold, fontWeight: '700' },

  // 一覧のスクロール部分と、0件のときの案内文
  list: { flex: 1, padding: spacing.lg },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  // 投稿1件分のカード。サムネイルと情報を横に並べる
  card: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.indigoLine },
  // カードの中の動画サムネイル(正方形)と、題名・投稿者
  thumbWrapper: { width: 90, height: 90, borderRadius: radius.sm, backgroundColor: '#000', overflow: 'hidden' },
  cardBody: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  authorName: { fontSize: 12, color: colors.textMuted },
  // 極め度・いいね数・コメント数の行と、「未アドバイス」の金色のバッジ
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
  noAdviceBadge: { backgroundColor: colors.goldSoft, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: spacing.sm },
  noAdviceBadgeText: { color: colors.gold, fontSize: 10, fontWeight: '700' },

  // 投稿を選んだときに開く詳細画面
  detailContainer: { flex: 1, backgroundColor: colors.indigoDeep },
  // 詳細画面の「戻る」の行・動画の表示枠・題名
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.indigoLine },
  modalBackText: { color: colors.gold, fontWeight: '700', marginLeft: 4 },
  detailVideoBox: { backgroundColor: '#000', height: 260 },
  detailBody: { padding: spacing.xl },
  detailTitle: { ...typography.titleSerif, color: colors.textPrimary, marginBottom: spacing.lg, fontSize: 18 },
  // 極め度を表示する小さな枠
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
  },
  scoreCardText: { color: colors.gold, fontWeight: '900', marginLeft: spacing.sm, fontSize: 16 },
  // 投稿者のプロフィールへのリンク(金色の文字)と、アドバイスを送るボタン(金色)
  profileBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  profileBtnText: { marginLeft: spacing.sm, color: colors.gold, fontWeight: '700', fontSize: 14 },
  adviceBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  adviceBtnText: { color: colors.textOnGold, fontWeight: '700', marginLeft: spacing.sm },
});
