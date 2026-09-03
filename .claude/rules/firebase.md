---
paths:
  - "firestore.rules"
  - "storage.rules"
  - "firestore.indexes.json"
  - "functions/**"
  - "Ren-kei_procon/src/repositories/**"
  - "Ren-kei_procon/src/config/**"
---

# Firebase を触るときのルール

**編集前に [docs/rules/safety.md](../../docs/rules/safety.md) と [docs/design/data-model.md](../../docs/design/data-model.md) を読んでください。**

## ⚠️ Security Rules を緩める変更は人間の承認が必要

緩める変更とは: `allow` の条件を削除する、`if false` を `if true` にする、認証チェックや所有者チェックを外す、`match /{allPaths=**}` に広い許可を与える。

**「テストのために一時的に開ける」も禁止です。** Firebase Emulator を使ってください。一時的に開けたルールはそのまま残ります。現に `storage.rules` は `allow read, write: if true` のまま放置されています（[#50](../../../../issues/50)）。

変更手順:

1. [docs/design/security-rules.md](../../docs/design/security-rules.md) の CRUD 権限表と照合する
2. Emulator で Rules Unit Test を通す
3. 緩める変更なら人間の承認を取る
4. `firebase deploy --only firestore:rules,storage`（本番。これも承認を取る）

## 権限判定の根拠を間違えない

| 判定 | 正しい根拠 | やってはいけない |
| --- | --- | --- |
| 所有者 | `request.auth.uid` | クライアントが送った `userId` を信じる |
| 連管理者 | `ren/{renId}/members/{uid}.role == 'admin'` | `users.role == 'ren_admin'` だけで判定 |
| コメント編集・削除 | コメント自身の `userId` | 投稿の `userId` |
| 状態遷移 | 遷移元と遷移先の組み合わせ | 遷移先だけを見る |

連管理者の判定を `users.role` だけで済ませると、**連 A の管理者が連 B のデータを改変できます**。Rules・Functions・UI の 3 層すべてで検証してください。

## スコアはクライアントから書けてはいけない

`analysisResults` / `growthRecords` の write は Rules でクライアント全拒否にし、Cloud Functions（Admin SDK は Rules を経由しない）のみが書きます。クライアントは集計値を送り、`totalScore` はサーバで算出します。

## Firestore の命名と構造

正典は [docs/design/data-model.md](../../docs/design/data-model.md)。要点:

- コレクション名: 英語・複数形・小文字始まり（`users`, `videos`, `joinRequests`）
- フィールド名: lowerCamelCase / 日時は `serverTimestamp()`
- 列挙値: 小文字スネーク（`pending`, `ren_admin`）
- **既存の `Users/{uid}`（大文字）は規約違反。新規コードで使わない**

## カウンタに increment() を使わない

Cloud Functions のトリガは at-least-once 配信なので、`increment()` は重複実行でずれます。**しかもずれたことに気づけません。** 集約クエリ（`count()`）で毎回数え直してください。

いいねは `posts/{postId}/likes/{uid}` のようにドキュメント ID を uid にして、1 人 1 回を Rules で保証します。

## Cloud Functions

- v2 Callable（`onCall`）を使う。認証情報が自動で渡り、CORS の自前実装が不要
- エラーは `HttpsError` に仕様書 13 章のコードを載せる。**表示文言はクライアント側の辞書で解決する**
- `requireAuth()` / `requireRenAdmin()` の共通ガードを通す
- 権限遷移とスコア確定はトランザクションで行う
- 定義は [docs/design/api-functions.md](../../docs/design/api-functions.md)（FN-01〜FN-07）

## インデックス

`firestore.indexes.json` は現在空です。新しいクエリを書いたら必要な複合インデックスを追加してください。必要な一覧は [docs/design/data-model.md](../../docs/design/data-model.md) の 4 章にあります。

## 秘密情報

- `firebaseConfig` の apiKey 等は**公開識別子**。ソースにあっても脆弱性ではない（保護は Rules の責務）
- サービスアカウント鍵（`*-firebase-adminsdk-*.json`）は**絶対にコミットしない**
- Functions の秘密情報は Firebase Secret Manager を使う
