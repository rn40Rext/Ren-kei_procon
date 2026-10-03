import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MessageCircle, UserPlus, ChevronLeft } from 'lucide-react-native';
import { auth } from '../config/firebaseConfig';
import { colors, spacing, radius, typography } from '../theme';
import { RenMon } from '../components/motifs';

// 他のユーザーのプロフィール画面。名前とアイコンを表示し、自分自身のページでなければ
// 「メッセージを送る」「連にお誘いする」の2つのボタンを出す。
export default function UserProfileScreen({ route, navigation }: any) {
  // 前の画面から渡される、表示対象ユーザーのIDと表示名
  const { userId, userName } = route.params;
  const currentUser = auth.currentUser;
  // 表示中のプロフィールが自分自身のものかどうか。自分自身には
  // メッセージ・お誘いのボタンを出さないようにするために使う
  const isSelf = currentUser?.uid === userId;

  // 相手とのチャット画面を開く。isScoutがtrueのときは「連へのお誘い」用の
  // 定型文を、入力欄にあらかじめ入れた状態で開く。
  const startChat = (isScout: boolean) => {
    // チャットの部屋ID(chatId)を決める。自分と相手、2人のUIDを文字列として
    // 昇順に並べ、"_"でつなげて1つの文字列にする。
    // こうすることで、どちらが先に話しかけても同じchatIdになり、
    // 2人が別々のチャットを作ってしまうことを防げる。
    const chatId = [currentUser?.uid, userId].sort().join('_');
    // チャット画面へ移動する。チャットID・相手の表示名・入力欄に最初から
    // 入れておく文章(isScoutがtrueなら定型のお誘い文、falseなら空)を渡す。
    navigation.navigate('Chat', {
      chatId,
      recipientName: userName,
      initialMessage: isScout ? '【連へのお誘い】うちの連の稽古に一度いらっしゃいませんか。' : '',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 「戻る」ボタン。押すと前の画面に戻る */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <ChevronLeft color={colors.gold} size={22} />
        <Text style={styles.backText}>戻る</Text>
      </TouchableOpacity>

      <View style={styles.profileCard}>
        {/* アイコンの代わりに、表示名の先頭1文字を丸い枠の中に表示する。
            表示名が空のときは代わりに「阿」の字を表示する */}
        <RenMon size={80} color={colors.gold}>
          <Text style={styles.avatarChar}>{(userName || '阿').slice(0, 1)}</Text>
        </RenMon>
        <Text style={styles.name}>{userName}</Text>

        {isSelf ? (
          // 自分自身のプロフィールを見ているときは、ボタンの代わりに案内文だけを出す
          <Text style={styles.selfNote}>これはあなた自身のプロフィールです</Text>
        ) : (
          <View style={styles.actions}>
            {/* 押すと、定型文なしでチャット画面を開く */}
            <TouchableOpacity style={styles.msgBtn} onPress={() => startChat(false)} activeOpacity={0.85}>
              <MessageCircle color={colors.textOnGold} size={18} />
              <Text style={styles.btnText}>　言の葉を届ける</Text>
            </TouchableOpacity>
            {/* 押すと、お誘いの定型文を入れた状態でチャット画面を開く */}
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
  // 画面全体。濃い藍色の背景いっぱいに広げ、周りに余白を取る
  container: { flex: 1, backgroundColor: colors.indigoDeep, padding: spacing.lg },
  // 「戻る」ボタン。矢印アイコンと文字を横に並べる
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
  // プロフィール情報をまとめて囲むカード。角を丸め、薄い線で枠を付け、中の要素を中央寄せにする
  profileCard: {
    backgroundColor: colors.indigo,
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    alignItems: 'center',
  },
  // 丸いアイコン枠(RenMon)の中に表示する、名前の頭文字
  avatarChar: { color: colors.gold, fontSize: 30, fontFamily: typography.titleSerif.fontFamily, fontWeight: '700' },
  // 名前(明朝体)と所属連(金色の小さな文字)
  name: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  // ボタン(または案内文)を置くエリア。カードの横幅いっぱいに広げる
  actions: { marginTop: spacing.xl, width: '100%' },
  // 自分自身のプロフィールを見ているときに出す案内文
  selfNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xl },
  // 「メッセージを送る」ボタン。金色の背景で、アイコンと文字を横に並べて中央に置く
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
  // 「連にお誘いする」ボタン。茜色の枠線を付け、メッセージボタンと見た目を区別する
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
