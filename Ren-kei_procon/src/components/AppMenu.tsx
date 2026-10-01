import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X, Menu, ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { ChochinGarland } from './motifs';
import { RenKeiWordmark } from './Brand';
import {
  IconUchiwa,
  IconWagasa,
  IconGeta,
  IconMakimono,
} from './awaIcons';
import { useAuth } from '../hooks/useAuth';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';

/** メニューから移動できる画面の名前 */
type NavKey = 'Home' | 'Scoring' | 'Mypage' | 'Request';

/** メニューに並べるリンク(表示名・説明・アイコン)。上から順に表示する */
const LINKS: { key: NavKey; label: string; note: string; Icon: typeof IconUchiwa }[] = [
  { key: 'Home', label: '踊り広場・交流広場', note: 'みんなの投稿・交流', Icon: IconUchiwa },
  { key: 'Request', label: 'リクエスト', note: '未所属の踊り手を見つけて連に招く・連を探す', Icon: IconWagasa },
  { key: 'Scoring', label: '自主稽古・演舞解析', note: 'AI で基本動作を採点', Icon: IconGeta },
  { key: 'Mypage', label: '稽古手帳', note: 'プロフィール・成長の記録・練習動画・マイ連', Icon: IconMakimono },
];

/**
 * 全画面共通のメニュー。ヘッダー右に置くアイコン1つで、
 * 画面移動をすべてここに集約する（下部のナビゲーションバーは廃止）。
 * children を渡すと、リンク一覧の上に差し込める（ホームの絞り込みなど）。
 */
export default function AppMenu({
  children,
  tint = colors.gold,
}: {
  children?: React.ReactNode;
  tint?: string;
}) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const panelW = Math.min(Math.round(windowWidth * 0.82), 360);
  const { uid } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // 未読通知の件数を購読し、ある時はメニューボタンに赤い点を付ける
  useEffect(() => {
    if (!uid) {
      setUnreadCount(0);
      return;
    }
    return subscribeUnreadNotificationCount(
      uid,
      setUnreadCount,
      (error) => console.error('未読通知件数の取得に失敗しました', error)
    );
  }, [uid]);

  /** メニューを閉じてから遷移する。今いる画面と同じならそのまま閉じるだけ */
  const go = (key: NavKey) => {
    setOpen(false);
    if (key === route.name) return;
    navigation.navigate(key as never);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { borderColor: tint }]}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={unreadCount > 0 ? `メニューを開く(未読通知${unreadCount}件)` : 'メニューを開く'}
      >
        <Menu size={20} color={tint} />
        {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
          <View style={[styles.panel, { width: panelW }]}>
            <ChochinGarland width={panelW} count={5} height={38} sag={10} style={styles.panelGarland} />
            <View style={styles.panelHeader}>
              <View style={styles.brandRow}>
                <RenKeiWordmark size={22} />
                <Text style={styles.brandSub}>阿波・稽古と交流の広場</Text>
              </View>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="メニューを閉じる"
              >
                <X color={colors.gold} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.panelBody} showsVerticalScrollIndicator={false}>
              {children ? (
                <>
                  <View style={styles.childrenWrap}>{children}</View>
                  <View style={styles.divider} />
                </>
              ) : null}

              {LINKS.map((l) => {
                const active = route.name === l.key;
                return (
                  <TouchableOpacity
                    key={l.key}
                    style={[styles.link, active && styles.linkActive]}
                    activeOpacity={0.8}
                    onPress={() => go(l.key)}
                  >
                    <l.Icon size={19} color={active ? colors.gold : colors.textSecondary} />
                    <View style={styles.linkText}>
                      <Text style={[styles.linkLabel, active && styles.linkLabelActive]}>{l.label}</Text>
                      <Text style={styles.linkNote}>{l.note}</Text>
                    </View>
                    {active ? (
                      <View style={styles.activeMark} />
                    ) : (
                      <ChevronRight size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ヘッダー右上の丸いメニューボタン(枠線の色は tint で画面ごとに変えられる)
  trigger: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.indigoRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 未読通知があるときにメニューボタンの右上に付ける朱色の点
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.aka,
    borderWidth: 1.5,
    borderColor: colors.indigoRaised,
  },

  // メニューを開いたときの全体。左の暗い幕と右から出るパネルを横に並べる
  overlay: { flex: 1, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)' },
  // 右側に出るメニュー本体(濃い藍色)
  panel: {
    backgroundColor: colors.indigoDeep,
    borderLeftWidth: 1,
    borderLeftColor: colors.indigoLine,
  },
  // パネル上部に吊るす提灯の飾り
  panelGarland: { position: 'absolute', top: spacing.lg, left: 0, right: 0 },
  // ロゴと閉じるボタンを並べる見出し部分(提灯の下に来るよう上の余白を大きく取る)
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.indigoLine,
  },
  brandRow: {},
  brandSub: { ...typography.caption, color: colors.textMuted, fontSize: 9, marginTop: 2 },

  // リンク一覧のスクロール部分と、画面から差し込まれた部品(絞り込みなど)の区切り
  panelBody: { paddingVertical: spacing.md },
  childrenWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.indigoLine, marginVertical: spacing.md },

  // リンク1行分(アイコン・表示名と説明・右矢印)。今いる画面は金色の背景で示す
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  linkActive: { backgroundColor: colors.goldSoft },
  linkText: { flex: 1, marginLeft: spacing.md },
  linkLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  linkLabelActive: { color: colors.gold },
  linkNote: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  // 今いる画面の行の右端に付ける朱色の点
  activeMark: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.aka },
});
