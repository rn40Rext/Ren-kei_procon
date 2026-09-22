import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { subscribeAnnouncements, createAnnouncement } from '../repositories/renAnnouncements';
import { Announcement } from '../types/firestore';
import AppMenu from '../components/AppMenu';
import { colors } from '../theme/colors';

function formatDateTime(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ManageAnnouncementsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { renId } = route.params;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return subscribeAnnouncements(
      renId,
      (list) => {
        setAnnouncements(list);
        setLoading(false);
      },
      (error) => {
        console.error('お知らせの取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', 'お知らせの取得に失敗しました。時間をおいて再度お試しください');
      }
    );
  }, [renId]);

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      return Alert.alert('エラー', 'タイトルと本文を入力してください');
    }
    setSending(true);
    try {
      await createAnnouncement(renId, { title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      Alert.alert('完了', 'お知らせを配信しました');
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'お知らせの配信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.gold} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>お知らせ管理</Text>
        <AppMenu />
      </View>

      <ScrollView style={styles.list}>
        <View style={styles.formCard}>
          <Text style={styles.label}>タイトル(1〜100文字)</Text>
          <TextInput style={styles.input} placeholder="例：来週の練習について" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} maxLength={100} />

          <Text style={styles.label}>本文(1〜2000文字)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="お知らせの内容"
            placeholderTextColor={colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
            {sending ? (
              <ActivityIndicator color={colors.textOnGold} />
            ) : (
              <>
                <Send size={16} color={colors.textOnGold} />
                <Text style={styles.sendBtnText}>メンバーへ配信する</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>配信履歴</Text>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
        ) : announcements.length === 0 ? (
          <Text style={styles.emptyText}>まだお知らせはありません</Text>
        ) : (
          announcements.map((a) => (
            <View key={a.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{a.title}</Text>
              <Text style={styles.itemMeta}>{formatDateTime(a.createdAt)}</Text>
              <Text style={styles.itemBody}>{a.content}</Text>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: { height: 60, backgroundColor: colors.indigo, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: colors.indigoLine },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  list: { flex: 1, padding: 15 },
  formCard: { backgroundColor: colors.indigo, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: 'bold', color: colors.gold, marginBottom: 8 },
  input: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 16, color: colors.textPrimaryOnIndigo },
  textArea: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 16, minHeight: 100, textAlignVertical: 'top', color: colors.textPrimaryOnIndigo },
  sendBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: colors.textOnGold, fontWeight: 'bold', marginLeft: 8 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo, marginBottom: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  itemCard: { backgroundColor: colors.indigo, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.indigoLine },
  itemTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  itemBody: { fontSize: 13, color: colors.textSecondaryOnIndigo, marginTop: 8, lineHeight: 20 },
});
