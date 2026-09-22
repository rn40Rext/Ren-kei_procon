/**
 * 連のお知らせ管理（配信フォーム・配信履歴）。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import { subscribeAnnouncements, createAnnouncement } from '../repositories/renAnnouncements';
import type { Announcement } from '../types/firestore';

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
      },
    );
  }, [renId]);

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('エラー', 'タイトルと本文を入力してください');
      return;
    }
    setSending(true);
    try {
      await createAnnouncement(renId, { title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      Alert.alert('完了', 'お知らせを配信しました');
    } catch {
      Alert.alert('エラー', 'お知らせの配信に失敗しました');
    } finally {
      setSending(false);
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
        <Text style={styles.headerTitle}>お知らせ管理</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.label}>タイトル（1〜100文字）</Text>
          <TextInput
            style={styles.input}
            placeholder="例：来週の練習について"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>本文（1〜2000文字）</Text>
          <TextInput
            style={styles.textArea}
            placeholder="お知らせの内容"
            placeholderTextColor={colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
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
          <NarutoLoader size={22} color={colors.gold} style={{ marginTop: spacing.lg, alignSelf: 'center' }} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { marginRight: spacing.sm },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 17 },

  list: { flex: 1, padding: spacing.lg },
  formCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: spacing.xl },
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
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
  sendBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { ...typography.button, color: colors.textOnGold, marginLeft: spacing.sm },
  sectionLabel: { ...typography.sectionLabel, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  itemCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.indigoLine },
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  itemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 10 },
  itemBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
});
