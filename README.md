# Ren-Kei（連契）

**いつでも練習！「連」と「繋」げる踊り広場**

阿波踊りの練習をスマートフォンで支援するモバイルアプリです。AI による基本動作の採点、練習動画を共有する交流広場、自分に合った「連」との接続を通して、**「見る阿呆」から「踊る阿呆」へ移る最初のハードルを下げる**ことを目的としています。

## 背景

阿波踊りは「連」と呼ばれるグループ単位で踊る参加型の文化です。しかし初心者には次のような壁があります。

- 連への参加方法が分かりにくい
- 最低限踊れる自信がない
- 一人での練習方法が分からない

連の側にも、熟練者の技術を共有する機会の不足、地域・世代を超えた交流の難しさ、若手不足による活動継続の難しさがあります。Ren-Kei はこの両者をつなぐ橋渡し役を担います。

AI は最終目的ではありません。初心者が練習し、成長を実感し、人から助言を受け、**実際の連・地域コミュニティへつながる**ための手段として位置づけています。

## 主な機能と実装状況

| 機能 | 内容 | 状況 |
| --- | --- | --- |
| 認証 | メール/パスワードによる登録・ログイン | ✅ 実装済み |
| 交流広場 | 練習動画の投稿・閲覧、コメント（門下生の声 / 師匠の教え）、いいね、タグ絞り込み | ✅ 実装済み |
| マイページ | プロフィール表示・ニックネーム編集 | 🔶 部分実装 |
| AI 解析① 基本動作 | 姿勢推定 + 判定ルールで手の高さ・腰の低さ・停止・リズムを採点。GREAT/GOOD/MISS のリアルタイム表示 | ⚠️ **未実装**（現在の採点は乱数によるモック） |
| AI 解析② 連スタイル類似度 | どの連の熟練者の動きに近いかを判定 | ❌ 未着手 |
| 成長記録 | 練習履歴の保存と成長曲線 | ❌ 未着手 |
| 連（Ren）機能 | 連の検索、参加リクエスト、マイ連 | ❌ 未着手 |
| 連管理者機能 | 参加申請の承認、メンバー管理、お知らせ、アドバイス送信 | ❌ 未着手 |
| 通知 | コメント・申請結果・お知らせの通知 | ❌ 未着手 |

> ⚠️ **AI 採点は現在モックです。** 投稿時に 80〜99 のランダム値を「AI 採点」として表示しています（`CommunityScreen.tsx`）。画面上は AI が動いているように見えるため、デモや発表の際は注意してください。実装状況の詳細は [docs/status/gap-analysis.md](docs/status/gap-analysis.md) を参照してください。

## 技術スタック

