/**
 * 連管理者が投稿へ指導者コメント（師匠の教え）を送る。
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { addComment } from '../repositories/posts';

/** アドバイスの最大文字数 */
const MAX_LENGTH = 1000;

/** 連の管理者が、メンバーの投稿動画に「師匠の教え」としてアドバイスを書いて送る画面 */
export default function AdviceComposeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // どの投稿に送るか、と画面上部に出す投稿の情報(前の画面から受け取る)
  const { postId, renId, postTitle, authorName, videoUrl } = route.params;

  // 入力中のアドバイス / 送信中か
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  /** 指導者コメント(type:'instructor')を投稿に送信する */
  const handleSend = async () => {
    if (!text.trim()) {
      Alert.alert('エラー', 'アドバイスを入力してください');
      return;
    }
    setSending(true);
    try {
      await addComment(postId, { text: text.trim(), type: 'instructor', renId });
      Alert.alert('完了', 'アドバイスを送信しました');
      navigation.goBack();
    } catch {
      Alert.alert('エラー', 'アドバイスの送信に失敗しました');
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
        <Text style={styles.headerTitle}>アドバイスを送る</Text>
        <View style={{ flex: 1 }} />
        <AppMenu />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* アドバイスを送る投稿(動画のサムネイル・題名・投稿者) */}
        <View style={styles.postCard}>
          <View style={styles.thumbWrapper}>
            <RenkeiVideo uri={videoUrl} style={{ width: '100%', height: '100%' }} contentFit="cover" muted />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.postTitle} numberOfLines={2}>
              {postTitle}
            </Text>
            <Text style={styles.authorName}>{authorName}</Text>
          </View>
        </View>

        {/* アドバイスの入力欄と文字数 */}
        <Text style={styles.label}>
          アドバイス内容（1〜{MAX_LENGTH}文字）
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="足の運び方、姿勢、リズムなど気づいた点を伝えましょう"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_LENGTH}
        />
        <Text style={styles.counter}>
          {text.length} / {MAX_LENGTH}
        </Text>

        {/* 送信ボタン(送信中はくるくる) */}
        <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
          {sending ? (
            <ActivityIndicator color={colors.textOnGold} />
          ) : (
            <>
              <Send size={16} color={colors.textOnGold} />
              <Text style={styles.sendBtnText}>師匠の教えとして送信する</Text>
            </>
          )}
        </TouchableOpacity>
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
  content: { padding: spacing.xl },
  // コメントを送る対象の投稿を、サムネイルとタイトルで示すカード
  postCard: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.indigoLine },
  // 投稿カードの中の動画サムネイル(正方形)・題名・投稿者名
  thumbWrapper: { width: 70, height: 70, borderRadius: radius.sm, backgroundColor: '#000', overflow: 'hidden' },
  postTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  authorName: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  // 入力欄の見出し(金色)と、複数行の入力欄
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  textArea: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 140,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
  // 入力欄の右下の文字数と、送信ボタン(金色。送信中は薄くする)
  counter: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: 6, marginBottom: spacing.xl },
  sendBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: colors.textOnGold, fontWeight: '700', marginLeft: spacing.sm },
});
