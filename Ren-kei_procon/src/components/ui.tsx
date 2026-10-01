import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { KumihimoRule, AsanohaBackground } from './motifs';

/* ================================================================== */
/* 見出し（区切り）                                                     */
/* ================================================================== */
export function SectionHeader({
  title,
  category,
  note,
  onViewAll,
  viewAllLabel = '［ 全録を見る ］',
  style,
}: {
  title: string;
  category?: string;
  note?: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[uiStyles.sectionHeader, style]}>
      {category ? (
        <Text style={uiStyles.sectionCategory}>{category}</Text>
      ) : (
        <KumihimoRule width={30} style={uiStyles.rule} />
      )}
      <View style={uiStyles.sectionTitleRow}>
        <Text style={uiStyles.sectionTitle}>{title}</Text>
        {onViewAll ? (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={uiStyles.viewAll}>{viewAllLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {note ? <Text style={uiStyles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

/* ================================================================== */
/* 印（バッジ）                                                         */
/* ================================================================== */
type BadgeTone = 'aka' | 'gold' | 'outline' | 'dark';

/** 小さな色付きラベル(カテゴリ・状態表示に使う) */
export function Badge({
  label,
  tone = 'dark',
  style,
}: {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[uiStyles.badgeBase, uiStyles[`badge_${tone}` as const], style]}>
      <Text style={[uiStyles.badgeTextBase, uiStyles[`badgeText_${tone}` as const]]}>{label}</Text>
    </View>
  );
}

/* ================================================================== */
/* 調子チップ（絞り込み・タグ）                                          */
/* ================================================================== */
export function Chip({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[uiStyles.chip, active && uiStyles.chipActive, style]}
    >
      <Text style={[uiStyles.chipText, active && uiStyles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ================================================================== */
/* ボタン                                                              */
/* ================================================================== */
export function PrimaryButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[uiStyles.primaryBtn, style]}>
      {icon}
      <Text style={[uiStyles.primaryBtnText, icon ? { marginLeft: spacing.sm } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** 枠線のみの控えめなボタン(PrimaryButtonに対する副次操作用) */
export function GhostButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[uiStyles.ghostBtn, style]}>
      {icon}
      <Text style={[uiStyles.ghostBtnText, icon ? { marginLeft: spacing.sm } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ================================================================== */
/* 秘伝書（和紙・木札調カード）                                          */
/* ================================================================== */
export function WashiCard({
  children,
  eyebrow,
  style,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[uiStyles.washi, style]}>
      <AsanohaBackground width={360} height={360} color={colors.akaDeep} opacity={0.05} />
      <View style={uiStyles.washiEdge} />
      {eyebrow ? <Text style={uiStyles.washiEyebrow}>{eyebrow}</Text> : null}
      {children}
    </View>
  );
}

/* ================================================================== */
/* 藍のカード（汎用）                                                   */
/* ================================================================== */
export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[uiStyles.panel, style]}>{children}</View>;
}

/* ================================================================== */
/* 指標（演舞尺・極め度・喝采）                                          */
/* ================================================================== */
export function MetricRow({
  items,
  style,
}: {
  items: { label: string; value: string }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[uiStyles.metricRow, style]}>
      {items.map((it, i) => (
        <View key={it.label} style={[uiStyles.metricItem, i > 0 && uiStyles.metricDivider]}>
          <Text style={uiStyles.metricValue}>{it.value}</Text>
          <Text style={uiStyles.metricLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** 文字用のスタイルであることを型で示すための補助(中身はそのまま返す) */
const textStyle = (t: TextStyle): TextStyle => t;

const uiStyles = StyleSheet.create({
  // セクション見出し: 組紐の飾り・小見出し(金色)・見出し(明朝体)・補足・「すべて見る」
  sectionHeader: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  rule: { marginBottom: spacing.sm },
  sectionCategory: textStyle({ ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.xs }),
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: textStyle({ ...typography.headingSerif, color: colors.textPrimary }),
  sectionNote: textStyle({ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }),
  viewAll: textStyle({ ...typography.caption, color: colors.gold }),

  // Badgeコンポーネントの土台。色(tone)ごとの差分はbadge_○○/badgeText_○○で上書きする
  badgeBase: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badge_aka: { backgroundColor: colors.aka },
  badge_gold: { backgroundColor: colors.gold },
  badge_outline: { borderWidth: 1, borderColor: colors.gold, backgroundColor: 'transparent' },
  badge_dark: { backgroundColor: colors.overlay },
  badgeTextBase: textStyle({ ...typography.sectionLabel, letterSpacing: 1 }),
  badgeText_aka: { color: colors.textOnAka },
  badgeText_gold: { color: colors.textOnGold },
  badgeText_outline: { color: colors.gold },
  badgeText_dark: { color: colors.goldBright },

  // 絞り込みなどのチップ。選んでいるものは金色に塗る
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigoRaised,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: textStyle({ ...typography.caption, color: colors.textSecondary }),
  chipTextActive: textStyle({ ...typography.caption, color: colors.textOnGold, fontWeight: '700' }),

  // 主のボタン(金色)と、控えめなボタン(枠線のみ)
  primaryBtn: {
    backgroundColor: colors.gold,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryBtnText: textStyle({ ...typography.button, color: colors.textOnGold }),
  ghostBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingHorizontal: spacing.lg,
  },
  ghostBtnText: textStyle({ ...typography.button, color: colors.textPrimary }),

  // 和紙風のカード(明るい背景・左端の帯・小見出し)
  washi: {
    backgroundColor: colors.kinari,
    borderRadius: radius.sm,
    padding: spacing.lg,
    paddingLeft: spacing.xl,
    overflow: 'hidden',
  },
  washiEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: colors.akaDeep },
  washiEyebrow: textStyle({
    ...typography.sectionLabel,
    color: colors.akaDeep,
    marginBottom: spacing.sm,
  }),

  // 枠で囲んだパネル
  panel: {
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },

  // 数字を横に並べる行(区切り線・金色の数字・小さな見出し)
  metricRow: { flexDirection: 'row', alignItems: 'stretch' },
  metricItem: { paddingRight: spacing.lg },
  metricDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.indigoLine,
    paddingLeft: spacing.lg,
  },
  metricValue: textStyle({ ...typography.bodyStrong, color: colors.gold, fontSize: 15 }),
  metricLabel: textStyle({ ...typography.caption, color: colors.textMuted, marginTop: 2 }),
});
