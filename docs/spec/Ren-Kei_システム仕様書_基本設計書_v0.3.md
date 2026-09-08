**Ren-Kei**

**システム仕様書・基本設計書**

（プロトタイプ開発向け／一部詳細設計を含む）

| 文書バージョン | 0.3 |
| --- | --- |
| 作成日 | 2026-09-03 |
| 対象システム | Ren-Kei ～いつでも練習！「連」と「繋」げる踊り広場～ |
| 文書位置づけ | 要件定義 + 基本設計 + AI/データ/権限の詳細設計案 |

# 0. 文書情報

## 0.1 本書の位置づけ

本書は、提供されたパンフレット原稿、企画資料、ER図、ユーザー／連管理者UIフロー、Security Rules方針、プロトタイプ動画、および本会話で合意した設計方針を統合した、プロトタイプ開発用のシステム仕様書・基本設計書である。

現時点では、AI判定閾値、Motion Encoderの最終採用モデル、物理API形式、Firebase Security Rulesの実コード等が未確定である。そのため、完全な「実装詳細設計書」ではなく、実装チームが同じ構成・責務・データモデルを共有して開発を開始できる粒度を対象とする。

| 表記ルール | 【資料由来】提供資料に明記された内容。 【合意方針】会話で採用した方針。 【設計提案】資料不足部分を実装可能にするための提案。 【要検討】実装前または検証後に確定する項目。 |
| --- | --- |

## 0.2 参照資料

| No. | 資料 | 主な参照内容 |
| --- | --- | --- |
| 1 | Ren-Kei_パンフレット原稿.pdf | 目的、3主要機能、MediaPipe Tasks API、腰の身長正規化、FFTによるリズム解析 |
| 2 | app20021.pdf | 課題、機能詳細、成長曲線、連検索・勧誘、技術構成、類似システム比較 |
| 3 | ER_copy.drawio.png | 現行ER：Users / Videos / Posts / Comments / GrowthRecord / Ren / JoinRequests |
| 4 | ユーザー側UIフロー画像 | 一般ユーザーの画面構成・主要遷移 |
| 5 | ユーザー＋連管理者UIフロー画像 | 最新のユーザー全10画面、連管理者全8画面 |
| 6 | データごとのアクセス権限設計画像 | Authentication前提のCRUD権限方針 |
| 7 | プロトタイプ動画（約47秒） | ライブカメラ、骨格表示、GREAT/GOOD/MISS、LIVE SCORE、判定ゲージの体験イメージ |

## 0.3 現時点の主要決定事項

| ID | 決定事項 | 区分 |
| --- | --- | --- |
| D-01 | 阿波踊り全体を採点する独自深層学習モデルを一から学習する構成は採用しない。 | 合意方針 |
| D-02 | AI機能を「基本動作トレーニング」と「連スタイル類似度判定」の2系統に分離する。 | 合意方針 |
| D-03 | 基本動作はMediaPipe等の既存姿勢推定 + 明示的な判定ルールで評価する。 | 合意方針 |
| D-04 | リアルタイム中のゲームスコアと、終了後に履歴へ保存する0〜100の分析スコアを分離する。 | 合意方針 |
| D-05 | 連スタイルはMotion EncoderによるEmbeddingとコサイン類似度で比較する。MotionBERT/TMR等は候補であり未確定。 | 合意方針 |
| D-06 | Firebase Authentication / Firestore / Cloud Storageを中心とする構成を基本案とする。 | 資料＋設計方針 |
| D-07 | UIに存在する機能と現行ERの不足を埋める追加Entityを「追加推奨」として定義する。 | 設計提案 |

## 0.4 章構成

- 1. 背景・目的・対象範囲
- 2. 用語・利用者・権限ロール
- 3. 全体アーキテクチャ
- 4. 機能一覧・ユースケース
- 5. 画面設計（一般ユーザー）
- 6. 画面設計（連管理者）
- 7. AI機能① 基本動作トレーニング
- 8. AI機能② 連スタイル類似度判定
- 9. データ設計
- 10. 認証・認可・Security Rules方針
- 11. バックエンド／論理API設計
- 12. 主要シーケンス
- 13. エラー・例外設計
- 14. 非機能要件・セキュリティ・プライバシー
- 15. テスト設計
- 16. プロトタイプ／MVP計画
- 17. 未確定事項・今後の決定事項
- 付録. 参照図

# 1. 背景・目的・対象範囲

## 1.1 背景と課題

【資料由来】阿波踊りは「連」と呼ばれるグループ単位で踊る参加型の文化である。一方、初心者には連への参加方法が分かりにくい、最低限踊れる自信がない、一人での練習方法が分からない等の課題がある。連側にも、熟練者の技術共有機会の不足、地域・世代を超えた交流の難しさ、若手不足による活動継続の難しさがある。

## 1.2 システム目的

Ren-Keiは、スマートフォンを用いたAI補助付き練習、阿波踊り交流広場、連との接続を通して、「見る阿呆」から「踊る阿呆」へ移る最初のハードルを下げることを目的とする。AIは最終目的ではなく、初心者が練習し、成長を実感し、人から助言を受け、実際の連・地域コミュニティへつながるための橋渡し役とする。

**図 1**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図1-1 Ren-Keiの主要利用フロー（設計整理）*

## 1.3 対象範囲

| 区分 | 対象 | 備考 |
| --- | --- | --- |
| 対象 | スマートフォンでの基本動作練習・採点 | Android / iOSを想定 |
| 対象 | 練習動画・解析結果の保存と成長可視化 | GrowthRecords等へ保存 |
| 対象 | コミュニティ投稿・コメント・いいね | いいねは追加推奨Entity |
| 対象 | 連検索、参加リクエスト、所属連情報 | 連管理者による承認を含む |
| 対象 | 連管理者による投稿閲覧、アドバイス、メンバー・お知らせ・活動情報管理 | 最新UIフローに基づく |
| 対象 | どの連の動きに近いかのスタイル類似度判定 | Motion Encoderの最終選定は要検討 |
| 対象外/将来 | 阿波踊りの芸術性・楽しさ等を完全自動評価する独自大規模モデル | 将来研究テーマ |
| 対象外/将来 | 決済、チケット、イベント予約 | 現資料に要件なし |

