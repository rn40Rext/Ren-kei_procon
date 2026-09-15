/**
 * 通知一覧・既読管理(#44)。仕様書 U-01/R-01「通知への導線」の遷移先。
 * 通知の作成はサーバ側のみ(#43)。ここでは購読・既読化・遷移のみ扱う。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Bell, Check, CheckCheck, ChevronLeft, MessageSquare, Megaphone, UserCheck } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '../repositories/notifications';
import { fetchJoinRequest } from '../repositories/joinRequests';
import { fetchPost } from '../repositories/posts';
import { AppNotification, NotificationType } from '../types/firestore';
import { colors } from '../theme/colors';

type NotificationsNav = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ size?: number; color?: string }>> = {
  comment: MessageSquare,
  join_result: UserCheck,
  announcement: Megaphone,
};

function formatDateTime(value: AppNotification['createdAt']): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NotificationsNav>();
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
      }
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
    [uid]
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

  // 通知をタップしたら既読化した上で参照先へ遷移する。参照先が削除済みの
  // 場合は該当画面には飛ばず、一覧の親(コミュニティ/マイ連)に留める。
  const onPressNotification = useCallback(
    async (n: AppNotification) => {
      if (!uid || openingId) return;
      setOpeningId(n.id);
      try {
        if (!n.read) await markNotificationRead(uid, n.id);

        if (n.type === 'comment' && n.referenceId) {
          const post = await fetchPost(n.referenceId);
          if (post) {
            navigation.navigate('Community', { openPostId: n.referenceId });
          } else {
            navigation.navigate('Community', undefined);
          }
          return;
        }

        if (n.type === 'join_result' && n.referenceId) {
          const request = await fetchJoinRequest(n.referenceId);
          navigation.navigate('Group', request ? { renId: request.renId } : undefined);
          return;
        }

        // announcement: 通知には announcementId しか無く、そこから所属連(renId)を
        // 単独で引く手段が無いため、マイ連一覧へ遷移するに留める(#44のスコープ判断)。
        navigation.navigate('Group', undefined);
      } catch (e) {
        console.error('通知からの遷移に失敗しました', e);
        navigation.navigate('Group', undefined);
      } finally {
        setOpeningId(null);
      }
    },
    [uid, openingId, navigation]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={26} color={colors.indigo} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通知</Text>
        {unreadIds.length > 0 ? (
          <TouchableOpacity style={styles.markAllBtn} onPress={onMarkAllRead} disabled={markingAll}>
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.indigo} />
            ) : (
              <>
                <CheckCheck size={16} color={colors.indigo} />
                <Text style={styles.markAllText}>すべて既読</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.markAllBtn} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.indigo} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Bell size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>通知はまだありません</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.read && styles.cardUnread]}
                onPress={() => onPressNotification(n)}
                disabled={openingId === n.id}
              >
                <View style={[styles.iconWrap, !n.read && styles.iconWrapUnread]}>
                  <Icon size={18} color={!n.read ? colors.textOnDark : colors.textSecondary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, !n.read && styles.cardTitleUnread]}>{n.title}</Text>
                  <Text style={styles.cardText} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.cardTime}>{formatDateTime(n.createdAt)}</Text>
                </View>
                {!n.read && (
                  <TouchableOpacity
                    style={styles.markOneBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      onMarkOneRead(n.id);
                    }}
                  >
                    <Check size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                {openingId === n.id && <ActivityIndicator size="small" color={colors.indigo} style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: colors.textPrimary, marginLeft: 4 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 80, justifyContent: 'flex-end' },
  markAllText: { marginLeft: 4, fontSize: 13, color: colors.indigo, fontWeight: '600' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },

  list: { padding: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.indigoLight, backgroundColor: '#F5F8FF' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconWrapUnread: { backgroundColor: colors.indigo },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardTitleUnread: { fontWeight: 'bold' },
  cardText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardTime: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  markOneBtn: { padding: 6, marginLeft: 6 },
});