| 分類 | 採用技術 |
| --- | --- |
| フレームワーク | Expo / React Native 0.81 / React 19 |
| 言語 | TypeScript |
| ナビゲーション | React Navigation v7（Native Stack） |
| バックエンド | Firebase（Authentication / Cloud Firestore / Cloud Storage / Cloud Functions） |
| カメラ・動画 | expo-camera / expo-av / expo-image-picker |
| UI | lucide-react-native / expo-linear-gradient |
| 姿勢推定（予定） | MediaPipe Tasks API — 組み込み方式は検証中（[#13](../../issues/13)） |

Firebase プロジェクト: `ren-kei`

## ディレクトリ構成

```
Ren-kei_procon/
├── README.md                   ← この文書
├── docs/                       設計ドキュメント → docs/README.md が索引
├── firebase.json               Firebase デプロイ設定
├── firestore.rules             Firestore Security Rules ※未整備
├── storage.rules               Storage Security Rules   ※未整備
├── functions/                  Cloud Functions          ※未実装
└── Ren-kei_procon/             ★ Expo アプリ本体
    ├── App.tsx
    ├── app.json
    └── src/
        ├── config/firebaseConfig.ts
        ├── navigation/AppNavigator.tsx
        ├── components/BottomNav.tsx
        └── screens/            各画面
```

アプリ本体がサブディレクトリ `Ren-kei_procon/` にある点に注意してください。ルート直下は Firebase の設定とドキュメント用です。

## セットアップ

### 必要なもの

- Node.js（Cloud Functions は Node 24 を要求）
- Expo Go アプリ（実機で確認する場合）または iOS Simulator / Android Emulator
- Firebase CLI（Rules や Functions をデプロイする場合）

### アプリの起動

```bash
cd Ren-kei_procon
npm install
npx expo start
```

表示された QR コードを Expo Go で読み取るか、`i`（iOS Simulator）/ `a`（Android Emulator）/ `w`（Web）を押します。

> ⚠️ アプリの `package.json` に `scripts` と `main` が定義されていないため `npm start` は使えません。`npx expo start` を直接実行してください（[B-11](docs/status/gap-analysis.md#6-実装上の既知の不具合)）。

### Cloud Functions

```bash
cd functions
npm install
npm run build
npm run serve      # Emulator で起動
npm run deploy     # デプロイ
```

### Security Rules のデプロイ

```bash
firebase deploy --only firestore:rules,storage
```

## ⚠️ 開発前に知っておくべきこと

着手前に [docs/status/gap-analysis.md](docs/status/gap-analysis.md) を一読してください。特に次の 2 点は影響が大きいです。

### 1. Storage Rules が全開放されています — [#50](../../issues/50)

`storage.rules` が現在 `allow read, write: if true` になっており、**未認証の第三者が動画をアップロード・上書き・削除できます**。アプリを誰かに触らせる前に対処してください（暫定対処は [#50](../../issues/50)、本格実装は [#40](../../issues/40)、修正案は [docs/design/security-rules.md](docs/design/security-rules.md)）。

### 2. 5 つの画面がナビゲータに未登録です — [#51](../../issues/51)

`Camera` / `Result` / `Request` / `UserProfile` / `Chat` の 5 画面は `AppNavigator.tsx` に登録されていないのに `navigate()` されており、**遷移するとアプリが落ちます**。AI 機能の開発では `Camera` / `Result` を使うため、先に修正が必要です。

### 3. AI 採点のスコア表示はモックです — [#58](../../issues/58)

実際には解析していないランダム値を「AI ○○点」と表示しています。デモや発表で実在しない採点結果を提示しないよう注意してください。

## ドキュメント

| 目的 | 文書 |
| --- | --- |
| ドキュメント全体の索引 | [docs/README.md](docs/README.md) |
| **仕様の正典（v0.3）** | [docs/spec/README.md](docs/spec/README.md) |
| 現在の実装状況と仕様との差分 | [docs/status/gap-analysis.md](docs/status/gap-analysis.md) |
| 実装ロードマップとイシュー対応 | [docs/status/roadmap.md](docs/status/roadmap.md) |
| システム構成・技術スタック | [docs/design/architecture.md](docs/design/architecture.md) |
| Firestore のパスとフィールド定義 | [docs/design/data-model.md](docs/design/data-model.md) |
| Security Rules の実装案 | [docs/design/security-rules.md](docs/design/security-rules.md) |
| AI 解析①（Rule Engine）の設計 | [docs/design/ai-basic-motion.md](docs/design/ai-basic-motion.md) |
| AI 解析②（スタイル類似度）の設計 | [docs/design/ai-style-similarity.md](docs/design/ai-style-similarity.md) |
| Cloud Functions の API 定義 | [docs/design/api-functions.md](docs/design/api-functions.md) |
| 画面一覧とナビゲーション | [docs/design/screens.md](docs/design/screens.md) |

## 開発の進め方

### イシュー駆動

```
イシューを受け取る → 参照を読む → 実装 → 検証（DoD）
```

**タスクは GitHub イシューで管理されています（#5〜#59）。各イシューに受け入れ条件・仕様書該当箇所・設計文書へのリンクが入っており、それが実質の spec です。**

1. `gh issue view <番号>` でイシューを読む。親エピック（#5〜#12）に推奨順序と依存関係がある
2. **イシューがリンクしている設計文書を実際に読む。** リンクを読まずに書き始めない
3. 実装する。受け入れ条件から外れる必要が出たら**先にイシューを直す**
4. [docs/rules/definition-of-done.md](docs/rules/definition-of-done.md) で検証する

**大原則: 仕様を発明しない。** 作る機能が [docs/spec/](docs/spec/README.md)（正典）のどこに定義されているか確認してから書きます。無ければ止まって確認してください。

**決めた TBD は [docs/design/](docs/design/) に記録する。** チャットやイシューのコメントだけに残った決定は次の担当者に届きません。

手順の詳細は [docs/rules/workflow.md](docs/rules/workflow.md)。

複数イシューをまたぐ判断が必要なときだけ `docs/specs/` に spec を切ります（3 つの条件は [docs/rules/workflow.md](docs/rules/workflow.md) 3章）。実例: [docs/specs/001-hand-height-realtime/](docs/specs/001-hand-height-realtime/requirements.md)

### AI エージェントを使う場合

[AGENTS.md](AGENTS.md) がエージェント向けの契約です。[AGENTS.md 標準](https://agents.md)に従っているため、Codex CLI / GitHub Copilot / Cursor / Windsurf / Zed / Aider などは**そのまま読みます**。Claude Code は [CLAUDE.md](CLAUDE.md)（`@AGENTS.md` を読み込むだけのファイル）経由で同じ内容を読みます。

ディレクトリ固有のルールは、そのディレクトリの `AGENTS.md` にあります（`Ren-kei_procon/`、`functions/`、`docs/`）。編集対象に最も近いものが優先されます。

| ルール | 内容 |
| --- | --- |
| [docs/rules/workflow.md](docs/rules/workflow.md) | 開発フロー（既定はイシュー駆動） |
| [docs/rules/safety.md](docs/rules/safety.md) | 禁止事項・安全境界 |
| [docs/rules/coding.md](docs/rules/coding.md) | コーディング規約 |
| [docs/rules/definition-of-done.md](docs/rules/definition-of-done.md) | 完了の定義 |

### イシューとマイルストーン

未実装機能はエピック 8 件 + 子イシュー 36 件（#5〜#48）に分解して管理しています。加えて既知の不具合・技術的負債を 10 件（#50〜#59）起票しています。

| マイルストーン | 完了条件 |
| --- | --- |
| Prototype 1 | 1 つの基本動作がリアルタイムで安定判定され、プロトタイプ動画同等のフィードバックが出る |
| Prototype 2 | 複数ルールを同時/順次判定でき、誤判定を調整できる |
| Prototype 3 | 練習履歴が保存され、成長推移を表示できる |
| Prototype 4 | 最低 2〜3 連で類似度ランキングを表示できる |
| MVP Community | 解析動画を安全に公開し交流できる |
| MVP Ren | 参加申請から所属表示まで一連で動作する |

エピック（親イシュー）から着手すると、子イシューの推奨順序と依存関係が確認できます。

- [#5 AI解析① 基本動作トレーニング](../../issues/5)
- [#6 AI解析② 連スタイル類似度判定](../../issues/6)
- [#7 連(Ren)機能](../../issues/7)
- [#8 連管理者機能 R-01〜R-08](../../issues/8)
- [#9 成長記録・成長曲線](../../issues/9)
- [#10 ロール・権限モデルと Security Rules 整備](../../issues/10)
- [#11 通知機能](../../issues/11)
- [#12 Cloud Functions／バックエンド基盤](../../issues/12)

### ラベル

| ラベル | 対象領域 |
| --- | --- |
| `area:ai` | AI 解析① 基本動作 |
| `area:style` | AI 解析② 連スタイル類似度 |
| `area:ren` | 連機能（一般ユーザー側） |
| `area:admin` | 連管理者機能 |
| `area:growth` | 成長記録・成長曲線 |
| `area:security` | 認証・認可・Security Rules |
| `area:notification` | 通知 |
| `area:infra` | Cloud Functions・バックエンド基盤 |
| `area:app` | アプリ基盤・ナビゲーション・ビルド設定 |
| `type:epic` | 親イシュー |
| `type:feature` | 新機能の実装 |
| `type:bug` | 既知の不具合の修正 |
| `type:debt` | 技術的負債・整合性の修正 |
| `spec:v0.3` | 仕様書 v0.3 に定義された未実装項目 |

### 設計判断の記録

実装中に未確定事項（TBD）を決めたら、**`docs/design/` の該当文書へ追記**してください。各イシューの受け入れ条件に「設計文書へ記録」を含めています。決定が文書に残らないと、同じ議論を繰り返すことになります。

未確定事項の一覧と、それをどのイシューで決めるかは [docs/status/roadmap.md](docs/status/roadmap.md) の 4 章にまとめています。

### Expo のバージョンに注意

Expo は SDK バージョンによって API が変わります。コードを書く前に、対象バージョンの公式ドキュメント（<https://docs.expo.dev/versions/>）を確認してください（[AGENTS.md](Ren-kei_procon/AGENTS.md)）。

## ライセンス

[LICENSE](Ren-kei_procon/LICENSE) を参照してください。