# 2. 用語・利用者・権限ロール

## 2.1 用語

| 用語 | 定義 |
| --- | --- |
| 連（Ren） | 阿波踊りを行うグループ。システム上ではRen Entityで管理する。 |
| 一般ユーザー | 練習・投稿・連検索・参加申請を行う利用者。 |
| 連管理者 | 特定の連の情報・参加申請・メンバー・お知らせ等を管理するユーザー。 |
| 基本動作解析 | MediaPipe等で姿勢を取得し、明示ルールで「手の高さ」「腰」等を判定する処理。 |
| Game Score | 練習中にGOOD/GREAT等で加算されるゲーム的ポイント。成長履歴用の0〜100点とは別。 |
| Analysis Score | 練習終了後に0〜100へ正規化し、履歴比較に使用する点数。 |
| Embedding | 動画・動作系列を固定次元の数値ベクトルへ変換した表現。 |
| 類似度 | ユーザーEmbeddingと連Embedding間の近さ。確率ではなく動作表現上の類似度として扱う。 |

## 2.2 ロール

| ロールID | 名称 | 主な権限 |
| --- | --- | --- |
| user | 一般ユーザー | 自分のプロフィール・動画・履歴、投稿、コメント、参加申請 |
| ren_admin | 連管理者 | 対象連の参加申請承認、メンバー管理、お知らせ、活動情報、指導コメント |
| system | AI/システム | 解析結果・GrowthRecords生成、通知等のバックエンド処理 |
| service_admin | サービス管理者（将来） | 通報対応、不適切投稿管理、全体運営。現UI/ERでは詳細未定 |

# 3. 全体アーキテクチャ

## 3.1 論理構成

**図 2**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図3-1 推奨システム構成*

【資料由来】実行環境はAndroid/iOS、開発技術としてTypeScript、React Native、Python、MediaPipe Tasks API、TensorFlow Lite等が示されている。また、別の構成図ではCloud Firestore、Cloud Storage、Firebase Hosting等が示されている。資料間で技術構成に揺れがあるため、本書ではFirebase系を中心とする構成を基本案とし、物理実装はプロトタイプ検証後に確定する。

## 3.2 処理配置方針

| 処理 | 推奨配置 | 理由/備考 |
| --- | --- | --- |
| カメラ取得 | クライアント | リアルタイム表示が必要 |
| MediaPipe姿勢推定 | クライアント優先 | 音ゲー的フィードバックの遅延を抑える。端末性能次第で再検討。 |
| Rule Engine | クライアント優先 | フレームごとの即時判定。最終結果はバックエンドで検証/保存してもよい。 |
| 動画保管 | Cloud Storage | DBへ動画バイナリを直接保存しない。 |
| ユーザー/投稿/連 | Cloud Firestore | 現在のSecurity Rules案と整合。 |
| スタイルEmbedding | バックエンド優先 | モデルが重い可能性があり、モデル更新を一元化しやすい。 |
| GrowthRecords確定 | system/backend | ユーザー自身によるスコア改ざんを防ぐ。 |

# 4. 機能一覧・ユースケース

| ID | 分類 | 機能名 | 概要 |
| --- | --- | --- | --- |
| AUTH-01 | 認証 | 新規登録 | ユーザーアカウントを作成する |
| AUTH-02 | 認証 | ログイン | Firebase Authenticationで認証する |
| USER-01 | ユーザー | プロフィール閲覧/編集 | 名前、アイコン、プロフィール、danceStyle等 |
| PRACTICE-01 | 練習 | カメラ撮影 | 全身を撮影し姿勢推定へ渡す |
| PRACTICE-02 | 練習 | 基本動作リアルタイム判定 | GREAT/GOOD/MISSと指示を表示 |
| PRACTICE-03 | 練習 | ゲームスコア | 成功イベントに応じてLIVE SCOREを加算 |
| PRACTICE-04 | 練習 | 解析結果 | 終了後に0〜100点、項目別スコア、コメントを表示 |
| PRACTICE-05 | 練習 | 保存 | Videos/AnalysisResults/GrowthRecordsへ保存 |
| STYLE-01 | スタイル | 連スタイル類似度解析 | ユーザーEmbeddingと各連Embeddingを比較 |
| STYLE-02 | スタイル | 類似連表示 | 類似度ランキングを表示し連詳細へ遷移 |
| COMM-01 | 交流 | 投稿一覧 | コミュニティタイムライン |
| COMM-02 | 交流 | 投稿作成 | 解析済み動画から投稿 |
| COMM-03 | 交流 | 投稿詳細 | 動画、AI採点、コメント、いいね |
| COMM-04 | 交流 | コメント/アドバイス | 一般コメントおよび指導者コメント |
| COMM-05 | 交流 | いいね | 投稿に対するリアクション。追加推奨 |
| REN-01 | 連 | 連検索 | キーワード等で連を検索 |
| REN-02 | 連 | 連詳細/マイ連 | 連情報、活動、お知らせを表示 |
| REN-03 | 連 | 参加リクエスト | 任意メッセージ付きで参加申請 |
| REN-04 | 連管理 | 参加申請管理 | ren_adminが承認/却下 |
| REN-05 | 連管理 | メンバー管理 | 所属メンバーの確認・管理 |
| REN-06 | 連管理 | お知らせ管理 | 連のお知らせ作成・履歴 |
| REN-07 | 連管理 | 活動情報管理 | スケジュール/基本情報を管理 |
| HIST-01 | 成長 | 成長曲線 | スコア推移と項目別スコアを表示 |
| NOTI-01 | 通知 | 通知 | コメント、申請結果、お知らせ等。追加推奨 |

## 4.2 主要ユースケース

### UC-01 初心者が基本動作を練習する

ログイン → 踊り解析 → カメラで練習 → リアルタイムで手の高さ等を判定 → GREAT/GOOD/MISS表示 → 終了 → 0〜100点の結果を保存 → 成長曲線で過去結果と比較する。

### UC-02 練習結果をコミュニティへ投稿する

解析結果から「コミュニティへ投稿」 → 動画・タイトル・説明を確認 → Postsを作成 → タイムラインへ公開 → 他ユーザー/連管理者がコメントする。

