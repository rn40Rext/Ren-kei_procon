# Cloud Functions / API 設計（FN-01〜FN-07）

> 出典: [仕様書 11章 バックエンド／論理API設計](../spec/11-backend-api.md) / [13章 エラー・例外設計](../spec/13-error-handling.md)
> 付録C「Cloud Functions/Cloud Run の request/response JSON Schema」に対応する文書です。

## 1. 方針

Firebase を中心とする構成では、すべてを REST API 化する必要はありません。

| 処理の性質 | 実装方法 |
| --- | --- |
| 低リスクな CRUD（プロフィール編集、コメント投稿、いいね） | **Firestore 直接アクセス** + Security Rules |
| 権限の遷移を伴う（参加申請の承認、連の作成） | **Callable Functions**（サーバ側で検証） |
| スコア確定（改ざん防止が必要） | **Callable Functions** |
| 重い AI 推論 | **Callable Functions → Cloud Run**（非同期） |
| 非正規化フィールドの同期（`likeCount` 等） | **Firestore トリガ Functions** |

### 実装形式

すべて **v2 Callable Functions**（`onCall`）を使います。理由:

- クライアントの認証情報（`request.auth`）が自動で渡る
- Firebase SDK 側でエラーコードが型付きで扱える
- HTTP エンドポイントを公開せずに済む（CORS・認証の自前実装が不要）

`functions/src/index.ts` は現在テンプレートのままです。以下の構成へ分割します。

```
functions/src/
├── index.ts                    各関数の export のみ
├── analysis/
│   ├── finalizeBasicAnalysis.ts   FN-01
│   └── analyzeStyle.ts            FN-02
├── community/
│   └── publishPost.ts             FN-03
├── ren/
│   ├── submitJoinRequest.ts       FN-04
│   ├── updateJoinRequestStatus.ts FN-05
│   └── createAnnouncement.ts      FN-06
├── style/
│   └── rebuildRenStyleProfile.ts  FN-07
├── triggers/
│   ├── onLikeWrite.ts             likeCount 同期
│   ├── onCommentWrite.ts          commentCount 同期
│   └── onMemberWrite.ts           memberCount 同期
├── lib/
│   ├── errors.ts                  エラーコード定義（13章）
│   ├── guards.ts                  認証・連管理者チェック
│   └── types.ts                   共通型
└── test/
```

## 2. 共通仕様

### 認証

すべての関数は認証必須です。未認証は `UNAUTHENTICATED`（仕様書の `UNAUTHORIZED`）を返します。

```ts
// functions/src/lib/guards.ts
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';

export function requireAuth(req: CallableRequest): string {
  if (!req.auth?.uid) {
    throw new HttpsError('unauthenticated', 'UNAUTHORIZED');
  }
  return req.auth.uid;
}

/** 対象連の管理者であることを検証する（users.role だけでは判定しない） */
export async function requireRenAdmin(uid: string, renId: string): Promise<void> {
  const snap = await db.doc(`ren/${renId}/members/${uid}`).get();
  if (!snap.exists || snap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'FORBIDDEN');
  }
}
```

### エラー返却

仕様書 13 章のエラーコードを `HttpsError` の `message` に載せます。クライアントはコードで分岐し、表示文言はクライアント側の辞書で解決します（多言語化とメッセージ変更をサーバデプロイなしで行うため）。

| 仕様書のコード | `HttpsError` code | 発生元 |
| --- | --- | --- |
| `UNAUTHORIZED` | `unauthenticated` | 全関数 |
| `FORBIDDEN` | `permission-denied` | FN-05, FN-05.5, FN-06, FN-07 |
| `VIDEO_UPLOAD_FAILED` | `internal` | クライアント側（Storage） |
| `ANALYSIS_FAILED` | `internal` | FN-01, FN-02 |
| `STYLE_MODEL_UNAVAILABLE` | `unavailable` | FN-02 |
| `JOIN_REQUEST_ALREADY_PENDING` | `already-exists` | FN-04 |
| `INVALID_STATUS_TRANSITION` | `failed-precondition` | FN-05, FN-05.5（#33、最後の管理者保護に流用） |
| `POST_VIDEO_NOT_PUBLICABLE` | `failed-precondition` | FN-03 |
| `PERSON_NOT_DETECTED` 等 | — | クライアント側（Rule Engine）で処理 |

