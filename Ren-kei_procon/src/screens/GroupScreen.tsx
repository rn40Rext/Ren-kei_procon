import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { Users, MapPin, Plus, X, Shield, ChevronRight, Megaphone, CalendarDays, Search } from 'lucide-react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { createRen } from '../repositories/renProfile';
import { subscribeRenActivities } from '../repositories/renActivities';
import { subscribeAnnouncements } from '../repositories/renAnnouncements';
import { Announcement, RenActivity } from '../types/firestore';
import { useMyRens } from '../hooks/useMyRens';
import AppMenu from '../components/AppMenu';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';

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
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Group'>>();
  // 通知(type:'join_result')タップで来たとき、承認された連を選択した状態で開く(#44)
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
    const unsubActivities = subscribeRenActivities(
      selectedRenId,
      setActivities,
      (error) => console.error('活動情報の取得に失敗しました', error)
    );
    const unsubAnnouncements = subscribeAnnouncements(
      selectedRenId,
      setAnnouncements,
      (error) => console.error('お知らせの取得に失敗しました', error)
    );
    return () => {
      unsubActivities();
      unsubAnnouncements();
    };
  }, [selectedRenId]);

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert('エラー', '連の名前を入力してください');
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
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '連の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const selectedRen = myRens.find((r) => r.renId === selectedRenId) ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>マイ連</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateForm(true)}>
          <Plus size={16} color={colors.gold} />
          <Text style={styles.createBtnText}>連を作成</Text>
        </TouchableOpacity>
        <AppMenu />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
      ) : myRens.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>まだどの連にも所属していません</Text>
          <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Request')}>
            <Search size={18} color={colors.textOnGold} />
            <Text style={styles.searchBtnText}>連を探す</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {myRens.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcher} contentContainerStyle={{ paddingHorizontal: 15 }}>
              {myRens.map((r) => (
                <TouchableOpacity
                  key={r.renId}
                  style={[styles.switcherPill, r.renId === selectedRen?.renId && styles.switcherPillActive]}
                  onPress={() => setSelectedRenId(r.renId)}
                >
                  <Text style={[styles.switcherText, r.renId === selectedRen?.renId && styles.switcherTextActive]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {selectedRen && (
            <ScrollView contentContainerStyle={styles.content}>
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
                  <Text style={styles.renRowText}>メンバー {selectedRen.memberCount}人・自分の役割: {selectedRen.role === 'admin' ? '管理者' : 'メンバー'}</Text>
                </View>

                {selectedRen.role === 'admin' && (
                  <TouchableOpacity style={styles.adminLink} onPress={() => navigation.navigate('AdminHome')}>
                    <Shield size={16} color={colors.gold} />
                    <Text style={styles.adminLinkText}>連の管理へ</Text>
                    <ChevronRight size={16} color={colors.gold} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.sectionHeader}>
                <CalendarDays size={16} color={colors.textPrimaryOnIndigo} />
                <Text style={styles.sectionLabel}>活動情報</Text>
              </View>
              {activities.length === 0 ? (
                <Text style={styles.sectionEmptyText}>活動情報はまだありません</Text>
              ) : (
                activities.map((a) => (
                  <View key={a.id} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{a.title}</Text>
                    <Text style={styles.itemMeta}>
                      {formatDateTime(a.startAt)}{a.endAt ? ` 〜 ${formatDateTime(a.endAt)}` : ''}
                      {a.location ? ` ・ ${a.location}` : ''}
                    </Text>
                    {a.description ? <Text style={styles.itemBody}>{a.description}</Text> : null}
                  </View>
                ))
              )}

              <View style={styles.sectionHeader}>
                <Megaphone size={16} color={colors.textPrimaryOnIndigo} />
                <Text style={styles.sectionLabel}>お知らせ</Text>
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
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={showCreateForm} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.indigoDeep }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>連を作成する</Text>
            <TouchableOpacity onPress={() => setShowCreateForm(false)}>
              <X color={colors.textMuted} size={22} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.label}>連の名前</Text>
            <TextInput style={styles.input} placeholder="例：徳島連" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

            <Text style={styles.label}>紹介</Text>
            <TextInput style={styles.textArea} placeholder="連の紹介文" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />

            <Text style={styles.label}>活動地域</Text>
            <TextInput style={styles.input} placeholder="例：徳島県徳島市" placeholderTextColor={colors.textMuted} value={location} onChangeText={setLocation} />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setBeginnerFriendly(!beginnerFriendly)}>
              <View style={[styles.checkbox, beginnerFriendly && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>初心者歓迎</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
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
  header: { height: 60, backgroundColor: colors.indigo, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.indigoLine },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  createBtnText: { color: colors.gold, fontWeight: 'bold', fontSize: 12, marginLeft: 4 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginBottom: 20 },
  searchBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  searchBtnText: { color: colors.textOnGold, fontWeight: 'bold', marginLeft: 8 },

  switcher: { backgroundColor: colors.indigo, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.indigoLine },
  switcherPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.indigoRaised, marginRight: 8 },
  switcherPillActive: { backgroundColor: colors.gold },
  switcherText: { fontSize: 13, color: colors.textSecondaryOnIndigo },
  switcherTextActive: { color: colors.textOnGold, fontWeight: 'bold' },

  content: { padding: 20, paddingBottom: 120 },
  renCard: { backgroundColor: colors.indigo, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: 24 },
  renName: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 8 },
  renDescription: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 20 },
  renRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  renRowText: { marginLeft: 8, fontSize: 13, color: colors.textSecondaryOnIndigo },
  adminLink: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.indigoLine },
  adminLinkText: { flex: 1, marginLeft: 8, color: colors.gold, fontWeight: 'bold', fontSize: 13 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginLeft: 8 },
  sectionEmptyText: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  itemCard: { backgroundColor: colors.indigo, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.indigoLine },
  itemTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  itemBody: { fontSize: 13, color: colors.textSecondaryOnIndigo, marginTop: 8, lineHeight: 20 },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: colors.indigoLine },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  formContent: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: 'bold', color: colors.gold, marginBottom: 8 },
  input: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 20, color: colors.textPrimaryOnIndigo },
  textArea: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 20, minHeight: 80, textAlignVertical: 'top', color: colors.textPrimaryOnIndigo },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.indigoLine, marginRight: 10 },
  checkboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkboxLabel: { fontSize: 14, color: colors.textPrimaryOnIndigo },
  submitBtn: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: colors.textOnGold, fontWeight: 'bold', fontSize: 16 },
});
