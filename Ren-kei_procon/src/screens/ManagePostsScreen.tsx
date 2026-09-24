/**
 * 連管理者向けの投稿一覧（検索・並び替え・詳細からアドバイス送信へ）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Modal } from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, Search, Heart, MessageSquare, Award, Shield, User as UserIcon, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { formatAiScore } from '../features/analysis/format';
import { subscribePosts, hasInstructorAdvice } from '../repositories/posts';
import type { Post as PostDoc } from '../types/firestore';
import { subscribeActiveMembers } from '../repositories/renMembership';

type SortMode = 'newest' | 'score' | 'noAdvice';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'newest', label: '新着順' },
  { key: 'score', label: 'スコア順' },
  { key: 'noAdvice', label: '未アドバイス優先' },
];

export default function ManagePostsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { renId } = route.params;

  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberUids, setMemberUids] = useState<Set<string>>(new Set());
  const [hasAdviceMap, setHasAdviceMap] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedPost, setSelectedPost] = useState<PostDoc | null>(null);

  useEffect(() => {
    return subscribeActiveMembers(
      renId,
      (members) => setMemberUids(new Set(members.map((m) => m.uid))),
      (error) => console.error('自連メンバーの取得に失敗しました', error),
    );
  }, [renId]);

  // 「未アドバイス優先」判定のクエリを投稿ごとに一度だけ発行するための既読集合。
  // stateをuseEffect内のクロージャで直接見ると古い値のままになるため、refで管理する。
  const requestedAdviceIdsRef = useRef<Set<string>>(new Set());

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

  const filteredSortedPosts = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = posts;
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
  }, [posts, keyword, sortMode, hasAdviceMap]);

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

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <NarutoLoader size={22} color={colors.gold} style={{ marginTop: spacing.xl, alignSelf: 'center' }} />
        ) : filteredSortedPosts.length === 0 ? (
          <Text style={styles.emptyText}>該当する投稿はありません</Text>
        ) : (
          filteredSortedPosts.map((p) => {
            const isOwnRenMember = memberUids.has(p.userId);
            return (
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
                    {isOwnRenMember && (
                      <View style={styles.memberBadge}>
                        <Shield size={10} color={colors.textOnGold} />
                        <Text style={styles.memberBadgeText}>自連</Text>
                      </View>
                    )}
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

  searchSection: { paddingTop: spacing.md, paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.indigoLine },
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
  sortRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sortPill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  sortPillActive: { backgroundColor: colors.gold },
  sortPillText: { fontSize: 12, color: colors.textSecondary },
  sortPillTextActive: { color: colors.textOnGold, fontWeight: '700' },

  list: { flex: 1, padding: spacing.lg },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.indigoLine },
  thumbWrapper: { width: 90, height: 90, borderRadius: radius.sm, backgroundColor: '#000', overflow: 'hidden' },
  cardBody: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  authorName: { fontSize: 12, color: colors.textMuted },
  memberBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  memberBadgeText: { color: colors.textOnGold, fontSize: 9, fontWeight: '700', marginLeft: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
  noAdviceBadge: { backgroundColor: colors.goldSoft, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: spacing.sm },
  noAdviceBadgeText: { color: colors.gold, fontSize: 10, fontWeight: '700' },

  detailContainer: { flex: 1, backgroundColor: colors.indigoDeep },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.indigoLine },
  modalBackText: { color: colors.gold, fontWeight: '700', marginLeft: 4 },
  detailVideoBox: { backgroundColor: '#000', height: 260 },
  detailBody: { padding: spacing.xl },
  detailTitle: { ...typography.titleSerif, color: colors.textPrimary, marginBottom: spacing.lg, fontSize: 18 },
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
  profileBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  profileBtnText: { marginLeft: spacing.sm, color: colors.gold, fontWeight: '700', fontSize: 14 },
  adviceBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  adviceBtnText: { color: colors.textOnGold, fontWeight: '700', marginLeft: spacing.sm },
});
