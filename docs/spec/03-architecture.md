<!-- 出典: Ren-Kei_システム仕様書_基本設計書_v0.3.docx / 章ごとに分割したもの。原本の記述は改変していない。 -->
> **Ren-Kei システム仕様書・基本設計書 v0.3** — 3. 全体アーキテクチャ
>
> [← 2. 用語・利用者・権限ロール](02-terms-and-roles.md) ｜ [章一覧](README.md) ｜ [4. 機能一覧・ユースケース →](04-functions-and-usecases.md)

---

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