### 冪等性

`VIDEO_UPLOAD_FAILED` の再試行で重複ドキュメントが作られないよう、クライアントが生成した `clientRequestId` を受け取り、同一 ID の処理済み記録があればその結果を返します。

---

## 3. 関数定義

### FN-01 `finalizeBasicAnalysis`

練習セッション終了時に呼び出し、**サーバ側でスコアを確定**します。クライアントが `totalScore` を送ってはいけません。

**Request**

```ts
{
  videoId: string;
  clientRequestId: string;
  analysisVersion: string;          // 使用したルールセットの版
  danceType: 'male' | 'female';
  scorePart: 'feet' | 'hands' | 'whole';
  events: {                          // Rule Engine が発火したイベント列
    ruleId: string;
    grade: 'GREAT' | 'GOOD' | 'MISS';
    timestampMs: number;
    value: number;
  }[];
  metrics: {                         // ルール別の集計値
    [ruleId: string]: {
      attempts: number;
      greatCount: number;
      goodCount: number;
      missCount: number;
      holdRatio?: number;
      meanValue?: number;
    };
  };
  rhythm?: { userBpm: number; baseBpm: number };
  gameScore: number;                 // UX 用の参考値。totalScore には影響させない
  maxCombo?: number;
  durationMs: number;
}
```

**Response**

```ts
{
  analysisId: string;
  totalScore: number;               // 0〜100（サーバ算出）
  scores: {
    handHeightScore?: number;
    hipHeightScore?: number;
    stopScore?: number;
    rhythmScore?: number;
  };
  feedback: { type: 'good' | 'improve'; ruleId: string; message: string }[];
}
```

**副作用**

1. `analysisResults/{analysisId}` を作成
2. `users/{uid}/growthRecords/{recordId}` を作成
3. `videos/{videoId}` を `analysisStatus: 'completed'`, `latestAnalysisId` へ更新

**検証**

