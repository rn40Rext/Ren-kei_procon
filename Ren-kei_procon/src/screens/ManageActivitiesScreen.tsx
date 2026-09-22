import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { ChevronLeft, Plus, X, Camera, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../config/firebaseConfig';
import { subscribeRen, updateRenIcon, updateRenInfo } from '../repositories/renProfile';
import {
  subscribeRenActivities,
  createRenActivity,
  updateRenActivity,
  deleteRenActivity,
} from '../repositories/renActivities';
import { RenActivity } from '../types/firestore';
import * as ImagePicker from 'expo-image-picker';
import BottomNav from '../components/BottomNav';
import { colors } from '../theme/colors';

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
      (error) => console.error('連の基本情報の取得に失敗しました', error)
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
      }
    );
  }, [renId]);

  const pickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const res = await fetch(result.assets[0].uri);
      const blob = await res.blob();
      setDraftIconUrl(await updateRenIcon(renId, currentUser.uid, blob));
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'アイコンのアップロードに失敗しました');
    }
  };

  const handleSaveInfo = async () => {
    if (!draftName.trim()) return Alert.alert('エラー', '連の名前を入力してください');
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
    } catch (error) {
      console.error(error);
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
    if (!formTitle.trim()) return Alert.alert('エラー', '活動名を入力してください');
    const startAt = parseDateTime(formStartAt);
    if (!startAt) return Alert.alert('エラー', '開始日時は「YYYY-MM-DD HH:mm」の形式で入力してください');
    let endAt: Date | null = null;
    if (formEndAt.trim()) {
      const parsedEndAt = parseDateTime(formEndAt);
      if (!parsedEndAt) return Alert.alert('エラー', '終了日時は「YYYY-MM-DD HH:mm」の形式で入力してください');
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
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '活動情報の保存に失敗しました');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivity) return;
    try {
      await deleteRenActivity(renId, deletingActivity.id);
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '活動情報の削除に失敗しました');
    } finally {
      setDeletingActivity(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.gold} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>活動情報・連の管理</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.list}>
        <Text style={styles.sectionLabel}>連の基本情報</Text>
        {renInfo ? (
          <View style={styles.formCard}>
            <TouchableOpacity style={styles.iconPicker} onPress={pickIcon}>
              {draftIconUrl ? (
                <Image source={{ uri: draftIconUrl }} style={styles.iconImage} />
              ) : (
                <Camera size={22} color={colors.gold} />
              )}
            </TouchableOpacity>

            <Text style={styles.label}>連の名前</Text>
            <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>紹介</Text>
            <TextInput style={styles.textArea} value={draftDescription} onChangeText={setDraftDescription} multiline placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>活動地域</Text>
            <TextInput style={styles.input} value={draftLocation} onChangeText={setDraftLocation} placeholderTextColor={colors.textMuted} />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDraftBeginnerFriendly(!draftBeginnerFriendly)}>
              <View style={[styles.checkbox, draftBeginnerFriendly && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>初心者歓迎</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveInfo} disabled={savingInfo}>
              {savingInfo ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.saveBtnText}>基本情報を保存</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator color={colors.gold} style={{ marginBottom: 20 }} />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>活動スケジュール</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewActivityForm}>
            <Plus size={14} color={colors.gold} />
            <Text style={styles.addBtnText}>追加</Text>
          </TouchableOpacity>
        </View>

        {loadingActivities ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
        ) : activities.length === 0 ? (
          <Text style={styles.emptyText}>活動情報はまだありません</Text>
        ) : (
          activities.map((a) => (
            <View key={a.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{a.title}</Text>
                <Text style={styles.itemMeta}>
                  {formatDateTime(a.startAt)}{a.endAt ? ` 〜 ${formatDateTime(a.endAt)}` : ''}
                  {a.location ? ` ・ ${a.location}` : ''}
                </Text>
                {a.description ? <Text style={styles.itemBody}>{a.description}</Text> : null}
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEditActivityForm(a)}>
                  <Pencil size={16} color={colors.gold} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setDeletingActivity(a)}>
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
              <TouchableOpacity onPress={() => setEditingActivity(null)}>
                <X color={colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>活動名</Text>
              <TextInput style={styles.input} placeholder="例：夏祭り合同練習" placeholderTextColor={colors.textMuted} value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>開始日時(YYYY-MM-DD HH:mm)</Text>
              <TextInput style={styles.input} placeholder="2026-08-01 18:00" placeholderTextColor={colors.textMuted} value={formStartAt} onChangeText={setFormStartAt} />

              <Text style={styles.label}>終了日時(任意・同形式)</Text>
              <TextInput style={styles.input} placeholder="2026-08-01 20:00" placeholderTextColor={colors.textMuted} value={formEndAt} onChangeText={setFormEndAt} />

              <Text style={styles.label}>場所(任意)</Text>
              <TextInput style={styles.input} value={formLocation} onChangeText={setFormLocation} placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>説明(任意)</Text>
              <TextInput style={styles.textArea} value={formDescription} onChangeText={setFormDescription} multiline placeholderTextColor={colors.textMuted} />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveActivity} disabled={savingActivity}>
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
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setDeletingActivity(null)}>
                <Text style={styles.confirmCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteActivity}>
                <Text style={styles.confirmDeleteText}>削除する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: { height: 60, backgroundColor: colors.indigo, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: colors.indigoLine },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  list: { flex: 1, padding: 15 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginBottom: 10 },
  addBtnText: { color: colors.gold, fontWeight: 'bold', fontSize: 12, marginLeft: 3 },
  formCard: { backgroundColor: colors.indigo, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: 24 },
  iconPicker: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.indigoRaised, justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden', alignSelf: 'center' },
  iconImage: { width: 64, height: 64 },
  label: { fontSize: 13, fontWeight: 'bold', color: colors.gold, marginBottom: 8 },
  input: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 16, color: colors.textPrimaryOnIndigo },
  textArea: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 16, minHeight: 80, textAlignVertical: 'top', color: colors.textPrimaryOnIndigo },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.indigoLine, marginRight: 10 },
  checkboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkboxLabel: { fontSize: 14, color: colors.textPrimaryOnIndigo },
  saveBtn: { backgroundColor: colors.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: colors.textOnGold, fontWeight: 'bold', fontSize: 14 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  itemCard: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.indigoLine },
  itemTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  itemBody: { fontSize: 13, color: colors.textSecondaryOnIndigo, marginTop: 8, lineHeight: 20 },
  itemActions: { justifyContent: 'center', marginLeft: 10 },
  iconBtn: { padding: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.indigoDeep, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  confirmCard: { backgroundColor: colors.indigoDeep, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 16, padding: 24, width: '100%' },
  confirmTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 10 },
  confirmMessage: { fontSize: 14, color: colors.textSecondaryOnIndigo, lineHeight: 20, marginBottom: 24 },
  confirmActions: { flexDirection: 'row' },
  confirmCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.indigoRaised, marginRight: 8 },
  confirmCancelText: { color: colors.textPrimaryOnIndigo, fontWeight: 'bold', fontSize: 14 },
  confirmDeleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.aka, marginLeft: 8 },
  confirmDeleteText: { color: colors.textOnAka, fontWeight: 'bold', fontSize: 14 },
});
