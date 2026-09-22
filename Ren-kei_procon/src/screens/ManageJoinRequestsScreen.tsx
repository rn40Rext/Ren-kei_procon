/**
 * 連の参加リクエスト管理（未対応・承認済み・却下のタブ、申請者詳細、承認/却下）。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { ChevronLeft, X, User as UserIcon, MessageSquare } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { subscribeRenJoinRequests, updateJoinRequestStatus } from '../repositories/joinRequests';
import { fetchUserProfile } from '../repositories/users';
import { fetchPostsByUser, type PostDoc } from '../data/community';
import type { JoinRequest, UserProfile } from '../types/firestore';

type Tab = 'pending' | 'approved' | 'rejected';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '未対応' },
  { key: 'approved', label: '承認済み' },
  { key: 'rejected', label: '却下' },
];

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
  const [applicant, setApplicant] = useState<UserProfile | null>(null);
  const [applicantPosts, setApplicantPosts] = useState<PostDoc[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoading(true);
    return subscribeRenJoinRequests(
      renId,
      tab,
      (list) => {
        setRequests(list);
        setLoading(false);
        list.forEach((req) => {
          if (applicantNames[req.userId]) return;
          fetchUserProfile(req.userId)
            .then((profile) => {
              setApplicantNames((prev) => ({
                ...prev,
                [req.userId]: profile?.nickname || profile?.name || '不明なユーザー',
              }));
            })
            .catch(() => undefined);
        });
      },
      (error) => {
        console.error('参加リクエストの取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', '参加リクエストの取得に失敗しました。時間をおいて再度お試しください');
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renId, tab]);

  const openDetail = async (req: JoinRequest) => {
    setDetailRequest(req);
    setApplicant(null);
    setApplicantPosts([]);
    setLoadingDetail(true);
    try {
      setApplicant(await fetchUserProfile(req.userId));
      setApplicantPosts(await fetchPostsByUser(req.userId, 6));
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
      await updateJoinRequestStatus(requestId, action);
      Alert.alert('完了', action === 'approve' ? '参加を承認しました' : '申請を却下しました');
      closeDetail();
    } catch (error: any) {
      if (error?.code === 'functions/failed-precondition') {
        Alert.alert('お知らせ', 'この申請はすでに処理されています');
      } else if (error?.code === 'functions/permission-denied') {
        Alert.alert('エラー', 'この連の管理者のみ操作できます');
      } else {
        Alert.alert('エラー', '処理に失敗しました');
      }
    } finally {
      setProcessingId(null);
    }
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
        <Text style={styles.headerTitle}>参加リクエスト管理</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tabItem, tab === t.key && styles.tabItemActive]} onPress={() => setTab(t.key)} activeOpacity={0.85}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <NarutoLoader size={22} color={colors.gold} style={{ marginTop: 40, alignSelf: 'center' }} />
        ) : requests.length === 0 ? (
          <Text style={styles.emptyText}>該当する申請はありません</Text>
        ) : (
          requests.map((req) => (
            <View key={req.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{applicantNames[req.userId] ?? '読み込み中…'}</Text>
                {req.message ? (
                  <Text style={styles.cardMessage} numberOfLines={2}>
                    {req.message}
                  </Text>
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
                    activeOpacity={0.85}
                  >
                    {processingId === req.id ? <ActivityIndicator color={colors.textOnGold} size="small" /> : <Text style={styles.approveBtnText}>承認</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    disabled={processingId === req.id}
                    onPress={() => handleDecision(req.id, 'reject')}
                    activeOpacity={0.85}
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
              <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={colors.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <NarutoLoader size={22} color={colors.gold} style={{ marginVertical: spacing.xl, alignSelf: 'center' }} />
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                <View style={styles.profileRow}>
                  <UserIcon size={17} color={colors.gold} />
                  <Text style={styles.profileName}>{applicant?.nickname || applicant?.name || '不明なユーザー'}</Text>
                </View>
                {detailRequest?.message ? (
                  <View style={styles.messageBox}>
                    <MessageSquare size={14} color={colors.textMuted} />
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
                        <RenkeiVideo uri={p.videoUrl} style={StyleSheet.absoluteFill} contentFit="cover" muted />
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
                      activeOpacity={0.85}
                    >
                      {processingId === detailRequest.id ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.approveBtnText}>承認する</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtnLarge}
                      disabled={processingId === detailRequest.id}
                      onPress={() => handleDecision(detailRequest.id, 'reject')}
                      activeOpacity={0.85}
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

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.indigoLine },
  tabItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabLabel: { ...typography.bodyStrong, color: colors.textMuted, fontSize: 12 },
  tabLabelActive: { color: colors.gold },

  list: { flex: 1, padding: spacing.lg },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  cardName: { ...typography.bodyStrong, color: colors.textPrimary },
  cardMessage: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  detailLink: { ...typography.caption, color: colors.gold, fontWeight: '700', marginTop: spacing.sm },
  cardActions: { justifyContent: 'center', marginLeft: spacing.sm },
  approveBtn: { backgroundColor: colors.gold, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.sm, marginBottom: spacing.sm, minWidth: 64, alignItems: 'center' },
  approveBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 13 },
  rejectBtn: { borderWidth: 1, borderColor: colors.indigoLine, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.sm, minWidth: 64, alignItems: 'center' },
  rejectBtnText: { ...typography.button, color: colors.aka, fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  profileName: { marginLeft: spacing.sm, ...typography.bodyStrong, color: colors.textPrimary },
  messageBox: { flexDirection: 'row', backgroundColor: colors.indigoRaised, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg },
  messageBoxText: { marginLeft: spacing.sm, flex: 1, ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  sectionLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  noPostsText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  postThumbWrapper: { width: 100, height: 100, borderRadius: radius.sm, backgroundColor: '#000', overflow: 'hidden', marginRight: spacing.sm },
  postScoreBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(11,19,43,0.8)',
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalActions: { flexDirection: 'row', marginTop: spacing.xl },
  approveBtnLarge: { flex: 1, backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', marginRight: spacing.sm },
  rejectBtnLarge: { flex: 1, borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', marginLeft: spacing.sm },
});
