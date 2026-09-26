/**
 * マイ連。自分が所属する連の一覧・活動情報・お知らせ、連の新規作成。
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Users, MapPin, Plus, X, Megaphone, CalendarDays, Search, ChevronLeft, ChevronRight, Shield, LogOut } from 'lucide-react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { Badge } from '../components/ui';
import AppMenu from '../components/AppMenu';
import { KasaGarland, NarutoLoader } from '../components/motifs';
import { IconWagasa } from '../components/awaIcons';
import { createRen } from '../repositories/renProfile';
import { subscribeRenActivities } from '../repositories/renActivities';
import { subscribeAnnouncements } from '../repositories/renAnnouncements';
import { leaveRen } from '../repositories/renMembership';
import { useMyRens } from '../hooks/useMyRens';
import type { Announcement, RenActivity } from '../types/firestore';
import type { RootStackParamList } from '../navigation/AppNavigator';

function formatDateTime(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default function GroupScreen() {
  const { width: SCREEN_W } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Group'>>();
  const requestedRenId = route.params?.renId;
  const { myRens, loading } = useMyRens();
  const [selectedRenId, setSelectedRenId] = useState<string | null>(null);
  const [activities, setActivities] = useState<RenActivity[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [beginnerFriendly, setBeginnerFriendly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (myRens.length === 0) return;
    if (requestedRenId && myRens.some((r) => r.renId === requestedRenId)) {
      setSelectedRenId(requestedRenId);
      return;
    }
    if (!selectedRenId || !myRens.some((r) => r.renId === selectedRenId)) {
      setSelectedRenId(myRens[0].renId);
    }
  }, [myRens, selectedRenId, requestedRenId]);

  useEffect(() => {
    if (!selectedRenId) {
      setActivities([]);
      setAnnouncements([]);
      return;
    }
    const unsubActivities = subscribeRenActivities(selectedRenId, setActivities, (e) =>
      console.error('活動情報の取得に失敗しました', e),
    );
    const unsubAnnouncements = subscribeAnnouncements(selectedRenId, setAnnouncements, (e) =>
      console.error('お知らせの取得に失敗しました', e),
    );
    return () => {
      unsubActivities();
      unsubAnnouncements();
    };
  }, [selectedRenId]);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', '連の名前を入力してください');
      return;
    }
    setCreating(true);
    try {
      const renId = await createRen({
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        beginnerFriendly,
      });
      setName('');
      setDescription('');
      setLocation('');
      setBeginnerFriendly(false);
      setShowCreateForm(false);
      setSelectedRenId(renId);
      Alert.alert('完了', '連を作成しました');
    } catch {
      Alert.alert('エラー', '連の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const selectedRen = myRens.find((r) => r.renId === selectedRenId) ?? null;

  const handleLeave = () => {
    if (!selectedRen) return;
    Alert.alert(
      '連から脱退しますか？',
      `「${selectedRen.name}」から脱退します。この操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '脱退する',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveRen(selectedRen.renId);
            } catch (e: any) {
              if (e?.code === 'functions/failed-precondition') {
                Alert.alert('お知らせ', '最後の管理者は脱退できません。先に他のメンバーを管理者にしてください。');
              } else {
                console.error('連からの脱退に失敗しました', e);
                Alert.alert('エラー', '脱退に失敗しました');
              }
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KasaGarland width={SCREEN_W} count={7} height={40} style={styles.garland} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </TouchableOpacity>
        <IconWagasa size={22} color={colors.gold} style={styles.headerIcon} />
        <Text style={styles.headerTitle}>マイ連</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateForm(true)} activeOpacity={0.85}>
          <Plus size={15} color={colors.gold} />
          <Text style={styles.createBtnText}>連を作成</Text>
        </TouchableOpacity>
        <AppMenu />
      </View>

      {loading ? (
        <NarutoLoader size={26} color={colors.gold} style={{ marginTop: 60, alignSelf: 'center' }} />
      ) : myRens.length === 0 ? (
        <View style={styles.emptyWrap}>
          <IconWagasa size={36} color={colors.gold} />
          <Text style={styles.emptyText}>まだどの連にも所属していません</Text>
          <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('RenSearch')} activeOpacity={0.85}>
            <Search size={17} color={colors.textOnGold} />
            <Text style={styles.searchBtnText}>連を探す</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {myRens.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.switcher}
              contentContainerStyle={styles.switcherContent}
            >
              {myRens.map((r) => (
                <TouchableOpacity
                  key={r.renId}
                  style={[styles.switcherPill, r.renId === selectedRen?.renId && styles.switcherPillActive]}
                  onPress={() => setSelectedRenId(r.renId)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.switcherText, r.renId === selectedRen?.renId && styles.switcherTextActive]}>
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {selectedRen && (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.renCard}>
                <Text style={styles.renName}>{selectedRen.name}</Text>
                {selectedRen.description ? <Text style={styles.renDescription}>{selectedRen.description}</Text> : null}
                {selectedRen.location ? (
                  <View style={styles.renRow}>
                    <MapPin size={14} color={colors.textMuted} />
                    <Text style={styles.renRowText}>{selectedRen.location}</Text>
                  </View>
                ) : null}
                <View style={styles.renRow}>
                  <Users size={14} color={colors.textMuted} />
                  <Text style={styles.renRowText}>メンバー {selectedRen.memberCount}人</Text>
                  <Badge
                    label={selectedRen.role === 'admin' ? '管理者' : 'メンバー'}
                    tone={selectedRen.role === 'admin' ? 'gold' : 'outline'}
                    style={{ marginLeft: spacing.sm }}
                  />
                </View>
                {selectedRen.role === 'admin' && (
                  <TouchableOpacity style={styles.adminLink} onPress={() => navigation.navigate('AdminHome')} activeOpacity={0.85}>
                    <Shield size={16} color={colors.gold} />
                    <Text style={styles.adminLinkText}>連の管理へ</Text>
                    <ChevronRight size={16} color={colors.gold} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.leaveLink}
                  onPress={handleLeave}
                  disabled={leaving}
                  activeOpacity={0.85}
                >
                  {leaving ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <LogOut size={15} color={colors.textMuted} />
                  )}
                  <Text style={styles.leaveLinkText}>この連から脱退する</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHead}>
                <CalendarDays size={16} color={colors.gold} />
                <Text style={styles.sectionTitle}>活動情報</Text>
              </View>
              {activities.length === 0 ? (
                <Text style={styles.sectionEmptyText}>活動情報はまだありません</Text>
              ) : (
                activities.map((a) => (
                  <View key={a.id} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{a.title}</Text>
                    <Text style={styles.itemMeta}>
                      {formatDateTime(a.startAt)}
                      {a.endAt ? ` 〜 ${formatDateTime(a.endAt)}` : ''}
                      {a.location ? `　${a.location}` : ''}
                    </Text>
                    {a.description ? <Text style={styles.itemBody}>{a.description}</Text> : null}
                  </View>
                ))
              )}

              <View style={styles.sectionHead}>
                <Megaphone size={16} color={colors.gold} />
                <Text style={styles.sectionTitle}>お知らせ</Text>
              </View>
              {announcements.length === 0 ? (
                <Text style={styles.sectionEmptyText}>お知らせはまだありません</Text>
              ) : (
                announcements.map((a) => (
                  <View key={a.id} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{a.title}</Text>
                    <Text style={styles.itemMeta}>{formatDate(a.createdAt)}</Text>
                    <Text style={styles.itemBody}>{a.content}</Text>
                  </View>
                ))
              )}
              <View style={{ height: spacing.xl }} />
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={showCreateForm} animationType="slide" onRequestClose={() => setShowCreateForm(false)}>
        <SafeAreaView style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formHeaderTitle}>連を作成する</Text>
            <TouchableOpacity onPress={() => setShowCreateForm(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.label}>連の名前</Text>
            <TextInput
              style={styles.input}
              placeholder="例：徳島連"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>紹介</Text>
            <TextInput
              style={styles.textArea}
              placeholder="連の紹介文"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>活動地域</Text>
            <TextInput
              style={styles.input}
              placeholder="例：徳島県徳島市"
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setBeginnerFriendly((v) => !v)} activeOpacity={0.8}>
              <View style={[styles.checkbox, beginnerFriendly && styles.checkboxOn]} />
              <Text style={styles.checkboxLabel}>初心者歓迎</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              {creating ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.submitBtnText}>この内容で作成する</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  garland: { backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { marginRight: spacing.sm },
  headerIcon: { marginRight: spacing.md },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.md,
  },
  createBtnText: { ...typography.caption, color: colors.gold, fontWeight: '700', marginLeft: 4 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xl },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  searchBtnText: { ...typography.button, color: colors.textOnGold, marginLeft: spacing.sm },

  switcher: { borderBottomWidth: 1, borderColor: colors.indigoLine },
  switcherContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  switcherPill: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  switcherPillActive: { backgroundColor: colors.gold },
  switcherText: { ...typography.caption, color: colors.textSecondary },
  switcherTextActive: { color: colors.textOnGold, fontWeight: '700' },

  content: { padding: spacing.lg },
  renCard: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  renName: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20 },
  renDescription: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  renRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  renRowText: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.sm },
  adminLink: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.indigoLine },
  adminLinkText: { flex: 1, marginLeft: spacing.sm, ...typography.bodyStrong, color: colors.gold, fontSize: 13 },
  leaveLink: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.indigoLine },
  leaveLinkText: { marginLeft: spacing.sm, ...typography.caption, color: colors.textMuted },

  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { ...typography.sectionLabel, color: colors.textPrimary, marginLeft: spacing.sm },
  sectionEmptyText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  itemCard: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  itemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  itemBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },

  formContainer: { flex: 1, backgroundColor: colors.indigoDeep },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  formHeaderTitle: { ...typography.headingSerif, color: colors.textPrimary },
  formContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
    ...typography.body,
  },
  textArea: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 90,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.indigoLine, marginRight: spacing.sm },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkboxLabel: { ...typography.body, color: colors.textPrimary },
  submitBtn: { backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },
});
