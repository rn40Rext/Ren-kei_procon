import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Dimensions, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, PlayCircle, ChevronRight, LogOut } from 'lucide-react-native';
import BottomNav from '../components/BottomNav';
import NotificationBadge from '../components/NotificationBadge';
import { KasaGarland, KumihimoRule } from '../components/motifs';
import { IconGeta, IconUchiwa, IconWagasa, IconMakimono } from '../components/awaIcons';
import { colors, spacing, radius, typography } from '../theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';

// Firebase関連
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
  const { uid } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeUnreadNotificationCount(
      uid,
      setUnreadCount,
      (error) => console.error('未読通知件数の取得に失敗しました', error),
    );
  }, [uid]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('ログアウトエラー:', error);
      Alert.alert('エラー', 'ログアウトに失敗しました');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <KasaGarland width={width} count={7} height={36} style={styles.garland} />

        {/* ヘッダー */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>徳島 伝統の絆</Text>
                </View>
                <Text style={styles.welcomeText}>やっとさー！ {auth.currentUser?.email?.split('@')[0]} さん</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate('Notifications')}>
                  <Bell color={colors.gold} size={21} />
                  <NotificationBadge count={unreadCount} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <LogOut color={colors.textMuted} size={18} />
                  <Text style={styles.logoutText}>終了</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <Text style={styles.heroTitle}>
            最高の演舞を目指して、{'\n'}今日も稽古に励みましょう。
          </Text>
        </View>

        {/* メインメニュー */}
        <View style={styles.menuContainer}>
          <View style={styles.sectionHead}>
            <KumihimoRule width={18} />
            <Text style={styles.sectionTitle}>　稽古メニュー</Text>
          </View>

          <View style={styles.menuGrid}>
            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Scoring')} activeOpacity={0.85}>
              <View style={styles.iconCircle}>
                <IconGeta size={26} color={colors.gold} />
              </View>
              <Text style={styles.menuLabel}>AI解析・稽古</Text>
              <Text style={styles.menuSub}>フォームを採点</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Community')} activeOpacity={0.85}>
              <View style={styles.iconCircle}>
                <IconUchiwa size={26} color={colors.gold} />
              </View>
              <Text style={styles.menuLabel}>交流広場</Text>
              <Text style={styles.menuSub}>仲間の動画を見る</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Request')} activeOpacity={0.85}>
              <View style={styles.iconCircle}>
                <IconWagasa size={26} color={colors.gold} />
              </View>
              <Text style={styles.menuLabel}>連を探す</Text>
              <Text style={styles.menuSub}>参加を申請する</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>新機能</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Mypage')} activeOpacity={0.85}>
              <View style={styles.iconCircle}>
                <IconMakimono size={26} color={colors.gold} />
              </View>
              <Text style={styles.menuLabel}>マイページ</Text>
              <Text style={styles.menuSub}>実績と設定</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.largeCard} activeOpacity={0.85}>
            <View style={styles.largeCardContent}>
              <View>
                <Text style={styles.largeCardTitle}>有名連のお手本動画</Text>
                <Text style={styles.largeCardSub}>一流の足運びと手の動きを学ぶ</Text>
              </View>
              <PlayCircle color={colors.gold} size={36} />
            </View>
          </TouchableOpacity>
        </View>

        {/* お知らせセクション */}
        <View style={styles.newsSection}>
          <View style={styles.newsHeader}>
            <View style={styles.sectionHead}>
              <KumihimoRule width={18} />
              <Text style={styles.sectionTitle}>　お知らせ</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.viewMore}>すべて見る</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.newsItem}>
            <Text style={styles.newsDate}>2024.08.18</Text>
            <Text style={styles.newsText}>夏の阿波踊り大会に向けた強化週間が始まります！</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  content: { flexGrow: 1 },
  garland: { position: 'absolute', top: 0, left: 0, right: 0 },

  hero: {
    padding: spacing.xl,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xxl + spacing.lg,
    backgroundColor: colors.indigo,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  heroHeader: { marginBottom: spacing.lg },
  badge: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  badgeText: { ...typography.caption, color: colors.gold, fontSize: 10, fontWeight: '700' },
  welcomeText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  heroTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 22, lineHeight: 32, marginTop: spacing.xs },
  bellButton: { alignItems: 'center', backgroundColor: colors.indigoRaised, padding: spacing.sm, borderRadius: radius.md, marginRight: spacing.sm },
  logoutButton: { alignItems: 'center', backgroundColor: colors.indigoRaised, padding: spacing.sm, borderRadius: radius.md },
  logoutText: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '700' },

  menuContainer: { paddingHorizontal: spacing.xl, marginTop: -spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.headingSerif, color: colors.textPrimary },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuCard: {
    width: (width - spacing.xl * 2 - spacing.md) / 2,
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.indigoRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  menuLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  menuSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  newBadge: { position: 'absolute', top: spacing.md, right: spacing.md, backgroundColor: colors.aka, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  newBadgeText: { color: colors.textOnAka, fontSize: 8, fontWeight: '700' },

  largeCard: { backgroundColor: colors.indigo, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.xl, borderRadius: radius.lg, marginTop: spacing.xs },
  largeCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  largeCardTitle: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 16 },
  largeCardSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  newsSection: { padding: spacing.xl, marginTop: spacing.sm },
  newsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  viewMore: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  newsItem: { backgroundColor: colors.indigo, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' },
  newsDate: { ...typography.caption, color: colors.gold, fontWeight: '700', marginRight: spacing.md },
  newsText: { flex: 1, ...typography.caption, color: colors.textSecondary, fontWeight: '500' },
});
