/**
 * 連を探す・参加を申請する（連機能）。
 * 個人へのスカウト(RequestScreen)とは別物で、連そのものへの参加申請を扱う。
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, MapPin, Users, X } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { Badge } from '../components/ui';
import AppMenu from '../components/AppMenu';
import { KasaGarland, NarutoLoader } from '../components/motifs';
import { IconWagasa } from '../components/awaIcons';
import { auth } from '../config/firebaseConfig';
import { subscribeRens } from '../repositories/renProfile';
import { fetchRenMember } from '../repositories/renMembership';
import { subscribeMyJoinRequests, submitJoinRequest, cancelJoinRequest } from '../repositories/joinRequests';
import type { JoinRequest, Ren } from '../types/firestore';

export default function RenSearchScreen() {
  const navigation = useNavigation<any>();

  const [rens, setRens] = useState<Ren[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [beginnerOnly, setBeginnerOnly] = useState(false);

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
      },
    );
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    return subscribeMyJoinRequests(
      user.uid,
      setMyRequests,
      (error) => {
        console.error('申請履歴の取得に失敗しました', error);
        Alert.alert('エラー', '申請履歴の取得に失敗しました。時間をおいて画面を開き直してください');
      },
    );
  }, []);

  const filteredRens = rens.filter((r) => {
    if (beginnerOnly && !r.beginnerFriendly) return false;
    if (!keyword.trim()) return true;
    const target = `${r.name} ${r.description} ${r.location}`.toLowerCase();
    return target.includes(keyword.trim().toLowerCase());
  });

  const pendingRequestFor = (renId: string) => myRequests.find((r) => r.renId === renId && r.status === 'pending');

  const openRen = async (ren: Ren) => {
    setSelectedRen(ren);
    setMessage('');
    setCheckingMembership(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const member = await fetchRenMember(ren.id, user.uid);
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
    } catch (e: any) {
      if (e?.code === 'functions/already-exists') {
        Alert.alert('お知らせ', 'この連へはすでに申請中です');
      } else if (e?.code === 'functions/failed-precondition') {
        Alert.alert('お知らせ', 'すでにこの連のメンバーです');
      } else {
        Alert.alert('エラー', '申請に失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await cancelJoinRequest(requestId);
      Alert.alert('完了', '申請を取り消しました');
    } catch {
      Alert.alert('エラー', '取り消しに失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KasaGarland width={360} count={7} height={40} style={styles.garland} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </TouchableOpacity>
        <IconWagasa size={22} color={colors.gold} style={styles.headerIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>連を探す</Text>
          <Text style={styles.headerSub}>気になる連を見つけて参加を申請する</Text>
        </View>
        <AppMenu />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="連の名前・地域などで検索"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <TouchableOpacity style={styles.filterRow} onPress={() => setBeginnerOnly((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, beginnerOnly && styles.checkboxOn]} />
          <Text style={styles.filterLabel}>初心者歓迎のみ表示</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingRow}>
            <NarutoLoader size={22} color={colors.gold} />
            <Text style={styles.loadingText}>連を探しています…</Text>
          </View>
        ) : filteredRens.length === 0 ? (
          <Text style={styles.emptyText}>連が見つかりませんでした</Text>
        ) : (
          filteredRens.map((ren) => {
            const pending = pendingRequestFor(ren.id);
            return (
              <TouchableOpacity key={ren.id} style={styles.renCard} onPress={() => openRen(ren)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.renName}>{ren.name}</Text>
                  {ren.location ? (
                    <View style={styles.renRow}>
                      <MapPin size={13} color={colors.textMuted} />
                      <Text style={styles.renRowText}>{ren.location}</Text>
                    </View>
                  ) : null}
                  <View style={styles.renRow}>
                    <Users size={13} color={colors.textMuted} />
                    <Text style={styles.renRowText}>メンバー {ren.memberCount}人</Text>
                  </View>
                  {ren.beginnerFriendly ? (
                    <View style={styles.badgeRow}>
                      <Badge label="初心者歓迎" tone="gold" />
                      {pending ? <Badge label="申請中" tone="outline" /> : null}
                    </View>
                  ) : pending ? (
                    <View style={styles.badgeRow}>
                      <Badge label="申請中" tone="outline" />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <Modal visible={!!selectedRen} animationType="slide" transparent onRequestClose={() => setSelectedRen(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{selectedRen?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedRen(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {selectedRen?.description ? <Text style={styles.modalDesc}>{selectedRen.description}</Text> : null}

            {checkingMembership ? (
              <NarutoLoader size={22} color={colors.gold} style={{ marginVertical: spacing.xl, alignSelf: 'center' }} />
            ) : isMember ? (
              <Text style={styles.infoText}>すでにこの連のメンバーです</Text>
            ) : selectedRen && pendingRequestFor(selectedRen.id) ? (
              <View>
                <Text style={styles.infoText}>この連へはすでに申請中です</Text>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    const req = pendingRequestFor(selectedRen.id);
                    if (req) handleCancel(req.id);
                    setSelectedRen(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelBtnText}>申請を取り消す</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.modalLabel}>メッセージ（任意）</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="自己紹介や意気込みなど"
                  placeholderTextColor={colors.textMuted}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.textOnGold} />
                  ) : (
                    <Text style={styles.submitBtnText}>参加を申請する</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  garland: { backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { marginRight: spacing.sm },
  headerIcon: { marginRight: spacing.md },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  body: { padding: spacing.lg },
  searchBar: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  searchInput: { color: colors.textPrimary, ...typography.body, fontSize: 13 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: colors.indigoLine, marginRight: spacing.sm },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterLabel: { ...typography.caption, color: colors.textSecondary },

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  loadingText: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  renCard: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  renName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 16 },
  renRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  renRowText: { ...typography.caption, color: colors.textMuted, marginLeft: 6 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,19,43,0.7)' },
  modalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  modalDesc: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },
  infoText: { ...typography.body, color: colors.textPrimary, textAlign: 'center', marginVertical: spacing.lg },
  modalLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  modalInput: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
    ...typography.body,
  },
  submitBtn: { backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  cancelBtn: { borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  cancelBtnText: { ...typography.button, color: colors.textSecondary },
});
