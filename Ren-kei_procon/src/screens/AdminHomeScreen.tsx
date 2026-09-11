import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { ClipboardList, Bell, Video, ChevronLeft, ChevronRight, Users, Megaphone, CalendarDays } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { subscribePendingJoinRequestCount } from '../repositories/joinRequests';
import { useAdminRens } from '../hooks/useAdminRens';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

export default function AdminHomeScreen() {
  const navigation = useNavigation<any>();
  const { adminRens, loading } = useAdminRens();
  const [selectedRenId, setSelectedRenId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

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
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (adminRens.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={COLORS.primary} size={22} />
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
          <ClipboardList size={22} color={COLORS.primary} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.statValue}>{pendingCount}件</Text>
            <Text style={styles.statLabel}>未対応の参加リクエスト</Text>
          </View>
          <ChevronRight size={20} color="#CBD5E1" />
        </TouchableOpacity>

        <View style={styles.pendingCard}>
          <View style={styles.pendingRow}>
            <Video size={18} color={COLORS.textMuted} />
            <Text style={styles.pendingText}>新着投稿の表示は準備中です</Text>
          </View>
          <View style={styles.pendingRow}>
            <Bell size={18} color={COLORS.textMuted} />
            <Text style={styles.pendingText}>通知機能は準備中です</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>管理メニュー</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageJoinRequests', { renId: selectedRen.renId })}
        >
          <ClipboardList size={20} color={COLORS.primary} />
          <Text style={styles.menuItemText}>参加リクエスト管理</Text>
          <ChevronRight size={18} color="#CBD5E1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('MemberManagement', { renId: selectedRen.renId })}
        >
          <Users size={20} color={COLORS.primary} />
          <Text style={styles.menuItemText}>メンバー管理</Text>
          <ChevronRight size={18} color="#CBD5E1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageAnnouncements', { renId: selectedRen.renId })}
        >
          <Megaphone size={20} color={COLORS.primary} />
          <Text style={styles.menuItemText}>お知らせ管理</Text>
          <ChevronRight size={18} color="#CBD5E1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageActivities', { renId: selectedRen.renId })}
        >
          <CalendarDays size={20} color={COLORS.primary} />
          <Text style={styles.menuItemText}>活動情報・連の基本情報</Text>
          <ChevronRight size={18} color="#CBD5E1" />
        </TouchableOpacity>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  switcher: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.border },
  switcherPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
  switcherPillActive: { backgroundColor: COLORS.primary },
  switcherText: { fontSize: 13, color: COLORS.textMain },
  switcherTextActive: { color: '#fff', fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 120 },
  renName: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 16 },
  statCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pendingCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pendingText: { marginLeft: 10, fontSize: 13, color: COLORS.textMuted },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  menuItemText: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
  emptyWrap: { flex: 1, padding: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backBtnText: { color: COLORS.primary, fontWeight: 'bold', marginLeft: 4 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
