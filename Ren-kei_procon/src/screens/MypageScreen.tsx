import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Settings, Video, Mail, Users, LogOut, ShieldCheck } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  const [userName, setUserName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [inputName, setInputName] = useState('');

  const handleLogout = () => {
    Alert.alert("ログアウト", "ログアウトしてもよろしいですか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", style: "destructive", onPress: () => signOut(auth) }
    ]);
  };

  const handleSaveUserName = async () => {
    const user = auth.currentUser;

    if (!user) return;

    if (!inputName.trim()) {
      Alert.alert('エラー', 'ユーザー名を入力してください');
      return;
    }

    try {
      await setDoc(
        doc(db, 'Users', user.uid),
        {
          userName: inputName.trim(),
        },
        { merge: true }
      );

      setUserName(inputName.trim());
      setEditingName(false);

      Alert.alert('完了', 'ユーザー名を変更しました');
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'ユーザー名の保存に失敗しました');
    }
  };

  useEffect(() => {
    const fetchUserName = async () => {
      const user = auth.currentUser;

      if (!user) return;

      const userRef = doc(db, 'Users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const name = userSnap.data().userName || '';
        setUserName(name);
        setInputName(name);
      }
    };

    fetchUserName();
  }, []);

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
          {editingName ? (
            <>
              <TextInput
                style={styles.nameInput}
                value={inputName}
                onChangeText={setInputName}
                placeholder="ユーザー名"
              />

              <View style={styles.nameButtonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setInputName(userName);
                    setEditingName(false);
                  }}
                >
                  <Text>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveUserName}
                >
                  <Text style={styles.saveButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={styles.userName}>
                {userName || 'ユーザー名を設定'}
              </Text>

              <Text style={styles.editText}>
                タップして変更
              </Text>
            </TouchableOpacity>
          )}
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

  nameInput: {
    width: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 18,
  },

  nameButtonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },

  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },

  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  editText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});