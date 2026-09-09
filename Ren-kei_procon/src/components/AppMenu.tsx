import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X, ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { ChochinGarland } from './motifs';
import { RenKeiWordmark } from './Brand';
import {
  IconTenugui,
  IconUchiwa,
  IconAmigasa,
  IconGeta,
  IconMakimono,
} from './awaIcons';

const PANEL_W = Math.min(Math.round(Dimensions.get('window').width * 0.82), 360);

type NavKey = 'Home' | 'Scoring' | 'Mypage' | 'Request';

const LINKS: { key: NavKey; label: string; note: string; Icon: typeof IconUchiwa }[] = [
  { key: 'Home', label: '踊り広場', note: '演舞の推薦・みんなの投稿・交流', Icon: IconUchiwa },
  { key: 'Request', label: 'リクエスト', note: '未所属の踊り手を見つけて連に招く', Icon: IconAmigasa },
  { key: 'Scoring', label: '自主稽古・演舞解析', note: '手本同期・二拍子稽古', Icon: IconGeta },
  { key: 'Mypage', label: '稽古手帳', note: '成長記録・段位・連バッジ', Icon: IconMakimono },
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

  const go = (key: NavKey) => {
    setOpen(false);
    if (key === route.name) return;
    navigation.navigate(key as never);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="メニューを開く"
      >
        <IconTenugui color={tint} size={21} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
          <View style={styles.panel}>
            <ChochinGarland width={PANEL_W} count={5} height={38} sag={10} style={styles.panelGarland} />
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
  trigger: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  overlay: { flex: 1, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(11,19,43,0.7)' },
  panel: {
    width: PANEL_W,
    backgroundColor: colors.indigoDeep,
    borderLeftWidth: 1,
    borderLeftColor: colors.indigoLine,
  },
  panelGarland: { position: 'absolute', top: spacing.lg, left: 0, right: 0 },
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

  panelBody: { paddingVertical: spacing.md },
  childrenWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.indigoLine, marginVertical: spacing.md },

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
  activeMark: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.aka },
});
