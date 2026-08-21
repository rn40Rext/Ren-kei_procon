import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MessageCircle, UserPlus, ChevronLeft } from 'lucide-react-native';
import { auth } from '../config/firebaseConfig';

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId, userName } = route.params;
  const currentUser = auth.currentUser;

  const startChat = (isScout: boolean) => {
    // チャットIDを作成 (小さいUID _ 大きいUID)
    const chatId = [currentUser?.uid, userId].sort().join('_');
    navigation.navigate('Chat', { 
      chatId, 
      recipientName: userName,
      initialMessage: isScout ? "【連への勧誘】私たちの連に参加しませんか？" : "" 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ChevronLeft color="#2563EB" />
        <Text style={{color:'#2563EB', fontWeight:'bold'}}>戻る</Text>
      </TouchableOpacity>

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>阿</Text></View>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.team}>所属：徳島連</Text>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.msgBtn} onPress={() => startChat(false)}>
            <MessageCircle color="#fff" size={20} />
            <Text style={styles.btnText}>メッセージを送る</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.msgBtn, {backgroundColor: '#10B981'}]} onPress={() => startChat(true)}>
            <UserPlus color="#fff" size={20} />
            <Text style={styles.btnText}>連に勧誘する</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileCard: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold' },
  team: { color: '#64748B', marginTop: 5 },
  actions: { marginTop: 30, width: '100%' },
  msgBtn: { backgroundColor: '#2563EB', flexDirection: 'row', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 }
});