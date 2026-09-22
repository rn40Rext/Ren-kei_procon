import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { X, Send, MapPin, UserPlus, Check, Trash2, ChevronLeft, MessageCircle } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { Badge, Chip } from '../components/ui';
import AppMenu from '../components/AppMenu';
import { KasaGarland, RenMon, NarutoLoader } from '../components/motifs';
import { IconWagasa, IconUchiwa, categoryIcon } from '../components/awaIcons';
import { auth } from '../config/firebaseConfig';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { freeDancers, sentInvitations, Invitation, InviteStatus, FreeDancer } from '../data/mockRequests';
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

const SCREEN_W = Dimensions.get('window').width;
const STYLE_FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'male', label: '男踊り' },
  { key: 'female', label: '女踊り' },
] as const;
type StyleFilter = (typeof STYLE_FILTERS)[number]['key'];

type Tab = 'scout' | 'sent' | 'received';

const STATUS_TONE: Record<InviteStatus, 'gold' | 'aka' | 'outline'> = {
  返答待ち: 'outline',
  承諾: 'gold',
  辞退: 'aka',
};

const REAL_STATUS_LABEL: Record<InvitationDoc['status'], InviteStatus> = {
  pending: '返答待ち',
  accepted: '承諾',
  declined: '辞退',
};

const DANCE_LABEL: Record<'male' | 'female', string> = { male: '男踊り', female: '女踊り' };

function timeAgo(ms: number | null): string {
  if (ms == null) return 'たった今';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'たった今';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;
  return `${Math.floor(diff / 86_400_000)}日前`;
}

type InviteTarget =
  | { kind: 'real'; id: string; name: string; meta: string }
  | { kind: 'dummy'; dancer: FreeDancer }
  | { kind: 'challenge'; name: string; meta: string };

function targetDisplayName(t: InviteTarget | null): string {
  if (!t) return '';
  return t.kind === 'dummy' ? t.dancer.name : t.name;
}

function targetDisplayMeta(t: InviteTarget | null): string {
  if (!t) return '';
  if (t.kind === 'dummy') return `${t.dancer.area}・${t.dancer.category}・${t.dancer.years}`;
  return t.meta || '踊り手';
}

