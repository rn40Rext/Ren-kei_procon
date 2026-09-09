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
import { db, auth } from '../config/firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { colors, spacing, radius, typography } from '../theme';

export default function ChatScreen({ route, navigation }: any) {
  const { chatId, recipientName } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [chatId]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: inputText,
      senderId: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
    });
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft color={colors.gold} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{recipientName} さんとの連絡</Text>
      </View>

      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.senderId === auth.currentUser?.uid;
          return (
            <View style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>
              <Text style={mine ? styles.myText : styles.otherText}>{item.text}</Text>
            </View>
          );
        }}
        contentContainerStyle={{ padding: spacing.lg }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
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
  headerTitle: { ...typography.headingSerif, color: colors.textPrimary, flex: 1 },
  bubble: { maxWidth: '80%', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  myBubble: { alignSelf: 'flex-end', backgroundColor: colors.gold },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  myText: { ...typography.body, color: colors.textOnGold },
  otherText: { ...typography.body, color: colors.textPrimary },
  inputArea: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.indigoLine,
    alignItems: 'center',
    backgroundColor: colors.indigo,
  },
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
