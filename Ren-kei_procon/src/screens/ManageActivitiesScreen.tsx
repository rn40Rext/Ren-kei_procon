/**
 * 連の基本情報編集・活動スケジュール管理。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, Plus, X, Camera, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import { auth } from '../config/firebaseConfig';
import { subscribeRen, updateRenIcon, updateRenInfo } from '../repositories/renProfile';
import { subscribeRenActivities, createRenActivity, updateRenActivity, deleteRenActivity } from '../repositories/renActivities';
import type { RenActivity } from '../types/firestore';

interface RenInfo {
  name: string;
  description: string;
  location: string;
  beginnerFriendly: boolean;
  iconUrl: string;
}

function formatDateTime(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toInputFormat(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// null = 未入力、undefined = 入力はあるが形式が不正
function parseDateTime(input: string): Date | null | undefined {
  if (!input.trim()) return null;
  const date = new Date(input.trim().replace(' ', 'T'));
  return isNaN(date.getTime()) ? undefined : date;
}

export default function ManageActivitiesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { renId } = route.params;

  const [renInfo, setRenInfo] = useState<RenInfo | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftBeginnerFriendly, setDraftBeginnerFriendly] = useState(false);
  const [draftIconUrl, setDraftIconUrl] = useState('');

  const [activities, setActivities] = useState<RenActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [editingActivity, setEditingActivity] = useState<RenActivity | 'new' | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartAt, setFormStartAt] = useState('');
  const [formEndAt, setFormEndAt] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<RenActivity | null>(null);

  useEffect(() => {
    return subscribeRen(
      renId,
      (ren) => {
        if (!ren) return;
        const info: RenInfo = {
          name: ren.name ?? '',
          description: ren.description ?? '',
          location: ren.location ?? '',
          beginnerFriendly: !!ren.beginnerFriendly,
          iconUrl: ren.iconUrl ?? '',
        };
        setRenInfo(info);
        setDraftName(info.name);
        setDraftDescription(info.description);
        setDraftLocation(info.location);
        setDraftBeginnerFriendly(info.beginnerFriendly);
        setDraftIconUrl(info.iconUrl);
      },
      (error) => console.error('連の基本情報の取得に失敗しました', error),
    );
  }, [renId]);

  useEffect(() => {
    return subscribeRenActivities(
      renId,
      (list) => {
        setActivities(list);
        setLoadingActivities(false);
      },
      (error) => {
        console.error('活動情報の取得に失敗しました', error);
        setLoadingActivities(false);
        Alert.alert('エラー', '活動情報の取得に失敗しました。時間をおいて再度お試しください');
      },
    );
  }, [renId]);

  const pickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetch(result.assets[0].uri);
      const blob = await res.blob();
      setDraftIconUrl(await updateRenIcon(renId, user.uid, blob));
    } catch {
      Alert.alert('エラー', 'アイコンのアップロードに失敗しました');
    }
  };

  const handleSaveInfo = async () => {
    if (!draftName.trim()) {
      Alert.alert('エラー', '連の名前を入力してください');
      return;
    }
    setSavingInfo(true);
    try {
      await updateRenInfo(renId, {
        name: draftName.trim(),
        description: draftDescription.trim(),
        location: draftLocation.trim(),
        beginnerFriendly: draftBeginnerFriendly,
        iconUrl: draftIconUrl,
      });
      Alert.alert('完了', '連の基本情報を更新しました');
    } catch {
      Alert.alert('エラー', '連の基本情報の更新に失敗しました');
    } finally {
      setSavingInfo(false);
    }
  };

  const openNewActivityForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormStartAt('');
    setFormEndAt('');
    setFormLocation('');
    setEditingActivity('new');
  };

  const openEditActivityForm = (activity: RenActivity) => {
    setFormTitle(activity.title);
    setFormDescription(activity.description ?? '');
    setFormStartAt(toInputFormat(activity.startAt));
    setFormEndAt(activity.endAt ? toInputFormat(activity.endAt) : '');
    setFormLocation(activity.location ?? '');
    setEditingActivity(activity);
  };

  const handleSaveActivity = async () => {
    if (!formTitle.trim()) {
      Alert.alert('エラー', '活動名を入力してください');
      return;
    }
    const startAt = parseDateTime(formStartAt);
    if (!startAt) {
      Alert.alert('エラー', '開始日時は「YYYY-MM-DD HH:mm」の形式で入力してください');
      return;
    }
    let endAt: Date | null = null;
    if (formEndAt.trim()) {
      const parsedEndAt = parseDateTime(formEndAt);
      if (!parsedEndAt) {
        Alert.alert('エラー', '終了日時は「YYYY-MM-DD HH:mm」の形式で入力してください');
        return;
      }
      endAt = parsedEndAt;
    }

    setSavingActivity(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        startAt,
        endAt: endAt ?? null,
        location: formLocation.trim(),
      };
      if (editingActivity === 'new') {
        await createRenActivity(renId, payload);
      } else if (editingActivity) {
        await updateRenActivity(renId, editingActivity.id, payload);
      }
      setEditingActivity(null);
    } catch {
      Alert.alert('エラー', '活動情報の保存に失敗しました');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivity) return;
    try {
      await deleteRenActivity(renId, deletingActivity.id);
    } catch {
      Alert.alert('エラー', '活動情報の削除に失敗しました');
    } finally {
      setDeletingActivity(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft color={colors.gold} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>活動情報・連の管理</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>連の基本情報</Text>
        {renInfo ? (
          <View style={styles.formCard}>
            <TouchableOpacity style={styles.iconPicker} onPress={pickIcon} activeOpacity={0.85}>
              {draftIconUrl ? <Image source={{ uri: draftIconUrl }} style={styles.iconImage} /> : <Camera size={22} color={colors.gold} />}
            </TouchableOpacity>

            <Text style={styles.label}>連の名前</Text>
            <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>紹介</Text>
            <TextInput style={styles.textArea} value={draftDescription} onChangeText={setDraftDescription} multiline placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>活動地域</Text>
            <TextInput style={styles.input} value={draftLocation} onChangeText={setDraftLocation} placeholderTextColor={colors.textMuted} />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDraftBeginnerFriendly((v) => !v)} activeOpacity={0.8}>
              <View style={[styles.checkbox, draftBeginnerFriendly && styles.checkboxOn]} />
              <Text style={styles.checkboxLabel}>初心者歓迎</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, savingInfo && styles.saveBtnDisabled]} onPress={handleSaveInfo} disabled={savingInfo} activeOpacity={0.85}>
              {savingInfo ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.saveBtnText}>基本情報を保存</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <NarutoLoader size={22} color={colors.gold} style={{ marginBottom: spacing.lg, alignSelf: 'center' }} />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>活動スケジュール</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewActivityForm} activeOpacity={0.85}>
            <Plus size={14} color={colors.gold} />
            <Text style={styles.addBtnText}>追加</Text>
          </TouchableOpacity>
        </View>

        {loadingActivities ? (
          <NarutoLoader size={22} color={colors.gold} style={{ marginTop: spacing.lg, alignSelf: 'center' }} />
        ) : activities.length === 0 ? (
          <Text style={styles.emptyText}>活動情報はまだありません</Text>
        ) : (
          activities.map((a) => (
            <View key={a.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{a.title}</Text>
                <Text style={styles.itemMeta}>
                  {formatDateTime(a.startAt)}
                  {a.endAt ? ` 〜 ${formatDateTime(a.endAt)}` : ''}
                  {a.location ? `　${a.location}` : ''}
                </Text>
                {a.description ? <Text style={styles.itemBody}>{a.description}</Text> : null}
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEditActivityForm(a)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Pencil size={16} color={colors.gold} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setDeletingActivity(a)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Trash2 size={16} color={colors.aka} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!editingActivity} animationType="slide" transparent onRequestClose={() => setEditingActivity(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingActivity === 'new' ? '活動を追加' : '活動を編集'}</Text>
              <TouchableOpacity onPress={() => setEditingActivity(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={colors.textMuted} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>活動名</Text>
              <TextInput style={styles.input} placeholder="例：夏祭り合同練習" placeholderTextColor={colors.textMuted} value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>開始日時（YYYY-MM-DD HH:mm）</Text>
              <TextInput style={styles.input} placeholder="2026-08-01 18:00" placeholderTextColor={colors.textMuted} value={formStartAt} onChangeText={setFormStartAt} />

              <Text style={styles.label}>終了日時（任意・同形式）</Text>
              <TextInput style={styles.input} placeholder="2026-08-01 20:00" placeholderTextColor={colors.textMuted} value={formEndAt} onChangeText={setFormEndAt} />

              <Text style={styles.label}>場所（任意）</Text>
              <TextInput style={styles.input} value={formLocation} onChangeText={setFormLocation} placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>説明（任意）</Text>
              <TextInput style={styles.textArea} value={formDescription} onChangeText={setFormDescription} multiline placeholderTextColor={colors.textMuted} />

              <TouchableOpacity style={[styles.saveBtn, savingActivity && styles.saveBtnDisabled]} onPress={handleSaveActivity} disabled={savingActivity} activeOpacity={0.85}>
                {savingActivity ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.saveBtnText}>保存する</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deletingActivity} animationType="fade" transparent onRequestClose={() => setDeletingActivity(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>確認</Text>
            <Text style={styles.confirmMessage}>「{deletingActivity?.title}」を削除しますか？</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setDeletingActivity(null)} activeOpacity={0.85}>
                <Text style={styles.confirmCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteActivity} activeOpacity={0.85}>
                <Text style={styles.confirmDeleteText}>削除する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { marginRight: spacing.sm },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 16 },

  list: { flex: 1, padding: spacing.lg },
  sectionLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldSoft, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, marginBottom: spacing.sm },
  addBtnText: { color: colors.gold, fontWeight: '700', fontSize: 12, marginLeft: 3 },
  formCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: spacing.xl },
  iconPicker: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.indigoRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  iconImage: { width: 64, height: 64 },
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm, fontSize: 12 },
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
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.indigoLine, marginRight: spacing.sm },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkboxLabel: { ...typography.body, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  emptyText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  itemCard: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.indigoLine },
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  itemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 11 },
  itemBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  itemActions: { justifyContent: 'center', marginLeft: spacing.sm },
  iconBtn: { padding: spacing.xs },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmCard: { backgroundColor: colors.indigoDeep, borderRadius: radius.md, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.xl, width: '100%' },
  confirmTitle: { ...typography.headingSerif, color: colors.textPrimary, marginBottom: spacing.sm },
  confirmMessage: { ...typography.body, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
  confirmActions: { flexDirection: 'row' },
  confirmCancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.indigoRaised, marginRight: spacing.sm },
  confirmCancelText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.aka, marginLeft: spacing.sm },
  confirmDeleteText: { color: colors.textOnAka, fontWeight: '700', fontSize: 14 },
});
