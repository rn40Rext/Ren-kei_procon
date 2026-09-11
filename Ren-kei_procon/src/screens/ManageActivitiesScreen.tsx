import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { ChevronLeft, Plus, X, Camera, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db, storage } from '../config/firebaseConfig';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
};

// docs/design/data-model.md 3.8章
interface RenInfo {
  name: string;
  description: string;
  location: string;
  beginnerFriendly: boolean;
  iconUrl: string;
}

// docs/design/data-model.md 3.11章(仕様書9.3 RenActivities)
interface Activity {
  id: string;
  title: string;
  description?: string;
  startAt: any;
  endAt?: any;
  location?: string;
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

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [editingActivity, setEditingActivity] = useState<Activity | 'new' | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartAt, setFormStartAt] = useState('');
  const [formEndAt, setFormEndAt] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'ren', renId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const info: RenInfo = {
        name: data.name ?? '',
        description: data.description ?? '',
        location: data.location ?? '',
        beginnerFriendly: !!data.beginnerFriendly,
        iconUrl: data.iconUrl ?? '',
      };
      setRenInfo(info);
      setDraftName(info.name);
      setDraftDescription(info.description);
      setDraftLocation(info.location);
      setDraftBeginnerFriendly(info.beginnerFriendly);
      setDraftIconUrl(info.iconUrl);
    });
  }, [renId]);

  useEffect(() => {
    const q = query(collection(db, 'ren', renId, 'activities'), orderBy('startAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)));
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
    try {
      const res = await fetch(result.assets[0].uri);
      const blob = await res.blob();
      const iconRef = ref(storage, `ren/${renId}/icon/${Date.now()}.jpg`);
      await uploadBytes(iconRef, blob);
      const url = await getDownloadURL(iconRef);
      setDraftIconUrl(url);
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'アイコンのアップロードに失敗しました');
    }
  };

  const handleSaveInfo = async () => {
    if (!draftName.trim()) return Alert.alert('エラー', '連の名前を入力してください');
    setSavingInfo(true);
    try {
      await updateDoc(doc(db, 'ren', renId), {
        name: draftName.trim(),
        description: draftDescription.trim(),
        location: draftLocation.trim(),
        beginnerFriendly: draftBeginnerFriendly,
        iconUrl: draftIconUrl,
        updatedAt: serverTimestamp(),
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

  const openEditActivityForm = (activity: Activity) => {
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
        await addDoc(collection(db, 'ren', renId, 'activities'), payload);
      } else if (editingActivity) {
        await updateDoc(doc(db, 'ren', renId, 'activities', editingActivity.id), payload);
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
      await deleteDoc(doc(db, 'ren', renId, 'activities', deletingActivity.id));
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
          <ChevronLeft color={COLORS.primary} size={24} />
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
                <Camera size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>

            <Text style={styles.label}>連の名前</Text>
            <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} />

            <Text style={styles.label}>紹介</Text>
            <TextInput style={styles.textArea} value={draftDescription} onChangeText={setDraftDescription} multiline />

            <Text style={styles.label}>活動地域</Text>
            <TextInput style={styles.input} value={draftLocation} onChangeText={setDraftLocation} />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDraftBeginnerFriendly(!draftBeginnerFriendly)}>
              <View style={[styles.checkbox, draftBeginnerFriendly && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>初心者歓迎</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveInfo} disabled={savingInfo}>
              {savingInfo ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>基本情報を保存</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator style={{ marginBottom: 20 }} />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>活動スケジュール</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewActivityForm}>
            <Plus size={14} color={COLORS.primary} />
            <Text style={styles.addBtnText}>追加</Text>
          </TouchableOpacity>
        </View>

        {loadingActivities ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
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
                  <Pencil size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setDeletingActivity(a)}>
                  <Trash2 size={16} color={COLORS.danger} />
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
                <X color={COLORS.textMain} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>活動名</Text>
              <TextInput style={styles.input} placeholder="例：夏祭り合同練習" value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>開始日時(YYYY-MM-DD HH:mm)</Text>
              <TextInput style={styles.input} placeholder="2026-08-01 18:00" value={formStartAt} onChangeText={setFormStartAt} />

              <Text style={styles.label}>終了日時(任意・同形式)</Text>
              <TextInput style={styles.input} placeholder="2026-08-01 20:00" value={formEndAt} onChangeText={setFormEndAt} />

              <Text style={styles.label}>場所(任意)</Text>
              <TextInput style={styles.input} value={formLocation} onChangeText={setFormLocation} />

              <Text style={styles.label}>説明(任意)</Text>
              <TextInput style={styles.textArea} value={formDescription} onChangeText={setFormDescription} multiline />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveActivity} disabled={savingActivity}>
                {savingActivity ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>保存する</Text>}
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: COLORS.border },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  list: { flex: 1, padding: 15 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginBottom: 10 },
  addBtnText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12, marginLeft: 3 },
  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  iconPicker: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden', alignSelf: 'center' },
  iconImage: { width: 64, height: 64 },
  label: { fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 16 },
  textArea: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, marginRight: 10 },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxLabel: { fontSize: 14, color: COLORS.textMain },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 20 },
  itemCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  itemTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
  itemMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  itemBody: { fontSize: 13, color: COLORS.textMain, marginTop: 8, lineHeight: 20 },
  itemActions: { justifyContent: 'center', marginLeft: 10 },
  iconBtn: { padding: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  confirmCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  confirmTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
  confirmMessage: { fontSize: 14, color: COLORS.textMain, lineHeight: 20, marginBottom: 24 },
  confirmActions: { flexDirection: 'row' },
  confirmCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1F5F9', marginRight: 8 },
  confirmCancelText: { color: COLORS.textMain, fontWeight: 'bold', fontSize: 14 },
  confirmDeleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.danger, marginLeft: 8 },
  confirmDeleteText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
