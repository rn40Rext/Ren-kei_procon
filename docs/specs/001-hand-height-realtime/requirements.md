# 001-hand-height-realtime — requirements

> フェーズ [1]。書き方は [../../rules/workflow.md](../../rules/workflow.md) を参照。
> **承認状態: 承認済み（2026-09-03）**
>
> この spec は [workflow.md](../../rules/workflow.md) 3章のケース B（TBD-01 の判断が #13〜#16 を決める）および C（スコープの線引き）に該当するため作成しました。
> **通常の実装はイシュー駆動で進めます**（spec は不要）。

| 項目 | 値 |
| --- | --- |
| 対応する機能 ID | PRACTICE-01（カメラ撮影）, PRACTICE-02（基本動作リアルタイム判定）, PRACTICE-03（ゲームスコア） |
| 対応する画面 ID | U-02 踊り解析 |
| 対応イシュー | [#13](../../../../issues/13) [#14](../../../../issues/14) [#15](../../../../issues/15) [#16](../../../../issues/16)（エピック [#5](../../../../issues/5)） |
| マイルストーン | Prototype 1 |

## 1. 目的

練習中のユーザーが、**自分の手が十分に上がっているかを、踊りながらその場で確認できる**ようになる。

現在は撮影しても何のフィードバックも得られず、投稿時にランダムな点数が付くだけです。この増分によって、初めて「AI が自分の動きを見て反応している」体験が成立します。仕様書 16 章が Prototype 1 の完了条件に挙げる「プロトタイプ動画同等のフィードバック」がここに相当します。

## 2. 背景・正典での位置づけ

| 参照 | 内容 |
| --- | --- |
| [docs/spec/07-ai-basic-motion.md](../../spec/07-ai-basic-motion.md) | 7.2 姿勢推定入力 / 7.3 座標正規化 / 7.4 RULE-01 / 7.5 判定状態 / 7.6 リアルタイム評価 |
| [docs/spec/05-screens-user.md](../../spec/05-screens-user.md) | 5.2 U-02 踊り解析画面の詳細 |
| [docs/spec/16-prototype-plan.md](../../spec/16-prototype-plan.md) | Prototype 1 の完了条件、16.2 実装優先順位 |
| [docs/design/ai-basic-motion.md](../../design/ai-basic-motion.md) | 正規化式、状態機械の疑似コード、閾値初期値 |

### 現状

- `CameraScreen.tsx` は `expo-camera` でプレビューを表示するのみ。**録画も解析もしていない**
- 姿勢推定ライブラリが未導入
- AI 採点は `CommunityScreen.tsx:76` の `Math.floor(Math.random() * 20) + 80`
- `ScoringScreen` から `navigate('Camera')` しているが `Camera` はナビゲータ未登録で**遷移するとクラッシュする**

## 3. スコープ

- MediaPipe（または代替）による姿勢ランドマーク取得のアプリ組み込み
- 座標正規化ユーティリティ（`bodyScale` による体格・撮影距離の吸収）
- Rule Engine の基盤（状態機械 `NOT_READY → READY → HOLDING → SUCCESS/MISS`、ヒステリシス）
- **RULE-01「手の高さ」のみ**の判定
- U-02 画面のリアルタイム表示: 骨格オーバーレイ、GREAT/GOOD/MISS、改善メッセージ、LIVE SCORE、項目ゲージ
- Game Score の加算（GREAT +100 / GOOD +60 / MISS +0）
- 人物未検出・低信頼度・複数人検出・カメラ権限なしの扱い
- Rule Engine のユニットテスト（フィクスチャによる、実機不要）

## 4. スコープ外

- **RULE-02〜07**（手のキープ・腰の低さ・手を止める・手の位置・基本姿勢維持・リズム）→ [#17](../../../../issues/17) [#18](../../../../issues/18) [#19](../../../../issues/19)、spec は別に切る
- **終了後の Analysis Score（0〜100）と U-03 解析結果画面** → [#20](../../../../issues/20)、Prototype 3
- **動画の保存・Firestore への記録** → Prototype 3（`videos` / `analysisResults`）。この spec では**画面内で完結し、何も永続化しない**
- **判定閾値の Firestore 外部化** → [#21](../../../../issues/21)。この spec ではアプリ内定数として持つ
- **コンボ倍率** → 仕様書 7.6 で「MVP では未実装でも可」とされている
- **男踊り / 女踊りによるルールの差** → TBD-03。この spec では共通ルールとする
- **スタイル類似度** → エピック [#6](../../../../issues/6)

## 5. 受け入れ基準

閾値は [docs/design/ai-basic-motion.md](../../design/ai-basic-motion.md) 6章の**暫定値**を使います（`bodyScale` 正規化後の比率）。

| ID | 基準 | 検証方法 |
| --- | --- | --- |
| AC-1 | システムは常にカメラ映像から 33 点の姿勢ランドマーク（x, y, visibility）を取得する SHALL | 実機で取得数をログ確認 |
| AC-2 | システムは常にランドマーク取得を 10fps 以上で行う SHALL | 実機で fps 計測 |
| AC-3 | WHEN 判定イベントが発生した THEN システムは 300ms 以内に画面へ表示する SHALL | 実機で計測 |
| AC-4 | WHEN `normalizedHandHeight` が 0.05 を超える状態が 200ms 継続した THEN システムは GOOD イベントを発火する SHALL | ユニットテスト（フィクスチャ） |
| AC-5 | WHEN `normalizedHandHeight` が 0.12 を超える状態が 200ms 継続した THEN システムは GOOD ではなく GREAT イベントを発火する SHALL | ユニットテスト |
| AC-6 | WHILE 肩中心または足首中心の visibility が 0.5 未満である THEN システムは状態を NOT_READY とし、いかなるイベントも発火しない SHALL | ユニットテスト |
| AC-7 | WHEN ランドマーク座標に閾値付近の微小な揺れが加わった THEN システムは GOOD と MISS を交互に反転させない SHALL（ヒステリシス） | ユニットテスト（ノイズ付きフィクスチャ） |
| AC-8 | システムは左右いずれの手首についても同一の基準で判定する SHALL。鏡像入力でも結果が一致する SHALL | ユニットテスト |
| AC-9 | WHEN GREAT が発火した THEN システムは Game Score に 100 を加算する SHALL。GOOD なら 60、MISS なら 0 を加算する SHALL | ユニットテスト |
| AC-10 | WHILE 解析中である THEN システムはカメラ映像上に骨格線とランドマークを重ねて表示する SHALL | 実機で目視 |
| AC-11 | WHEN MISS が発火した THEN システムは失敗理由に基づく改善メッセージ（例「手を上げよう」）を表示する SHALL | 実機で目視 |
| AC-12 | WHILE 条件成立の継続時間を計測中である THEN システムは進捗を 0〜1 の項目ゲージとして表示する SHALL | 実機で目視 |
| AC-13 | IF カメラ権限が付与されていない THEN システムは設定画面への案内を表示する SHALL（`CAMERA_PERMISSION_DENIED`） | 実機で権限を拒否して確認 |
| AC-14 | IF 人物を十分に検出できない THEN システムは全身が映る位置への誘導を表示する SHALL（`PERSON_NOT_DETECTED`） | 実機で確認 |
| AC-15 | IF 複数人が検出された THEN システムは 1 人だけ映すよう案内する SHALL（`MULTIPLE_PERSONS_DETECTED`） | 実機で 2 人映して確認 |
| AC-16 | システムは常に Game Score を「練習中の得点」として表示し、0〜100 の Analysis Score と混同させない SHALL | 実機で文言を目視 |

### 検証できない基準を置かないこと

「自然なフィードバックになっている」「使いやすい」といった基準はここに含めていません。UX の良否は別途ユーザーテストで扱います。

## 6. 前提・依存

| 依存 | 理由 |
| --- | --- |
| [#51](../../../../issues/51) | `Camera` 画面がナビゲータ未登録。**この spec で `Camera` を使うため、先に修正が必要** |
| [#54](../../../../issues/54) | `npm start` が使えない。開発の入口 |
| [#55](../../../../issues/55) | Expo のバージョンが v54 / v57 で不確定。**姿勢推定ライブラリの選定に影響する** |

## 7. 未確定事項

| ID | 内容 | いつ誰が決めるか |
| --- | --- | --- |
| TBD-01 | MediaPipe を React Native 端末内で直接実行する方式（VisionCamera+ネイティブ / WebView+WASM / TFLite） | **この spec の design フェーズで検証して決める**。[#13](../../../../issues/13) |
| TBD-02 | `normalizedHandHeight` の閾値（暫定 GOOD 0.05 / GREAT 0.12）と `holdDurationMs`（暫定 200ms） | 連の指導者へのヒアリング後。**この spec では暫定値で実装し、外部化は [#21](../../../../issues/21) で行う** |
| TBD-06 | Game Score の点数設計（暫定 100/60/0） | UX テスト後 |
| — | Expo のバージョン（v54 か v57 か） | [#55](../../../../issues/55)。**design フェーズ前に確定させたい** |

**TBD-01 がこの spec の成否を左右します。** 方式が決まらないと AC-1〜AC-3 を満たせません。design フェーズで実際に動かして判断してください。

## 8. 非対象の判断

| やらないこと | 理由 |
| --- | --- |
| 動画をサーバへ送って解析する | リアルタイム性を満たせない。仕様書 3.2 の処理配置方針に反する |
| 独自の深層学習モデルで「上手さ」を採点する | 決定事項 D-01 で採用しないと決めている |
| 複数ルールを同時に実装する | 仕様書 16.2 が「基本動作 Rule Engine の 1 ルールを完成させる」を最優先に挙げている。1 本通してから広げる |
| この spec で結果を保存する | 保存は Prototype 3 の範囲。ここで Firestore を触ると、[#41](../../../../issues/41) の `visibility` 導入や [#35](../../../../issues/35) の FN-01 と衝突する |