### UC-03 自分に近い連を探す

練習動画または診断用動画 → Motion Encoder → 各連代表Embeddingと類似度計算 → 上位連を表示 → 連詳細 → 参加リクエスト。

### UC-04 連管理者が参加申請を処理する

管理ホーム → 参加リクエスト管理 → 申請者プロフィール/動画を確認 → 承認または却下 → 承認時にメンバー登録 → ユーザーへ通知。

# 5. 画面設計（一般ユーザー）

【資料由来】最新UIフローでは一般ユーザー側を全10画面として整理している。本書ではその構成を優先し、以前の11画面版は参考とする。

| 画面ID | 画面名 | 主要表示 | 主要操作 |
| --- | --- | --- | --- |
| U-01 | ホーム / 認証 | ロゴ、ログイン、新規登録。ログイン後は新着投稿・参加リクエスト・通知への導線。 | ログイン、新規登録、主要機能へ遷移 |
| U-02 | 踊り解析 | カメラ映像、骨格オーバーレイ、AI採点/開始、保存、LIVE SCORE。 | 撮影開始/停止、基本動作判定、保存 |
| U-03 | 解析結果 | 総合評価、項目別評価、AIコメント、グラフ、コミュニティ投稿ボタン。 | 結果確認、投稿へ遷移、履歴保存 |
| U-04 | コミュニティ（タイムライン） | 検索、投稿一覧、追加ボタン。 | 投稿検索/閲覧、投稿作成 |
| U-05 | 投稿詳細 | 動画、コメント一覧、いいね、アドバイス表示。 | コメント、いいね、投稿者情報確認 |
| U-06 | 投稿作成 | 動画選択、コメント/説明入力、投稿ボタン。 | Posts作成 |
| U-07 | 連への参加リクエスト | 連検索、連一覧、任意メッセージ、申請ボタン。 | JoinRequests作成 |
| U-08 | マイ連 | 所属連、アクティビティInfo、活動情報、お知らせ。 | 連情報/お知らせ確認 |
| U-09 | マイページ | プロフィール、投稿履歴、保存動画。 | プロフィール編集、履歴閲覧 |
| U-10 | 成長曲線 | 成長曲線、スコア推移、項目別スコア。 | GrowthRecords/AnalysisResultsを可視化 |

## 5.2 U-02 踊り解析画面 詳細

| 領域 | 表示/入力 | 仕様 |
| --- | --- | --- |
| カメラ領域 | ライブ映像 | 全身が入ることを推奨。人物検出信頼度が低い場合は警告。 |
| 骨格表示 | ランドマーク/骨格線 | デバッグ・理解補助。公開動画へ焼き込むかは要検討。 |
| 状態 | READY / ANALYZING等 | プロトタイプ動画の表示イメージを踏襲。 |
| 即時評価 | GREAT / GOOD / MISS | 判定イベント発生時に短時間表示。 |
| 改善メッセージ | 例: 手を上げよう | Rule Engineの失敗理由から生成。 |
| LIVE SCORE | 累積Game Score | 練習中のみ使用。成長履歴の0〜100点とは別。 |
| 項目ゲージ | 高さ/キープ/交互等 | プロトタイプに近い視覚表示。最終項目はルール確定後に決定。 |
| 操作 | 開始/停止/保存 | 誤操作防止のため解析中は状態を明示。 |

## 5.3 画面遷移の要点

- U-02 → U-03：練習終了・解析確定後に遷移する。
- U-03 → U-04/U-06：解析済み動画をコミュニティへ投稿する場合に遷移する。
- U-04 → U-05：タイムラインの任意投稿をタップ。
- U-05 → U-06：ユーザー自身の投稿編集/再投稿導線は要検討。
- U-07 → U-08：参加申請が承認されRenMembersへ登録された後、マイ連で所属情報を確認できる。
- U-09 → U-10：成長曲線への導線を設ける。

# 6. 画面設計（連管理者）

| 画面ID | 画面名 | 主要表示 | 主要操作 |
| --- | --- | --- | --- |
| R-01 | 管理ホーム | 新着投稿、参加リクエスト、通知 | 各管理画面へ遷移 |
| R-02 | 投稿一覧 | 検索、並び替え、投稿一覧 | ユーザー投稿を確認 |
| R-03 | 投稿詳細 | 動画、AI採点、プロフィール | アドバイス送信へ遷移 |
| R-04 | アドバイス送信 | コメント入力、送信 | 指導者コメントをCommentsへ保存 |
| R-05 | 参加リクエスト管理 | 未対応/承認済み/却下 | 承認/却下、状態更新 |
| R-06 | メンバー管理 | 連メンバー一覧、詳細 | RenMembersを管理 |
| R-07 | お知らせ管理 | 新規作成、配信履歴 | Announcementsを管理 |
| R-08 | 活動情報管理 | スケジュール、基本情報、編集 | RenActivities/Ren情報を管理 |

| 重要 | ren_adminは「管理者ロールである」だけでは他の連を編集できない。対象Renに対する管理者権限（RenMembers.role等）を必ず検証する。 |
| --- | --- |

# 7. AI機能① 基本動作トレーニング

## 7.1 目的と設計原則

【合意方針】独自の深層学習モデルで阿波踊りの「上手さ」を一括採点するのではなく、既存姿勢推定モデルで関節位置を取得し、連の熟練者から確認した基本動作を明示的なルールで判定する。判定根拠を説明可能にし、閾値を後から調整できることを重視する。

**図 3**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図7-1 AI解析の2系統*

## 7.2 姿勢推定入力

| 項目 | 仕様 |
| --- | --- |
| 入力 | スマートフォンのカメラ映像、または保存済み動画 |
| 候補ライブラリ | MediaPipe Tasks API / Pose Landmarker系 |
| 主要ランドマーク | nose, shoulders, elbows, wrists, hips, knees, ankles 等 |
| フレーム単位情報 | x, y, z（利用可能時）, visibility/presence等の信頼度 |
| 前処理 | 低信頼度点の除外、短時間の平滑化、身体サイズ正規化 |

## 7.3 座標正規化

【資料由来】腰の高さは身長で正規化し、体格差の影響を除く方針が示されている。実装ではピクセル距離を直接使わず、肩・腰・足首等から求めた身体スケールで距離・速度を正規化する。

