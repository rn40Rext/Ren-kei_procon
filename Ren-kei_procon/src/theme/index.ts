import { Platform, TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * 「連（ren-kei）」共通デザイン基盤（阿波藍ダークテーマ）。
 *
 * 色そのものは theme/colors.ts に一元化されている（既存の画面互換のため）。
 * ここでは色以外のトークン（余白・角丸・文字設定）を定義し、colors も
 * 合わせて re-export することで `import { colors, spacing } from '../theme'`
 * の形でまとめて参照できるようにする。
 */
export { colors };

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
