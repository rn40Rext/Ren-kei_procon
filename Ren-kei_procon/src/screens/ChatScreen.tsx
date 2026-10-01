/**
 * 1対1のチャット画面。相手とのメッセージをリアルタイムで表示して、送信もできる。
 * route.params で chatId(会話のID)と recipientName(相手の名前)を受け取る。
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Send, ChevronLeft } from 'lucide-react-native';
import { subscribeChatMessages, sendChatMessage } from '../repositories/chats';
import { useAuth } from '../hooks/useAuth';
import { HeaderSeam, KumihimoRule } from '../components/motifs';
import { IconMakimono } from '../components/awaIcons';
import { colors, spacing, radius, typography } from '../theme';
import type { ChatMessage } from '../types/firestore';

/** 2人の間でメッセージをやり取りする画面(仕様書にない、試作だけの機能) */
export default function ChatScreen({ route, navigation }: any) {
  // どの会話を開くか(会話ID)と相手の名前(前の画面から受け取る)
  const { chatId, recipientName } = route.params;
  const { uid } = useAuth();
  // メッセージの一覧(新しい順) / 入力中の文
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  // メッセージをリアルタイム購読(画面を離れたら解除)。chatIdが変わったら購読し直す
  useEffect(() => {
    return subscribeChatMessages(chatId, setMessages, (error) =>
      console.error('メッセージの取得に失敗しました', error)
    );
  }, [chatId]);

  // 空文字・未ログインの時は送らない。送信に成功したら入力欄を空にする
  const sendMessage = async () => {
    if (!inputText.trim() || !uid) return;
    await sendChatMessage(chatId, uid, inputText);
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー: 戻るボタンと「◯◯ さんとの連絡」 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft color={colors.gold} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{recipientName} さんとの連絡</Text>
      </View>
      <HeaderSeam />

      {/* inverted: 一覧を上下逆にして、新しいメッセージが画面の下に来るようにする。
          そのためメッセージは新しい順(最新が先頭)で渡す前提 */}
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.senderId === uid;
          return (
            // メッセージ1件分の吹き出し。自分の発言は右・金色、相手の発言は左・枠線
            <View style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>
              <Text style={mine ? styles.myText : styles.otherText}>{item.text}</Text>
            </View>
          );
        }}
        // メッセージが無い時は空状態を中央に出す。ある時は通常の余白
        contentContainerStyle={
          messages.length === 0
            ? { flexGrow: 1, justifyContent: 'center' }
            : { padding: spacing.lg }
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconMakimono size={30} color={colors.gold} />
            <Text style={styles.emptyText}>まだ言の葉は交わされていません</Text>
            <Text style={styles.emptySub}>下の欄から最初のひとことを送ってみましょう。</Text>
            <KumihimoRule width={32} style={{ marginTop: spacing.md }} />
          </View>
        }
      />

      {/* 入力欄がキーボードに隠れないようにする(iOSのみ。ヘッダー分の高さ100をずらす) */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        {/* 入力欄と送信ボタン */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="言の葉を届ける…"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            <Send color={colors.textOnGold} size={18} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  // 相手の名前(長いときは1行で省略)
  headerTitle: { ...typography.headingSerif, color: colors.textPrimary, flex: 1 },
  // FlatListが inverted で上下反転しているので、空状態の表示を逆さまにして元に戻す
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, transform: [{ scaleY: -1 }] },
  emptyText: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.md },
  emptySub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  // 1つ分の吹き出し。幅は画面の80%まで
  bubble: { maxWidth: '80%', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  // 自分の発言は右寄せ・金色の吹き出しにする
  myBubble: { alignSelf: 'flex-end', backgroundColor: colors.gold },
  // 相手の発言は左寄せ・枠線付きの吹き出しにする
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  myText: { ...typography.body, color: colors.textOnGold },
  otherText: { ...typography.body, color: colors.textPrimary },
  // 画面下部の入力欄エリア。入力欄と送信ボタンを横に並べる
  inputArea: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.indigoLine,
    alignItems: 'center',
    backgroundColor: colors.indigo,
  },
  // メッセージの入力欄
  input: {
    flex: 1,
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.textPrimary,
    ...typography.body,
  },
  // 送信ボタン(金色)
  sendBtn: {
    backgroundColor: colors.gold,
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
});
