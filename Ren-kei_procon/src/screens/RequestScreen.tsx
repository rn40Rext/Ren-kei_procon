import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../utils/alert';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, Send, UserPlus, Check, Trash2, MessageCircle } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { Badge, Chip } from '../components/ui';
import ScreenHeader from '../components/ScreenHeader';
import UserAvatar from '../components/UserAvatar';
import { NarutoLoader } from '../components/motifs';
import { IconUchiwa, categoryIcon } from '../components/awaIcons';
import { auth } from '../config/firebaseConfig';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  subscribeOtherDancers,
  subscribeSentInvitations,
  subscribeReceivedInvitations,
  sendInvitation,
  respondToInvitation,
  cancelInvitation,
  type OtherDancer,
  type InvitationDoc,
} from '../data/invitations';

/** 「気になる踊り手」を踊りの種類で絞り込むチップの選択肢 */
const STYLE_FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'male', label: '男踊り' },
  { key: 'female', label: '女踊り' },
] as const;
type StyleFilter = (typeof STYLE_FILTERS)[number]['key'];

/** 画面上部の3つのタブ(気になる踊り手/送ったお誘い/届いたお誘い) */
type Tab = 'scout' | 'sent' | 'received';

/** お誘いの状態の表示名 */
type InviteStatus = '返答待ち' | '承諾' | '辞退';

/** お誘いの状態ごとのバッジの色(返答待ち=枠線、承諾=金、辞退=朱) */
const STATUS_TONE: Record<InviteStatus, 'gold' | 'aka' | 'outline'> = {
  返答待ち: 'outline',
  承諾: 'gold',
  辞退: 'aka',
};

/** Firestore に保存されている状態(英語)を画面表示用の日本語に変える */
const REAL_STATUS_LABEL: Record<InvitationDoc['status'], InviteStatus> = {
  pending: '返答待ち',
  accepted: '承諾',
  declined: '辞退',
};

/** 踊りの種類の表示名 */
const DANCE_LABEL: Record<'male' | 'female', string> = { male: '男踊り', female: '女踊り' };

/** 送った時刻を「◯分前」「◯時間前」「◯日前」の形にする */
function timeAgo(ms: number | null): string {
  if (ms == null) return 'たった今';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'たった今';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;
  return `${Math.floor(diff / 86_400_000)}日前`;
}

/** お誘いの送り先(アプリに登録している実在の踊り手) */
type InviteTarget = { id: string; name: string; meta: string };

/** お誘い先の表示名 */
function targetDisplayName(t: InviteTarget | null): string {
  return t ? t.name : '';
}

/** お誘い先の補足情報(踊りの種類など) */
function targetDisplayMeta(t: InviteTarget | null): string {
  if (!t) return '';
  return t.meta || '踊り手';
}

/**
 * リクエスト画面(U-07)。未所属の踊り手を見つけて連に招く「お誘い」機能。
 * scout(見つける)/sent(送信済み)/received(受信)の3タブ構成。
 * 同じアプリに登録している踊り手(users)と、お誘い(invitations)の実データを扱う(data/invitations.ts参照)。
 */
