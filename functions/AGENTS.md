# AGENTS.md — Cloud Functions

> ルートの [../AGENTS.md](../AGENTS.md) に加えて、このディレクトリ固有のルールです。

## 現状

**まだ何も実装されていません。** `src/index.ts` は Firebase のテンプレートコメントのみで、関数が 1 つも定義されていません。

設計は [../docs/design/api-functions.md](../docs/design/api-functions.md) にあります（FN-01〜FN-07）。基盤整備は [#46](../../issues/46)。

## コマンド

```bash
npm install
npm run build           # tsc
npm run lint            # eslint
npm run serve           # build + Emulator
npm run deploy          # ⚠ 本番。承認を取ってから
npm run logs
```

`firebase.json` の `predeploy` で `lint` と `build` が走ります。**ビルドが通らないとデプロイできません。**

Node のバージョンは `package.json` の `engines` で **24** を指定しています。

## このディレクトリで守ること

### v2 Callable（`onCall`）を使う

`onRequest`（HTTP）ではなく `onCall` を使います。認証情報が `request.auth` として自動で渡り、CORS と認証の自前実装が不要になるためです。

### 共通ガードを通す

```ts
import { requireAuth, requireRenAdmin } from './lib/guards';

const uid = requireAuth(request);
await requireRenAdmin(uid, renId);   // 連管理者権限が必要な関数
```

**連管理者の判定を `users.role` だけで済ませないこと。** `ren/{renId}/members/{uid}.role == 'admin'` を検証します。これを省くと連 A の管理者が連 B のデータを改変できます。

### スコアはサーバで算出する

クライアントから `totalScore` を受け取ってはいけません。集計値（ルール別の成功回数・保持率・実測値）を受け取り、**サーバ側で算出**します（[../docs/rules/safety.md](../docs/rules/safety.md) 4章）。

`analysisResults` / `growthRecords` への write は Security Rules でクライアント全拒否にします。Admin SDK は Rules を経由しないため、Functions からは書けます。

### 権限遷移はトランザクションで

`joinRequests.status` の更新と `members` の作成のように、**片方だけ成功する状態を作ってはいけない**処理はトランザクションにします。

状態遷移は遷移元と遷移先の組み合わせを検証します（`pending` 以外からの承認は `INVALID_STATUS_TRANSITION`）。

### カウンタは集約クエリで再集計する

`increment()` を使わないでください。**トリガは at-least-once 配信なので重複実行でずれ、しかもずれたことに気づけません。** `count()` で毎回数え直します。

### エラーはコードで返す

```ts
throw new HttpsError('permission-denied', 'FORBIDDEN');
```

仕様書 13 章のコード（`UNAUTHORIZED` / `FORBIDDEN` / `ANALYSIS_FAILED` / `JOIN_REQUEST_ALREADY_PENDING` / `INVALID_STATUS_TRANSITION` / `POST_VIDEO_NOT_PUBLICABLE` 等）を `message` に載せます。

**表示文言はクライアント側の辞書で解決します。** サーバに文言を持たせると、文言を変えるたびにデプロイが必要になります。

### 冪等性

クライアントの再試行で重複ドキュメントが作られないよう、`clientRequestId` を受け取って処理済みを判定します。

## ディレクトリ構成（予定）

```
src/
├── index.ts                    各関数の export のみ
├── analysis/                   FN-01 finalizeBasicAnalysis, FN-02 analyzeStyle
├── community/                  FN-03 publishPost
├── ren/                        FN-04〜FN-06
├── style/                      FN-07 rebuildRenStyleProfile
├── triggers/                   カウンタ同期・通知生成・Storage 実体削除
└── lib/                        errors.ts / guards.ts / types.ts
```

## 未確定事項

| ID | 内容 |
| --- | --- |
| TBD-12 | Firebase Functions と Cloud Run の役割分担（Motion Encoder の推論をどこに置くか） |
| N-4 | リージョン。Firestore は `nam5`（米国）、ユーザーは日本国内。`asia-northeast1` に置くと Functions ↔ Firestore の往復が増える |

決めたら [../docs/design/api-functions.md](../docs/design/api-functions.md) と [../docs/status/roadmap.md](../docs/status/roadmap.md) に記録してください。

## 秘密情報

- サービスアカウント鍵を**このディレクトリに置かない・コミットしない**
- 秘密情報は Firebase Secret Manager を使う
- `setGlobalOptions({ maxInstances: 10 })` はコスト制御のため維持する
