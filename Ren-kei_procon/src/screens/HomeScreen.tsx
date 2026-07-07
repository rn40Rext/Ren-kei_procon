import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Camera, Users, UserPlus, Flag, User, Home as HomeIcon } from 'lucide-react-native';

export default function HomeScreen() {
  const menuItems = [
    { title: '踊り解析', icon: <Camera size={28} color="#2563eb" />, bgColor: '#dbeafe' },
    { title: 'コミュニティ', icon: <Users size={28} color="#16a34a" />, bgColor: '#dcfce7' },
    { title: '連への参加リクエスト', icon: <UserPlus size={28} color="#ca8a04" />, bgColor: '#fef08a', isWide: true },
    { title: 'マイ連', icon: <Flag size={28} color="#9333ea" />, bgColor: '#f3e8ff' },
    { title: 'マイページ', icon: <User size={28} color="#4b5563" />, bgColor: '#f3f4f6' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ren-kei</Text>
      </View>

      {/* メインコンテンツ */}
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        <Text style={styles.sectionTitle}>メインメニュー</Text>
        
        <View style={styles.grid}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.card,
                item.isWide ? styles.cardWide : styles.cardHalf
              ]}
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
          <Flag size={24} color="#9ca3af" />
          <Text style={styles.navText}>マイ連</Text>
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
    padding: 20,
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
  },
  cardWide: {
    width: '100%', // 1列（全幅）表示
  },
  iconWrapper: {
    padding: 12,
    borderRadius: 50,
    marginBottom: 12,
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