| 指標 | 概念式 | 備考 |
| --- | --- | --- |
| bodyScale | distance(shoulderCenter, ankleCenter) | 身長相当。全身検出が不安定な場合の代替は要検討 |
| normalizedHandHeight | (headY - wristY) / bodyScale | 画像座標Yが下向き正の場合の例 |
| normalizedHipHeight | (ankleCenterY - hipCenterY) / bodyScale | 撮影距離差を抑える |
| normalizedVelocity | distance(p[t], p[t-1]) / bodyScale / Δt | 手の停止/キレ等に利用 |

## 7.4 基本動作ルール一覧

| ID | 項目 | 判定概要 | 主データ | 未確定点 |
| --- | --- | --- | --- | --- |
| RULE-01 | 手の高さ | 対象手首が頭部基準より十分上にある | 位置 | 閾値T_handHeightは連の指導者確認後に確定 |
| RULE-02 | 手のキープ | RULE-01等の適正位置を一定時間維持 | 時間 | holdDurationMsを設定 |
| RULE-03 | 腰の低さ | 正規化腰位置 + 膝角度等が基準内 | 位置/角度 | 身長正規化を必須とする |
| RULE-04 | 手を止める | 動作後の正規化手首速度が閾値未満で一定時間継続 | 速度/時間 | 「出して止める」を位置だけで判定しない |
| RULE-05 | 手の位置 | 手首が頭上の許容領域内にある | 位置 | 左右/男踊り女踊り差は要検討 |
| RULE-06 | 基本姿勢維持 | 複数条件の同時成立を一定時間維持 | 複合 | 腰・腕・上体等の組合せ |
| RULE-07 | リズム | 腰上下動等の周期と基準拍の差を評価 | 時系列 | 資料ではFFTによる周波数解析を想定 |

## 7.5 ルール判定状態

単一フレームで成功判定せず、時間方向の状態を持つ。短時間のランドマーク揺れでGOOD/MISSが連続反転しないようヒステリシスまたは連続成立時間を用いる。

| 状態 | 説明 | 遷移例 |
| --- | --- | --- |
| NOT_READY | 人物/対象部位が十分検出できない | 信頼度が閾値以上 → READY |
| READY | 判定可能だが条件未成立 | 条件成立開始 → HOLDING |
| HOLDING | 条件の連続成立時間を計測 | 継続 → SUCCESS / 逸脱 → READY |
| SUCCESS | 1回の成功イベントを発火 | 表示後 → READY/次ルール |
| MISS | 期待タイミングや許容範囲を外れた | 表示後 → READY |

## 7.6 リアルタイム評価とゲームスコア

【プロトタイプ由来】ライブカメラ上に骨格を表示し、右側にLIVE SCORE、評価ゲージ、GREAT/GOOD/MISS回数を表示する。成功時には映像上にもGREAT等と短い改善メッセージを重ねる体験を基本イメージとする。

| 評価 | 意味 | Game Score例（暫定） |
| --- | --- | --- |
| GREAT | 理想範囲内でルール達成 | +100 |
| GOOD | 最低基準を満たして達成 | +60 |
| MISS | 失敗/タイミング逸脱 | +0 |
| COMBO | 連続成功 | 倍率またはボーナス。MVPでは未実装でも可 |

| 暫定 | Game Scoreの具体点数・コンボ倍率はUX調整用であり、阿波踊り能力の絶対評価ではない。GrowthRecordsには別途0〜100のAnalysis Scoreを保存する。 |
| --- | --- |

## 7.7 終了後Analysis Score

| 項目 | 仕様 |
| --- | --- |
| totalScore | 0〜100。項目別スコアを集約した成長比較用スコア |
| handHeightScore | 手の高さ成功率・精度等から0〜100へ正規化 |
| hipHeightScore | 腰の低さ評価を0〜100へ正規化 |
| stopScore | 停止判定の成功率/安定度 |
| rhythmScore | 基準テンポとの差を0〜100へ変換 |
| feedback | 成功した点と改善点をルール根拠から生成 |
| analysisVersion | 判定ルールのバージョン。過去スコア比較時の意味を追跡する |

【要検討】totalScoreの重み付けは資料に定義がない。最初は単純平均等で仮実装し、連の指導者による妥当性確認後に確定する。

## 7.8 リズム評価

【資料由来】腰の上下動をFFTで周波数解析し、拍とのずれを求める案が示されている。MVPでは、腰中心Yの時系列を平滑化し、主周波数またはピーク間隔を取得する。基準BPMの取得方法（固定曲、端末再生音源、ユーザー選択等）は要検討とする。

## 7.9 判定ルールの外部化

【設計提案】閾値変更のたびにアプリを改修しないため、判定ルール定義を設定データとして管理できるようにする。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| ruleId | string | 例: HAND_ABOVE_HEAD |
| name | string | 表示名 |
| metric | string | 使用する指標 |
| minValue/maxValue | number? | 許容範囲 |
| holdDurationMs | number? | 継続成立時間 |
| enabled | boolean | 有効/無効 |
| version | string | ルールバージョン |

# 8. AI機能② 連スタイル類似度判定

## 8.1 目的

【合意方針】「上手い・下手」ではなく、ユーザーの動きのスタイルがどの連の熟練者の動きに近いかを示す。表示は「あなたは○○連タイプ／動きの類似度xx%」等とし、確率表現は行わない。

## 8.2 処理フロー

1.  ユーザー動画から姿勢系列またはモーション特徴を取得する。

2.  Motion Encoderで固定次元Embedding Uを生成する。

3.  各連について、承認済み熟練者動画のEmbeddingから代表Embedding R_iを生成する。

4.  cosine(U, R_i)を計算し、類似度降順に並べる。

5.  上位連をUIに表示し、そのまま連詳細・参加リクエストへ接続する。

## 8.3 モデル候補

| 候補 | 位置づけ | 確定状況 |
| --- | --- | --- |
| MotionBERT | 人体モーション表現の候補 | 未確定。実装容易性、入力形式、ライセンス、推論速度を検証 |
| TMR | テキスト/モーション表現等を扱う候補 | 未確定。目的に適する埋め込みが得られるか検証 |
| その他Motion Encoder | 比較対象 | 必要に応じて調査 |