export default function RequestScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Request'>>();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('scout');
  const [target, setTarget] = useState<InviteTarget | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // 気になる踊り手の絞り込み
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');

  // ダミー：送信したお誘いはローカル state に積む（見本表示）
  const [sent, setSent] = useState<Invitation[]>(sentInvitations);

  // 実データ：同じアプリの踊り手・送受信したお誘い
  const [otherDancers, setOtherDancers] = useState<OtherDancer[]>([]);
  const [dancersLoaded, setDancersLoaded] = useState(false);
  const [sentReal, setSentReal] = useState<InvitationDoc[]>([]);
  const [receivedReal, setReceivedReal] = useState<InvitationDoc[]>([]);

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

  // 他画面（チャレンジ詳細など）から「◯◯さんを連へ勧誘する」で渡された相手を、開いたら即お誘い文を出す
  const consumedInviteRef = useRef<string | null>(null);
  useEffect(() => {
    const name = route.params?.inviteName;
    if (!name || consumedInviteRef.current === name) return;
    consumedInviteRef.current = name;
    setTarget({ kind: 'challenge', name, meta: route.params?.inviteMeta ?? '' });
    setMessage(`${name}さん、動画を拝見しました。うちの連の稽古に一度いらっしゃいませんか。`);
  }, [route.params?.inviteName, route.params?.inviteMeta]);

  const openRealInvite = (d: OtherDancer) => {
    setTarget({ kind: 'real', id: d.id, name: d.name, meta: d.danceStyle ? DANCE_LABEL[d.danceStyle] : '' });
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

  const openDummyInvite = (d: FreeDancer) => {
    setTarget({ kind: 'dummy', dancer: d });
    setMessage(`${d.name}さん、演舞を拝見しました。うちの連の稽古に一度いらっしゃいませんか。`);
  };

  const submitInvite = async () => {
    if (!target || !message.trim() || sending) return;

    if (target.kind === 'real') {
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
      return;
    }

    // ダミー・チャレンジ経由：この端末の中だけの見本表示に追加
    const dancerName = target.kind === 'dummy' ? target.dancer.name : target.name;
    const dancerArea = target.kind === 'dummy' ? target.dancer.area : target.meta || 'チャレンジ投稿より';
    setSent((prev) => [
      {
        id: `inv-${Date.now()}`,
        dancerName,
        dancerArea,
        message: message.trim(),
        sentAt: 'たった今',
        status: '返答待ち',
      },
      ...prev,
    ]);
    setTarget(null);
    setMessage('');
    setTab('sent');
  };

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

  const invitedDummyNames = new Set(sent.map((s) => s.dancerName));
  const invitedRealIds = new Set(sentReal.map((i) => i.toUserId));
  const pendingReceivedCount = receivedReal.filter((i) => i.status === 'pending').length;

  const q = search.trim().toLowerCase();
  // プロフィールを書いている人ほど「声を掛けてほしい」意思が明確なので上に出す
  const profileCompleteness = (d: OtherDancer) =>
    (d.profile.trim() ? 1 : 0) + (d.danceStyle ? 1 : 0) + (d.icon ? 1 : 0);
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
  const filteredFreeDancers = useMemo(
    () =>
      freeDancers.filter((d) => {
        const dummyStyle = d.category === '男踊り' ? 'male' : d.category === '女踊り' ? 'female' : null;
        const styleOk = styleFilter === 'all' || dummyStyle === styleFilter;
        const searchOk =
          !q || d.name.toLowerCase().includes(q) || d.area.toLowerCase().includes(q) || d.note.toLowerCase().includes(q);
        return styleOk && searchOk;
      }),
    [styleFilter, q],
  );

  return (
    <SafeAreaView style={styles.container}>
      <KasaGarland width={SCREEN_W} count={7} height={40} style={styles.garland} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </TouchableOpacity>
        <IconWagasa size={22} color={colors.gold} style={styles.headerIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>連へのお誘い</Text>
          <Text style={styles.headerSub}>未所属の踊り手を見つけて連に招く</Text>
        </View>
        <AppMenu />
      </View>

      <TouchableOpacity
        style={styles.renSearchLink}
        onPress={() => navigation.navigate('RenSearch')}
        activeOpacity={0.85}
      >
        <Text style={styles.renSearchLinkText}>連そのものに参加したい方はこちら　→　連を探す</Text>
      </TouchableOpacity>

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
            送った（{sent.length + sentReal.length}）
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
        {tab === 'scout' ? (
          <>
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

            {!dancersLoaded ? (
              <View style={styles.loadingRow}>
                <NarutoLoader size={22} color={colors.gold} />
                <Text style={styles.loadingText}>踊り手を探しています…</Text>
              </View>
            ) : filteredOtherDancers.length === 0 && filteredFreeDancers.length === 0 && q ? (
              <Text style={styles.lead}>「{search}」に一致する踊り手が見つかりませんでした。</Text>
            ) : filteredOtherDancers.length > 0 ? (
              <>
                <Text style={styles.lead}>同じ広場にいる踊り手たち。プロフィールを見て声を掛けられます。</Text>
                {filteredOtherDancers.map((d) => {
                  const already = invitedRealIds.has(d.id);
                  const CatIcon = d.danceStyle ? categoryIcon(d.danceStyle === 'male' ? '男踊り' : '女踊り') : null;
                  return (
                    <View key={d.id} style={styles.realCard}>
                      <RenMon size={52} color={colors.gold}>
                        {d.icon ? (
                          <Image source={{ uri: d.icon }} style={styles.realAvatarImg} />
                        ) : (
                          <Text style={styles.realAvatarChar}>{d.name.slice(0, 1)}</Text>
                        )}
                      </RenMon>
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
                <View style={styles.sampleDivider}>
                  <Text style={styles.sampleDividerText}>ここから下は見本（サンプル）</Text>
                </View>
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

            {filteredFreeDancers.length > 0 && (
              <Text style={styles.lead}>連に所属していない踊り手たち。演舞を見て声を掛けられます。</Text>
            )}
            {filteredFreeDancers.map((d) => {
              const already = invitedDummyNames.has(d.name);
              return (
                <View key={d.id} style={styles.card}>
                  <ImageBackground
                    source={{ uri: d.image }}
                    style={styles.thumb}
                    imageStyle={{ borderRadius: radius.sm }}
                  >
                    {d.seekingRen ? (
                      <Badge label="連を探し中" tone="aka" style={styles.thumbBadge} />
                    ) : null}
                  </ImageBackground>

                  <View style={styles.cardBody}>
                    <Text style={styles.dancerName}>{d.name}</Text>
                    <View style={styles.metaRow}>
                      <MapPin size={11} color={colors.textMuted} />
                      <Text style={styles.metaText}>　{d.area}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      {React.createElement(categoryIcon(d.category), { size: 12, color: colors.gold })}
                      <Text style={styles.dancerTags}>
                        　{d.category}・{d.years}　極め度 {d.kimeRate}%
                      </Text>
                    </View>
                    <Text style={styles.enbuTitle} numberOfLines={1}>演舞「{d.enbuTitle}」</Text>
                    <Text style={styles.dancerNote} numberOfLines={2}>{d.note}</Text>

                    <TouchableOpacity
                      style={[styles.inviteBtn, already && styles.inviteBtnDone]}
                      onPress={() => !already && openDummyInvite(d)}
                      activeOpacity={0.85}
                      disabled={already}
                    >
                      <UserPlus size={14} color={already ? colors.textMuted : colors.textOnGold} />
                      <Text style={[styles.inviteBtnText, already && styles.inviteBtnTextDone]}>
                        {already ? 'お誘い済み' : '連に招く'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        ) : tab === 'sent' ? (
          <>
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
                <View style={styles.sampleDivider}>
                  <Text style={styles.sampleDividerText}>ここから下は見本（サンプル）</Text>
                </View>
              </>
            ) : null}

            {sent.length === 0 && sentReal.length === 0 ? (
              <Text style={styles.lead}>まだお誘いを送っていません。</Text>
            ) : (
              sent.map((inv) => (
                <View key={inv.id} style={styles.sentCard}>
                  <View style={styles.sentHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sentName}>{inv.dancerName}</Text>
                      <Text style={styles.sentMeta}>{inv.dancerArea}・{inv.sentAt}</Text>
                    </View>
                    <Badge label={inv.status} tone={STATUS_TONE[inv.status]} />
                  </View>
                  <Text style={styles.sentMsg}>{inv.message}</Text>
                </View>
              ))
            )}
          </>
        ) : (
          <>
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
  container: { flex: 1, backgroundColor: colors.indigoDeep },

  garland: { backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { marginRight: spacing.sm },
  headerIcon: { marginRight: spacing.md },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  renSearchLink: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.goldSoft,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  renSearchLinkText: { ...typography.caption, color: colors.gold, fontWeight: '700', textAlign: 'center' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.indigoLine },
  tabItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabLabel: { ...typography.bodyStrong, color: colors.textMuted, fontSize: 12 },
  tabLabelActive: { color: colors.gold },

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

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  loadingText: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },

  sampleDivider: { alignItems: 'center', marginVertical: spacing.lg },
  sampleDividerText: { ...typography.caption, color: colors.textMuted },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  thumb: { width: 92, height: 92, backgroundColor: colors.indigoRaised },
  thumbBadge: { margin: 4 },
  cardBody: { flex: 1, marginLeft: spacing.md },

  realCard: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  realAvatarImg: { width: 42, height: 42, borderRadius: radius.pill },
  realAvatarChar: { ...typography.bodyStrong, color: colors.gold, fontSize: 18 },
  realCardBody: { flex: 1, marginLeft: spacing.md },

  dancerName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaText: { ...typography.caption, color: colors.textMuted },
  dancerTags: { ...typography.caption, color: colors.gold },
  enbuTitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  dancerNote: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 16 },

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
