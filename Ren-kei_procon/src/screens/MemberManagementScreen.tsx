/**
 * 連のメンバー管理（役割変更・除名）。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, Shield, User as UserIcon } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import { auth } from '../config/firebaseConfig';
import { subscribeActiveMembers, updateMemberRole, removeMember } from '../repositories/renMembership';
import { fetchUserProfile } from '../repositories/users';
import type { RenMember } from '../types/firestore';

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
              if (profile) setProfiles((prev) => ({ ...prev, [m.uid]: profile as Profile }));
            })
            .catch(() => undefined);
        });
      },
      (error) => {
        console.error('メンバー一覧の取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', 'メンバー一覧の取得に失敗しました。時間をおいて再度お試しください');
      },
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
        Alert.alert('エラー', '除名に失敗しました');
      }
    } finally {
      setProcessingUid(null);
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
        <Text style={styles.headerTitle}>メンバー管理</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <NarutoLoader size={22} color={colors.gold} style={{ marginTop: 40, alignSelf: 'center' }} />
        ) : members.length === 0 ? (
          <Text style={styles.emptyText}>メンバーがいません</Text>
        ) : (
          members.map((member) => {
            const profile = profiles[member.uid];
            const isSelf = member.uid === currentUid;
            return (
              <View key={member.uid} style={styles.card}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{profile?.nickname || profile?.name || '読み込み中…'}</Text>
                  {isSelf ? <Text style={styles.selfBadge}>自分</Text> : null}
                  {member.role === 'admin' ? (
                    <View style={styles.adminBadge}>
                      <Shield size={11} color={colors.textOnGold} />
                      <Text style={styles.adminBadgeText}>管理者</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardMeta}>
                  {profile?.danceStyle ? DANCE_STYLE_LABEL[profile.danceStyle] : '踊り種別未設定'}　加入日 {formatDate(member.joinedAt)}
                </Text>

                <TouchableOpacity
                  style={styles.profileLink}
                  onPress={() => navigation.navigate('UserProfile', { userId: member.uid, userName: profile?.nickname || profile?.name || '' })}
                >
                  <UserIcon size={13} color={colors.gold} />
                  <Text style={styles.profileLinkText}>プロフィール・投稿履歴を見る</Text>
                  <ChevronRight size={14} color={colors.gold} />
                </TouchableOpacity>

                {!isSelf && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.roleBtn}
                      disabled={processingUid === member.uid}
                      onPress={() => handleToggleRole(member)}
                      activeOpacity={0.85}
                    >
                      {processingUid === member.uid ? (
                        <ActivityIndicator color={colors.gold} size="small" />
                      ) : (
                        <Text style={styles.roleBtnText}>{member.role === 'admin' ? 'メンバーにする' : '管理者にする'}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      disabled={processingUid === member.uid}
                      onPress={() => setConfirmingMember(member)}
                      activeOpacity={0.85}
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
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmingMember(null)} activeOpacity={0.85}>
                <Text style={styles.confirmCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRemoveBtn} onPress={confirmRemove} activeOpacity={0.85}>
                <Text style={styles.confirmRemoveText}>除名する</Text>
              </TouchableOpacity>
            </View>
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

  list: { flex: 1, padding: spacing.lg },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardName: { ...typography.bodyStrong, color: colors.textPrimary },
  selfBadge: { marginLeft: spacing.sm, fontSize: 10, color: colors.textMuted, backgroundColor: colors.indigoRaised, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: colors.textOnGold, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  profileLink: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  profileLinkText: { flex: 1, marginLeft: 6, ...typography.caption, color: colors.gold, fontWeight: '700' },
  cardActions: { flexDirection: 'row', marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.indigoLine, paddingTop: spacing.md },
  roleBtn: { flex: 1, backgroundColor: colors.goldSoft, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', marginRight: spacing.sm },
  roleBtnText: { color: colors.gold, fontWeight: '700', fontSize: 12 },
  removeBtn: { flex: 1, borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', marginLeft: spacing.sm },
  removeBtnText: { color: colors.aka, fontWeight: '700', fontSize: 12 },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmCard: { backgroundColor: colors.indigoDeep, borderRadius: radius.md, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.xl, width: '100%' },
  confirmTitle: { ...typography.headingSerif, color: colors.textPrimary, marginBottom: spacing.sm },
  confirmMessage: { ...typography.body, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
  confirmActions: { flexDirection: 'row' },
  confirmCancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  confirmCancelText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  confirmRemoveBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.aka, marginLeft: spacing.sm },
  confirmRemoveText: { color: colors.textOnAka, fontWeight: '700', fontSize: 14 },
});