## 8.4 代表Embedding

連ごとに1名だけを基準にすると個人差が強く出るため、可能であれば複数の熟練者・複数動画を用い、平均ベクトルまたはクラスタ等で代表表現を作る。最初のプロトタイプでは単純平均を使用してよい。

代表ベクトル例: R = (v1 + v2 + ... + vn) / n

## 8.5 類似度の扱い

cosine similarity = (U・R) / (||U|| ||R||)。表示値を単純に100倍するか、検証データに合わせて0〜100へ再スケーリングするかは実験で決定する。いずれの場合も「87%の確率で○○連」などの確率表現はしない。

## 8.6 検証要件

- 同一人物の別撮影でも同じ連が上位になりやすいか。
- 撮影距離・左右反転・速度差に過度に影響されないか。
- 連内個人差より連間差を十分に捉えられるか。
- 熟練者本人・連関係者の主観評価とランキングが大きく乖離しないか。
- モデルの出力が「踊り方のスタイル」を捉えているか。単なる体格・撮影条件の類似になっていないか。

# 9. データ設計

## 9.1 現行ER（資料由来）

| Entity | 現行フィールド |
| --- | --- |
| Users | uid(PK), name, mail, icon, profile, createdAt, nickname, danceStyle, ren, role |
| Videos | videoId(PK), userId, storageUrl, score, createdAt |
| Posts | postId(PK), userId, videoId, title, description, createdAt |
| Comments | commentId(PK), postId, userId, text, createdAt |
| GrowthRecord | recordId(PK), userId, score, date |
| Ren | renId(PK), name, description, location |
| JoinRequests | requestId(PK), userId, renId, status |

| 不整合 | 最新UIとAI仕様をそのまま実装するには、現行ERだけでは「項目別解析結果」「いいね」「複数連メンバー管理」「お知らせ」「活動予定」「通知」「連スタイルEmbedding」等を表現できない。以下を追加推奨とする。 |
| --- | --- |

**図 4**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図9-1 推奨論理ER（追加推奨Entityを含む）*

## 9.2 Core Entity詳細

### Users

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| uid | string | 必須/PK | Firebase Auth uid |
| name | string | 必須 | 氏名または表示名方針は要検討 |
| mail | string | 必須 | 認証メール。Auth側との二重管理方針を決定 |
| icon | string? | 任意 | 画像URL/Storage path |
| profile | string? | 任意 | 自己紹介 |
| nickname | string? | 任意 | 表示名 |
| danceStyle | string? | 任意 | 男踊り/女踊り等。型は要検討 |
| role | string | 必須 | user / ren_admin 等 |
| createdAt | Timestamp | 必須 | 作成日時 |

### Videos

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| videoId | string | 必須/PK | 動画ID |
| userId | string | 必須/FK | 所有ユーザー |
| storageUrl | string | 必須 | Cloud Storage参照 |
| visibility | string | 追加推奨 | private / public |
| analysisStatus | string | 追加推奨 | uploaded / analyzing / completed / failed |
| score | number? | 現行 | 互換用。将来はAnalysisResults.totalScoreを正とする |
| createdAt | Timestamp | 必須 | 作成日時 |

### Posts

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| postId | string | 必須/PK | 投稿ID |
| userId | string | 必須/FK | 投稿者 |
| videoId | string | 必須/FK | 公開対象動画 |
| title | string | 必須 | タイトル |
| description | string? | 任意 | 本文 |
| createdAt | Timestamp | 必須 | 作成日時 |

### Comments

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| commentId | string | 必須/PK | コメントID |
| postId | string | 必須/FK | 対象投稿 |
| userId | string | 必須/FK | コメント投稿者 |
| type | string | 追加推奨 | normal / instructor |
| text | string | 必須 | 本文 |
| createdAt | Timestamp | 必須 | 作成日時 |

### Ren

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| renId | string | 必須/PK | 連ID |
| name | string | 必須 | 連名 |
| description | string? | 任意 | 紹介 |
| location | string? | 任意 | 主な活動地域 |
| iconUrl | string? | 追加推奨 | 連アイコン |
| beginnerFriendly | boolean? | 追加推奨 | 初心者歓迎 |
| activityInfo | string? | 追加推奨 | 活動概要 |
| createdAt | Timestamp | 追加推奨 | 作成日時 |
| updatedAt | Timestamp | 追加推奨 | 更新日時 |

### JoinRequests

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| requestId | string | 必須/PK | 申請ID |
| userId | string | 必須/FK | 申請者 |
| renId | string | 必須/FK | 対象連 |
| message | string? | 追加推奨 | 任意メッセージ |
| status | string | 必須 | pending / approved / rejected / cancelled |
| createdAt | Timestamp | 追加推奨 | 申請日時 |
| updatedAt | Timestamp | 追加推奨 | 更新日時 |

## 9.3 追加推奨Entity

### AnalysisResults

| フィールド | 型 | 説明 |
| --- | --- | --- |
| analysisId | string | PK |
| videoId | string | Videos FK |
| userId | string | Users FK |
| totalScore | number | 0〜100 |
| gameScore | number | 練習中累積ポイント |
| handHeightScore | number? | 項目別 |
| hipHeightScore | number? | 項目別 |
| stopScore | number? | 項目別 |
| rhythmScore | number? | 項目別 |
| rawMetrics | map | 根拠数値 |
| goodCount/greatCount/missCount | number | イベント回数 |
| maxCombo | number? | 最大コンボ |
| feedback | array/map | 改善コメント |
| analysisVersion | string | ルール版 |
| createdAt | Timestamp | 作成日時 |

### GrowthRecords

| フィールド | 型 | 説明 |
| --- | --- | --- |
| recordId | string | PK |
| userId | string | Users FK |
| analysisId | string | AnalysisResults FK |
| score | number | 比較用総合点 |
| date | Timestamp | 記録日時 |

### Likes

| フィールド | 型 | 説明 |
| --- | --- | --- |
| postId | string | Posts FK |
| userId | string | Users FK |
| createdAt | Timestamp | 作成日時 |

### RenMembers

