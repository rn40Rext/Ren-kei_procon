import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft, Send } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../config/firebaseConfig';
import { addPostComment } from '../repositories/posts';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

const MAX_LENGTH = 1000;

// R-04: 連管理者が投稿へ指導者コメント(師匠の教え)を送る(#31)
export default function AdviceComposeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { postId, renId, postTitle, authorName, videoUrl } = route.params;

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return Alert.alert('エラー', 'アドバイスを入力してください');
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setSending(true);
    try {
      const userName = currentUser.email?.split('@')[0] || '匿名';
      await addPostComment(postId, {
        userId: currentUser.uid,
        userName,
        text: text.trim(),
        type: 'instructor',
        renId,
      });
      Alert.alert('完了', 'アドバイスを送信しました');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'アドバイスの送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={COLORS.primary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>アドバイスを送る</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.postCard}>
          <View style={styles.thumbWrapper}>
            <Video style={{ width: '100%', height: '100%' }} source={{ uri: videoUrl }} resizeMode={ResizeMode.COVER} shouldPlay={false} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.postTitle} numberOfLines={2}>{postTitle}</Text>
            <Text style={styles.authorName}>{authorName}</Text>
          </View>
        </View>

        <Text style={styles.label}>アドバイス内容(1〜{MAX_LENGTH}文字)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="足の運び方、姿勢、リズムなど気づいた点を伝えましょう"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_LENGTH}
        />
        <Text style={styles.counter}>{text.length} / {MAX_LENGTH}</Text>

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={16} color="#fff" />
              <Text style={styles.sendBtnText}>師匠の教えとして送信する</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: COLORS.border },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  content: { padding: 20 },
  postCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  thumbWrapper: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden' },
  postTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
  authorName: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  textArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, minHeight: 140, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 6, marginBottom: 20 },
  sendBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
});
