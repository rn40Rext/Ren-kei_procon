import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Settings, Video, Mail, Users, LogOut, ShieldCheck, Camera } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth, db, storage } from '../config/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import AppMenu from '../components/AppMenu';
import { RenMon } from '../components/motifs';
import { colors, spacing, radius, typography } from '../theme';

type DanceStyle = 'male' | 'female' | null;

const KEIKO_STATS = [
  { label: '連続稽古', value: '18', unit: '日' },
  { label: '総演舞', value: '42', unit: '本' },
  { label: '獲得段位', value: '三段', unit: '' },
];

export default function MypageScreen() {
  const navigation = useNavigation<any>();

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
    Alert.alert('ログアウト', 'ログアウトしてもよろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => signOut(auth) },
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const res = await fetch(result.assets[0].uri);
      const blob = await res.blob();
      const iconRef = ref(storage, `users/${user.uid}/icon/${Date.now()}.jpg`);
      await uploadBytes(iconRef, blob);
      const url = await getDownloadURL(iconRef);
      setDraftIcon(url);
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
      // role/uid/createdAt は送らない（firestore.rules でも保護されている）
      await setDoc(
        doc(db, 'users', user.uid),
        {
          nickname: draftNickname.trim(),
          profile: draftProfile.trim(),
          danceStyle: draftDanceStyle,
          icon: draftIcon,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

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

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setNickname(data.nickname || '');
        setProfile(data.profile || '');
        setDanceStyle(data.danceStyle ?? null);
        setIcon(data.icon || '');
      }
    };

    fetchProfile();
  }, []);

  const displayName = nickname || auth.currentUser?.email?.split('@')[0] || '踊り名を定める';
  const shownIcon = editing ? draftIcon : icon;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 38 }} />
        <Text style={styles.headerTitle}>稽古手帳</Text>
        <AppMenu />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={editing ? pickIcon : startEditing}
            activeOpacity={0.85}
          >
            <RenMon size={78} color={colors.gold}>
              {shownIcon ? (
                <Image source={{ uri: shownIcon }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarChar}>{(nickname || '阿').slice(0, 1)}</Text>
              )}
            </RenMon>
            {editing ? (
              <View style={styles.avatarEditBadge}>
                <Camera size={13} color={colors.textOnGold} />
              </View>
            ) : null}
          </TouchableOpacity>

          {editing ? (
            <>
              <TextInput
                style={styles.nameInput}
                value={draftNickname}
                onChangeText={setDraftNickname}
                placeholder="踊り名"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={styles.profileInput}
                value={draftProfile}
                onChangeText={setDraftProfile}
                placeholder="自己紹介・稽古への思い"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <View style={styles.danceStyleRow}>
                <TouchableOpacity
                  style={[styles.danceStyleBtn, draftDanceStyle === 'male' && styles.danceStyleBtnActive]}
                  onPress={() => setDraftDanceStyle('male')}
                >
                  <Text style={[styles.danceStyleText, draftDanceStyle === 'male' && styles.danceStyleTextActive]}>
                    男踊り
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.danceStyleBtn, draftDanceStyle === 'female' && styles.danceStyleBtnActive]}
                  onPress={() => setDraftDanceStyle('female')}
                >
                  <Text style={[styles.danceStyleText, draftDanceStyle === 'female' && styles.danceStyleTextActive]}>
                    女踊り
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.nameButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
                  <Text style={styles.cancelButtonText}>やめる</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? '保存中…' : '改める'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={startEditing}>
              <Text style={styles.userName}>{displayName}</Text>
              {profile ? <Text style={styles.profileText}>{profile}</Text> : null}
              <Text style={styles.editText}>
                {danceStyle === 'male' ? '男踊り' : danceStyle === 'female' ? '女踊り' : '傘連・阿波徳島　新進'}　▸ タップして改める
              </Text>
            </TouchableOpacity>
          )}

          {!editing ? (
            <View style={styles.statRow}>
              {KEIKO_STATS.map((s, i) => (
                <View key={s.label} style={[styles.statItem, i > 0 && styles.statDivider]}>
                  <Text style={styles.statValue}>
                    {s.value}
                    {s.unit ? <Text style={styles.statUnit}>{s.unit}</Text> : null}
                  </Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>稽古の記録</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('VideoList')}>
            <View style={styles.menuLeft}>
              <Video size={19} color={colors.gold} />
              <Text style={styles.menuText}>自分の演舞・稽古録</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Group')}>
            <View style={styles.menuLeft}>
              <Users size={19} color={colors.gold} />
              <Text style={styles.menuText}>所属連・役職の設定</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>サポート・設定</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ContactInfo')}>
            <View style={styles.menuLeft}>
              <Mail size={19} color={colors.textSecondary} />
              <Text style={styles.menuText}>お問い合わせ</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Setting')}>
            <View style={styles.menuLeft}>
              <Settings size={19} color={colors.textSecondary} />
              <Text style={styles.menuText}>アプリ設定</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <ShieldCheck size={19} color={colors.textSecondary} />
              <Text style={styles.menuText}>プライバシーポリシー</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={19} color={colors.danger} />
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: {
    height: 56,
    backgroundColor: colors.indigoDeep,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  headerTitle: { ...typography.headingSerif, color: colors.textPrimary },
  content: { flex: 1 },

  profileSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.indigo,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  avatarWrap: { marginBottom: spacing.md },
  avatarImage: { width: 60, height: 60, borderRadius: radius.pill },
  avatarChar: { color: colors.gold, fontSize: 30, fontFamily: typography.titleSerif.fontFamily, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    padding: 5,
    borderWidth: 2,
    borderColor: colors.indigo,
  },
  userName: { ...typography.titleSerif, color: colors.textPrimary, textAlign: 'center' },
  profileText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  editText: { textAlign: 'center', ...typography.caption, color: colors.textMuted, marginTop: 4 },

  statRow: { flexDirection: 'row', marginTop: spacing.xl, justifyContent: 'center' },
  statItem: { alignItems: 'center', paddingHorizontal: spacing.lg },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.indigoLine },
  statValue: { ...typography.titleSerif, color: colors.gold, fontSize: 18 },
  statUnit: { ...typography.caption, color: colors.textMuted },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  section: {
    backgroundColor: colors.indigo,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.gold,
    marginLeft: spacing.lg,
    marginVertical: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.indigoLine,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: { ...typography.body, fontSize: 14, color: colors.textPrimary, marginLeft: spacing.md },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.indigo,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  logoutText: { color: colors.danger, ...typography.button, marginLeft: spacing.sm },

  nameInput: {
    minWidth: 220,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.indigoRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
    fontSize: 17,
    color: colors.textPrimary,
  },
  profileInput: {
    minWidth: 260,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
  danceStyleRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  danceStyleBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
  },
  danceStyleBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  danceStyleText: { ...typography.caption, color: colors.textSecondary },
  danceStyleTextActive: { color: colors.textOnGold, fontWeight: '700' },

  nameButtonRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.md },
  cancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelButtonText: { ...typography.button, color: colors.textSecondary },
  saveButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  saveButtonText: { color: colors.textOnGold, ...typography.button },
});
