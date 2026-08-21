import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Settings, Video, Mail, Users, LogOut, ShieldCheck } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  white: '#FFFFFF',
  danger: '#EF4444',
};

export default function MypageScreen() {
  // 💡 解決策: useNavigationに <any> を指定することで、すべての遷移エラーを消します
  const navigation = useNavigation<any>();

  const handleLogout = () => {
    Alert.alert("ログアウト", "ログアウトしてもよろしいですか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", style: "destructive", onPress: () => signOut(auth) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>マイページ</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>阿</Text>
          </View>
          <Text style={styles.userName}>{auth.currentUser?.email?.split('@')[0] || '阿波 踊子'}</Text>
          <Text style={styles.userSub}>所属連：徳島連</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>アクティビティ</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigation.navigate('VideoList')}
          >
            <View style={styles.menuLeft}>
              <Video size={20} color={COLORS.primary} />
              <Text style={styles.menuText}>自分の練習動画一覧</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Group')}>
            <View style={styles.menuLeft}>
              <Users size={20} color={COLORS.primary} />
              <Text style={styles.menuText}>所属グループ・連の設定</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>サポート & 設定</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ContactInfo')}>
            <View style={styles.menuLeft}>
              <Mail size={20} color={COLORS.textMuted} />
              <Text style={styles.menuText}>お問い合わせ</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Setting')}>
            <View style={styles.menuLeft}>
              <Settings size={20} color={COLORS.textMuted} />
              <Text style={styles.menuText}>アプリ設定</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <ShieldCheck size={20} color={COLORS.textMuted} />
              <Text style={styles.menuText}>プライバシーポリシー</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  content: { flex: 1 },
  profileSection: { alignItems: 'center', padding: 30, backgroundColor: '#fff', marginBottom: 10 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarTextLarge: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  userName: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  userSub: { fontSize: 14, color: COLORS.textMuted, marginTop: 5 },
  section: { backgroundColor: '#fff', marginBottom: 10, paddingVertical: 10 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.textMuted, marginLeft: 20, marginBottom: 10, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: { fontSize: 16, color: COLORS.textMain, marginLeft: 15 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 15, marginTop: 10 },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
});