import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, Shield, User as UserIcon } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../config/firebaseConfig';
import { subscribeActiveMembers, updateMemberRole, removeMember } from '../repositories/ren';
import { fetchUserProfile } from '../repositories/users';
import { RenMember } from '../types/firestore';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
};

interface Profile {
  name: string;
  nickname?: string;
  danceStyle?: 'male' | 'female' | null;
}

const DANCE_STYLE_LABEL: Record<string, string> = { male: '男踊り', female: '女踊り' };

function formatDate(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default function MemberManagementScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { renId } = route.params;
  const currentUid = auth.currentUser?.uid;

  const [members, setMembers] = useState<RenMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [confirmingMember, setConfirmingMember] = useState<RenMember | null>(null);

  useEffect(() => {
    setLoading(true);
    return subscribeActiveMembers(
      renId,
      (snapshotMembers) => {
        const list = [...snapshotMembers];
        list.sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1));
        setMembers(list);
        setLoading(false);
        list.forEach((m) => {
          if (profiles[m.uid]) return;
          fetchUserProfile(m.uid)
            .then((profile) => {
              if (profile) {
                setProfiles((prev) => ({ ...prev, [m.uid]: profile as Profile }));
              }
            })
            .catch(() => undefined);
        });
      },
      (error) => {
        console.error('メンバー一覧の取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', 'メンバー一覧の取得に失敗しました。時間をおいて再度お試しください');
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renId]);

  const handleToggleRole = async (member: RenMember) => {
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    setProcessingUid(member.uid);
    try {
      await updateMemberRole(renId, member.uid, nextRole);
    } catch (error: any) {
      if (error?.code === 'functions/failed-precondition') {
        Alert.alert('お知らせ', '最後の管理者を降格することはできません');
      } else {
        console.error(error);
        Alert.alert('エラー', '役割の変更に失敗しました');
      }
    } finally {
      setProcessingUid(null);
    }
  };

  const confirmRemove = async () => {
    if (!confirmingMember) return;
    const member = confirmingMember;
    setConfirmingMember(null);
    setProcessingUid(member.uid);
    try {
      await removeMember(renId, member.uid);
    } catch (error: any) {
      if (error?.code === 'functions/failed-precondition') {
        Alert.alert('お知らせ', '最後の管理者を除名することはできません');
      } else {
        console.error(error);
        Alert.alert('エラー', '除名に失敗しました');
      }
    } finally {
      setProcessingUid(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={COLORS.primary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>メンバー管理</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.list}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : members.length === 0 ? (
          <Text style={styles.emptyText}>メンバーがいません</Text>
        ) : (
          members.map((member) => {
            const profile = profiles[member.uid];
            const isSelf = member.uid === currentUid;
            return (
              <View key={member.uid} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.cardName}>{profile?.nickname || profile?.name || '読み込み中...'}</Text>
                      {isSelf ? <Text style={styles.selfBadge}>自分</Text> : null}
                      {member.role === 'admin' ? (
                        <View style={styles.adminBadge}>
                          <Shield size={11} color="#fff" />
                          <Text style={styles.adminBadgeText}>管理者</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardMeta}>
                      {profile?.danceStyle ? DANCE_STYLE_LABEL[profile.danceStyle] : '踊り種別未設定'} ・ 加入日 {formatDate(member.joinedAt)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.profileLink}
                  onPress={() => navigation.navigate('UserProfile', { userId: member.uid, userName: profile?.nickname || profile?.name || '' })}
                >
                  <UserIcon size={13} color={COLORS.primary} />
                  <Text style={styles.profileLinkText}>プロフィール・投稿履歴を見る</Text>
                  <ChevronRight size={14} color={COLORS.primary} />
                </TouchableOpacity>

                {!isSelf && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.roleBtn}
                      disabled={processingUid === member.uid}
                      onPress={() => handleToggleRole(member)}
                    >
                      {processingUid === member.uid ? (
                        <ActivityIndicator color={COLORS.primary} size="small" />
                      ) : (
                        <Text style={styles.roleBtnText}>{member.role === 'admin' ? 'メンバーにする' : '管理者にする'}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      disabled={processingUid === member.uid}
                      onPress={() => setConfirmingMember(member)}
                    >
                      <Text style={styles.removeBtnText}>除名</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!confirmingMember} animationType="fade" transparent onRequestClose={() => setConfirmingMember(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>確認</Text>
            <Text style={styles.confirmMessage}>
              {(confirmingMember && (profiles[confirmingMember.uid]?.nickname || profiles[confirmingMember.uid]?.name)) || 'このメンバー'}
              を連から除名しますか？
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmingMember(null)}>
                <Text style={styles.confirmCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRemoveBtn} onPress={confirmRemove}>
                <Text style={styles.confirmRemoveText}>除名する</Text>
              </TouchableOpacity>
            </View>
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
  list: { flex: 1, padding: 15 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTop: { flexDirection: 'row' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain },
  selfBadge: { marginLeft: 8, fontSize: 10, color: COLORS.textMuted, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 3 },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  profileLink: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  profileLinkText: { flex: 1, marginLeft: 6, fontSize: 12, color: COLORS.primary, fontWeight: 'bold' },
  cardActions: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  roleBtn: { flex: 1, backgroundColor: '#EFF6FF', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginRight: 8 },
  roleBtnText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12 },
  removeBtn: { flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginLeft: 8 },
  removeBtnText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 12 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  confirmCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  confirmTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
  confirmMessage: { fontSize: 14, color: COLORS.textMain, lineHeight: 20, marginBottom: 24 },
  confirmActions: { flexDirection: 'row' },
  confirmCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1F5F9', marginRight: 8 },
  confirmCancelText: { color: COLORS.textMain, fontWeight: 'bold', fontSize: 14 },
  confirmRemoveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.danger, marginLeft: 8 },
  confirmRemoveText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
