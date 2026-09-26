/**
 * 通知一覧・既読管理。コメント・連の参加結果・お知らせへの導線。
 * 通知の作成はサーバ側(Cloud Functionsトリガー)のみ。ここでは購読・既読化・遷移のみ扱う。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  Mail,
  MessageCircle,
  MessageSquare,
  Megaphone,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { KasaGarland, NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import { useAuth } from '../hooks/useAuth';
import { markAllNotificationsRead, markNotificationRead, subscribeNotifications } from '../repositories/notifications';
import { fetchJoinRequest } from '../repositories/joinRequests';
import { fetchPost } from '../repositories/posts';
import { fetchUserProfile } from '../repositories/users';
import type { AppNotification, NotificationType } from '../types/firestore';

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  comment: MessageSquare,
  join_result: UserCheck,
  announcement: Megaphone,
  join_request: UserPlus,
  member_removed: UserMinus,
  role_changed: Shield,
  member_joined: Users,
  invitation_result: Mail,
  chat_message: MessageCircle,
};

function formatDateTime(value: AppNotification['createdAt']): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NotificationsScreen() {
  const { width: SCREEN_W } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { uid } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    return subscribeNotifications(
      uid,
      (list) => {
        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        console.error('通知の取得に失敗しました', error);
        setLoading(false);
      },
    );
  }, [uid]);

  const unreadIds = useMemo(() => notifications.filter((n) => !n.read).map((n) => n.id), [notifications]);

  const onMarkOneRead = useCallback(
    async (notificationId: string) => {
      if (!uid) return;
      try {
        await markNotificationRead(uid, notificationId);
      } catch (e) {
        console.error('既読処理に失敗しました', e);
      }
    },
    [uid],
  );

  const onMarkAllRead = useCallback(async () => {
    if (!uid || unreadIds.length === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(uid, unreadIds);
    } catch (e) {
      console.error('一括既読処理に失敗しました', e);
    } finally {
      setMarkingAll(false);
    }
  }, [uid, unreadIds]);

  // 通知をタップしたら既読化した上で参照先へ遷移する。参照先が削除済みの場合は
  // 該当画面には飛ばず、踊り広場・マイ連に留める。
  const onPressNotification = useCallback(
    async (n: AppNotification) => {
      if (!uid || openingId) return;
      setOpeningId(n.id);
      try {
        if (!n.read) await markNotificationRead(uid, n.id);

        if (n.type === 'comment' && n.referenceId) {
          const post = await fetchPost(n.referenceId);
          if (post) {
            navigation.navigate('VideoDetail', { postId: n.referenceId });
          } else {
            navigation.navigate('Home');
          }
          return;
        }

        if (n.type === 'join_result' && n.referenceId) {
          const request = await fetchJoinRequest(n.referenceId);
          navigation.navigate('Group', request ? { renId: request.renId } : undefined);
          return;
        }

        if (n.type === 'join_request' && n.referenceId) {
          const request = await fetchJoinRequest(n.referenceId);
          if (request) {
            navigation.navigate('ManageJoinRequests', { renId: request.renId });
          } else {
            navigation.navigate('Group');
          }
          return;
        }

        if (n.type === 'role_changed' && n.referenceId) {
          navigation.navigate('Group', { renId: n.referenceId });
          return;
        }

        if (n.type === 'member_joined' && n.referenceId) {
          navigation.navigate('Group', { renId: n.referenceId });
          return;
        }

        if (n.type === 'member_removed') {
          // 除名された連の詳細はもう見られないため、マイ連一覧へ留める。
          navigation.navigate('Group');
          return;
        }

        if (n.type === 'invitation_result') {
          navigation.navigate('Request');
          return;
        }

        if (n.type === 'chat_message' && n.referenceId) {
          const chatId = n.referenceId;
          const otherUid = chatId.split('_').find((u) => u !== uid);
          if (otherUid) {
            const profile = await fetchUserProfile(otherUid);
            navigation.navigate('Chat', {
              chatId,
              recipientName: profile?.nickname || profile?.name || '踊り子',
            });
          } else {
            navigation.navigate('Home');
          }
          return;
        }

        // announcement: 通知には announcementId しか無く、そこから所属連(renId)を
        // 単独で引く手段が無いため、マイ連一覧へ遷移するに留める。
        navigation.navigate('Group');
      } catch (e) {
        console.error('通知からの遷移に失敗しました', e);
        navigation.navigate('Group');
      } finally {
        setOpeningId(null);
      }
    },
    [uid, openingId, navigation],
  );

  return (
    <SafeAreaView style={styles.container}>
      <KasaGarland width={SCREEN_W} count={7} height={40} style={styles.garland} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </TouchableOpacity>
        <Bell size={20} color={colors.gold} style={styles.headerIcon} />
        <Text style={styles.headerTitle}>通知</Text>
        <View style={{ flex: 1 }} />
        {unreadIds.length > 0 ? (
          <TouchableOpacity style={styles.markAllBtn} onPress={onMarkAllRead} disabled={markingAll} activeOpacity={0.85}>
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.gold} />
            ) : (
              <>
                <CheckCheck size={14} color={colors.gold} />
                <Text style={styles.markAllText}>すべて既読</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
        <AppMenu />
      </View>

      {loading ? (
        <NarutoLoader size={26} color={colors.gold} style={{ marginTop: 60, alignSelf: 'center' }} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Bell size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>通知はまだありません</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.read && styles.cardUnread]}
                onPress={() => onPressNotification(n)}
                disabled={openingId === n.id}
                activeOpacity={0.85}
              >
                <View style={[styles.iconWrap, !n.read && styles.iconWrapUnread]}>
                  <Icon size={17} color={!n.read ? colors.textOnGold : colors.textMuted} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, !n.read && styles.cardTitleUnread]}>{n.title}</Text>
                  <Text style={styles.cardText} numberOfLines={2}>
                    {n.body}
                  </Text>
                  <Text style={styles.cardTime}>{formatDateTime(n.createdAt)}</Text>
                </View>
                {!n.read ? (
                  <TouchableOpacity
                    style={styles.markOneBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      onMarkOneRead(n.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Check size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
                {openingId === n.id ? <ActivityIndicator size="small" color={colors.gold} style={{ marginLeft: spacing.sm }} /> : null}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
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
  headerIcon: { marginRight: spacing.sm },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  markAllText: { ...typography.caption, color: colors.gold, fontWeight: '700', marginLeft: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },

  list: { padding: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  cardUnread: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.indigoRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  iconWrapUnread: { backgroundColor: colors.gold },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  cardTitleUnread: { fontWeight: '900' },
  cardText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardTime: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontSize: 10 },
  markOneBtn: { padding: 4, marginLeft: spacing.sm },
});
