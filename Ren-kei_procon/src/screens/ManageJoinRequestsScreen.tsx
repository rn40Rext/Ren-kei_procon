import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { ChevronLeft, X, User as UserIcon, MessageSquare } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db, functions } from '../config/firebaseConfig';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
};

type Tab = 'pending' | 'approved' | 'rejected';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '未対応' },
  { key: 'approved', label: '承認済み' },
  { key: 'rejected', label: '却下' },
];

// docs/design/data-model.md 3.10章
interface JoinRequest {
  id: string;
  userId: string;
  renId: string;
  message: string;
  status: Tab;
  createdAt: any;
}

// docs/design/data-model.md 3.1章
interface Applicant {
  name: string;
  nickname?: string;
}

// docs/design/data-model.md 3.3章(投稿)
interface ApplicantPost {
  id: string;
  title: string;
  videoUrl: string;
  score: number;
}

export default function ManageJoinRequestsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { renId } = route.params;

  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [applicantNames, setApplicantNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [detailRequest, setDetailRequest] = useState<JoinRequest | null>(null);
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [applicantPosts, setApplicantPosts] = useState<ApplicantPost[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'joinRequests'),
      where('renId', '==', renId),
      where('status', '==', tab),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as JoinRequest));
        setRequests(list);
        setLoading(false);
        list.forEach((req) => {
          if (applicantNames[req.userId]) return;
          getDoc(doc(db, 'users', req.userId))
            .then((s) => {
              const data = s.data();
              setApplicantNames((prev) => ({ ...prev, [req.userId]: data?.nickname || data?.name || '不明なユーザー' }));
            })
            .catch(() => undefined);
        });
      },
      (error) => {
        console.error('参加リクエストの取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', '参加リクエストの取得に失敗しました。時間をおいて再度お試しください');
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renId, tab]);

  const openDetail = async (req: JoinRequest) => {
    setDetailRequest(req);
    setApplicant(null);
    setApplicantPosts([]);
    setLoadingDetail(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', req.userId));
      setApplicant(userSnap.exists() ? (userSnap.data() as Applicant) : null);

      const postsSnap = await getDocs(
        query(collection(db, 'posts'), where('userId', '==', req.userId), orderBy('createdAt', 'desc'), limit(6))
      );
      setApplicantPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ApplicantPost)));
    } catch (error) {
      console.error('申請者情報の取得に失敗しました', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setDetailRequest(null);
    setApplicant(null);
    setApplicantPosts([]);
  };

  const handleDecision = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      const updateJoinRequestStatus = httpsCallable(functions, 'updateJoinRequestStatus');
      await updateJoinRequestStatus({ requestId, action });
      Alert.alert('完了', action === 'approve' ? '参加を承認しました' : '申請を却下しました');
      closeDetail();
    } catch (error: any) {
      if (error?.code === 'functions/failed-precondition') {
        Alert.alert('お知らせ', 'この申請はすでに処理されています');
      } else if (error?.code === 'functions/permission-denied') {
        Alert.alert('エラー', 'この連の管理者のみ操作できます');
      } else {
        console.error(error);
        Alert.alert('エラー', '処理に失敗しました');
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={COLORS.primary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>参加リクエスト管理</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tabItem, tab === t.key && styles.tabItemActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.list}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : requests.length === 0 ? (
          <Text style={styles.emptyText}>該当する申請はありません</Text>
        ) : (
          requests.map((req) => (
            <View key={req.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{applicantNames[req.userId] ?? '読み込み中...'}</Text>
                {req.message ? (
                  <Text style={styles.cardMessage} numberOfLines={2}>{req.message}</Text>
                ) : null}
                <TouchableOpacity onPress={() => openDetail(req)}>
                  <Text style={styles.detailLink}>プロフィール・投稿動画を見る ＞</Text>
                </TouchableOpacity>
              </View>
              {tab === 'pending' && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    disabled={processingId === req.id}
                    onPress={() => handleDecision(req.id, 'approve')}
                  >
                    {processingId === req.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.approveBtnText}>承認</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    disabled={processingId === req.id}
                    onPress={() => handleDecision(req.id, 'reject')}
                  >
                    <Text style={styles.rejectBtnText}>却下</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!detailRequest} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>申請者の詳細</Text>
              <TouchableOpacity onPress={closeDetail}>
                <X color={COLORS.textMain} size={22} />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                <View style={styles.profileRow}>
                  <UserIcon size={18} color={COLORS.primary} />
                  <Text style={styles.profileName}>{applicant?.nickname || applicant?.name || '不明なユーザー'}</Text>
                </View>
                {detailRequest?.message ? (
                  <View style={styles.messageBox}>
                    <MessageSquare size={14} color={COLORS.textMuted} />
                    <Text style={styles.messageBoxText}>{detailRequest.message}</Text>
                  </View>
                ) : null}

                <Text style={styles.sectionLabel}>投稿動画</Text>
                {applicantPosts.length === 0 ? (
                  <Text style={styles.noPostsText}>投稿された動画はありません</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {applicantPosts.map((p) => (
                      <View key={p.id} style={styles.postThumbWrapper}>
                        <Video style={StyleSheet.absoluteFill} source={{ uri: p.videoUrl }} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                        <Text style={styles.postScoreBadge}>{p.score}点</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {tab === 'pending' && detailRequest && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.approveBtnLarge}
                      disabled={processingId === detailRequest.id}
                      onPress={() => handleDecision(detailRequest.id, 'approve')}
                    >
                      {processingId === detailRequest.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>承認する</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtnLarge}
                      disabled={processingId === detailRequest.id}
                      onPress={() => handleDecision(detailRequest.id, 'reject')}
                    >
                      <Text style={styles.rejectBtnText}>却下する</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
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
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: COLORS.border },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 3, borderBottomColor: COLORS.primary },
  tabLabel: { color: COLORS.textMuted, fontWeight: 'bold', fontSize: 13 },
  tabLabelActive: { color: COLORS.primary },
  list: { flex: 1, padding: 15 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardName: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain },
  cardMessage: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  detailLink: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold', marginTop: 8 },
  cardActions: { justifyContent: 'center', marginLeft: 10 },
  approveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginBottom: 8, minWidth: 64, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  rejectBtn: { backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 64, alignItems: 'center' },
  rejectBtnText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profileName: { marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: COLORS.textMain },
  messageBox: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 16 },
  messageBoxText: { marginLeft: 8, flex: 1, fontSize: 13, color: COLORS.textMain, lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  noPostsText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },
  postThumbWrapper: { width: 100, height: 100, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden', marginRight: 10 },
  postScoreBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  modalActions: { flexDirection: 'row', marginTop: 20 },
  approveBtnLarge: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginRight: 8 },
  rejectBtnLarge: { flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginLeft: 8 },
});
