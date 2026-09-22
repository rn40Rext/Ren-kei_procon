/**
 * 配色の一元管理。
 *
 * 画面ごとに色を定義しない（docs/rules/coding.md）。
 * 阿波踊りの伝統色（藍 / 朱 / 金）を基調にする。
 *
 * 2026-09、UIを阿波藍（深藍）を基底にしたダークテーマへ更新中（段階移行）。
 * 新しいキー（indigoDeep 以降）が現行のダークテーマ、上の既存キー
 * （indigo〜errorText）はまだ移行していない画面が参照しているため、
 * 削除せずそのまま残す。全画面の移行が終わったら整理する。
 */
export const colors = {
  /** 藍。主要な背景・見出し（旧ライトテーマ） */
  indigo: "#001E43",
  indigoLight: "#123A6B",
  /** 朱。強調・警告的でない注意喚起（旧ライトテーマ） */
  vermilion: "#E60012",
  /** 金。順位や達成の表現（旧ライトテーマ） */
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

  // ---------- ここから阿波藍ダークテーマ（新規） ----------
  // 基底色（阿波藍）— 静寂と格式
  indigoDeep: "#0B132B", // 深藍：画面の地
  indigoRaised: "#243354", // 一段持ち上げた面（入力欄・チップ）
  indigoLine: "rgba(212,175,55,0.18)", // 金を薄く敷いた罫線

  // 強調色（提灯茜）— 祭りの熱気・主要CTA
  aka: "#D9381E", // 茜色
  akaDeep: "#C84B31", // 朱赤
  akaSoft: "rgba(217,56,30,0.14)", // 茜の淡い下地

  // 装飾色（金泥）
  goldBright: "#F3E5AB", // 明るい金泥
  goldSoft: "rgba(212,175,55,0.12)", // 金の淡い下地
  kinari: "#F4EBD9", // 生成り：和紙・木札の文字色

  // ダークテーマの文字色。textPrimary/textSecondaryは旧ライトテーマ用の
  // 値（暗い文字色）のままなので、ダーク背景の上ではこちらを使う
  // （名前を流用すると意味が逆転してしまうため別名にしている）。
  textPrimaryOnIndigo: "#F4EBD9", // 生成り：深藍の上の本文
  textSecondaryOnIndigo: "#A9B4C9", // 藍がかった淡色：深藍の上の補足
  textMuted: "#6C7794",
  textOnGold: "#0B132B", // 金地の上の文字
  textOnAka: "#F4EBD9", // 茜地の上の文字

  success: "#5F9E7C",
  danger: "#E5604D",
  scrim: "rgba(11,19,43,0.94)",
  overlay: "rgba(0,0,0,0.55)",
} as const;

export type AppColors = typeof colors;
