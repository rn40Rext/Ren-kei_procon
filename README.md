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

> 2026-09-15 時点。詳細は [docs/status/gap-analysis.md](docs/status/gap-analysis.md)、優先順位は [docs/status/roadmap.md](docs/status/roadmap.md)。

| 機能 | 内容 | 状況 |
| --- | --- | --- |
| 認証 | メール/パスワードによる登録・ログイン | ✅ 実装済み |
| 交流広場 | 練習動画の投稿・閲覧、コメント（門下生の声 / 師匠の教え）、いいね、タグ絞り込み | ✅ 実装済み |
| マイページ | プロフィール（ニックネーム・自己紹介・踊り種別・アイコン）の編集 | ✅ 実装済み |
| AI 解析① 基本動作 | 姿勢推定 + 判定ルール（RULE-01〜07）で手の高さ・腰の低さ・停止・リズムを採点。GREAT/GOOD/MISS のリアルタイム表示、解析結果画面、履歴保存 | ✅ 実装済み（**ブラウザのみ**・**閾値は暫定**） |
| AI 解析② 連スタイル類似度 | どの連の熟練者の動きに近いかを判定 | 🔶 実装済み。**実データ検証が未実施のため「検証中・参考値」表示** |
| 成長記録 | 練習履歴の保存と成長曲線 | 🔶 履歴（`growthRecords`）は保存される。**グラフ画面（U-10）が未実装** |
| 連（Ren）機能 | 連の検索、参加リクエスト、マイ連 | ✅ 実装済み |
| 連管理者機能 | 管理ホーム、投稿一覧/詳細、アドバイス送信、参加申請の承認、メンバー管理、お知らせ、活動情報（R-01〜R-08） | ✅ 実装済み |
| 通知 | コメント・申請結果・お知らせの通知 | 🔶 **生成側のみ**。一覧画面が無いためユーザーには届かない |

### ⚠️ デモ・発表の前に必ず補足すること

