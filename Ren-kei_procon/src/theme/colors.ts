/**
 * 配色の一元管理。
 *
 * 画面ごとに色を定義しない（docs/rules/coding.md）。
 * 阿波踊りの伝統色（藍 / 朱 / 金）を基調にする。
 */
export const colors = {
  /** 藍。主要な背景・見出し */
  indigo: "#001E43",
  indigoLight: "#123A6B",
  /** 朱。強調・警告的でない注意喚起 */
  vermilion: "#E60012",
  /** 金。順位や達成の表現 */
  gold: "#D4AF37",

  background: "#F7F8FA",
  surface: "#FFFFFF",
  border: "#E2E5EB",

  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textOnDark: "#FFFFFF",

  /** 注記・参考値であることを示す帯 */
  noticeBackground: "#FFF6E5",
  noticeText: "#8A6100",

  /** エラー表示 */
  errorBackground: "#FDECEC",
  errorText: "#B3261E",
} as const;

export type AppColors = typeof colors;