| フィールド | 型 | 説明 |
| --- | --- | --- |
| renId | string | Ren FK |
| userId | string | Users FK |
| role | string | member / admin |
| status | string | active等 |
| joinedAt | Timestamp | 加入日時 |

### Announcements

| フィールド | 型 | 説明 |
| --- | --- | --- |
| announcementId | string | PK |
| renId | string | Ren FK |
| title | string | タイトル |
| content | string | 本文 |
| createdBy | string | 管理者uid |
| createdAt | Timestamp | 作成日時 |

### RenActivities

| フィールド | 型 | 説明 |
| --- | --- | --- |
| activityId | string | PK |
| renId | string | Ren FK |
| title | string | 活動名 |
| description | string? | 説明 |
| startAt | Timestamp | 開始 |
| endAt | Timestamp? | 終了 |
| location | string? | 場所 |

### Notifications

| フィールド | 型 | 説明 |
| --- | --- | --- |
| notificationId | string | PK |
| userId | string | 通知先 |
| type | string | comment/join_result/announcement等 |
| referenceId | string? | 参照先ID |
| title | string | タイトル |
| body | string | 本文 |
| read | boolean | 既読 |
| createdAt | Timestamp | 作成日時 |

### RenStyleReferences

| フィールド | 型 | 説明 |
| --- | --- | --- |
| referenceId | string | PK |
| renId | string | Ren FK |
| userId | string? | 熟練者uid（任意） |
| videoId | string | 参照動画 |
| embeddingVersion | string | モデル版 |
| embeddingRef | string/map | Embedding保存先 |
| approved | boolean | 代表データ採用可否 |
| createdAt | Timestamp | 作成日時 |

### RenStyleProfiles

| フィールド | 型 | 説明 |
| --- | --- | --- |
| renId | string | Ren FK/PK候補 |
| embeddingVersion | string | モデル版 |
| embeddingRef | string/map | 代表Embedding |
| sampleCount | number | サンプル数 |
| updatedAt | Timestamp | 更新日時 |

### StyleAnalysisResults

| フィールド | 型 | 説明 |
| --- | --- | --- |
| styleAnalysisId | string | PK |
| userId | string | Users FK |
| videoId | string | Videos FK |
| modelVersion | string | モデル版 |
| results | array | renId + similarityの上位結果 |
| createdAt | Timestamp | 作成日時 |

## 9.4 状態遷移

### JoinRequests.status

| 現在 | 操作主体 | 操作 | 遷移先 |
| --- | --- | --- | --- |
| pending | 申請者 | 取消 | cancelled |
| pending | 対象連管理者 | 承認 | approved |
| pending | 対象連管理者 | 却下 | rejected |
| approved/rejected/cancelled | 通常ユーザー | 状態変更 | 原則不可（再申請は新規Request） |

### Videos.analysisStatus

| 状態 | 意味 | 次状態 |
| --- | --- | --- |
| uploaded | 動画保存済み、未解析 | analyzing |
| analyzing | 解析中 | completed / failed |
| completed | 解析結果確定 | 終端 |
| failed | 解析失敗 | 再解析でanalyzingへ戻すことを許可するか要検討 |

# 10. 認証・認可・Security Rules方針

## 10.1 認証

【資料由来】Authenticationによるログインを前提とする。Firebase AuthenticationのuidとUsers.uidを一致させ、データ所有者判定の基準とする。

## 10.2 CRUD権限

| データ | read | create | update | delete |
| --- | --- | --- | --- | --- |
| Users | ログインユーザー | 本人 | 本人 | 本人 |
| Videos | 本人 + AI/system（private時）／公開投稿経由はpublic | 本人 | 本人またはsystemの限定項目 | 本人 |
| Posts | 誰でも | ログインユーザー | 投稿者 | 投稿者 |
| Comments | ログインユーザー | ログインユーザー | コメント本人 | コメント本人 |
| GrowthRecords | 本人 | AI/system | AI/system | 本人（またはsystemのみも検討） |
| Ren | 誰でも | 正当な連管理者作成フロー | 対象連管理者 | 対象連管理者 |
| JoinRequests | 本人 + 対象連管理者 | 本人 | 本人/対象連管理者（許可遷移を分離） | 本人/対象連管理者（運用要検討） |
| RenMembers | 本人 + 対象連管理者 | system/対象連管理者 | 対象連管理者 | 対象連管理者 |
| Announcements | 誰でも/所属者のみは要件次第 | 対象連管理者 | 対象連管理者 | 対象連管理者 |
| RenActivities | 誰でも/所属者のみは要件次第 | 対象連管理者 | 対象連管理者 | 対象連管理者 |
| AnalysisResults | 本人 | AI/system | AI/system | 本人/system |
| StyleAnalysisResults | 本人 | AI/system | AI/system | 本人/system |

## 10.3 Security Rules上の重要制約

- Postsの公開とVideosの本人限定readが衝突するため、Videos.visibility等で非公開練習動画と公開投稿動画を分離する。
- Commentsの更新/削除権限は「Postの投稿者」ではなく「コメント自身のuserId」で判定する。
- Renの更新はrole == ren_adminだけで許可せず、対象renIdに対する管理者関係を確認する。
- JoinRequestsは申請者がpending→approvedへ変更できないよう、変更前後のstatusをRules/Backendで検証する。
- GrowthRecords/AnalysisResultsのスコア本体はクライアントから任意編集できない。
- role値を一般クライアントが自己昇格できないようUsers.roleの更新権限を制限する。

# 11. バックエンド／論理API設計

Firebaseを中心とする場合、すべてをREST API化する必要はない。低リスクCRUDはSecurity Rules付きFirestore直接アクセス、権限遷移・AI・非同期処理はCloud Functions/Cloud Run等へ分離する。以下は論理インターフェース案であり、HTTP/Callable/Triggerの最終形式は要検討。

