# アーキテクチャ設計

> 出典: [仕様書 3章 全体アーキテクチャ](../spec/03-architecture.md) / [14章 非機能要件](../spec/14-non-functional.md)
> この文書は仕様書の方針を、現行リポジトリの実体に落とし込んだものです。

## 1. 全体構成

```
┌──────────────────────────── モバイルアプリ (Expo / React Native) ────────────────────────────┐
│                                                                                              │
│  UI 層          src/screens/*.tsx            画面（U-01〜U-10 / R-01〜R-08）                 │
│                 src/components/*.tsx         共通 UI（BottomNav 等）                         │
│                 src/navigation/*.tsx         React Navigation（Native Stack）                │
│                                                                                              │
│  ドメイン層     src/features/pose/           MediaPipe ラッパ・座標正規化       ※未実装      │
│                 src/features/rules/          Rule Engine（RULE-01〜07）         ※未実装      │
│                 src/features/scoring/        Game Score / Analysis Score        ※未実装      │
│                                                                                              │
│  データ層       src/repositories/            Firestore / Storage アクセス       ※未整備      │
│                 src/config/firebaseConfig.ts Firebase 初期化                                 │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │ Firebase JS SDK
        ┌──────────────────────────────────────┼──────────────────────────────────────┐
        │                                      │                                      │
┌───────▼────────┐                   ┌─────────▼─────────┐                 ┌──────────▼─────────┐
│ Firebase Auth  │                   │ Cloud Firestore   │                 │ Cloud Storage      │
│ Email/Password │                   │ ユーザー/投稿/連  │                 │ 動画ファイル       │
└────────────────┘                   └─────────┬─────────┘                 └──────────┬─────────┘
                                               │ トリガ / Callable                    │
                                     ┌─────────▼──────────────────────────────────────▼─────────┐
                                     │ Cloud Functions（FN-01〜FN-07）              ※未実装     │
                                     │  スコア確定 / 権限遷移 / 通知 / Embedding 再構築         │
                                     └─────────┬───────────────────────────────────────────────┘
                                               │ 重い推論のみ切り出す場合
                                     ┌─────────▼─────────┐
                                     │ Motion Encoder    │ ※未実装・モデル未確定（TBD-08）
                                     │ (Cloud Run 等)    │
                                     └───────────────────┘
```

## 2. 処理配置方針

仕様書 3.2 の方針をそのまま採用します。

| 処理 | 配置 | 理由 |
| --- | --- | --- |
| カメラ取得 | クライアント | リアルタイム表示が必要 |
| MediaPipe 姿勢推定 | クライアント優先 | フィードバック遅延 300ms 以内を満たすため（14.1） |
| Rule Engine | クライアント優先 | フレーム単位の即時判定。結果はバックエンドで再検証 |
| 動画保管 | Cloud Storage | Firestore に動画バイナリを置かない |
| ユーザー / 投稿 / 連 | Cloud Firestore | Security Rules で所有権を制御 |
| スタイル Embedding 生成 | バックエンド優先 | モデルが重く、更新を一元化したい |
| AnalysisResults / GrowthRecords 確定 | バックエンド（system） | クライアントによるスコア改ざんを防ぐ |

