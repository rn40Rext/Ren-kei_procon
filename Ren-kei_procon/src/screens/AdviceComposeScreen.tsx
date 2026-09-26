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

const MAX_LENGTH = 1000;

export default function AdviceComposeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { postId, renId, postTitle, authorName, videoUrl } = route.params;

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

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

  content: { padding: spacing.xl },
  postCard: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.indigoLine },
  thumbWrapper: { width: 70, height: 70, borderRadius: radius.sm, backgroundColor: '#000', overflow: 'hidden' },
  postTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  authorName: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
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
  counter: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: 6, marginBottom: spacing.xl },
  sendBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: colors.textOnGold, fontWeight: '700', marginLeft: spacing.sm },
});
