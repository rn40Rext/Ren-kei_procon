# Ren-Kei ドキュメント索引

阿波踊り練習支援プラットフォーム「Ren-Kei」の設計ドキュメント一覧です。

## まず読むもの

| 目的 | 文書 |
| --- | --- |
| プロジェクト全体を知りたい | [../README.md](../README.md) |
| **今どこまで実装されているか知りたい** | [status/gap-analysis.md](status/gap-analysis.md) |
| **次に何を作るか知りたい** | [status/roadmap.md](status/roadmap.md) |
| 仕様の正典を読みたい | [spec/README.md](spec/README.md) |

## ディレクトリ構成

```
docs/
├── README.md                   ← この索引
├── spec/                       仕様書 v0.3（正典・原本の記述は不変）
├── design/                     実装向け設計（仕様書を実装に落とし込んだもの）
├── status/                     実装状況・ロードマップ
├── api/                        旧 API メモ（初期の検討記録）
├── ER図.drawio                 ER 図（drawio 形式）
├── ER図 copy.drawio.png        ER 図（画像）
└── sec_image.png               アクセス権限設計の図
```

## spec/ — 仕様書 v0.3（正典）

Word 原本 `Ren-Kei_システム仕様書_基本設計書_v0.3.docx` を章ごとに分割したものです。**原本の記述は改変していません。** 仕様の解釈で迷ったらここが正典です。

→ [章一覧は spec/README.md](spec/README.md)

主要な章:

- [7章 AI機能① 基本動作トレーニング](spec/07-ai-basic-motion.md) — AI 採点の中核仕様
- [9章 データ設計](spec/09-data-design.md) — Entity とフィールドの全量
- [10章 認証・認可・Security Rules方針](spec/10-auth-and-security-rules.md) — CRUD 権限表
- [16章 プロトタイプ／MVP計画](spec/16-prototype-plan.md) — マイルストーンの根拠
- [17章 未確定事項](spec/17-open-items.md) — TBD-01〜15

## design/ — 実装向け設計

仕様書の方針を、実際のファイル・パス・コードへ落とし込んだ文書です。仕様書 [付録C](spec/92-appendix-c-next-documents.md)「詳細設計へ進む際に追加する文書」に対応します。

| 文書 | 内容 | 主な読者 |
| --- | --- | --- |
| [architecture.md](design/architecture.md) | システム構成、処理配置方針、技術スタック、ディレクトリ構成、既知のアーキテクチャ課題 | 全員 |
| [data-model.md](design/data-model.md) | **Firestore の物理パス確定案**、全コレクションのフィールド定義、複合インデックス、Storage パス命名規則、現行実装からの移行手順 | 全員 |
| [security-rules.md](design/security-rules.md) | **Firestore / Storage の実 Rules コード**、CRUD 権限表（実装版）、テストケース一覧 | バックエンド担当 |
| [ai-basic-motion.md](design/ai-basic-motion.md) | 正規化式、Rule Engine の状態機械と疑似コード、RULE-01〜07 の閾値初期値、Analysis Score 算出、リズム評価 | AI 担当 |
| [ai-style-similarity.md](design/ai-style-similarity.md) | Motion Encoder の選定観点、Embedding 設計、類似度の扱い、検証計画、縮退案 | AI 担当 |
| [api-functions.md](design/api-functions.md) | FN-01〜FN-07 の request/response 定義、Firestore トリガ、エラーコード対応 | バックエンド担当 |
| [screens.md](design/screens.md) | U-01〜U-10 / R-01〜R-08 と実装ファイルの対応、ナビゲーション構成、入力制約 | フロントエンド担当 |

## status/ — 実装状況

| 文書 | 内容 |
| --- | --- |
| [gap-analysis.md](status/gap-analysis.md) | 仕様書 v0.3 と実装の差分。機能 ID 別の達成度、データモデルの差分、セキュリティ上の問題、既知の不具合 |
| [roadmap.md](status/roadmap.md) | マイルストーンとイシューの対応、依存関係、未確定事項の決定タイミング |

## 図版

本文中の「図 1」〜「図 9」は Word 原本を参照してください。リポジトリにあるのは以下のみです。

| ファイル | 内容 |
| --- | --- |
| [ER図 copy.drawio.png](ER図%20copy.drawio.png) | 現行 ER 図（Users / Videos / Posts / Comments / GrowthRecord / Ren / JoinRequests / Nortifications） |
| [ER図.drawio](ER図.drawio) | 同 drawio ソース |
| [sec_image.png](sec_image.png) | データごとのアクセス権限設計 |

## api/ — 旧 API メモ

初期の検討記録です。**現在の設計は [design/api-functions.md](design/api-functions.md) が正**です。

| ファイル | 状態 |
| --- | --- |
| [api/api.design.md](api/api.design.md) | 「投稿API」の初期メモ。実装は現在クライアント直接書き込みで、この設計とは乖離している |
| `api/aip_list` | 空ファイル |

## 文書の更新ルール

| 対象 | 更新方法 |
| --- | --- |
| `spec/` | **直接編集しない。** 仕様変更は Word 原本を v0.4 として更新し、再分割する |
| `design/` | 実装で決定した事項（TBD の解決を含む）を随時追記する。イシューの受け入れ条件に「設計文書へ記録」を含めている |
| `status/gap-analysis.md` | マイルストーン完了時に見直す |
| `status/roadmap.md` | イシューの追加・完了時に更新する |
