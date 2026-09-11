import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { ChevronLeft, X, Search, Heart, MessageSquare, Award, Shield, User as UserIcon, Send } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '../config/firebaseConfig';
import { collection, onSnapshot, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

type SortMode = 'newest' | 'score' | 'noAdvice';

// docs/design/data-model.md 3.3章(仕様書 Posts)
interface Post {
  id: string;
  authorName: string;
  userId: string;
  title: string;
  videoUrl: string;
  score: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  createdAt: any;
}

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
    const q = query(collection(db, 'ren', renId, 'members'), where('status', '==', 'active'));
    return onSnapshot(q, (snap) => setMemberUids(new Set(snap.docs.map((d) => d.id))));
  }, [renId]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
        setPosts(list);
        setLoading(false);
        list.forEach((p) => {
          if (p.id in hasAdviceMap) return;
          getDocs(query(collection(db, 'posts', p.id, 'comments'), where('type', '==', 'instructor'), limit(1)))
            .then((commentsSnap) => {
              setHasAdviceMap((prev) => ({ ...prev, [p.id]: !commentsSnap.empty }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSortedPosts = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = posts;
    if (kw) {
      list = list.filter((p) => `${p.title} ${p.authorName} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(kw));
    }
    const sorted = [...list];
    if (sortMode === 'score') {
      sorted.sort((a, b) => b.score - a.score);
    } else if (sortMode === 'noAdvice') {
      sorted.sort((a, b) => Number(!!hasAdviceMap[a.id]) - Number(!!hasAdviceMap[b.id]));
    }
    return sorted;
  }, [posts, keyword, sortMode, hasAdviceMap]);

  const handleSendAdvice = () => {
    Alert.alert('お知らせ', 'アドバイス送信機能(R-04)は準備中です');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={COLORS.primary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿一覧</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput style={styles.searchInput} placeholder="タイトル・投稿者・タグで検索" value={keyword} onChangeText={setKeyword} />
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
          <ActivityIndicator style={{ marginTop: 40 }} />
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
                        <Shield size={10} color="#fff" />
                        <Text style={styles.memberBadgeText}>自連</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <Award size={13} color={COLORS.textMuted} />
                    <Text style={styles.metaText}>{p.score}点</Text>
                    <Heart size={13} color={COLORS.textMuted} style={{ marginLeft: 10 }} />
                    <Text style={styles.metaText}>{p.likeCount}</Text>
                    <MessageSquare size={13} color={COLORS.textMuted} style={{ marginLeft: 10 }} />
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedPost(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ChevronLeft size={24} color={COLORS.primary} />
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
                  <Award size={20} color="#FACC15" />
                  <Text style={styles.scoreCardText}>AI採点 {selectedPost.score}点</Text>
                </View>
                <Text style={styles.scoreNote}>
                  ※ 項目別スコアはAI採点(FN-01)が未実装のため表示できません。総合スコアのみ暫定値です
                </Text>

                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() => {
                    setSelectedPost(null);
                    navigation.navigate('UserProfile', { userId: selectedPost.userId, userName: selectedPost.authorName });
                  }}
                >
                  <UserIcon size={16} color={COLORS.primary} />
                  <Text style={styles.profileBtnText}>{selectedPost.authorName} のプロフィールを見る</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.adviceBtn} onPress={handleSendAdvice}>
                  <Send size={16} color="#fff" />
                  <Text style={styles.adviceBtnText}>アドバイスを送る</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: COLORS.border },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  searchSection: { backgroundColor: '#fff', paddingTop: 12, paddingBottom: 4, borderBottomWidth: 1, borderColor: COLORS.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 15, height: 42, marginHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  sortRow: { paddingHorizontal: 15, paddingVertical: 10 },
  sortPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
  sortPillActive: { backgroundColor: COLORS.primary },
  sortPillText: { fontSize: 12, color: COLORS.textMain },
  sortPillTextActive: { color: '#fff', fontWeight: 'bold' },
  list: { flex: 1, padding: 15 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  thumbWrapper: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden' },
  cardBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  authorName: { fontSize: 12, color: COLORS.textMuted },
  memberBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  memberBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold', marginLeft: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: COLORS.textMuted, marginLeft: 4 },
  noAdviceBadge: { backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 10 },
  noAdviceBadgeText: { color: '#92400E', fontSize: 10, fontWeight: 'bold' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  modalBackText: { color: COLORS.primary, fontWeight: 'bold', marginLeft: 4 },
  detailVideoBox: { backgroundColor: '#000', height: 260 },
  detailBody: { padding: 20 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 16 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' },
  scoreCardText: { color: '#FACC15', fontWeight: '900', marginLeft: 8, fontSize: 16 },
  scoreNote: { fontSize: 11, color: COLORS.textMuted, marginTop: 8, marginBottom: 20 },
  profileBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  profileBtnText: { marginLeft: 8, color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  adviceBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  adviceBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
});
