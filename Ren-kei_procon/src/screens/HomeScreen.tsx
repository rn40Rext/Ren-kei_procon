import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, BarChart2, User, PlayCircle, ClipboardList, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '../components/BottomNav';
import { auth } from '../config/firebaseConfig';

const { width } = Dimensions.get('window');

// 阿波踊りの伝統色
const COLORS = {
  indigo: '#001E43', // 藍色（ベース）
  indigoLight: '#1E3A8A', 
  vermilion: '#E60012', // 朱色（アクセント）
  gold: '#D4AF37', // 金茶（スコア・特別感）
  white: '#FFFFFF',
  bg: '#F8F9FA',
  textMain: '#1E293B',
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* ヘッダー：藍色のグラデーションバナー */}
        <LinearGradient 
          colors={[COLORS.indigo, COLORS.indigoLight]} 
          style={styles.hero}
        >
          <View style={styles.heroHeader}>
            <View style={styles.badge}><Text style={styles.badgeText}>徳島 伝統の絆</Text></View>
            <Text style={styles.welcomeText}>やっとさー！ {auth.currentUser?.email?.split('@')[0]} さん</Text>
          </View>
          <Text style={styles.heroTitle}>最高の演舞を目指して、{"\n"}今日も稽古に励みましょう。</Text>
        </LinearGradient>

        {/* メインメニュー：2列のグリッド */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>稽古メニュー</Text>
          
          <View style={styles.menuGrid}>
            <TouchableOpacity 
              style={styles.menuCard} 
              onPress={() => navigation.navigate('Scoring')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#EEF2FF' }]}>
                <BarChart2 color={COLORS.indigoLight} size={28} />
              </View>
              <Text style={styles.menuLabel}>AI解析・稽古</Text>
              <Text style={styles.menuSub}>フォームを採点</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuCard} 
              onPress={() => navigation.navigate('Community')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#FFF1F2' }]}>
                <Users color={COLORS.vermilion} size={28} />
              </View>
              <Text style={styles.menuLabel}>交流広場</Text>
              <Text style={styles.menuSub}>仲間の動画を見る</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuCard} 
              onPress={() => navigation.navigate('Request')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#FEFCE8' }]}>
                <ClipboardList color={COLORS.gold} size={28} />
              </View>
              <Text style={styles.menuLabel}>指導リクエスト</Text>
              <Text style={styles.menuSub}>師匠に教えを乞う</Text>
              {/* バッジ的な演出 */}
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>新機能</Text></View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuCard} 
              onPress={() => navigation.navigate('Mypage')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                <User color="#475569" size={28} />
              </View>
              <Text style={styles.menuLabel}>マイページ</Text>
              <Text style={styles.menuSub}>実績と設定</Text>
            </TouchableOpacity>
          </View>

          {/* 大きな横長のカード：お手本動画 */}
          <TouchableOpacity style={styles.largeCard}>
            <View style={styles.largeCardContent}>
              <View>
                <Text style={styles.largeCardTitle}>有名連のお手本動画</Text>
                <Text style={styles.largeCardSub}>一流の足運びと手の動きを学ぶ</Text>
              </View>
              <PlayCircle color={COLORS.indigo} size={40} />
            </View>
          </TouchableOpacity>
        </View>

        {/* お知らせセクション */}
        <View style={styles.newsSection}>
          <View style={styles.newsHeader}>
            <Text style={styles.sectionTitle}>お知らせ</Text>
            <TouchableOpacity><Text style={styles.viewMore}>すべて見る</Text></TouchableOpacity>
          </View>
          <View style={styles.newsItem}>
            <Text style={styles.newsDate}>2024.08.18</Text>
            <Text style={styles.newsText}>夏の阿波踊り大会に向けた強化週間が始まります！</Text>
            <ChevronRight size={16} color="#CBD5E1" />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1 },
  
  // ヘッダー部分
  hero: { 
    padding: 25, 
    paddingTop: 40, 
    paddingBottom: 60, 
    borderBottomLeftRadius: 40, 
    borderBottomRightRadius: 40,
    elevation: 8,
    shadowColor: COLORS.indigo,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  heroHeader: { marginBottom: 20 },
  badge: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 20, 
    alignSelf: 'flex-start',
    marginBottom: 10
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  welcomeText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 'bold' },
  heroTitle: { color: COLORS.white, fontSize: 24, fontWeight: '900', lineHeight: 34, marginTop: 5 },

  // メニュー部分
  menuContainer: { paddingHorizontal: 20, marginTop: -30 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textMain, marginBottom: 15 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuCard: { 
    width: (width - 55) / 2, 
    backgroundColor: COLORS.white, 
    padding: 20, 
    borderRadius: 24, 
    marginBottom: 15, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    position: 'relative'
  },
  iconCircle: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  menuLabel: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain },
  menuSub: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  newBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: COLORS.vermilion, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  newBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },

  // 特大カード
  largeCard: { backgroundColor: COLORS.white, padding: 25, borderRadius: 24, marginTop: 5, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  largeCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  largeCardTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.indigo },
  largeCardSub: { fontSize: 12, color: '#94A3B8', marginTop: 4 },

  // お知らせ部分
  newsSection: { padding: 20, marginTop: 10 },
  newsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  viewMore: { fontSize: 12, color: COLORS.indigoLight, fontWeight: 'bold' },
  newsItem: { backgroundColor: '#fff', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },
  newsDate: { fontSize: 11, color: COLORS.vermilion, fontWeight: 'bold', marginRight: 15 },
  newsText: { flex: 1, fontSize: 12, color: COLORS.textMain, fontWeight: '500' },
});