- `videos/{videoId}.userId == uid`（他人の動画に結果を付けられない）
- `events` の件数上限（例 5,000 件）を超えたら `invalid-argument`
- スコア算出式は [ai-basic-motion.md 9章](ai-basic-motion.md#9-analysis-score仕様書-77) に従う

> クライアントから送られる `metrics` 自体は改ざんされ得ます。完全な防止には動画のサーバ側再解析が必要ですが、コストが高いためプロトタイプでは行いません。**「クライアントが totalScore を直接書けない」ことを最低ラインとし、将来的にサーバ側サンプリング再解析を検討**します（未決定事項）。

---

### FN-02 `analyzeStyle`

連スタイル類似度を解析します。推論が重いため非同期にします。

**Request**

```ts
{ videoId: string; topN?: number; }   // topN 既定 3
```

**Response**

```ts
// 同期完了した場合
{ status: 'completed'; styleAnalysisId: string;
  results: { renId: string; renName: string; similarity: number }[]; }

// 非同期の場合
{ status: 'queued'; jobId: string; }
```

**副作用**: `styleAnalysisResults/{id}` を作成。非同期時はクライアントが同ドキュメントを `onSnapshot` で購読して完了を待ちます。

**検証**: `videos.userId == uid`、`renStyleProfiles` の `embeddingVersion` 一致（[ai-style-similarity.md 6章](ai-style-similarity.md#6-データモデル)）。モデル未配備なら `unavailable` / `STYLE_MODEL_UNAVAILABLE` を返し、**AI① の結果は保持したまま**スタイル診断のみ再試行可能にします（仕様書 13 章）。

---

### FN-03 `publishPost`

練習動画をコミュニティへ公開します。`posts` の作成と `videos.visibility` の変更を**トランザクションで一括**実行します（片方だけ成功する状態を作らない）。

**Request**

```ts
{ videoId: string; title: string; description?: string; tags?: string[]; }
```

**Response**

```ts
{ postId: string; }
```

**副作用**

1. `posts/{postId}` を作成（`authorName` / `videoUrl` / `totalScore` の非正規化コピーを埋める）
2. `videos/{videoId}.visibility` を `'public'` へ更新
3. 公開用 `downloadUrl` を発行して `posts.videoUrl` に設定

**検証**

- `videos.userId == uid` かつ `analysisStatus == 'completed'` → 満たさなければ `POST_VIDEO_NOT_PUBLICABLE`
- `title` 1〜100 文字、`description` 0〜1000 文字、`tags` は既定リストのみ許可

> #### 実装との差分（2026-09-09時点・縮小版で実装）
>
> `videos` コレクションへの書き込み経路と FN-01（AI 採点確定）が未実装のため、上記どおりには実装できない（渡せる `videoId` が存在しない）。チームで確認のうえ、次の縮小版を先行実装した。
>
> - **Request**: `videoId` を受け取らず、代わりにクライアントが Storage へアップロード済みの `videoUrl` と `authorName` を直接渡す（`{ title, description?, tags?, videoUrl, authorName }`）
> - **videoId / analysisStatus の検証は行わない**（対象の `videos` ドキュメントが存在しないため）
> - `videos.visibility` の更新、`downloadUrl` の発行は行わない（`videoUrl` はクライアントがアップロード時に取得した URL をそのまま使う）
> - スコアは AI 採点（FN-01）が未実装のため、Functions 側で暫定的にモック値（`Math.random()` ベース）を発行する。クライアントから直接指定はできない
> - 満たしている点: `title`/`description`/`tags` の検証、`likeCount`/`commentCount` の 0 初期化、クライアントによる `posts` への直接書き込み禁止（Firestore Rules で `posts.create` を拒否し Cloud Functions 経由に限定）
>
> FN-01・#41（`videos.visibility`/`analysisStatus` 導入）の実装後、本来の設計（`videoId` ベース・トランザクション化・`downloadUrl` 発行）に置き換える。

---

### FN-03.5 `createRen`（本設計での追加・#26）

仕様書・当初の FN-01〜07 一覧には無いが、[#26](../../issues/26) の実装にあたって新設した。連の作成と、作成者を `role: 'admin'` のメンバーとして登録する処理を 1 つのトランザクションで行う。

**背景**: `firestore.rules` は `ren/{renId}/members/{uid}` の `create` を常に拒否する設計（4章参照。通常は FN-05 の参加承認経由）。連作成自体は当初クライアント直接書き込みを許可していたが、そのままでは**連の作成者が自分自身を管理者として登録する手段が無い**という矛盾があった。連本体の作成もクライアントから拒否に変更し、本関数に一本化することで解消した。

**Request**

```ts
{ name: string; description?: string; location?: string; iconUrl?: string; beginnerFriendly?: boolean; }
```

**Response**

```ts
{ renId: string; }
```

**副作用**（トランザクション）

1. `ren/{renId}` を作成（`createdBy` = 呼び出しユーザー、`memberCount: 1`）
2. `ren/{renId}/members/{uid}` を `role: 'admin'`, `status: 'active'` で作成

**検証**: `name` 1〜100 文字、`description` 0〜1000 文字、`location` 0〜100 文字。

エミュレータ（Firestore + Functions + Auth）で実際に呼び出し、`ren`/`members` 両ドキュメントの内容と入力バリデーションを確認済み。

---

### FN-04 `submitJoinRequest`

**Request**

```ts
{ renId: string; message?: string; }
```

**Response**

```ts
{ requestId: string; }
```

**副作用**: `joinRequests/{requestId}` を `status: 'pending'` で作成。対象連の管理者へ通知を作成。

**検証**

- 同一 `userId` × `renId` で `status == 'pending'` が既にあれば `already-exists` / `JOIN_REQUEST_ALREADY_PENDING`
- 既に `ren/{renId}/members/{uid}` が `active` なら `failed-precondition`

---

### FN-05 `updateJoinRequestStatus`

連管理者が参加申請を承認・却下します。**申請者が自分で `approved` にできないよう、サーバ側で遷移を検証**します。

**Request**

```ts
{ requestId: string; action: 'approve' | 'reject'; }
```

**Response**

```ts
{ status: 'approved' | 'rejected'; }
```

**副作用**（トランザクション）

1. `joinRequests/{requestId}.status` を更新、`handledBy` に管理者 uid を記録
2. `approve` の場合 `ren/{renId}/members/{userId}` を `role: 'member', status: 'active'` で作成
3. 申請者へ通知（`type: 'join_result'`）を作成

**検証**

- `requireRenAdmin(uid, request.renId)`
- 現在の `status` が `'pending'` でなければ `failed-precondition` / `INVALID_STATUS_TRANSITION`

---

### FN-05.5 `updateMemberRole` / `removeMember`（本設計での追加・#33）

仕様書・当初の FN-01〜07 一覧には無いが、`createRen`（FN-03.5）と同じ理由で [#33](../../issues/33) の実装にあたって新設した。「連の最後の管理者を降格・削除できない」という ren 単位の不変条件は、Firestore Rules の `get()`/`exists()` だけでは残り管理者数を数えられず表現できないため、この2つの Cloud Function に一本化した。

**Request（updateMemberRole）**

```ts
{ renId: string; uid: string; role: 'admin' | 'member'; }
```

**Request（removeMember）**

```ts
{ renId: string; uid: string; }
```

**Response**: `updateMemberRole` は `{ role: 'admin' | 'member'; }`、`removeMember` は `{ removed: true; }`。

**副作用**（トランザクション）

- `updateMemberRole`: `ren/{renId}/members/{uid}.role` を更新
- `removeMember`: `ren/{renId}/members/{uid}` を削除（本人による脱退は Rules で直接許可済みのため対象外。管理者が他メンバーを除名する場合のみ使う）
- どちらも `ren.memberCount` の再集計は既存の `onMemberWrite` トリガ（#48）に任せる（本関数側では触らない）

**検証**

- `requireRenAdmin(uid, renId)`
- 対象メンバーが現在 `role: 'admin'` かつ、対象を除く `role=='admin' && status=='active'` が 0 件になる変更（降格・除名）は `failed-precondition` / `INVALID_STATUS_TRANSITION`（仕様書13章に専用のエラーコードが無いため流用。詳細は `docs/design/security-rules.md` #33 差分参照）

エミュレータ（Firestore + Functions + Auth）で実際に呼び出し、昇格・降格・除名の成功、最後の管理者の降格・除名の拒否、`memberCount` の再集計、他連の管理者による操作拒否を確認済み。

---

### FN-06 `createAnnouncement`

**Request**

```ts
{ renId: string; title: string; content: string; }
```

**Response**

```ts
{ announcementId: string; }
```

**副作用**: `ren/{renId}/announcements/{id}` を作成し、連メンバー全員へ通知（`type: 'announcement'`）。

**検証**: `requireRenAdmin(uid, renId)`。`title` 1〜100 文字、`content` 1〜2000 文字。

> メンバーが多い連では通知作成が大量になります。メンバー 500 件を超える場合はバッチ分割し、Firestore の 500 件書き込み上限に対応します。

> #### 実装メモ（#34）
> - 通知の宛先は `status == 'active'` のメンバーのみ（脱退済みは除外）、かつ**作成者自身は除外**する（自分の投稿の通知を自分が受け取っても意味が無いため）。
> - バッチ分割は 500 件ずつ（Firestore のバッチ書き込み上限と同じ値）。エミュレータでは実際に 500 件超のメンバーは用意せず、通知作成のロジック自体（宛先の絞り込み・除外・`type`/`referenceId` の内容）を確認した。500 件超のバッチ分割そのもの（`for`ループでの複数バッチ発行）はコードレビューで確認済み。
> - エミュレータ（Firestore + Functions + Auth）で実際に呼び出し、`announcements` 作成・通知の宛先絞り込み・文字数バリデーション・他連の管理者/一般メンバーからの拒否を確認済み。

---

### FN-06.5 `updateRenIcon`（本設計での追加・#34）

仕様書・当初の FN-01〜07 一覧には無いが、`createRen`（FN-03.5）と同じ理由で新設した。当初は連アイコンの書き込みをStorage RulesのCross-Service Rules（`firestore.get()`）で対象連の管理者のみに制限する設計だったが、本番デプロイ後に管理者本人でも`storage/unauthorized`になる不具合が発生し（エミュレータでは再現しなかった）、信頼性を優先してAdmin SDK経由に切り替えた。

**Request**

```ts
{ renId: string; tempPath: string; } // tempPath: users/{uid}/renIconUploads/{renId}/{fileName}
```

**Response**

```ts
{ iconUrl: string; }
```

**副作用**: `tempPath`（本人のみ書き込み可能な一時領域）のファイルを`ren/{renId}/icon/{fileName}`へ`move`し、ダウンロードトークンを発行、`ren/{renId}.iconUrl`を更新する。

**検証**

- `tempPath`が呼び出し本人の一時領域（`users/{uid}/renIconUploads/{renId}/`）配下であること
- `requireRenAdmin(uid, renId)`

エミュレータ（Storage + Firestore + Functions + Auth）で実際に呼び出し、正常系（`ren.iconUrl`反映）、一般メンバーからの拒否、他人の一時パスを指定した場合の拒否、`ren/{renId}/icon`への直接書き込み（`allow write: if false`）が拒否されることを確認済み。

---

### FN-07 `rebuildRenStyleProfile`

承認済み参照 Embedding から連の代表ベクトルを再計算します。

**Request**

```ts
{ renId: string; }
```

**Response**

```ts
{ renId: string; sampleCount: number; embeddingVersion: string; }
```

**副作用**: `renStyleProfiles/{renId}` を更新。

**検証**: `requireRenAdmin(uid, renId)` またはサービス管理者。`approved == true` の参照が 0 件なら `failed-precondition`。

**呼び出し契機**: 参照動画の承認・削除時。将来は Firestore トリガでの自動実行も検討します。

---

## 4. Firestore トリガ（非正規化の同期）

| トリガ | 対象 | 処理 |
| --- | --- | --- |
| `onDocumentWritten('posts/{postId}/likes/{uid}')` | いいね | `posts.likeCount` を再集計 |
| `onDocumentWritten('posts/{postId}/comments/{id}')` | コメント | `posts.commentCount` を再集計 |
| `onDocumentWritten('ren/{renId}/members/{uid}')` | メンバー | `ren.memberCount` を再集計 |
| `onDocumentCreated('posts/{postId}/comments/{id}')` | コメント | 投稿者へ通知（`type: 'comment'`） |
| `onDocumentDeleted('videos/{videoId}')` | 動画削除 | Storage の実体も削除（仕様書 14.3） |

`increment()` ではなく **`count()` 集約クエリで再集計**します。トリガの重複実行（at-least-once 配信）でカウンタがずれるのを防ぐためです。

> #### 実装状況（2026-09-10・#48）
> 上表のうち `onLikeWrite` / `onCommentWrite` / `onMemberWrite`（`status=='active'` のみ集計） / `onVideoDeleted`（Storage削除は冪等）を `functions/src/triggers/` に実装済み。`onDocumentCreated('posts/{postId}/comments/{id}')` による通知作成は、`notifications` 機能自体が未実装（#43）のため対象外。`ren`/`videos` へのアプリからの書き込みがまだ無いため、`onMemberWrite`/`onVideoDeleted` は現状休眠中。エミュレータで各トリガの発火・カウント・冪等性を確認済み。

## 5. Firestore 直接 CRUD にするもの（仕様書 11.2）

Functions を経由せず、Security Rules だけで守る操作です。

- `users/{uid}` の本人プロフィール編集（`role` を除く）
- `posts/{postId}/comments` の作成・編集・削除
- `posts/{postId}/likes/{uid}` の作成・削除
- `ren/{renId}` の公開情報の read、連検索
- 自分の `growthRecords` / `analysisResults` の read
- `ren/{renId}/announcements` / `activities` の read

## 6. デプロイと運用

```bash
# ローカル実行
cd functions && npm run build && firebase emulators:start --only functions,firestore,storage

# デプロイ（firebase.json の predeploy で lint + build が走る）
firebase deploy --only functions
```

- `setGlobalOptions({ maxInstances: 10 })` はコスト制御のため維持します。
- **リージョン（N-4）: `asia-northeast1` に決定**（2026-09-09、`functions/src/index.ts` の `setGlobalOptions` で設定済み）。ユーザーが日本国内のみであることを優先し、クライアント ↔ Functions 間のレイテンシを削減する側を選びました。Firestore（`nam5`）との往復増はトレードオフとして許容します。現状の各関数（`publishPost`）は Firestore 操作が1回程度と少なく、影響は小さいと判断しています。関数内で Firestore 操作が多段になる場合（例: `ren` 関連のトランザクション）は改めて見直しを検討してください。クライアント側は `src/config/firebaseConfig.ts` の `getFunctions(app, "asia-northeast1")` で合わせています。
- Cloud Run（Motion Encoder）との役割分担は TBD-12。