| ID | 論理処理 | 権限 | 入力 | 出力/副作用 |
| --- | --- | --- | --- | --- |
| FN-01 | finalizeBasicAnalysis | 認証必須 | videoId, metrics, eventSummary | AnalysisResults作成、GrowthRecords作成 |
| FN-02 | analyzeStyle | 認証必須 | videoId | StyleAnalysisResultsまたはjobId |
| FN-03 | publishPost | 認証必須 | videoId,title,description | Posts作成 + video公開設定をトランザクション化 |
| FN-04 | submitJoinRequest | 認証必須 | renId,message | pendingのJoinRequest作成 |
| FN-05 | updateJoinRequestStatus | 対象連管理者 | requestId, approved/rejected | 状態検証 + RenMembers作成 + 通知 |
| FN-06 | createAnnouncement | 対象連管理者 | renId,title,content | Announcements作成 + 通知 |
| FN-07 | rebuildRenStyleProfile | system/管理者 | renId | 承認済み参照Embeddingから代表ベクトル更新 |

## 11.2 Firestore直接CRUD候補

- Usersの本人プロフィール編集（role等の保護フィールド除外）
- コミュニティPosts/Comments/Likes（Rulesで所有権検証）
- Renの公開情報read
- 自分のGrowthRecords/AnalysisResults read

# 12. 主要シーケンス

## 12.1 基本動作練習

1.  ユーザーがU-02を開きカメラ権限を許可する。

2.  カメラフレームをMediaPipeへ入力し、姿勢ランドマークを取得する。

3.  Rule Engineが各フレーム/時間窓を評価し、GREAT/GOOD/MISSとメッセージをUIへ返す。

4.  練習中はGame Scoreをローカルで加算する。

5.  終了時に動画をCloud Storageへ保存しVideosを作成する（動画保存を任意にするか要検討）。

6.  最終指標をsystem処理へ渡しAnalysisResultsを確定する。

7.  GrowthRecordsをsystemが作成し、U-03/U-10へ反映する。

## 12.2 コミュニティ投稿

1.  U-03またはU-06で解析済みvideoIdを選択する。

2.  title/descriptionを入力する。

3.  publishPostでPostsを作成し、対象Videos.visibilityをpublicへ変更する。

4.  U-04のタイムラインに表示する。

5.  他ユーザーはU-05でコメント/いいねを作成する。

## 12.3 連参加

1.  U-07でRenを検索し、任意メッセージ付きJoinRequestを作成する。

2.  R-05で対象連管理者がpending申請を確認する。

3.  承認時、JoinRequestをapprovedへ更新しRenMembersを作成する。

4.  ユーザーへ通知し、U-08でマイ連情報を表示する。

## 12.4 連スタイル類似度

1.  ユーザー動画をStorageへ保存し、スタイル解析を開始する。

2.  Motion EncoderでEmbeddingを生成する。

3.  同一modelVersionのRenStyleProfilesとコサイン類似度を計算する。

4.  上位N件をStyleAnalysisResultsへ保存する。

5.  UIで「動きの類似度」として表示し、Ren詳細/参加申請へ導線を出す。

# 13. エラー・例外設計

| コード | 条件 | ユーザー/システム動作 |
| --- | --- | --- |
| CAMERA_PERMISSION_DENIED | カメラ権限がない | 設定画面への案内を表示 |
| PERSON_NOT_DETECTED | 人物を十分検出できない | 全身が映る位置へ誘導 |
| LOW_LANDMARK_CONFIDENCE | 主要関節の信頼度が低い | 照明/距離/遮蔽を改善するメッセージ |
| MULTIPLE_PERSONS_DETECTED | 複数人検出 | MVPでは1人だけ映すよう案内 |
| VIDEO_UPLOAD_FAILED | 動画アップロード失敗 | 再試行。重複Videos作成を防ぐ |
| ANALYSIS_FAILED | 解析処理失敗 | failed状態を保存し再解析導線 |
| STYLE_MODEL_UNAVAILABLE | スタイルモデル利用不可 | 基本動作結果は保持し、スタイル診断のみ再試行 |
| UNAUTHORIZED | 未認証 | ログインへ誘導 |
| FORBIDDEN | 権限不足 | 対象操作を拒否 |
| JOIN_REQUEST_ALREADY_PENDING | 同一連へのpending申請あり | 既存申請を表示 |
| INVALID_STATUS_TRANSITION | 不正な状態遷移 | 更新拒否・ログ記録 |
| POST_VIDEO_NOT_PUBLICABLE | 動画所有権/解析状態不正 | 投稿を拒否 |

# 14. 非機能要件・セキュリティ・プライバシー

## 14.1 性能（暫定目標）

| 項目 | 暫定目標 | 備考 |
| --- | --- | --- |
| 基本動作フィードバック遅延 | 体感上即時。目標300ms以内 | 端末性能・MediaPipe実装方式で検証 |
| 姿勢推定更新頻度 | 目標10fps以上 | プロトタイプ動画では15FPS表示が確認できる。最終要件ではない |
| 通常画面API/Firestore表示 | 概ね2秒以内を目標 | ネットワーク依存 |
| スタイル解析 | 非同期許容 | 数秒〜数十秒でもUI上進捗を表示できれば可。モデル選定後確定 |

## 14.2 セキュリティ

- Authentication必須データではrequest.auth.uidを所有者判定に用いる。
- Cloud StorageもFirestoreと同様に所有権・公開範囲を制御する。
- Users.roleやRen管理者権限をクライアント入力だけで信用しない。
- 管理系処理・AI確定処理はバックエンド側で再検証する。
- 動画ファイル形式・サイズを検証し、推測可能な公開URL運用を避ける。
- 秘密鍵・サービスアカウント情報をアプリへ埋め込まない。

## 14.3 プライバシー

- 練習動画はデフォルトprivateとし、ユーザーが明示的に投稿した場合のみpublicへ変更する。
- AI解析のため身体映像/姿勢データを処理することを利用者へ明示する。
- 動画削除時はFirestore参照だけでなくStorage実体の削除も行う。
- 連スタイル参照動画は提供者の同意と利用範囲を明確化する。
- Embeddingが元動画の代替個人情報となり得る可能性を考慮し、アクセス制御と削除方針を設ける。
- 未成年利用を想定する場合の公開範囲・保護者同意等は別途要件化する。

# 15. テスト設計

## 15.1 基本動作Rule Engine

