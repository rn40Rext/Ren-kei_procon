import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MessageCircle, UserPlus, ChevronLeft } from 'lucide-react-native';
import { auth } from '../config/firebaseConfig';
import { colors } from '../theme/colors';

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId, userName } = route.params;
  const currentUser = auth.currentUser;
  const isSelf = currentUser?.uid === userId;

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
        <ChevronLeft color={colors.gold} />
        <Text style={{ color: colors.gold, fontWeight: 'bold' }}>戻る</Text>
      </TouchableOpacity>

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>阿</Text></View>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.team}>所属：徳島連</Text>

        {isSelf ? (
          <Text style={styles.selfNote}>これはあなた自身のプロフィールです</Text>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.msgBtn} onPress={() => startChat(false)}>
              <MessageCircle color={colors.textOnGold} size={20} />
              <Text style={styles.btnText}>メッセージを送る</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.msgBtn, styles.scoutBtn]} onPress={() => startChat(true)}>
              <UserPlus color={colors.textOnAka} size={20} />
              <Text style={styles.scoutBtnText}>連に勧誘する</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep, padding: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileCard: { backgroundColor: colors.indigo, borderWidth: 1, borderColor: colors.indigoLine, padding: 30, borderRadius: 20, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: colors.gold, fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimaryOnIndigo },
  team: { color: colors.textMuted, marginTop: 5 },
  actions: { marginTop: 30, width: '100%' },
  selfNote: { marginTop: 30, color: colors.textMuted, fontSize: 13 },
  msgBtn: { backgroundColor: colors.gold, flexDirection: 'row', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  scoutBtn: { backgroundColor: colors.aka },
  btnText: { color: colors.textOnGold, fontWeight: 'bold', marginLeft: 10 },
  scoutBtnText: { color: colors.textOnAka, fontWeight: 'bold', marginLeft: 10 }
});
