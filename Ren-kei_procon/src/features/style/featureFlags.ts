/**
 * 連スタイル類似度 UI の公開可否。
 *
 * 仕様書 8.6 の検証のうち、実撮影データが要る 1（同一人物の別テイク一致率）・
 * 6（熟練者の主観評価）・7（体格・撮影条件の類似を「スタイル」と誤認していないか）は
 * まだ実施できていない（docs/design/ai-style-similarity.md 7章）。
 *
 * 2026-09-13 の決定: UI は表示するが、STYLE_SIMILARITY_VALIDATED が false の間は
 * 画面上部に「検証中・参考値」の帯を出し、順位を断定しない文言にする。
 * 非表示のままではデモも実データ収集も進まないため、ラベル付きで出す
 * （モックを実物のように見せない、という安全境界は「検証中」の明示で守る）。
 */
export const STYLE_SIMILARITY_UI_ENABLED = true;

/** 仕様書 8.6 の 1・6・7 を実データで満たしたら true にする。 */
export const STYLE_SIMILARITY_VALIDATED = false;

/**
 * 連詳細・参加リクエスト画面への導線。
 * 連を探す画面(U-07 / RequestScreen)は実装済みなので有効化した。
 * 特定の連を開いた状態で遷移するには Request に renId パラメータが要る(未対応)。
 */
export const REN_DETAIL_NAVIGATION_ENABLED = true;
