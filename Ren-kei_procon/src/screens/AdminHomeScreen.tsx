import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { ClipboardList, Bell, Video, ChevronLeft, ChevronRight, Users, Megaphone, CalendarDays } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { subscribePendingJoinRequestCount } from '../repositories/joinRequests';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';
import { useAdminRens } from '../hooks/useAdminRens';
import { useAuth } from '../hooks/useAuth';
import BottomNav from '../components/BottomNav';
import { colors } from '../theme/colors';

export default function AdminHomeScreen() {
  const navigation = useNavigation<any>();
  const { uid } = useAuth();
  const { adminRens, loading } = useAdminRens();
  const [selectedRenId, setSelectedRenId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeUnreadNotificationCount(
      uid,
      setUnreadNotifications,
      (error) => console.error('未読通知件数の取得に失敗しました', error)
    );
  }, [uid]);

  useEffect(() => {
    if (!selectedRenId && adminRens.length > 0) {
      setSelectedRenId(adminRens[0].renId);
    }
  }, [adminRens, selectedRenId]);

  useEffect(() => {
    if (!selectedRenId) return;
    return subscribePendingJoinRequestCount(
      selectedRenId,
      setPendingCount,
      (error) => console.error('未対応の参加リクエスト件数の取得に失敗しました', error)
    );
  }, [selectedRenId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (adminRens.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={colors.gold} size={22} />
            <Text style={styles.backBtnText}>戻る</Text>
          </TouchableOpacity>
          <Text style={styles.emptyText}>管理者として所属している連がありません</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedRen = adminRens.find((r) => r.renId === selectedRenId) ?? adminRens[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>連の管理</Text>
      </View>

      {adminRens.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcher} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {adminRens.map((r) => (
            <TouchableOpacity
              key={r.renId}
              style={[styles.switcherPill, r.renId === selectedRen.renId && styles.switcherPillActive]}
              onPress={() => setSelectedRenId(r.renId)}
            >
              <Text style={[styles.switcherText, r.renId === selectedRen.renId && styles.switcherTextActive]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.renName}>{selectedRen.name}</Text>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('ManageJoinRequests', { renId: selectedRen.renId })}
        >
          <ClipboardList size={22} color={colors.gold} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.statValue}>{pendingCount}件</Text>
            <Text style={styles.statLabel}>未対応の参加リクエスト</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.pendingCard} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.pendingRow}>
            <Bell size={18} color={colors.textMuted} />
            <Text style={styles.pendingText}>
              {unreadNotifications > 0 ? `未読の通知が${unreadNotifications}件あります` : '新しい通知はありません'}
            </Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>管理メニュー</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManagePosts', { renId: selectedRen.renId })}
        >
          <Video size={20} color={colors.gold} />
          <Text style={styles.menuItemText}>投稿一覧</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageJoinRequests', { renId: selectedRen.renId })}
        >
          <ClipboardList size={20} color={colors.gold} />
          <Text style={styles.menuItemText}>参加リクエスト管理</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('MemberManagement', { renId: selectedRen.renId })}
        >
          <Users size={20} color={colors.gold} />
          <Text style={styles.menuItemText}>メンバー管理</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageAnnouncements', { renId: selectedRen.renId })}
        >
          <Megaphone size={20} color={colors.gold} />
          <Text style={styles.menuItemText}>お知らせ管理</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageActivities', { renId: selectedRen.renId })}
        >
          <CalendarDays size={20} color={colors.gold} />
          <Text style={styles.menuItemText}>活動情報・連の基本情報</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: { height: 60, backgroundColor: colors.indigo, justifyContent: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.indigoLine },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  switcher: { backgroundColor: colors.indigo, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.indigoLine },
  switcherPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.indigoRaised, marginRight: 8 },
  switcherPillActive: { backgroundColor: colors.gold },
  switcherText: { fontSize: 13, color: colors.textSecondaryOnIndigo },
  switcherTextActive: { color: colors.textOnGold, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 120 },
  renName: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 16 },
  statCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.indigo, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: 16 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pendingCard: { backgroundColor: colors.indigo, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: 24 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pendingText: { flex: 1, marginLeft: 10, fontSize: 13, color: colors.textSecondaryOnIndigo },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.indigo, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.indigoLine },
  menuItemText: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  emptyWrap: { flex: 1, padding: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backBtnText: { color: colors.gold, fontWeight: 'bold', marginLeft: 4 },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});
