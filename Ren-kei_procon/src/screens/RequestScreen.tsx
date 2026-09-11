import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { Search, Users, MapPin, ChevronRight, X } from 'lucide-react-native';
import { auth } from '../config/firebaseConfig';
import { subscribeRens, fetchRenMember } from '../repositories/ren';
import {
  subscribeMyJoinRequests,
  submitJoinRequest,
  cancelJoinRequest,
} from '../repositories/joinRequests';
import { JoinRequest, Ren } from '../types/firestore';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
};

export default function RequestScreen() {
  const [rens, setRens] = useState<Ren[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [beginnerFriendlyOnly, setBeginnerFriendlyOnly] = useState(false);

  const [selectedRen, setSelectedRen] = useState<Ren | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return subscribeRens(
      (list) => {
        setRens(list);
        setLoading(false);
      },
      (error) => {
        console.error('連一覧の取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', '連一覧の取得に失敗しました。時間をおいて再度お試しください');
      }
    );
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    // 複合インデックス(userId + createdAt)を使う自分の申請履歴クエリ。
    // 特定の連への重複pending申請の有無は、ここから取得した一覧を
    // クライアント側でフィルタして判定する(申請ごとのクエリを増やさない)。
    return subscribeMyJoinRequests(
      currentUser.uid,
      setMyRequests,
      (error) => {
        // 複合インデックスがデプロイ直後で構築中の場合など、一時的に
        // 失敗することがある。エラーを可視化し、再読み込みを促す。
        console.error('申請履歴の取得に失敗しました', error);
        Alert.alert(
          'エラー',
          '申請履歴の取得に失敗しました。時間をおいて画面を開き直してください'
        );
      }
    );
  }, []);

  const filteredRens = rens.filter((r) => {
    if (beginnerFriendlyOnly && !r.beginnerFriendly) return false;
    if (!keyword.trim()) return true;
    const target = `${r.name} ${r.description} ${r.location}`.toLowerCase();
    return target.includes(keyword.trim().toLowerCase());
  });

  const pendingRequestFor = (renId: string) =>
    myRequests.find((r) => r.renId === renId && r.status === 'pending');

  const openRen = async (ren: Ren) => {
    setSelectedRen(ren);
    setMessage('');
    setCheckingMembership(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const member = await fetchRenMember(ren.id, currentUser.uid);
        setIsMember(member?.status === 'active');
      }
    } finally {
      setCheckingMembership(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRen) return;
    setSubmitting(true);
    try {
      await submitJoinRequest(selectedRen.id, message.trim());
      Alert.alert('完了', '参加を申請しました');
      setSelectedRen(null);
    } catch (error: any) {
      if (error?.code === 'functions/already-exists') {
        Alert.alert('お知らせ', 'この連へはすでに申請中です');
      } else if (error?.code === 'functions/failed-precondition') {
        Alert.alert('お知らせ', 'すでにこの連のメンバーです');
      } else {
        console.error(error);
        Alert.alert('エラー', '申請に失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelJoinRequest(requestId);
      Alert.alert('完了', '申請を取り消しました');
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '取り消しに失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>連を探す</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search color="#94A3B8" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="連の名前・地域などで検索"
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>

        <TouchableOpacity style={styles.filterRow} onPress={() => setBeginnerFriendlyOnly(!beginnerFriendlyOnly)}>
          <View style={[styles.checkbox, beginnerFriendlyOnly && styles.checkboxChecked]} />
          <Text style={styles.filterLabel}>初心者歓迎のみ表示</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : filteredRens.length === 0 ? (
          <Text style={styles.emptyText}>連が見つかりませんでした</Text>
        ) : (
          filteredRens.map((ren) => {
            const pending = pendingRequestFor(ren.id);
            return (
              <TouchableOpacity key={ren.id} style={styles.renCard} onPress={() => openRen(ren)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.renName}>{ren.name}</Text>
                  {ren.location ? (
                    <View style={styles.renRow}>
                      <MapPin size={13} color={COLORS.textMuted} />
                      <Text style={styles.renRowText}>{ren.location}</Text>
                    </View>
                  ) : null}
                  <View style={styles.renRow}>
                    <Users size={13} color={COLORS.textMuted} />
                    <Text style={styles.renRowText}>メンバー {ren.memberCount}人</Text>
                  </View>
                  {pending ? <Text style={styles.pendingBadge}>申請中</Text> : null}
                </View>
                <ChevronRight size={20} color="#CBD5E1" />
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!selectedRen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedRen?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedRen(null)}>
                <X color={COLORS.textMain} size={22} />
              </TouchableOpacity>
            </View>

            {selectedRen?.description ? <Text style={styles.modalDescription}>{selectedRen.description}</Text> : null}

            {checkingMembership ? (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            ) : isMember ? (
              <Text style={styles.infoText}>すでにこの連のメンバーです</Text>
            ) : selectedRen && pendingRequestFor(selectedRen.id) ? (
              <View>
                <Text style={styles.infoText}>この連へはすでに申請中です</Text>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    const req = pendingRequestFor(selectedRen.id);
                    if (req) handleCancelRequest(req.id);
                    setSelectedRen(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>申請を取り消す</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>メッセージ(任意)</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="自己紹介や意気込みなど"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>参加を申請する</Text>}
                </TouchableOpacity>
              </>
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
  header: { height: 60, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  searchSection: { backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderColor: COLORS.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 15, height: 45 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterLabel: { fontSize: 13, color: COLORS.textMain },
  list: { flex: 1, padding: 15 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  renCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  renName: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain },
  renRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  renRowText: { marginLeft: 6, fontSize: 12, color: COLORS.textMuted },
  pendingBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  modalDescription: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16, lineHeight: 20 },
  infoText: { fontSize: 14, color: COLORS.textMain, textAlign: 'center', marginVertical: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  messageInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { backgroundColor: '#FEF2F2', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 15 },
});