| テスト種別 | 内容 |
| --- | --- |
| Unit | 固定ランドマーク系列を入力し、手の高さ/腰/停止/キープが期待通り判定されるか |
| 境界値 | 閾値直前/直後、holdDuration直前/直後 |
| ノイズ | 座標揺れを加えたとき表示がチャタリングしないか |
| 欠損 | 手首/足首等のvisibility低下時に誤加点しないか |
| 左右 | 左右の手、鏡映像で一貫するか |
| 実地 | 連の指導者がOK/NGと判断した動画に対して判定が妥当か |

## 15.2 Security Rules

- 他人のprivate動画を読めない。
- 自分のGrowthRecords.scoreを書き換えられない。
- 一般ユーザーがUsers.roleをren_adminへ変更できない。
- 申請者がJoinRequestをapprovedへ変更できない。
- ren_adminが別の連のデータを更新できない。
- コメントAの投稿者がコメントBを削除できない。

## 15.3 スタイル類似度

- 同一動画の再解析でランキングが安定するか。
- 同一人物の別テイクで大きく順位が変わらないか。
- 撮影位置・速度・左右反転の影響を測定する。
- 連の熟練者による人手評価と比較する。
- 代表Embeddingのサンプル数を増やしたときの性能変化を測定する。

# 16. プロトタイプ／MVP計画

| 段階 | 範囲 | 完了条件 |
| --- | --- | --- |
| Prototype 1 | カメラ + MediaPipe + 手の高さ判定 + GOOD/MISS + リアルタイム加点 | 1つの基本動作がリアルタイムで安定判定され、プロトタイプ動画同等のフィードバックが出る |
| Prototype 2 | 手のキープ、腰の低さ、手の停止を追加 | 複数ルールを同時/順次判定でき、誤判定を調整できる |
| Prototype 3 | 終了後Analysis Score、Videos/AnalysisResults/GrowthRecords、成長曲線 | 練習履歴が保存され、U-10で成長推移を表示できる |
| Prototype 4 | Motion Encoder + 連参照動画 + コサイン類似度 | 最低2〜3連で類似度ランキングを表示できる |
| MVP Community | 投稿/コメント/いいね | 解析動画を安全に公開し交流できる |
| MVP Ren | 連検索/申請/管理者承認/マイ連 | 参加申請から所属表示まで一連で動作する |

## 16.2 実装優先順位

1.  基本動作Rule Engineの1ルールを完成させる。

2.  判定UI/LIVE SCOREの体験を固める。

3.  ルールを複数に拡張し、連の指導者から閾値の意見を得る。

4.  データ保存と成長曲線を接続する。

5.  コミュニティ/連接続を実装する。

6.  並行してスタイルEmbeddingの技術検証を行い、実用性が確認できてから本機能へ統合する。

# 17. 未確定事項・今後の決定事項

| ID | 項目 | 決定時期 |
| --- | --- | --- |
| TBD-01 | MediaPipeをReact Native端末内で直接実行する具体方式 | Prototype 1 |
| TBD-02 | 手の高さ・腰・停止等の閾値 | 連の指導者ヒアリング後 |
| TBD-03 | 男踊り/女踊りでルールを分ける範囲 | 要件確認 |
| TBD-04 | リズムの基準BPMと音源の扱い | Prototype 2〜3 |
| TBD-05 | Analysis Scoreの項目重み | 指導者評価との比較後 |
| TBD-06 | ゲームスコア/コンボの点数設計 | UXテスト後 |
| TBD-07 | 練習動画を常に保存するか、任意保存にするか | プライバシー/コスト検討 |
| TBD-08 | MotionBERT/TMR等の最終モデル選定 | Prototype 4技術検証 |
| TBD-09 | Embeddingの保存形式/ベクトル検索基盤 | モデル次元・規模確定後 |
| TBD-10 | 類似度の%表示へのスケーリング | 評価実験後 |
| TBD-11 | Users.renを廃止してRenMembersへ一本化するか | DB実装前 |
| TBD-12 | Firebase FunctionsとCloud Runの役割分担 | AIモデル/ランタイム確定後 |
| TBD-13 | サービス管理者・通報/モデレーション機能 | MVP後または公開前 |
| TBD-14 | 公開範囲（誰でもread vs ログイン限定） | 運用ポリシー決定 |
| TBD-15 | お知らせ・活動情報の公開対象 | 連ごとの要件確認 |

# 付録A. 参照図

以下は提供資料をそのまま参照するための付録であり、本書本文では最新UIフローと推奨拡張設計を優先している。

**図 5**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図A-1 提供ER図（現行案）*

**図 6**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図A-2 一般ユーザーUIフロー（初期案）*

**図 7**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図A-3 一般ユーザー＋連管理者UIフロー（最新案として優先）*

**図 8**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図A-4 データごとのアクセス権限設計（Security Rules方針）*

**図 9**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図A-5 プロトタイプ動画の代表フレーム（5/15/25/35/45秒）*

# 付録B. 仕様根拠マッピング

| 仕様テーマ | 主な根拠 |
| --- | --- |
| AI補助付き練習 | パンフレット原稿 2.1、app20021 p.6〜7 |
| MediaPipe/腰正規化/FFT | パンフレット原稿 2.1 |
| 交流広場・コメント | パンフレット原稿 2.2、app20021 p.7 |
| 連検索・参加・勧誘 | パンフレット原稿 2.3、app20021 p.8 |
| Android/iOS・React Native等 | app20021 p.11 |
| 画面構成 | 提供UIフロー画像 |
| 現行データ構造 | 提供ER図 |
| CRUD権限 | 提供Security Rules方針画像 |
| ゲーム的リアルタイム採点 | 提供プロトタイプ動画 + 会話合意 |
| 連スタイル類似度 | 会話で提示された参考方針を採用。モデルは未確定 |

# 付録C. 詳細設計へ進む際に追加する文書

- 画面ごとの項目ID・入力制約・イベント・API呼出表
- Firestore collection/document pathの確定版
- Cloud Storage path命名規則
- Security Rules実コードとRules Unit Test
- Cloud Functions/Cloud Runのrequest/response JSON Schema
- Rule Engineの閾値一覧・判定疑似コード・バージョン管理表
- Motion Encoderの技術選定結果・前処理・Embedding次元・推論環境
- 通知仕様（FCM等）
- 監視・ログ・障害復旧・データ削除手順
