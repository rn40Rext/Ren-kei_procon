import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Settings, Video, Mail, Users, LogOut, ShieldCheck, Camera, Shield } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { fetchUserProfile, saveUserProfile, uploadUserIcon } from '../repositories/users';
import * as ImagePicker from 'expo-image-picker';
import { useAdminRens } from '../hooks/useAdminRens';
import AppMenu from '../components/AppMenu';
import { colors } from '../theme/colors';

type DanceStyle = 'male' | 'female' | null;

export default function MypageScreen() {
  // TODO: NativeStackNavigationProp<RootStackParamList, 'Mypage'>へ置き換える(docs/rules/coding.md 2章)
  const navigation = useNavigation<any>();
  const { adminRens } = useAdminRens();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // users/{uid} のフィールド
  const [nickname, setNickname] = useState('');
  const [profile, setProfile] = useState('');
  const [danceStyle, setDanceStyle] = useState<DanceStyle>(null);
  const [icon, setIcon] = useState('');

  // 編集中の下書き
  const [draftNickname, setDraftNickname] = useState('');
  const [draftProfile, setDraftProfile] = useState('');
  const [draftDanceStyle, setDraftDanceStyle] = useState<DanceStyle>(null);
  const [draftIcon, setDraftIcon] = useState('');

  const handleLogout = () => {
    Alert.alert("ログアウト", "ログアウトしてもよろしいですか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", style: "destructive", onPress: () => signOut(auth) }
    ]);
  };

  const startEditing = () => {
    setDraftNickname(nickname);
    setDraftProfile(profile);
    setDraftDanceStyle(danceStyle);
    setDraftIcon(icon);
    setEditing(true);
  };

  const pickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const res = await fetch(result.assets[0].uri);
      const blob = await res.blob();
      setDraftIcon(await uploadUserIcon(user.uid, blob));
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'アイコンのアップロードに失敗しました');
    }
  };

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      await saveUserProfile(user.uid, {
        nickname: draftNickname.trim(),
        profile: draftProfile.trim(),
        danceStyle: draftDanceStyle,
        icon: draftIcon,
      });

      setNickname(draftNickname.trim());
      setProfile(draftProfile.trim());
      setDanceStyle(draftDanceStyle);
      setIcon(draftIcon);
      setEditing(false);

      Alert.alert('完了', 'プロフィールを変更しました');
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'プロフィールの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const data = await fetchUserProfile(user.uid);
      if (data) {
        setNickname(data.nickname || '');
        setProfile(data.profile || '');
        setDanceStyle(data.danceStyle ?? null);
        setIcon(data.icon || '');
      }
    };

    fetchProfile();
  }, []);

  const displayName = nickname || auth.currentUser?.email?.split('@')[0] || 'ユーザー名を設定';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 38 }} />
        <Text style={styles.headerTitle}>マイページ</Text>
        <AppMenu />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarLarge}
            onPress={editing ? pickIcon : undefined}
            disabled={!editing}
          >
            {(editing ? draftIcon : icon) ? (
              <Image source={{ uri: editing ? draftIcon : icon }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarTextLarge}>阿</Text>
            )}
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Camera size={14} color={colors.textOnGold} />
              </View>
            )}
          </TouchableOpacity>

          {editing ? (
            <>
              <TextInput
                style={styles.nameInput}
                value={draftNickname}
                onChangeText={setDraftNickname}
                placeholder="ニックネーム"
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.profileInput}
                value={draftProfile}
                onChangeText={setDraftProfile}
                placeholder="自己紹介"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <View style={styles.danceStyleRow}>
                <TouchableOpacity
                  style={[styles.danceStyleBtn, draftDanceStyle === 'male' && styles.danceStyleBtnActive]}
                  onPress={() => setDraftDanceStyle('male')}
                >
                  <Text style={[styles.danceStyleText, draftDanceStyle === 'male' && styles.danceStyleTextActive]}>男踊り</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.danceStyleBtn, draftDanceStyle === 'female' && styles.danceStyleBtnActive]}
                  onPress={() => setDraftDanceStyle('female')}
                >
                  <Text style={[styles.danceStyleText, draftDanceStyle === 'female' && styles.danceStyleTextActive]}>女踊り</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.nameButtonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditing(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={startEditing}>
              <Text style={styles.userName}>{displayName}</Text>
              {profile ? <Text style={styles.profileText}>{profile}</Text> : null}
              <Text style={styles.editText}>タップして変更</Text>
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
              <Video size={20} color={colors.gold} />
              <Text style={styles.menuText}>自分の練習動画一覧</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Group')}>
            <View style={styles.menuLeft}>
              <Users size={20} color={colors.gold} />
              <Text style={styles.menuText}>所属グループ・連の設定</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {adminRens.length > 0 && (
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AdminHome')}>
              <View style={styles.menuLeft}>
                <Shield size={20} color={colors.gold} />
                <Text style={styles.menuText}>連の管理</Text>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>サポート & 設定</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ContactInfo')}>
            <View style={styles.menuLeft}>
              <Mail size={20} color={colors.textMuted} />
              <Text style={styles.menuText}>お問い合わせ</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Setting')}>
            <View style={styles.menuLeft}>
              <Settings size={20} color={colors.textMuted} />
              <Text style={styles.menuText}>アプリ設定</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <ShieldCheck size={20} color={colors.textMuted} />
              <Text style={styles.menuText}>プライバシーポリシー</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.aka} />
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: { height: 60, backgroundColor: colors.indigo, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: colors.indigoLine },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  content: { flex: 1 },
  profileSection: { alignItems: 'center', padding: 30, backgroundColor: colors.indigo, marginBottom: 10 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarTextLarge: { color: colors.gold, fontSize: 32, fontWeight: 'bold' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.gold, borderRadius: 10, padding: 4, borderWidth: 2, borderColor: colors.indigo },
  userName: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, textAlign: 'center' },
  userSub: { fontSize: 14, color: colors.textMuted, marginTop: 5 },
  profileText: { fontSize: 13, color: colors.textSecondaryOnIndigo, marginTop: 8, textAlign: 'center' },
  section: { backgroundColor: colors.indigo, marginBottom: 10, paddingVertical: 10 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: colors.textMuted, marginLeft: 20, marginBottom: 10, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: colors.indigoLine },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: { fontSize: 16, color: colors.textPrimaryOnIndigo, marginLeft: 15 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.indigo, paddingVertical: 15, marginTop: 10 },
  logoutText: { color: colors.aka, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },

  nameInput: {
    width: '80%',
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 18,
    color: colors.textPrimaryOnIndigo,
  },

  profileInput: {
    width: '80%',
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.textPrimaryOnIndigo,
  },

  danceStyleRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },

  danceStyleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
  },

  danceStyleBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  danceStyleText: {
    color: colors.textSecondaryOnIndigo,
    fontSize: 13,
  },

  danceStyleTextActive: {
    color: colors.textOnGold,
    fontWeight: 'bold',
  },

  nameButtonRow: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },

  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  cancelButtonText: { color: colors.textSecondaryOnIndigo },

  saveButton: {
    backgroundColor: colors.gold,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },

  saveButtonText: {
    color: colors.textOnGold,
    fontWeight: 'bold',
  },

  editText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
});