**重要な原則**: スコアはクライアントが自由に書ける場所に置きません。現在の実装（クライアントから `videos` へ直接 `score` を書き込む）はこの原則に反しており、[FN-01 finalizeBasicAnalysis](api-functions.md#fn-01-finalizebasicanalysis) の導入で解消します。

## 3. 現行の技術スタック

`Ren-kei_procon/package.json` の実体に基づきます。

| 分類 | 採用技術 | バージョン | 備考 |
| --- | --- | --- | --- |
| ランタイム | Expo | `^54.0.36` | `AGENTS.md` は v57 前提の記述。**要統一**（下記 5 章） |
| UI | React Native | `0.81.5` | |
| | React | `19.1.0` | |
| 言語 | TypeScript | `~5.9.2` | |
| ナビゲーション | `@react-navigation/native` + `native-stack` | `^7.x` | タブではなく Stack + 自作 `BottomNav` |
| BaaS | `firebase` (JS SDK) | `^12.17.1` | Auth / Firestore / Storage |
| カメラ | `expo-camera` | `~17.0.10` | 撮影・録画 |
| 動画 | `expo-av` | `~16.0.8` | 再生。将来 `expo-video` への移行を検討 |
| メディア選択 | `expo-image-picker` | `~17.0.11` | |
| アイコン | `lucide-react-native` | `^1.23.0` | `lucide-react`（Web 版）も混在しており整理対象 |
| 装飾 | `expo-linear-gradient` | `~15.0.8` | |
| 姿勢推定 | **未導入** | — | MediaPipe Tasks API の RN 組み込み方式が未確定（TBD-01） |

## 4. ディレクトリ構成

```
Ren-kei_procon/                     ← リポジトリルート
├── README.md                       プロジェクト概要
├── firebase.json                   Firebase デプロイ設定
├── .firebaserc                     プロジェクト ID: ren-kei
├── firestore.rules                 Firestore Security Rules（※サンプルのまま）
├── firestore.indexes.json          複合インデックス定義（空）
├── storage.rules                   Storage Security Rules（※全開放のまま）
├── functions/                      Cloud Functions（※テンプレートのまま）
│   └── src/index.ts
├── docs/                           設計ドキュメント（本ディレクトリ群）
│   ├── spec/                       仕様書 v0.3（章別）
│   ├── design/                     実装向け設計
│   ├── status/                     実装状況・ロードマップ
│   ├── api/                        旧 API メモ
│   └── ER図.drawio                 ER 図
└── Ren-kei_procon/                 ★ Expo アプリ本体
    ├── App.tsx
    ├── app.json
    ├── package.json
    ├── firebase/firebaseConfig.ts  ← 重複。src/config/ に統一予定
    └── src/
        ├── config/firebaseConfig.ts
        ├── navigation/AppNavigator.tsx
        ├── components/BottomNav.tsx
        └── screens/*.tsx
```

### 推奨する追加ディレクトリ

Rule Engine と AI 機能の実装に向けて、以下を新設します。

```
src/
├── features/
│   ├── pose/          poseLandmarker.ts, normalize.ts      姿勢推定と正規化
│   ├── rules/         ruleEngine.ts, rules/RULE-01.ts …    判定ロジック
│   ├── scoring/       gameScore.ts, analysisScore.ts       スコア算出
│   └── style/         styleClient.ts                       スタイル類似度 API 呼び出し
├── repositories/      users.ts, videos.ts, posts.ts, ren.ts  Firestore アクセスを集約
├── types/             firestore.ts                          Entity の型定義
└── hooks/             useAuth.ts, useCurrentUser.ts          共通フック
```

**方針**: 画面コンポーネントから `firebase/firestore` を直接呼ばず、`repositories/` を経由させます。現在は `CommunityScreen.tsx` などが `addDoc` / `uploadBytes` を直接呼んでおり、Rules 変更やデータモデル変更の影響が画面に直撃します。

## 5. 既知のアーキテクチャ上の課題

| # | 課題 | 影響 | 対応方針 |
| --- | --- | --- | --- |
| A-1 | ルート直下と `Ren-kei_procon/` に `package.json` が二重に存在し、Expo/React/TypeScript のバージョンが不一致。ルート側には `"undefined": "@expo/metro-runtime]"` という不正な依存エントリがある | 依存解決の混乱、ビルド再現性の低下 | アプリ本体の `Ren-kei_procon/package.json` を正とし、ルート側は Firebase ツール用途に限定して整理する |
| A-2 | `firebase/firebaseConfig.ts` と `src/config/firebaseConfig.ts` が重複。`App.tsx` は前者、各画面は後者を import | Firebase App の二重初期化リスク（現状は `getApps()` ガードで回避） | `src/config/firebaseConfig.ts` に統一し、旧ファイルを削除 |
| A-3 | `App.tsx` が `AppNavigator` に `user` prop を渡しているが、`AppNavigator` 側は prop を受け取らず自身で `onAuthStateChanged` を購読している | 認証状態の購読が二重。型不整合 | `AppNavigator` 側に一本化し、`App.tsx` は `NavigationContainer` のみを担う |
| A-4 | 画面が Firestore SDK を直接呼んでいる | データモデル変更時の影響範囲が広い | `repositories/` 層を導入（上記 4 章） |
| A-5 | `Camera` / `Result` / `Request` / `UserProfile` / `Chat` の 5 画面が `AppNavigator` に未登録なのに `navigate()` されている | 実行時に遷移失敗 | ナビゲーション定義の修正（[gap-analysis.md](../status/gap-analysis.md) 参照） |
| A-6 | `lucide-react`（Web 用）と `lucide-react-native` が両方入っている | バンドルサイズ増加、誤 import の温床 | `lucide-react` を削除 |

## 6. 環境と秘密情報

- Firebase プロジェクト: `ren-kei`（`.firebaserc`）
- `firebaseConfig` の値（apiKey 等）は Firebase Web SDK の公開識別子であり、ソースに含まれていても直接の脆弱性ではありません。**保護は Security Rules 側の責務**です（[security-rules.md](security-rules.md)）。
- 一方、サービスアカウント鍵や管理用シークレットはアプリへ埋め込みません（仕様書 14.2）。Cloud Functions 側の秘密情報は Firebase Secret Manager を使用します。
