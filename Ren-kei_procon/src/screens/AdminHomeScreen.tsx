/**
 * 連の管理ホーム。管理者として所属する連を切り替えつつ、各管理機能へ遷移する。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList, Bell, Video, ChevronLeft, ChevronRight, Users, Megaphone, CalendarDays, Flag } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { KasaGarland, NarutoLoader } from '../components/motifs';
import { IconTaiko } from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import { subscribePendingJoinRequestCount } from '../repositories/joinRequests';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';
import { useAdminRens } from '../hooks/useAdminRens';
import { useAuth } from '../hooks/useAuth';

/** 連の管理者向けのホーム画面。未対応の申請数・未読通知と、各管理画面への入口をまとめる */
export default function AdminHomeScreen() {
  const { width: SCREEN_W } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { uid } = useAuth();
  // 自分が管理者を務める連の一覧 / 表示中の連 / 未対応の参加申請の数 / 未読通知の数
  const { adminRens, loading } = useAdminRens();
  const [selectedRenId, setSelectedRenId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // 未読通知の数をリアルタイム購読する
  useEffect(() => {
    if (!uid) return;
    return subscribeUnreadNotificationCount(uid, setUnreadNotifications, (e) =>
      console.error('未読通知件数の取得に失敗しました', e),
    );
  }, [uid]);

  // 表示する連がまだ決まっていなければ、一覧の先頭の連を選ぶ
  useEffect(() => {
    if (!selectedRenId && adminRens.length > 0) {
      setSelectedRenId(adminRens[0].renId);
    }
  }, [adminRens, selectedRenId]);

  // 表示中の連の、未対応の参加申請の数をリアルタイム購読する
  useEffect(() => {
    if (!selectedRenId) return;
    return subscribePendingJoinRequestCount(selectedRenId, setPendingCount, (e) =>
      console.error('未対応の参加リクエスト件数の取得に失敗しました', e),
    );
  }, [selectedRenId]);

  // 管理している連を読み込んでいる間はくるくるだけを出す
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <NarutoLoader size={26} color={colors.gold} style={{ marginTop: 60, alignSelf: 'center' }} />
      </SafeAreaView>
    );
  }

  // 管理者を務める連がない場合は、その旨と戻るボタンだけを出す
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

  // 表示中の連(見つからなければ一覧の先頭)
  const selectedRen = adminRens.find((r) => r.renId === selectedRenId) ?? adminRens[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* 画面上部の笠の飾りと、戻るボタン・アイコン・画面名・メニューのヘッダー */}
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

      {/* 管理している連が複数あるときだけ、横スクロールで連を切り替えるタブを出す */}
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
        {/* 表示中の連の名前 */}
        <Text style={styles.renName}>{selectedRen.name}</Text>

        {/* 未対応の参加申請の数。タップで参加申請管理へ */}
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

        {/* 未読通知の数。タップで通知一覧へ */}
        <TouchableOpacity style={styles.pendingCard} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
          <View style={styles.pendingRow}>
            <Bell size={18} color={colors.textMuted} />
            <Text style={styles.pendingText}>
              {unreadNotifications > 0 ? `未読の通知が${unreadNotifications}件あります` : '新しい通知はありません'}
            </Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* 管理メニュー: 投稿一覧・参加申請・メンバー・お知らせ・活動情報・チャレンジの各管理画面への入口 */}
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
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('ManageChallenges', { renId: selectedRen.renId })}
          activeOpacity={0.85}
        >
          <Flag size={19} color={colors.gold} />
          <Text style={styles.menuItemText}>チャレンジの出題</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 画面全体の背景と、上部の笠の飾り
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  garland: { backgroundColor: colors.indigoDeep },
  // ヘッダー。「戻る」・アイコン・タイトル・メニューを横一列に並べる
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  // ヘッダーの戻るボタン・アイコン・画面名
  backBtnInline: { marginRight: spacing.sm },
  headerIcon: { marginRight: spacing.sm },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },

  // 管理している連が複数あるときに出す、横スクロールの連切り替えタブ
  switcher: { borderBottomWidth: 1, borderColor: colors.indigoLine },
  switcherContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  // 丸いピル形のタブ1つ
  switcherPill: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  // 選択中のタブは金色で塗りつぶす
  switcherPillActive: { backgroundColor: colors.gold },
  switcherText: { ...typography.caption, color: colors.textSecondary },
  switcherTextActive: { color: colors.textOnGold, fontWeight: '700' },

  // スクロール部分の余白と、表示中の連の名前(大きめの明朝体)
  content: { padding: spacing.lg },
  renName: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20, marginBottom: spacing.lg },
  // 「未対応の参加リクエスト件数」のカード
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
  // 申請数の数字(大きめ)と説明文
  statValue: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20 },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  // 未読通知の件数を知らせるカード
  pendingCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: spacing.xl },
  // 未読通知カードの中身(ベルのアイコンと文)と、管理メニューの見出し
  pendingRow: { flexDirection: 'row', alignItems: 'center' },
  pendingText: { flex: 1, marginLeft: spacing.sm, ...typography.caption, color: colors.textSecondary },
  sectionLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  // 「投稿一覧」「メンバー管理」等、管理メニュー1項目分の行
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
  // メニュー項目の名前
  menuItemText: { flex: 1, marginLeft: spacing.md, ...typography.bodyStrong, color: colors.textPrimary },

  // 管理する連がないときの表示。中央に案内文、左上に戻るボタンを置く
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', position: 'absolute', top: spacing.xl, left: spacing.lg },
  backBtnText: { ...typography.caption, color: colors.gold, fontWeight: '700', marginLeft: 4 },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
});
