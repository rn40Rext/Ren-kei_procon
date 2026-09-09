import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Send, MapPin, UserPlus } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { Badge } from '../components/ui';
import AppMenu from '../components/AppMenu';
import { freeDancers, sentInvitations, Invitation, InviteStatus, FreeDancer } from '../data/mockRequests';

type Tab = 'scout' | 'sent';

const STATUS_TONE: Record<InviteStatus, 'gold' | 'aka' | 'outline'> = {
  返答待ち: 'outline',
  承諾: 'gold',
  辞退: 'aka',
};

export default function RequestScreen() {
  const [tab, setTab] = useState<Tab>('scout');
  const [target, setTarget] = useState<FreeDancer | null>(null);
  const [message, setMessage] = useState('');
  // ダミー：送信したお誘いはローカル state に積む
  const [sent, setSent] = useState<Invitation[]>(sentInvitations);

  const openInvite = (d: FreeDancer) => {
    setTarget(d);
    setMessage(
      `${d.name}さん、演舞を拝見しました。うちの連の稽古に一度いらっしゃいませんか。`,
    );
  };

  const submitInvite = () => {
    if (!target || !message.trim()) return;
    setSent((prev) => [
      {
        id: `inv-${Date.now()}`,
        dancerName: target.name,
        dancerArea: target.area,
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

  const invitedNames = new Set(sent.map((s) => s.dancerName));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>連へのお誘い</Text>
          <Text style={styles.headerSub}>未所属の踊り手を見つけて連に招く</Text>
        </View>
        <AppMenu />
      </View>

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
            送ったお誘い（{sent.length}）
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {tab === 'scout' ? (
          <>
            <Text style={styles.lead}>連に所属していない踊り手たち。演舞を見て声を掛けられます。</Text>
            {freeDancers.map((d) => {
              const already = invitedNames.has(d.name);
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
                    <Text style={styles.dancerTags}>
                      {d.category}・{d.years}　極め度 {d.kimeRate}%
                    </Text>
                    <Text style={styles.enbuTitle} numberOfLines={1}>演舞「{d.enbuTitle}」</Text>
                    <Text style={styles.dancerNote} numberOfLines={2}>{d.note}</Text>

                    <TouchableOpacity
                      style={[styles.inviteBtn, already && styles.inviteBtnDone]}
                      onPress={() => !already && openInvite(d)}
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
        ) : (
          <>
            {sent.length === 0 ? (
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
              <Text style={styles.modalTitle}>{target?.name} さんへのお誘い</Text>
              <TouchableOpacity onPress={() => setTarget(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.gold} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalNote}>
              {target?.area}・{target?.category}・{target?.years}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={message}
              onChangeText={setMessage}
              placeholder="お誘いの言葉を書く…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
              onPress={submitInvite}
              disabled={!message.trim()}
              activeOpacity={0.85}
            >
              <Send size={16} color={colors.textOnGold} />
              <Text style={styles.sendBtnText}>お誘いを送る</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.indigoLine },
  tabItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabLabel: { ...typography.bodyStrong, color: colors.textMuted },
  tabLabelActive: { color: colors.gold },

  body: { padding: spacing.lg },
  lead: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },

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
  dancerName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaText: { ...typography.caption, color: colors.textMuted },
  dancerTags: { ...typography.caption, color: colors.gold, marginTop: 4 },
  enbuTitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  dancerNote: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 16 },

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
