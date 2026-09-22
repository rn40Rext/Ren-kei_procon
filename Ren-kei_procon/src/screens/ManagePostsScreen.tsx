import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatAiScore } from '../features/analysis/format';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { ChevronLeft, X, Search, Heart, MessageSquare, Award, Shield, User as UserIcon, Send } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { subscribePosts, hasInstructorAdvice } from '../repositories/posts';
import { subscribeActiveMembers } from '../repositories/renMembership';
import { Post } from '../types/firestore';
import AppMenu from '../components/AppMenu';
import { colors } from '../theme/colors';

type SortMode = 'newest' | 'score' | 'noAdvice';

export default function ManagePostsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { renId } = route.params;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberUids, setMemberUids] = useState<Set<string>>(new Set());
  const [hasAdviceMap, setHasAdviceMap] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    return subscribeActiveMembers(
      renId,
      (members) => setMemberUids(new Set(members.map((m) => m.uid))),
      (error) => console.error('自連メンバーの取得に失敗しました', error)
    );
  }, [renId]);

  // 「未アドバイス優先」判定のクエリを投稿ごとに一度だけ発行するための
  // 既読集合。state(hasAdviceMap)をuseEffect内のクロージャで直接見ると
  // 古い値のままになり判定が効かなくなるため、refで管理する(#92レビュー
  // で見つかった同種の不具合を避ける)。
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
            .then((hasAdvice) => {
              setHasAdviceMap((prev) => ({ ...prev, [p.id]: hasAdvice }));
            })
            .catch(() => undefined);
        });
      },
      (error) => {
        console.error('投稿一覧の取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', '投稿一覧の取得に失敗しました。時間をおいて再度お試しください');
      }
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.gold} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿一覧</Text>
        <AppMenu />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="タイトル・投稿者・タグで検索" placeholderTextColor={colors.textMuted} value={keyword} onChangeText={setKeyword} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {([
            { key: 'newest', label: '新着順' },
            { key: 'score', label: 'スコア順' },
            { key: 'noAdvice', label: '未アドバイス優先' },
          ] as { key: SortMode; label: string }[]).map((s) => (
            <TouchableOpacity key={s.key} style={[styles.sortPill, sortMode === s.key && styles.sortPillActive]} onPress={() => setSortMode(s.key)}>
              <Text style={[styles.sortPillText, sortMode === s.key && styles.sortPillTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.list}>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : filteredSortedPosts.length === 0 ? (
          <Text style={styles.emptyText}>該当する投稿はありません</Text>
        ) : (
          filteredSortedPosts.map((p) => {
            const isOwnRenMember = memberUids.has(p.userId);
            return (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => setSelectedPost(p)}>
                <View style={styles.thumbWrapper}>
                  <Video style={StyleSheet.absoluteFill} source={{ uri: p.videoUrl }} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
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
                    <Heart size={13} color={colors.textMuted} style={{ marginLeft: 10 }} />
                    <Text style={styles.metaText}>{p.likeCount}</Text>
                    <MessageSquare size={13} color={colors.textMuted} style={{ marginLeft: 10 }} />
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
            <TouchableOpacity onPress={() => setSelectedPost(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ChevronLeft size={24} color={colors.gold} />
              <Text style={styles.modalBackText}>戻る</Text>
            </TouchableOpacity>
          </View>
          {selectedPost && (
            <ScrollView>
              <View style={styles.detailVideoBox}>
                <Video style={{ width: '100%', height: '100%' }} source={{ uri: selectedPost.videoUrl }} useNativeControls resizeMode={ResizeMode.CONTAIN} />
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
                >
                  <UserIcon size={16} color={colors.gold} />
                  <Text style={styles.detailAuthorTextClick}>{selectedPost.authorName} のプロフィールを見る ＞</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.adviceBtn} onPress={handleSendAdvice}>
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
  header: { height: 60, backgroundColor: colors.indigo, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: colors.indigoLine },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  searchSection: { backgroundColor: colors.indigo, paddingTop: 12, paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.indigoLine },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.indigoRaised, borderRadius: 12, paddingHorizontal: 15, height: 42, marginHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: colors.textPrimaryOnIndigo },
  sortRow: { paddingHorizontal: 15, paddingVertical: 10 },
  sortPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.indigoRaised, marginRight: 8 },
  sortPillActive: { backgroundColor: colors.gold },
  sortPillText: { fontSize: 12, color: colors.textSecondaryOnIndigo },
  sortPillTextActive: { color: colors.textOnGold, fontWeight: 'bold' },
  list: { flex: 1, padding: 15 },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  card: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.indigoLine },
  thumbWrapper: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden' },
  cardBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  authorName: { fontSize: 12, color: colors.textMuted },
  memberBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  memberBadgeText: { color: colors.textOnGold, fontSize: 9, fontWeight: 'bold', marginLeft: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
  noAdviceBadge: { backgroundColor: colors.goldSoft, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 10 },
  noAdviceBadgeText: { color: colors.gold, fontSize: 10, fontWeight: 'bold' },

  detailContainer: { flex: 1, backgroundColor: colors.indigoDeep },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: colors.indigoLine },
  modalBackText: { color: colors.gold, fontWeight: 'bold', marginLeft: 4 },
  detailVideoBox: { backgroundColor: '#000', height: 260 },
  detailBody: { padding: 20 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 16 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.indigo, borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' },
  scoreCardText: { color: colors.gold, fontWeight: '900', marginLeft: 8, fontSize: 16 },
  profileBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginTop: 20 },
  detailAuthorTextClick: { marginLeft: 8, color: colors.gold, fontWeight: '600', fontSize: 14 },
  adviceBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  adviceBtnText: { color: colors.textOnGold, fontWeight: 'bold', marginLeft: 8 },
});