export default function RequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Request'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Request'>>();
  // 表示中のタブ / お誘い文を書いている相手(null ならダイアログを閉じる) / お誘い文 / 送信中か
  // 応答・取り消しの処理中のお誘いID(ボタンを二重に押せないようにする)
  const [tab, setTab] = useState<Tab>(route.params?.tab === 'received' ? 'received' : 'scout');
  // 通知から来たとき(画面が開いたままでも)、「届いた」タブへ切り替える
  useEffect(() => {
    if (route.params?.tab === 'received') setTab('received');
  }, [route.params?.tab]);
  const [target, setTarget] = useState<InviteTarget | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // 気になる踊り手の絞り込み
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');

  // 実データ：同じアプリの踊り手・送受信したお誘い
  const [otherDancers, setOtherDancers] = useState<OtherDancer[]>([]);
  const [dancersLoaded, setDancersLoaded] = useState(false);
  const [sentReal, setSentReal] = useState<InvitationDoc[]>([]);
  const [receivedReal, setReceivedReal] = useState<InvitationDoc[]>([]);

  // 画面を開いている間、他の踊り手・自分が送ったお誘い・自分に届いたお誘いをリアルタイム購読する
  useEffect(() => {
    const unsub1 = subscribeOtherDancers(
      (list) => {
        setOtherDancers(list);
        setDancersLoaded(true);
      },
      (e) => {
        console.warn('subscribeOtherDancers', e);
        setDancersLoaded(true);
      },
    );
    const unsub2 = subscribeSentInvitations(setSentReal, (e) => console.warn('subscribeSentInvitations', e));
    const unsub3 = subscribeReceivedInvitations(setReceivedReal, (e) => console.warn('subscribeReceivedInvitations', e));
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  /** 実在ユーザーのカードから「お誘い」ダイアログを開き、定型文を入れておく */
  const openRealInvite = (d: OtherDancer) => {
    setTarget({ id: d.id, name: d.name, meta: d.danceStyle ? DANCE_LABEL[d.danceStyle] : '' });
    setMessage(`${d.name}さん、いつも演舞を拝見しています。うちの連の稽古に一度いらっしゃいませんか。`);
  };

  // お誘いの前後でも直接やり取りできるよう、既存の1対1チャットに繋ぐ（DM）
  const chatWith = (otherUid: string, otherName: string) => {
    const myUid = auth.currentUser?.uid;
    if (!myUid) return;
    if (otherUid === myUid) return;
    const chatId = [myUid, otherUid].sort().join('_');
    navigation.navigate('Chat', { chatId, recipientName: otherName });
  };

  /** お誘いを送信する(Firestore の invitations に保存する) */
  const submitInvite = async () => {
    if (!target || !message.trim() || sending) return;

    setSending(true);
    try {
      await sendInvitation({ toUserId: target.id, toUserName: target.name, message });
      setTarget(null);
      setMessage('');
      setTab('sent');
    } catch (e: any) {
      Alert.alert('送信に失敗しました', e?.message ?? '時間をおいて再度お試しください。');
    } finally {
      setSending(false);
    }
  };

  /** 受信したお誘いに承諾/辞退で応答する */
  const respond = async (id: string, status: 'accepted' | 'declined') => {
    if (respondingId) return;
    setRespondingId(id);
    try {
      await respondToInvitation(id, status);
    } catch (e: any) {
      Alert.alert('エラー', '応答の送信に失敗しました。');
    } finally {
      setRespondingId(null);
    }
  };

  /** 送ったお誘いを、確認ダイアログの後に取り消す */
  const cancel = (id: string) => {
    Alert.alert('お誘いを取り消しますか？', 'この操作は取り消せません。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '取り消す',
        style: 'destructive',
        onPress: async () => {
          setCancelingId(id);
          try {
            await cancelInvitation(id);
          } catch (e: any) {
            Alert.alert('エラー', '取り消しに失敗しました。');
          } finally {
            setCancelingId(null);
          }
        },
      },
    ]);
  };

  // すでにお誘いを送った相手(「お誘い済み」表示に使う)と、まだ返事をしていない届いたお誘いの数
  const invitedRealIds = new Set(sentReal.map((i) => i.toUserId));
  const pendingReceivedCount = receivedReal.filter((i) => i.status === 'pending').length;

  // 検索キーワード(大文字・小文字を区別しない)
  const q = search.trim().toLowerCase();
  // プロフィールを書いている人ほど「声を掛けてほしい」意思が明確なので上に出す
  const profileCompleteness = (d: OtherDancer) =>
    (d.profile.trim() ? 1 : 0) + (d.danceStyle ? 1 : 0) + (d.icon ? 1 : 0);
  // 実在ユーザーを、踊りの種類とキーワードで絞り込み、プロフィールが充実している順に並べる
  const filteredOtherDancers = useMemo(
    () =>
      otherDancers
        .filter((d) => {
          const styleOk = styleFilter === 'all' || d.danceStyle === styleFilter;
          const searchOk = !q || d.name.toLowerCase().includes(q) || d.profile.toLowerCase().includes(q);
          return styleOk && searchOk;
        })
        .sort((a, b) => profileCompleteness(b) - profileCompleteness(a)),
    [otherDancers, styleFilter, q],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー(共通): 画面名と注釈・メニュー */}
      <ScreenHeader title="連へのお誘い" note="未所属の踊り手を見つけて連に招く" garland />

      {/* 連そのものを探したい人向けに、連検索画面への案内を出す */}
      <TouchableOpacity
        style={styles.renSearchLink}
        onPress={() => navigation.navigate('RenSearch')}
        activeOpacity={0.85}
      >
        <Text style={styles.renSearchLinkText}>連そのものに参加したい方はこちら　→　連を探す</Text>
      </TouchableOpacity>

      {/* 3つのタブ。送った/届いたの件数も表示する */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'scout' && styles.tabItemActive]}
          onPress={() => setTab('scout')}
        >
          <Text style={[styles.tabLabel, tab === 'scout' && styles.tabLabelActive]}>気になる踊り手</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'sent' && styles.tabItemActive]}
          onPress={() => setTab('sent')}
        >
          <Text style={[styles.tabLabel, tab === 'sent' && styles.tabLabelActive]}>
            送った（{sentReal.length}）
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'received' && styles.tabItemActive]}
          onPress={() => setTab('received')}
        >
          <Text style={[styles.tabLabel, tab === 'received' && styles.tabLabelActive]}>
            届いた（{pendingReceivedCount}）
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 選んだタブに応じて中身を切り替える */}
        {tab === 'scout' ? (
          <>
            {/* キーワード検索欄と、踊りの種類の絞り込みチップ */}
            <View style={styles.searchWrap}>
              <View style={styles.searchBar}>
                <IconUchiwa size={15} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="名前・自己紹介で探す"
                  placeholderTextColor={colors.textMuted}
                />
                {search.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <View style={styles.filterRow}>
              {STYLE_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  label={f.label}
                  active={styleFilter === f.key}
                  onPress={() => setStyleFilter(f.key)}
                />
              ))}
            </View>

            {/* 実在ユーザーの一覧。読み込み中・検索結果なし・該当なし・登録者なしの場合はそれぞれ案内文を出す */}
            {!dancersLoaded ? (
              <View style={styles.loadingRow}>
                <NarutoLoader size={22} color={colors.gold} />
                <Text style={styles.loadingText}>踊り手を探しています…</Text>
              </View>
            ) : filteredOtherDancers.length === 0 && q ? (
              <Text style={styles.lead}>「{search}」に一致する踊り手が見つかりませんでした。</Text>
            ) : filteredOtherDancers.length > 0 ? (
              <>
                <Text style={styles.lead}>同じ広場にいる踊り手たち。プロフィールを見て声を掛けられます。</Text>
                {filteredOtherDancers.map((d) => {
                  const already = invitedRealIds.has(d.id);
                  const CatIcon = d.danceStyle ? categoryIcon(d.danceStyle === 'male' ? '男踊り' : '女踊り') : null;
                  return (
                    // 実在ユーザー1人分のカード: アイコン・名前・踊りの種類・自己紹介と、「連に招く」「話す」ボタン
                    <View key={d.id} style={styles.realCard}>
                      <UserAvatar size={52} name={d.name} iconUrl={d.icon} charStyle={styles.realAvatarChar} />
                      <View style={styles.realCardBody}>
                        <Text style={styles.dancerName}>{d.name}</Text>
                        {CatIcon ? (
                          <View style={styles.metaRow}>
                            <CatIcon size={12} color={colors.gold} />
                            <Text style={styles.dancerTags}>　{DANCE_LABEL[d.danceStyle as 'male' | 'female']}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.dancerNote} numberOfLines={2}>
                          {d.profile || 'まだ自己紹介は書かれていません。'}
                        </Text>
                        <View style={styles.cardBtnRow}>
                          <TouchableOpacity
                            style={[styles.inviteBtn, styles.inviteBtnInRow, already && styles.inviteBtnDone]}
                            onPress={() => !already && openRealInvite(d)}
                            activeOpacity={0.85}
                            disabled={already}
                          >
                            <UserPlus size={14} color={already ? colors.textMuted : colors.textOnGold} />
                            <Text style={[styles.inviteBtnText, already && styles.inviteBtnTextDone]}>
                              {already ? 'お誘い済み' : '連に招く'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.chatBtn}
                            onPress={() => chatWith(d.id, d.name)}
                            activeOpacity={0.85}
                          >
                            <MessageCircle size={14} color={colors.gold} />
                            <Text style={styles.chatBtnText}>話す</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : otherDancers.length > 0 ? (
              <Text style={styles.lead}>絞り込みに一致する踊り手がいません。</Text>
            ) : (
              <View style={styles.noRealNote}>
                <Text style={styles.noRealNoteText}>
                  まだあなた以外に登録している踊り手がいません。誰かがアプリに登録すると、ここに表示されてお誘い・DMができるようになります。
                </Text>
              </View>
            )}

          </>
        ) : tab === 'sent' ? (
          <>
            {/* 「送った」タブ: 実際に送ったお誘い。返答待ちのものは取り消せる */}
            {sentReal.length > 0 ? (
              <>
                {sentReal.map((inv) => (
                  <View key={inv.id} style={styles.sentCard}>
                    <View style={styles.sentHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sentName}>{inv.toUserName}</Text>
                        <Text style={styles.sentMeta}>{timeAgo(inv.createdAtMs)}</Text>
                      </View>
                      <Badge label={REAL_STATUS_LABEL[inv.status]} tone={STATUS_TONE[REAL_STATUS_LABEL[inv.status]]} />
                    </View>
                    <Text style={styles.sentMsg}>{inv.message}</Text>
                    <View style={styles.cardBtnRow}>
                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => chatWith(inv.toUserId, inv.toUserName)}
                        activeOpacity={0.85}
                      >
                        <MessageCircle size={13} color={colors.gold} />
                        <Text style={styles.chatBtnText}>話す</Text>
                      </TouchableOpacity>
                      {inv.status === 'pending' ? (
                        <TouchableOpacity
                          style={[styles.cancelBtn, styles.cancelBtnInRow]}
                          onPress={() => cancel(inv.id)}
                          disabled={cancelingId === inv.id}
                          activeOpacity={0.85}
                        >
                          {cancelingId === inv.id ? (
                            <ActivityIndicator color={colors.textSecondary} size="small" />
                          ) : (
                            <>
                              <Trash2 size={13} color={colors.textSecondary} />
                              <Text style={styles.cancelBtnText}>取り消す</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {sentReal.length === 0 ? (
              <Text style={styles.lead}>まだお誘いを送っていません。</Text>
            ) : null}
          </>
        ) : (
          <>
            {/* 「届いた」タブ: 自分に届いたお誘い。返答待ちなら承諾・辞退を選べる */}
            {receivedReal.length === 0 ? (
              <Text style={styles.lead}>まだお誘いは届いていません。プロフィールを整えておくと声が掛かりやすくなります。</Text>
            ) : (
              receivedReal.map((inv) => (
                <View key={inv.id} style={styles.sentCard}>
                  <View style={styles.sentHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sentName}>{inv.fromUserName} さんから</Text>
                      <Text style={styles.sentMeta}>{timeAgo(inv.createdAtMs)}</Text>
                    </View>
                    {inv.status !== 'pending' ? (
                      <Badge label={REAL_STATUS_LABEL[inv.status]} tone={STATUS_TONE[REAL_STATUS_LABEL[inv.status]]} />
                    ) : null}
                  </View>
                  <Text style={styles.sentMsg}>{inv.message}</Text>
                  <View style={styles.cardBtnRow}>
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={() => chatWith(inv.fromUserId, inv.fromUserName)}
                      activeOpacity={0.85}
                    >
                      <MessageCircle size={13} color={colors.gold} />
                      <Text style={styles.chatBtnText}>話す</Text>
                    </TouchableOpacity>
                    {inv.status === 'pending' ? (
                      <>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => respond(inv.id, 'declined')}
                          disabled={respondingId === inv.id}
                          activeOpacity={0.85}
                        >
                          {respondingId === inv.id ? (
                            <ActivityIndicator color={colors.textSecondary} size="small" />
                          ) : (
                            <Text style={styles.declineBtnText}>辞退する</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => respond(inv.id, 'accepted')}
                          disabled={respondingId === inv.id}
                          activeOpacity={0.85}
                        >
                          {respondingId === inv.id ? (
                            <ActivityIndicator color={colors.textOnGold} size="small" />
                          ) : (
                            <>
                              <Check size={14} color={colors.textOnGold} />
                              <Text style={styles.acceptBtnText}>承諾する</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* お誘い文の作成 */}
      <Modal visible={target !== null} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{targetDisplayName(target)} さんへのお誘い</Text>
              <TouchableOpacity onPress={() => setTarget(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.gold} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalNote}>{targetDisplayMeta(target)}</Text>
            <TextInput
              style={styles.modalInput}
              value={message}
              onChangeText={setMessage}
              placeholder="お誘いの言葉を書く…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
              onPress={submitInvite}
              disabled={!message.trim() || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color={colors.textOnGold} size="small" />
              ) : (
                <>
                  <Send size={16} color={colors.textOnGold} />
                  <Text style={styles.sendBtnText}>お誘いを送る</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 画面全体の背景(濃い藍色)
  container: { flex: 1, backgroundColor: colors.indigoDeep },

  // 「連を探す」への案内の帯(薄い金色の背景)
  renSearchLink: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.goldSoft,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  renSearchLinkText: { ...typography.caption, color: colors.gold, fontWeight: '700', textAlign: 'center' },

  // 「見つける」「送信済み」「受信」の3タブ
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.indigoLine },
  tabItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabLabel: { ...typography.bodyStrong, color: colors.textMuted, fontSize: 12 },
  tabLabelActive: { color: colors.gold },

  // タブの中身の余白と、説明文・登録者がいないときの案内枠
  body: { padding: spacing.lg },
  lead: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },
  noRealNote: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noRealNoteText: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },

  // キーワード検索欄と絞り込みチップの並び
  searchWrap: { marginBottom: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.textPrimary, ...typography.body, fontSize: 13 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },

  // 読み込み中の表示
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  loadingText: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },

  // 実在するユーザーのカード
  realCard: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  // 紋の中に入れるアイコン画像(画像がなければ名前の1文字目)
  realAvatarChar: { ...typography.bodyStrong, color: colors.gold, fontSize: 18 },
  realCardBody: { flex: 1, marginLeft: spacing.md },

  // カードの中の文字(名前・地域・踊りの種類・演舞名・自己紹介)
  dancerName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  dancerTags: { ...typography.caption, color: colors.gold },
  dancerNote: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 16 },

  // カードのボタンの並び。「連に招く」は金色、送った後は灰色、「話す」は金色の枠線
  cardBtnRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  inviteBtnInRow: { marginTop: 0 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  inviteBtnDone: { backgroundColor: colors.indigoRaised },
  inviteBtnText: { ...typography.button, color: colors.textOnGold, marginLeft: 6, fontSize: 12 },
  inviteBtnTextDone: { color: colors.textMuted },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  chatBtnText: { ...typography.button, color: colors.gold, marginLeft: 6, fontSize: 12 },

  // 送った/届いたお誘い1件分のカード(相手の名前・時刻・状態のバッジ・本文)
  sentCard: {
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sentHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  sentName: { ...typography.bodyStrong, color: colors.textPrimary },
  sentMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  sentMsg: { ...typography.body, color: colors.textSecondary },

  // お誘いの取り消し(目立たない文字のボタン)、辞退(枠線)、承諾(金色)のボタン
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  cancelBtnInRow: { marginTop: 0, alignSelf: 'center' },
  cancelBtnText: { ...typography.caption, color: colors.textSecondary, marginLeft: 4 },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  declineBtnText: { ...typography.button, color: colors.textSecondary, fontSize: 12 },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  acceptBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 12, marginLeft: 4 },

  // お誘い文を書くダイアログ。画面の下からせり上がるカードにする
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,19,43,0.7)' },
  modalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  modalNote: { ...typography.caption, color: colors.gold, marginTop: 4, marginBottom: spacing.md },
  // お誘い文の入力欄(複数行)と送信ボタン。文が空か送信中は薄く表示する
  modalInput: {
    minHeight: 110,
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
    textAlignVertical: 'top',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { ...typography.button, color: colors.textOnGold, marginLeft: spacing.sm },
});
