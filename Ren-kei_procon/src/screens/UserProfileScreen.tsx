import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MessageCircle, UserPlus, ChevronLeft } from 'lucide-react-native';
import { auth } from '../config/firebaseConfig';
import { colors, spacing, radius, typography } from '../theme';
import { RenMon } from '../components/motifs';

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId, userName } = route.params;
  const currentUser = auth.currentUser;
  const isSelf = currentUser?.uid === userId;

  const startChat = (isScout: boolean) => {
    // チャットID（小さいUID _ 大きいUID）
    const chatId = [currentUser?.uid, userId].sort().join('_');
    navigation.navigate('Chat', {
      chatId,
      recipientName: userName,
      initialMessage: isScout ? '【連へのお誘い】うちの連の稽古に一度いらっしゃいませんか。' : '',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <ChevronLeft color={colors.gold} size={22} />
        <Text style={styles.backText}>戻る</Text>
      </TouchableOpacity>

      <View style={styles.profileCard}>
        <RenMon size={80} color={colors.gold}>
          <Text style={styles.avatarChar}>{(userName || '阿').slice(0, 1)}</Text>
        </RenMon>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.team}>所属：徳島連</Text>

        {isSelf ? (
          <Text style={styles.selfNote}>これはあなた自身のプロフィールです</Text>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.msgBtn} onPress={() => startChat(false)} activeOpacity={0.85}>
              <MessageCircle color={colors.textOnGold} size={18} />
              <Text style={styles.btnText}>　言の葉を届ける</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scoutBtn} onPress={() => startChat(true)} activeOpacity={0.85}>
              <UserPlus color={colors.textOnAka} size={18} />
              <Text style={styles.scoutBtnText}>　連にお誘いする</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep, padding: spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
  profileCard: {
    backgroundColor: colors.indigo,
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    alignItems: 'center',
  },
  avatarChar: { color: colors.gold, fontSize: 30, fontFamily: typography.titleSerif.fontFamily, fontWeight: '700' },
  name: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  team: { ...typography.caption, color: colors.gold, marginTop: spacing.xs },
  actions: { marginTop: spacing.xl, width: '100%' },
  selfNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xl },
  msgBtn: {
    backgroundColor: colors.gold,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnText: { ...typography.button, color: colors.textOnGold },
  scoutBtn: {
    backgroundColor: colors.akaSoft,
    borderWidth: 1,
    borderColor: colors.aka,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoutBtnText: { ...typography.button, color: colors.aka },
});
