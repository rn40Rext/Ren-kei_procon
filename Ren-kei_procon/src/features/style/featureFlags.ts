/**
 * 連スタイル類似度 UI の公開可否。
 *
 * 仕様書 8.6 の検証（同一人物の別テイクでの一致率、熟練者の主観評価、
 * 体格・撮影条件の類似を「スタイル」と誤認していないかの確認）は
 * 実撮影データが必要で、まだ実施できていない。
 * **検証が通るまでユーザーへ公開しない**（イシュー #25）。
 *
 * 検証結果は docs/design/ai-style-similarity.md 7章に記録する。
 */
export const STYLE_SIMILARITY_UI_ENABLED = false;

/**
 * 連詳細・参加リクエスト画面への導線を有効にできるか。
 * 遷移先は #26（連詳細）/ #27（U-07 参加リクエスト）で実装予定。
 * 未登録の画面へ navigate するとクラッシュするため false のまま。
 */
export const REN_DETAIL_NAVIGATION_ENABLED = false;
