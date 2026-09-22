import { Platform, TextStyle } from 'react-native';

/**
 * 「連（ren-kei）」共通デザイン基盤
 *
 * 阿波藍（深藍）を基底に、提灯の茜色・金泥・和紙の風合いを重ねた
 * 「粋な稽古と交流の場」のためのトークン集。
 * 各画面はこのファイルの値だけを参照し、色やサイズを直書きしない。
 */

/* ------------------------------------------------------------------ */
/* 色彩計画（カラーパレット）                                           */
/* ------------------------------------------------------------------ */
export const colors = {
  // 基底色（阿波藍）— 静寂と格式
  indigoDeep: '#0B132B', // 深藍：画面の地
  indigo: '#1C2A4A', // 藍色：カード面
  indigoRaised: '#243354', // 一段持ち上げた面（入力欄・チップ）
  indigoLine: 'rgba(212,175,55,0.18)', // 金を薄く敷いた罫線

  // 強調色（提灯茜）— 祭りの熱気・主要CTA
  aka: '#D9381E', // 茜色
  akaDeep: '#C84B31', // 朱赤
  akaSoft: 'rgba(217,56,30,0.14)', // 茜の淡い下地

  // 装飾色（金泥・木肌）— 巻物・バッジ・文字
  gold: '#D4AF37', // 金茶
  goldBright: '#F3E5AB', // 明るい金泥
  goldSoft: 'rgba(212,175,55,0.12)', // 金の淡い下地
  kinari: '#F4EBD9', // 生成り：和紙・木札の文字色

  // 文字
  textPrimary: '#F4EBD9', // 生成り：本文
  textSecondary: '#A9B4C9', // 藍がかった淡色：補足
  textMuted: '#6C7794', // さらに沈めた色
  textOnGold: '#0B132B', // 金地の上の文字
  textOnAka: '#F4EBD9', // 茜地の上の文字

  // 状態
  success: '#5F9E7C',
  danger: '#E5604D',

  // 透過
  scrim: 'rgba(11,19,43,0.94)', // 画像の上に敷く暗幕
  overlay: 'rgba(0,0,0,0.55)',
} as const;

/* ------------------------------------------------------------------ */
/* 余白・角・線                                                         */
/* ------------------------------------------------------------------ */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenH: 16, // 画面左右の標準余白
} as const;

export const radius = {
  /** 和の意匠は角を立てる。基本はごく浅い面取り。 */
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
  pill: 999,
} as const;

export const hairline = {
  width: 1,
  color: colors.indigoLine,
} as const;

/* ------------------------------------------------------------------ */
/* タイポグラフィ                                                       */
/* ------------------------------------------------------------------ */
/**
 * 表題・見出しは伝統の重みを感じさせる明朝体、
 * 本文・数値・機能ラベルは視認性の高い角ゴシック体。
 * 追加フォントは導入せず、OS 標準の明朝／ゴシックにフォールバックする。
 */
export const fontFamily = {
  serif: Platform.select({
    ios: 'Hiragino Mincho ProN',
    android: 'serif',
    default: "'Noto Serif JP', 'Hiragino Mincho ProN', serif",
  }) as string,
  sans: Platform.select({
    ios: 'Hiragino Sans',
    android: 'sans-serif',
    default: "'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif",
  }) as string,
} as const;

type TypePreset = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
>;

export const typography: Record<
  | 'displaySerif'
  | 'titleSerif'
  | 'headingSerif'
  | 'sectionLabel'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'metric'
  | 'button',
  TypePreset
> = {
  // 明朝体：格式ある見出し
  displaySerif: { fontFamily: fontFamily.serif, fontSize: 26, lineHeight: 36, fontWeight: '700' },
  titleSerif: { fontFamily: fontFamily.serif, fontSize: 20, lineHeight: 30, fontWeight: '700' },
  headingSerif: { fontFamily: fontFamily.serif, fontSize: 16, lineHeight: 24, fontWeight: '700' },

  // 角ゴシック体：ラベル・本文・数値
  sectionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  body: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, fontWeight: '400' },
  bodyStrong: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  caption: { fontFamily: fontFamily.sans, fontSize: 11, lineHeight: 16, fontWeight: '400' },
  metric: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  button: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 18, fontWeight: '700' },
};

/* ------------------------------------------------------------------ */
/* 言葉選び（トンマナ）                                                 */
/* ------------------------------------------------------------------ */
/**
 * 事務的な語を避け、稽古と交流の場にふさわしい言い回しに置き換える。
 * 画面側で文言を直書きせず、可能な限りここを参照する。
 */
export const lexicon = {
  like: '拍手を送る',
  likeShort: '粋！',
  comment: '門下生の声',
  commentInput: '言の葉を届ける',
  aiScore: '極め度',
  aiAdvice: '身体操法の指南',
  masterTeaching: '師匠の教え',
} as const;

export const theme = { colors, spacing, radius, hairline, fontFamily, typography, lexicon };
export default theme;
