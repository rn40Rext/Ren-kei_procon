import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Camera, Users, UserPlus, Flag, User, Home as HomeIcon, Settings } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

export default function HomeScreen() {
  type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;
  const navigation = useNavigation<HomeScreenNavigationProp>();
  type MenuItems = {id: number; title: string; icon: React.ReactNode; bgColor: string; screen: keyof RootStackParamList; };
  const menuItems: MenuItems[] = [
    { id: 0, title: '踊り解析', icon: <Camera size={36} color="#2563eb" />, bgColor: '#dbeafe', screen: 'Scoring', },
    { id: 1, title: 'コミュニティ', icon: <Users size={36} color="#16a34a" />, bgColor: '#dcfce7', screen: 'Community', },
    { id: 2, title: '連への参加リクエスト', icon: <UserPlus size={36} color="#ca8a04" />, bgColor: '#fef08a', screen: 'Request', },
    { id: 3, title: 'マイページ', icon: <User size={36} color="#4b5563" />, bgColor: '#f3f4f6' , screen: 'Mypage', },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ren-kei</Text>

          <TouchableOpacity style={styles.settingsButton}>
            <Settings size={24} color="#374151" />
          </TouchableOpacity>
      </View>

      {/* メインコンテンツ */}
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        <Text style={styles.sectionTitle}>メインメニュー</Text>
        
        <View style={styles.grid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, styles.cardHalf]}
              onPress ={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.iconWrapper, { backgroundColor: item.bgColor }]}>
                {item.icon}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ボトムナビゲーション (ダミー) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <HomeIcon size={24} color="#2563eb" />
          <Text style={[styles.navText, { color: '#2563eb' }]}>ホーム</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Users size={24} color="#9ca3af" />
          <Text style={styles.navText}>コミュニティ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <User size={24} color="#9ca3af" />
          <Text style={styles.navText}>マイページ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    top: 14,
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    letterSpacing: 1,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    padding: 20,
    paddingBottom: 100, // ボトムナビゲーションの分の余白
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHalf: {
    width: '48%', // 2列表示
    aspectRatio: 1,
  },
  cardWide: {
    width: '100%', // 1列（全幅）表示
  },
  iconWrapper: {
    padding: 18,
    borderRadius: 999,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 10,
    paddingBottom: 24, // iPhoneのホームバー考慮
    position: 'absolute',
    bottom: 0,
    width: '100%',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
  },
  navText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginTop: 4,
  },
});