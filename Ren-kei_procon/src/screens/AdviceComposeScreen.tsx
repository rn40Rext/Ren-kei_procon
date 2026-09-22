import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft, Send } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../config/firebaseConfig';
import { addPostComment } from '../repositories/posts';
import { colors } from '../theme/colors';

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
          <ChevronLeft color={colors.gold} size={24} />
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
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_LENGTH}
        />
        <Text style={styles.counter}>{text.length} / {MAX_LENGTH}</Text>

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
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
  header: { height: 60, backgroundColor: colors.indigo, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: colors.indigoLine },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  content: { padding: 20 },
  postCard: { flexDirection: 'row', backgroundColor: colors.indigo, borderRadius: 14, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.indigoLine },
  thumbWrapper: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden' },
  postTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  authorName: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: 'bold', color: colors.gold, marginBottom: 8 },
  textArea: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, minHeight: 140, textAlignVertical: 'top', color: colors.textPrimaryOnIndigo },
  counter: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 6, marginBottom: 20 },
  sendBtn: { flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: colors.textOnGold, fontWeight: 'bold', marginLeft: 8 },
});
