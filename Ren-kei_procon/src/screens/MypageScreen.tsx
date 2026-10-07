import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { Alert } from '../utils/alert';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Settings, Mail, LogOut, ShieldCheck, Camera, TrendingUp } from 'lucide-react-native';
import { IconWagasa, IconEnbuPlay } from '../components/awaIcons';
import { signOut } from 'firebase/auth';
import { auth, db, storage } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { saveUserProfile } from '../repositories/users';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../hooks/useAuth';
import { AnalysisResult, subscribeAnalysisResultsByUser } from '../repositories/analysis';
import { RenMon } from '../components/motifs';
import { colors, spacing, radius, typography } from '../theme';

/** 踊りの種類(男踊り/女踊り/未設定) と、ユーザーの役割 */
type DanceStyle = 'male' | 'female' | null;
type Role = 'user' | 'ren_admin' | 'service_admin';

/** 役割の表示名(名前の下のバッジに出す) */
const ROLE_LABEL: Record<Role, string> = {
  user: '踊り手',
  ren_admin: '連の世話役',
  service_admin: '運営',
};

/** 稽古手帳(マイページ)。プロフィール編集・稽古実績の集計・各種管理画面への導線をまとめる */
export default function MypageScreen() {
  const navigation = useNavigation<any>();
  const { uid } = useAuth();

  // 稽古の記録(analysisResults)から実データで集計する。以前は固定の見本値だった
  const [results, setResults] = useState<AnalysisResult[]>([]);
  useEffect(() => {
    if (!uid) return;
    return subscribeAnalysisResultsByUser(uid, setResults, (e) => console.warn('subscribeAnalysisResultsByUser', e));
  }, [uid]);
  // 直近の極め度と自己ベスト(記録がなければ null)。上部の3つの数字に出す
  const latest = results.length ? results[results.length - 1].totalScore : null;
  const best = results.length ? Math.max(...results.map((r) => r.totalScore)) : null;
  const keikoStats = [
    { label: '稽古の回数', value: `${results.length}`, unit: '回' },
    { label: '直近の極め度', value: latest === null ? '―' : `${Math.round(latest)}`, unit: latest === null ? '' : '点' },
    { label: '自己ベスト', value: best === null ? '―' : `${Math.round(best)}`, unit: best === null ? '' : '点' },
  ];

  // プロフィールを編集中か / 保存中か
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // users/{uid} のフィールド
  const [nickname, setNickname] = useState('');
  const [profile, setProfile] = useState('');
  const [danceStyle, setDanceStyle] = useState<DanceStyle>(null);
  const [icon, setIcon] = useState('');
  const [role, setRole] = useState<Role>('user');

  // 編集中の下書き
  const [draftNickname, setDraftNickname] = useState('');
  const [draftProfile, setDraftProfile] = useState('');
  const [draftDanceStyle, setDraftDanceStyle] = useState<DanceStyle>(null);
  const [draftIcon, setDraftIcon] = useState('');

  /** ログアウト確認ダイアログを出し、OKならサインアウトする */
  const handleLogout = () => {
    Alert.alert('ログアウト', 'ログアウトしてもよろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  /** プロフィール編集モードに入る。現在値を下書きへコピーする */
  const startEditing = () => {
    setDraftNickname(nickname);
    setDraftProfile(profile);
    setDraftDanceStyle(danceStyle);
    setDraftIcon(icon);
    setEditing(true);
  };

  /** プロフィールアイコンを選んでStorageへアップロードし、下書きのURLを差し替える */
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

  /** 下書きのプロフィールをusers/{uid}へ保存する */
  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      // users/{uid} が無いアカウントでも保存できるよう、repositories 側で先に作成してから書く
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

  // 画面を開いたときに、自分のプロフィール(users/{uid})を1回読み込む
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
        if (data.role === 'ren_admin' || data.role === 'service_admin') setRole(data.role);
        else setRole('user');
      }
    };

    fetchProfile();
  }, []);

  // 表示する名前(踊り名 → メールアドレスの@より前 → 未設定の案内の順に使う)と、表示するアイコン(編集中は下書き)
  const displayName = nickname || auth.currentUser?.email?.split('@')[0] || '踊り名を定める';
  const shownIcon = editing ? draftIcon : icon;

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー(共通): 画面名と注釈・メニュー */}
      <ScreenHeader title="稽古手帳" note="プロフィール等を確認する" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* プロフィール欄: アイコン・名前・役割・自己紹介と、稽古の実績 */}
        <View style={styles.profileSection}>
          {/* アイコン。編集中はタップで画像を選び、それ以外はタップで編集を始める */}
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
            {/* 編集中はアイコンの右下にカメラのバッジを出す */}
            {editing ? (
              <View style={styles.avatarEditBadge}>
                <Camera size={13} color={colors.textOnGold} />
              </View>
            ) : null}
          </TouchableOpacity>

          {/* 編集中は入力欄(踊り名・自己紹介・踊りの種類)と「やめる」「改める」ボタン、それ以外は名前と役割のバッジを出す */}
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
              <View style={styles.roleBadge}>
                {role !== 'user' ? <ShieldCheck size={12} color={colors.gold} /> : null}
                <Text style={styles.roleBadgeText}>{ROLE_LABEL[role]}</Text>
              </View>
              {profile ? <Text style={styles.profileText}>{profile}</Text> : null}
              <Text style={styles.editText}>
                {danceStyle === 'male' ? '男踊り' : danceStyle === 'female' ? '女踊り' : '踊りの種類は未設定'}　▸ タップして改める
              </Text>
            </TouchableOpacity>
          )}

          {/* 稽古の回数・直近の極め度・自己ベスト(編集中は隠す) */}
          {!editing ? (
            <View style={styles.statRow}>
              {keikoStats.map((s, i) => (
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

        {/* 稽古の記録: 成長曲線・練習動画一覧・マイ連への入口 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>稽古の記録</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('GrowthChart')}>
            <View style={styles.menuLeft}>
              <TrendingUp size={19} color={colors.gold} />
              <Text style={styles.menuText}>成長の記録</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('VideoList')}>
            <View style={styles.menuLeft}>
              <IconEnbuPlay size={19} color={colors.gold} />
              <Text style={styles.menuText}>練習動画一覧</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Group')}>
            <View style={styles.menuLeft}>
              <IconWagasa size={19} color={colors.gold} />
              <Text style={styles.menuText}>マイ連（所属している連）</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* サポート・設定: お問い合わせ・アプリ設定・プライバシーポリシー(未実装) */}
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

        {/* ログアウト */}
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
  // 画面全体の背景と、画面名を中央に置くヘッダー
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  content: { flex: 1 },

  // アイコン・名前・役割・統計をまとめた、画面上部のプロフィールエリア
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.indigo,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  // アイコン(紋の中に丸く表示)と、編集中に右下へ出すカメラのバッジ
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
  // 名前・役割のバッジ(丸い枠)・自己紹介・「タップして改める」の案内
  userName: { ...typography.titleSerif, color: colors.textPrimary, textAlign: 'center' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
  },
  roleBadgeText: { ...typography.caption, color: colors.gold, fontSize: 10 },
  profileText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  editText: { textAlign: 'center', ...typography.caption, color: colors.textMuted, marginTop: 4 },

  // 「稽古の回数」「直近の極め度」「自己ベスト」を横に並べる行
  statRow: { flexDirection: 'row', marginTop: spacing.xl, justifyContent: 'center' },
  statItem: { alignItems: 'center', paddingHorizontal: spacing.lg },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.indigoLine },
  statValue: { ...typography.titleSerif, color: colors.gold, fontSize: 18 },
  statUnit: { ...typography.caption, color: colors.textMuted },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // メニュー項目をまとめた1つのグループ(「稽古の記録」等のセクション)
  section: {
    backgroundColor: colors.indigo,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  // セクションの見出し(金色)と、メニューの1行(アイコン・名前・右矢印)
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

  // ログアウトのボタン(赤い文字で注意を促す)
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

  // 編集中の踊り名(金色の枠)と自己紹介(複数行)の入力欄
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
  // 編集中に「男踊り」「女踊り」を選ぶボタンを横に並べる行
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

  // 「やめる」(文字だけ)と「改める」(金色)のボタン
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