乱数による「AI 採点」のモックは廃止されました（[#58](../../issues/58)）。採点の無い投稿は「未採点」と表示されます。ただし**次の 4 点は「動くこと」と「正しいこと」が別**です。

1. **判定閾値はすべて暫定値です。** 連の指導者による妥当性確認（TBD-02、[#100](../../issues/100)）は未実施で、`analysisRules` から差し替えられる状態になっているだけです
2. **連スタイル類似度は参考値です。** 仕様書 8.6 の実データ検証（[#101](../../issues/101)）が未実施のため、画面にも「検証中」の帯が出ます
3. **リアルタイム判定はブラウザでのみ動きます。** ネイティブアプリは作らない方針です（2026-09-15 決定）。`getUserMedia` が HTTPS を要求するため、スマートフォンでは `npm run web:tunnel` 等の HTTPS 経由が必要です
4. **WASM とモデルを実行時に CDN から取得しています。** 会場の回線が不安定だと姿勢推定が始まりません

## 技術スタック

| 分類 | 採用技術 |
| --- | --- |
| フレームワーク | Expo / React Native 0.81 / React 19 |
| 言語 | TypeScript |
| ナビゲーション | React Navigation v7（Native Stack） |
| バックエンド | Firebase（Authentication / Cloud Firestore / Cloud Storage / Cloud Functions） |
| カメラ・動画 | expo-camera / expo-av / expo-image-picker |
| UI | lucide-react-native / expo-linear-gradient |
| 姿勢推定 | MediaPipe Tasks Vision（`@mediapipe/tasks-vision`、WASM + WebGL）。**Expo Web で実行**（[#13](../../issues/13) で決定） |
| オフライン採点エンジン | Python 3.12 + MediaPipe 0.10.14（`renkei_project_10/`）。閾値較正・検証用 |

Firebase プロジェクト: `ren-kei`

## ディレクトリ構成

```
Ren-kei_procon/
├── README.md                   ← この文書
├── docs/                       設計ドキュメント → docs/README.md が索引
├── firebase.json               Firebase デプロイ設定
├── firestore.rules             Firestore Security Rules
├── storage.rules               Storage Security Rules
├── firestore.indexes.json      複合インデックス
├── tests/rules/                Security Rules のユニットテスト
├── functions/                  Cloud Functions（FN-01〜09 + トリガ）
├── renkei_project_10/          オフライン採点エンジン（Python・閾値較正用）
└── Ren-kei_procon/             ★ Expo アプリ本体
    ├── App.tsx
    ├── app.json
    └── src/
        ├── config/firebaseConfig.ts
        ├── navigation/AppNavigator.tsx
        ├── components/
        ├── screens/            各画面
        ├── repositories/       Firestore / Storage アクセス
        ├── types/              Firestore エンティティの型
        ├── hooks/              useAuth / useMyRens / useAdminRens
        ├── theme/              colors.ts
        └── features/           pose（姿勢推定）/ rules（Rule Engine）/ analysis / style
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
npm run web          # ★ リアルタイム判定が動くのはこの Web 版だけ
```

**AI 解析①（リアルタイム判定）を使うときは必ず Web 版で起動してください。** ネイティブ（Expo Go）では姿勢推定が `POSE_NOT_SUPPORTED` になり、画面に案内が出ます。

```bash
npm start            # ネイティブ（Expo Go）。連機能や交流広場の確認用
npm run web:tunnel   # スマートフォンのブラウザで試す（HTTPS が必要なため ngrok 経由）
npm test             # Rule Engine・正規化・リズム判定のユニットテスト
npx tsc --noEmit     # 型チェック（コミット前に必須）
```

> ⚠️ **スマートフォンで試すときは HTTPS が必須です。** `getUserMedia` が Secure Context を要求するため、`http://<LAN IP>:8081` ではカメラが開きません。`npm run web:tunnel` を使ってください。端末の fps を測るときは URL に `?poseModel=lite` / `?poseDelegate=CPU` を付けると、ビルドし直さずに切り替えられます。

### Cloud Functions

```bash
cd functions
npm install
npm run build
npm test                # ユニットテスト（スコア計算・エンコーダ・ガード）
npm run serve           # Emulator で起動
npm run verify:emulator # FN-01/02/07/08/09 を Emulator で通しで検証（Java が必要）
npm run seed:rules      # analysisRules の初期値を投入（本番へ投入する場合は承認が必要）
npm run deploy          # デプロイ
```

### Security Rules のテスト

```bash
npm run test:rules   # リポジトリルートで実行（Emulator を自動起動）
```

### Security Rules のデプロイ

```bash
firebase deploy --only firestore:rules,storage
```

## ⚠️ 開発前に知っておくべきこと

着手前に [docs/status/gap-analysis.md](docs/status/gap-analysis.md) を一読してください。**2026-09-11 時点で挙げていた 3 点（Storage Rules の全開放・5 画面のナビゲータ未登録・乱数の AI 採点）はすべて解消済みです。** 現在効いてくるのは次の 3 点です。

### 1. リアルタイム判定はブラウザでのみ動きます

姿勢推定は `PoseDetector.web.ts`（MediaPipe Tasks、WASM）にしかありません。ネイティブ側の `PoseDetector.ts` は `POSE_NOT_SUPPORTED` を返すスタブです。**2026-09-15 の決定で、スマートフォンでも Web 実装を使い、ネイティブアプリは作りません**（[docs/design/ai-basic-motion.md](docs/design/ai-basic-motion.md) 3章）。

### 2. 判定閾値はすべて暫定値です — [#100](../../issues/100)

`Ren-kei_procon/src/features/rules/defaultRules.json` の値は設計上の初期値で、**連の指導者による妥当性確認は未実施**です（TBD-02）。Firestore の `analysisRules` から差し替えられるので、**閾値を変えるのにアプリの改修は要りません**。スコアを「較正済み」として提示しないでください。

### 3. スコアはクライアントの集計値を信頼しています — [#102](../../issues/102)

`finalizeBasicAnalysis` は `totalScore` をクライアントが送る `metrics` から計算し、内部整合性しか検証していません。**偽装した集計値を送れば満点を取得できます。** 開発段階では許容していますが（[docs/rules/safety.md](docs/rules/safety.md) 0章）、**一般公開前には必須の対応**です。

## ドキュメント

| 目的 | 文書 |
| --- | --- |
| ドキュメント全体の索引 | [docs/README.md](docs/README.md) |
| **仕様（v0.3・位置づけの注記あり）** | [docs/spec/README.md](docs/spec/README.md) |
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

**大原則: 仕様を発明しない。** 作る機能が [docs/spec/](docs/spec/README.md) のどこに定義されているか確認してから書きます。無ければ止まって確認してください。

> ⚠️ ただし仕様書 v0.3 は**チームで合意した確定仕様ではありません。** 既存資料（パンフレット原稿・企画資料・ER図・UIフロー・プロトタイプ動画）からの推測で組み立てた文書で、`docs/design/` はそれをさらに具体化したものです。**内容がおかしいと思ったら指摘してください** → [docs/spec/README.md](docs/spec/README.md)

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

### ドキュメントの言語

**AIへの指示ファイルは英語、人間が読むドキュメントは日本語**にしています。

| 対象 | 言語 |
| --- | --- |
| `AGENTS.md` / `CLAUDE.md` / `.claude/rules/**` / `.claude/skills/**` / `docs/rules/**` | 英語 |
| `README.md` / `docs/README.md` / `docs/spec/**` / `docs/design/**` / `docs/status/**` / `docs/specs/**` | 日本語 |
| ソースコードのコメント | 日本語（既存コードに合わせる） |
| 識別子（変数・関数・型） | 英語 |
| ユーザーに見える文言 | 日本語 |
| コミットメッセージ・PR・イシュー | 日本語 |

**新しくドキュメントを追加するときもこの表に従ってください。** 判断に迷ったら「AIにどう振る舞ってほしいかを書くもの（英語）か、システムが何でありなぜそうなっているかを記録するもの（日本語）か」で分けます。完全な定義は [AGENTS.md](AGENTS.md) の "Language policy" にあります。

### イシューとマイルストーン

機能はエピック 8 件 + 子イシュー 36 件（#5〜#48）に分解して管理しています。加えて既知の不具合・技術的負債（#50〜#59）と、実装後に判明した課題（#91 / #93 / #94 / #100 / #101 / #102）があります。**子イシュー計 52 件のうち 40 件が完了（2026-09-15）。**

| マイルストーン | 完了条件 | 状況 |
| --- | --- | --- |
| Prototype 1 | 1 つの基本動作がリアルタイムで安定判定され、プロトタイプ動画同等のフィードバックが出る | ✅ 完了 |
| Prototype 2 | 複数ルールを同時/順次判定でき、誤判定を調整できる | ✅ 完了 |
| Prototype 3 | 練習履歴が保存され、成長推移を表示できる | 🔶 成長曲線（[#37](../../issues/37)）と動画一覧（[#38](../../issues/38)）が残り |
| Prototype 4 | 最低 2〜3 連で類似度ランキングを表示できる | 🔶 実装完了・**実データ検証（[#101](../../issues/101)）が残り** |
| MVP Community | 解析動画を安全に公開し交流できる | 🔶 実装はほぼ完了。本番反映の確認と [#102](../../issues/102) が残り |
| MVP Ren | 参加申請から所属表示まで一連で動作する | 🔶 連・連管理者は完了。**通知（[#43](../../issues/43)〜[#45](../../issues/45)）が残り** |

エピック（親イシュー）から着手すると、子イシューの推奨順序と依存関係が確認できます。

- [#5 AI解析① 基本動作トレーニング](../../issues/5) — 実装完了・実地検証待ち
- [#6 AI解析② 連スタイル類似度判定](../../issues/6) — 実装完了・実地検証待ち
- [#7 連(Ren)機能](../../issues/7) — ✅ 完了
- [#8 連管理者機能 R-01〜R-08](../../issues/8) — 子イシューは全件完了
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
