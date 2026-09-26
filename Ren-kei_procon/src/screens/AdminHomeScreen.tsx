/**
 * 連の管理ホーム。管理者として所属する連を切り替えつつ、各管理機能へ遷移する。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList, Bell, Video, ChevronLeft, ChevronRight, Users, Megaphone, CalendarDays } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { KasaGarland, NarutoLoader } from '../components/motifs';
import { IconTaiko } from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import { subscribePendingJoinRequestCount } from '../repositories/joinRequests';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';
import { useAdminRens } from '../hooks/useAdminRens';
import { useAuth } from '../hooks/useAuth';

export default function AdminHomeScreen() {
  const { width: SCREEN_W } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { uid } = useAuth();
  const { adminRens, loading } = useAdminRens();
  const [selectedRenId, setSelectedRenId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeUnreadNotificationCount(uid, setUnreadNotifications, (e) =>
      console.error('未読通知件数の取得に失敗しました', e),
    );
  }, [uid]);

  useEffect(() => {
    if (!selectedRenId && adminRens.length > 0) {
      setSelectedRenId(adminRens[0].renId);
    }
  }, [adminRens, selectedRenId]);

  useEffect(() => {
    if (!selectedRenId) return;
    return subscribePendingJoinRequestCount(selectedRenId, setPendingCount, (e) =>
      console.error('未対応の参加リクエスト件数の取得に失敗しました', e),
    );
  }, [selectedRenId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <NarutoLoader size={26} color={colors.gold} style={{ marginTop: 60, alignSelf: 'center' }} />
      </SafeAreaView>
    );
  }

  if (adminRens.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft color={colors.gold} size={22} />
            <Text style={styles.backBtnText}>戻る</Text>
          </TouchableOpacity>
          <IconTaiko size={36} color={colors.gold} />
          <Text style={styles.emptyText}>管理者として所属している連がありません</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedRen = adminRens.find((r) => r.renId === selectedRenId) ?? adminRens[0];

  return (
    <SafeAreaView style={styles.container}>
      <KasaGarland width={SCREEN_W} count={7} height={40} style={styles.garland} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtnInline}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </TouchableOpacity>
        <IconTaiko size={20} color={colors.gold} style={styles.headerIcon} />
        <Text style={styles.headerTitle}>連の管理</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      {adminRens.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcher} contentContainerStyle={styles.switcherContent}>
          {adminRens.map((r) => (
            <TouchableOpacity
              key={r.renId}
              style={[styles.switcherPill, r.renId === selectedRen.renId && styles.switcherPillActive]}
              onPress={() => setSelectedRenId(r.renId)}
              activeOpacity={0.85}
            >
              <Text style={[styles.switcherText, r.renId === selectedRen.renId && styles.switcherTextActive]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.renName}>{selectedRen.name}</Text>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('ManageJoinRequests', { renId: selectedRen.renId })}
          activeOpacity={0.85}
        >
          <ClipboardList size={22} color={colors.gold} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.statValue}>{pendingCount}件</Text>
            <Text style={styles.statLabel}>未対応の参加リクエスト</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.pendingCard} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
          <View style={styles.pendingRow}>
            <Bell size={18} color={colors.textMuted} />
            <Text style={styles.pendingText}>
              {unreadNotifications > 0 ? `未読の通知が${unreadNotifications}件あります` : '新しい通知はありません'}
            </Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>管理メニュー</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ManagePosts', { renId: selectedRen.renId })} activeOpacity={0.85}>
          <Video size={19} color={colors.gold} />
          <Text style={styles.menuItemText}>投稿一覧</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageJoinRequests', { renId: selectedRen.renId })}
          activeOpacity={0.85}
        >
          <ClipboardList size={19} color={colors.gold} />
          <Text style={styles.menuItemText}>参加リクエスト管理</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('MemberManagement', { renId: selectedRen.renId })}
          activeOpacity={0.85}
        >
          <Users size={19} color={colors.gold} />
          <Text style={styles.menuItemText}>メンバー管理</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageAnnouncements', { renId: selectedRen.renId })}
          activeOpacity={0.85}
        >
          <Megaphone size={19} color={colors.gold} />
          <Text style={styles.menuItemText}>お知らせ管理</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageActivities', { renId: selectedRen.renId })}
          activeOpacity={0.85}
        >
          <CalendarDays size={19} color={colors.gold} />
          <Text style={styles.menuItemText}>活動情報・連の基本情報</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
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
  backBtnInline: { marginRight: spacing.sm },
  headerIcon: { marginRight: spacing.sm },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },

  switcher: { borderBottomWidth: 1, borderColor: colors.indigoLine },
  switcherContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  switcherPill: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  switcherPillActive: { backgroundColor: colors.gold },
  switcherText: { ...typography.caption, color: colors.textSecondary },
  switcherTextActive: { color: colors.textOnGold, fontWeight: '700' },

  content: { padding: spacing.lg },
  renName: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20, marginBottom: spacing.lg },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    marginBottom: spacing.md,
  },
  statValue: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20 },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  pendingCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: spacing.xl },
  pendingRow: { flexDirection: 'row', alignItems: 'center' },
  pendingText: { flex: 1, marginLeft: spacing.sm, ...typography.caption, color: colors.textSecondary },
  sectionLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  menuItemText: { flex: 1, marginLeft: spacing.md, ...typography.bodyStrong, color: colors.textPrimary },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', position: 'absolute', top: spacing.xl, left: spacing.lg },
  backBtnText: { ...typography.caption, color: colors.gold, fontWeight: '700', marginLeft: 4 },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
});
