import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Send, ChevronLeft } from 'lucide-react-native';
import { db, auth } from '../config/firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

export default function ChatScreen({ route, navigation }: any) {
  const { chatId, recipientName } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ChevronLeft color="#2563EB" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{recipientName} さんとの連絡</Text>
      </View>

      <FlatList
        data={messages}
        inverted
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={[styles.bubble, item.senderId === auth.currentUser?.uid ? styles.myBubble : styles.otherBubble]}>
            <Text style={item.senderId === auth.currentUser?.uid ? styles.myText : styles.otherText}>{item.text}</Text>
          </View>
        )}
        contentContainerStyle={{padding: 20}}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <View style={styles.inputArea}>
          <TextInput style={styles.input} value={inputText} onChangeText={setInputText} placeholder="メッセージを入力..." />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}><Send color="#fff" size={20} /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#2563EB' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9' },
  myText: { color: '#fff' },
  otherText: { color: '#1E293B' },
  inputArea: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 25, paddingHorizontal: 20, height: 45 },
  sendBtn: { backgroundColor: '#2563EB', width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});