# Ren-Kei システム仕様書・基本設計書 v0.3（章別）

このディレクトリは、Word 原本 `Ren-Kei_システム仕様書_基本設計書_v0.3.docx` を章ごとに Markdown へ分割したものです。**原本の記述は改変していません。**

- 分割前の全文: [Ren-Kei_システム仕様書_基本設計書_v0.3.md](Ren-Kei_システム仕様書_基本設計書_v0.3.md)
- 図版（本文中の「図 1」〜「図 9」）は Word 原本を参照してください。ER 図のみリポジトリに画像があります → [../ER図 copy.drawio.png](../ER図%20copy.drawio.png)

| 文書バージョン | 0.3 |
| --- | --- |
| 作成日 | 2026-09-03 |
| 文書位置づけ | 要件定義 + 基本設計 + AI/データ/権限の詳細設計案 |

## 章一覧

| 章 | 内容 | 主に決まっていること |
| --- | --- | --- |
| [0. 文書情報](00-document-info.md) | 本書の位置づけ、参照資料、主要決定事項 D-01〜D-07 | 独自大規模モデルを作らない方針、AI を 2 系統に分離 |
| [1. 背景・目的・対象範囲](01-background.md) | 課題、システム目的、対象/対象外 | 「見る阿呆」から「踊る阿呆」への橋渡しが目的 |
| [2. 用語・利用者・権限ロール](02-terms-and-roles.md) | 用語定義、ロール定義 | `user` / `ren_admin` / `system` / `service_admin` |
| [3. 全体アーキテクチャ](03-architecture.md) | 論理構成、処理配置方針 | 姿勢推定はクライアント、スコア確定はバックエンド |
| [4. 機能一覧・ユースケース](04-functions-and-usecases.md) | 機能 ID 一覧（AUTH/USER/PRACTICE/STYLE/COMM/REN/HIST/NOTI）、UC-01〜04 | 実装対象機能の全量 |
| [5. 画面設計（一般ユーザー）](05-screens-user.md) | U-01〜U-10 の 10 画面 | 画面ごとの主要表示・操作 |
| [6. 画面設計（連管理者）](06-screens-ren-admin.md) | R-01〜R-08 の 8 画面 | 連管理者は対象連の権限を必ず検証する |
| [7. AI機能① 基本動作トレーニング](07-ai-basic-motion.md) | 姿勢推定、正規化、RULE-01〜07、状態遷移、Game/Analysis Score | AI 採点の中核仕様 |
| [8. AI機能② 連スタイル類似度判定](08-ai-style-similarity.md) | Motion Encoder、Embedding、コサイン類似度、検証要件 | モデルは未確定（TBD-08） |
| [9. データ設計](09-data-design.md) | 現行 ER + 追加推奨 Entity、状態遷移 | Entity とフィールドの全量 |
| [10. 認証・認可・Security Rules方針](10-auth-and-security-rules.md) | CRUD 権限表、Rules 上の重要制約 | 誰が何を read/create/update/delete できるか |
| [11. バックエンド／論理API設計](11-backend-api.md) | FN-01〜FN-07、Firestore 直接 CRUD 候補 | バックエンドに寄せる処理の切り分け |
| [12. 主要シーケンス](12-sequences.md) | 練習・投稿・連参加・スタイル判定の 4 シーケンス | 処理順序 |
| [13. エラー・例外設計](13-error-handling.md) | エラーコード一覧 | `CAMERA_PERMISSION_DENIED` 等 12 種 |
| [14. 非機能要件・セキュリティ・プライバシー](14-non-functional.md) | 性能目標、セキュリティ、プライバシー | フィードバック遅延 300ms 以内、10fps 以上 |
| [15. テスト設計](15-testing.md) | Rule Engine / Security Rules / スタイル類似度のテスト | 検証観点 |
| [16. プロトタイプ／MVP計画](16-prototype-plan.md) | Prototype 1〜4、MVP Community/Ren | マイルストーンの根拠 |
| [17. 未確定事項・今後の決定事項](17-open-items.md) | TBD-01〜TBD-15 | 判断が必要な残課題 |
| [付録A. 参照図](90-appendix-a-figures.md) | 参照図の一覧 | 図は Word 原本参照 |
| [付録B. 仕様根拠マッピング](91-appendix-b-traceability.md) | 仕様テーマ → 根拠資料 | トレーサビリティ |
| [付録C. 詳細設計へ進む際に追加する文書](92-appendix-c-next-documents.md) | 今後追加すべき文書一覧 | → [../design/](../design/) で一部を着手済み |

## 本書と実装の関係

本書は**設計の目標**であり、現在のコードはまだその一部しか実装していません。実装状況の差分は [../status/gap-analysis.md](../status/gap-analysis.md) を参照してください。

付録 C が「詳細設計へ進む際に追加する文書」として挙げた項目のうち、以下は [../design/](../design/) に着手しています。

| 付録 C の項目 | 対応文書 |
| --- | --- |
| Firestore collection/document path の確定版 | [../design/data-model.md](../design/data-model.md) |
| Cloud Storage path 命名規則 | [../design/data-model.md](../design/data-model.md) |
| Security Rules 実コードと Rules Unit Test | [../design/security-rules.md](../design/security-rules.md) |
| Cloud Functions の request/response 定義 | [../design/api-functions.md](../design/api-functions.md) |
| Rule Engine の閾値一覧・判定疑似コード | [../design/ai-basic-motion.md](../design/ai-basic-motion.md) |
| Motion Encoder の技術選定・Embedding 設計 | [../design/ai-style-similarity.md](../design/ai-style-similarity.md) |
| 画面ごとの項目・イベント・API 呼出表 | [../design/screens.md](../design/screens.md) |
