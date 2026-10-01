/**
 * 連のお知らせ管理（配信フォーム・配信履歴）。
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { NarutoLoader } from '../components/motifs';
import AppMenu from '../components/AppMenu';
import { subscribeAnnouncements, createAnnouncement } from '../repositories/renAnnouncements';
import type { Announcement } from '../types/firestore';

/** Firestoreの日時を「2026/08/01 18:00」の形にする */
function formatDateTime(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 連の管理者が、メンバーへお知らせを配信し、配信履歴を確認する画面 */
export default function ManageAnnouncementsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // どの連のお知らせを管理するか(前の画面から受け取る)
  const { renId } = route.params;

  // 配信済みのお知らせ / 読み込み中か / 入力中のタイトルと本文 / 配信中か
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  // 連のお知らせをリアルタイム購読する
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

  /** お知らせを作成する */
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
      {/* ヘッダー: 戻るボタン・画面名・メニュー */}
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
        {/* 配信フォーム: タイトル・本文と「メンバーへ配信する」ボタン */}
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

        {/* 配信履歴。読み込み中・0件の場合は案内を出す */}
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
  // 画面全体の背景と、戻るボタン・画面名を並べるヘッダー
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

  // スクロール部分の余白
  list: { flex: 1, padding: spacing.lg },
  // お知らせの新規作成フォームを囲むカード
  formCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.indigoLine, marginBottom: spacing.xl },
  // 入力欄の見出し(金色)と、1行・複数行の入力欄
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
  // 配信ボタン(金色。配信中は薄くする)と、配信履歴の見出し・0件の案内
  sendBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { ...typography.button, color: colors.textOnGold, marginLeft: spacing.sm },
  sectionLabel: { ...typography.sectionLabel, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  // 送信済みのお知らせ1件分のカード
  itemCard: { backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.indigoLine },
  // お知らせカードの中のタイトル・配信日時・本文
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  itemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 10 },
  itemBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
});
