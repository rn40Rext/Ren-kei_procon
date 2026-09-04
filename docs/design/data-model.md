# データモデル設計（Firestore パス確定案）

> 出典: [仕様書 9章 データ設計](../spec/09-data-design.md) / [付録C](../spec/92-appendix-c-next-documents.md)「Firestore collection/document path の確定版」「Cloud Storage path 命名規則」
> 仕様書の論理 Entity を、実装で使う物理パスとフィールド名に確定させる文書です。

## 1. 命名規約

| 対象 | 規約 | 例 |
| --- | --- | --- |
| コレクション名 | 英語・複数形・lowerCamelCase | `users`, `videos`, `joinRequests` |
| ドキュメント ID | 自動 ID。ただし所有者が一意に定まるものは自然キー | `users/{uid}`, `renStyleProfiles/{renId}` |
| フィールド名 | lowerCamelCase | `createdAt`, `totalScore` |
| 日時 | Firestore `Timestamp`（`serverTimestamp()` で書き込む） | `createdAt` |
| 列挙値 | 小文字スネーク | `pending`, `ren_admin`, `analysis_completed` |

> ⚠️ 現行実装は `Users`（大文字始まり）と `videos`（小文字）が混在しています。本設計では **すべて小文字始まりの複数形** に統一します。移行手順は 6 章。

## 2. コレクション一覧（物理パス）

| # | パス | 論理 Entity | ドキュメント ID | 現行実装 |
| --- | --- | --- | --- | --- |
| 1 | `users/{uid}` | Users | Firebase Auth uid | ⚠️ `Users/{uid}` として存在（`userName` のみ） |
| 2 | `videos/{videoId}` | Videos | 自動 ID | ⚠️ 存在するが Posts と混在 |
| 3 | `posts/{postId}` | Posts | 自動 ID | ❌ 未実装 |
| 4 | `posts/{postId}/comments/{commentId}` | Comments | 自動 ID | ⚠️ `videos/{id}/comments` として存在 |
| 5 | `posts/{postId}/likes/{uid}` | Likes | いいねしたユーザーの uid | ❌ 未実装（`videos.likes` の数値のみ） |
| 6 | `analysisResults/{analysisId}` | AnalysisResults | 自動 ID | ❌ 未実装 |
| 7 | `users/{uid}/growthRecords/{recordId}` | GrowthRecords | 自動 ID | ❌ 未実装 |
| 8 | `ren/{renId}` | Ren | 自動 ID | ❌ 未実装 |
| 9 | `ren/{renId}/members/{uid}` | RenMembers | メンバーの uid | ❌ 未実装 |
| 10 | `ren/{renId}/announcements/{announcementId}` | Announcements | 自動 ID | ❌ 未実装 |
| 11 | `ren/{renId}/activities/{activityId}` | RenActivities | 自動 ID | ❌ 未実装 |
| 12 | `joinRequests/{requestId}` | JoinRequests | 自動 ID | ❌ 未実装 |
| 13 | `users/{uid}/notifications/{notificationId}` | Notifications | 自動 ID | ❌ 未実装 |
| 14 | `renStyleReferences/{referenceId}` | RenStyleReferences | 自動 ID | ✅ 実装済み（FN-08） |
| 15 | `renStyleProfiles/{renId}` | RenStyleProfiles | renId | ✅ 実装済み（FN-07） |
| 16 | `styleAnalysisResults/{styleAnalysisId}` | StyleAnalysisResults | 自動 ID | ✅ 実装済み（FN-02） |
| 17 | `analysisRules/{ruleId}` | 判定ルール定義（仕様書 7.9） | ルール ID | ❌ 未実装 |
| — | `chats/{chatId}/messages/{messageId}` | **仕様書に無い独自実装** | 自動 ID | ⚠️ 実装済み（扱いは 7 章） |

### サブコレクションにする / しないの判断

| 判断 | 対象 | 理由 |
| --- | --- | --- |
| サブコレクションにする | `comments`, `likes`, `growthRecords`, `notifications`, `members`, `announcements`, `activities` | 常に親（投稿・ユーザー・連）を起点に読み、横断検索が不要 |
| トップレベルにする | `videos`, `posts`, `analysisResults`, `joinRequests`, `styleAnalysisResults` | ユーザー横断のタイムライン表示や、連管理者による横断参照が必要 |

`joinRequests` をトップレベルに置く理由: 申請者本人（`userId` で絞る）と対象連の管理者（`renId` で絞る）の**両方**から検索する必要があるため。

## 3. フィールド定義

### 3.1 `users/{uid}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `uid` | string | ✓ | Auth uid（ドキュメント ID と同一。冗長だがクエリ結果で扱いやすい） |
| `name` | string | ✓ | 本名または表示名 |
| `nickname` | string | — | 表示名。UI 上は `nickname ?? name` を表示 |
| `mail` | string | ✓ | 認証メール。Auth 側を正とし、こちらは表示用キャッシュ |
| `icon` | string | — | Storage パスまたは URL |
| `profile` | string | — | 自己紹介 |
| `danceStyle` | `'male' \| 'female' \| null` | — | 男踊り / 女踊り。現行 `ScoringScreen` の `DanceType` と揃える |
| `role` | `'user' \| 'ren_admin' \| 'service_admin'` | ✓ | **クライアントから更新禁止**（Rules で保護） |
| `createdAt` | Timestamp | ✓ | |
| `updatedAt` | Timestamp | ✓ | |

> `ren`（所属連）フィールドは **持たせません**。所属は `ren/{renId}/members/{uid}` を正とします（仕様書 TBD-11 への回答）。1 ユーザーが複数連に所属する将来要件にも耐えます。

### 3.2 `videos/{videoId}`

練習動画そのもの。デフォルト非公開。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | 所有者 uid |
| `storagePath` | string | ✓ | Storage パス（下記 5 章の規約） |
| `downloadUrl` | string | — | 公開後のみ設定。非公開動画は都度署名 URL を取得 |
| `durationMs` | number | — | 長さ |
| `danceType` | `'male' \| 'female'` | — | 撮影時の選択 |
| `scorePart` | `'feet' \| 'hands' \| 'whole'` | — | 撮影時の選択 |
| `visibility` | `'private' \| 'public'` | ✓ | 既定 `private`（仕様書 14.3） |
| `analysisStatus` | `'uploaded' \| 'analyzing' \| 'completed' \| 'failed'` | ✓ | 既定 `uploaded` |
| `latestAnalysisId` | string | — | 最新の `analysisResults` ドキュメント ID |
| `poseSeriesPath` | string | — | 姿勢系列 JSON の Storage パス。スタイル診断（FN-02）が読む |
| `createdAt` | Timestamp | ✓ | |

> 旧 `score` フィールドは持ちません。スコアは `analysisResults.totalScore` を正とします（仕様書 9.2 の「将来は AnalysisResults.totalScore を正とする」を採用）。

### 3.3 `posts/{postId}`

コミュニティへ公開した投稿。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | 投稿者 uid |
| `videoId` | string | ✓ | 公開対象の `videos` ドキュメント ID |
| `authorName` | string | ✓ | 表示用の非正規化コピー（一覧の N+1 読み取りを避ける） |
| `title` | string | ✓ | |
| `description` | string | — | |
| `tags` | string[] | — | 現行実装の `TAG_OPTIONS`（`#男踊り` 等）を踏襲 |
| `videoUrl` | string | ✓ | 表示用 URL の非正規化コピー |
| `totalScore` | number | — | AI 採点の非正規化コピー（一覧表示用） |
| `likeCount` | number | ✓ | 既定 0。`likes` サブコレクションから Functions で同期 |
| `commentCount` | number | ✓ | 既定 0。同上 |
| `createdAt` | Timestamp | ✓ | |
| `updatedAt` | Timestamp | ✓ | |

**非正規化の方針**: 一覧表示に必要な `authorName` / `videoUrl` / `totalScore` は `posts` にコピーします。正データは `users` / `videos` / `analysisResults` 側で、同期は Cloud Functions のトリガで行います。

### 3.4 `posts/{postId}/comments/{commentId}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | コメント投稿者 uid。**権限判定はこの値で行う**（仕様書 10.3） |
| `userName` | string | ✓ | 表示用コピー |
| `type` | `'normal' \| 'instructor'` | ✓ | 仕様書 9.2 準拠。UI の「門下生の声 / 師匠の教え」に対応 |
| `renId` | string | — | `instructor` の場合、どの連の管理者としての発言か |
| `text` | string | ✓ | 本文 |
| `createdAt` | Timestamp | ✓ | |
| `updatedAt` | Timestamp | — | |

> 現行実装は `type: 'advice' \| 'comment'` を使っています。`'advice' → 'instructor'`、`'comment' → 'normal'` へ読み替えます。

### 3.5 `posts/{postId}/likes/{uid}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | ドキュメント ID と同一 |
| `createdAt` | Timestamp | ✓ | |

ドキュメント ID を uid にすることで、**1 ユーザー 1 いいねを Rules だけで保証**できます（現行の `increment(1)` は無制限に加算できてしまう）。

### 3.6 `analysisResults/{analysisId}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `videoId` | string | ✓ | |
| `userId` | string | ✓ | |
| `totalScore` | number | ✓ | 0〜100 |
| `gameScore` | number | ✓ | 練習中の累積ポイント（絶対評価ではない） |
| `handHeightScore` | number | — | 項目別 0〜100 |
| `hipHeightScore` | number | — | 項目別 0〜100 |
| `stopScore` | number | — | 項目別 0〜100 |
| `rhythmScore` | number | — | 項目別 0〜100 |
| `greatCount` / `goodCount` / `missCount` | number | ✓ | イベント回数 |
| `maxCombo` | number | — | |
| `rawMetrics` | map | — | 判定根拠の数値（再検証・チューニング用） |
| `feedback` | `{ type: 'good' \| 'improve', ruleId: string, message: string }[]` | ✓ | ルール根拠から生成 |
| `analysisVersion` | string | ✓ | ルールセットのバージョン。過去スコア比較の意味を追跡 |
| `createdAt` | Timestamp | ✓ | |

**書き込みは Cloud Functions（system）のみ。** クライアントからの直接書き込みは Rules で禁止します。

### 3.7 `users/{uid}/growthRecords/{recordId}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `analysisId` | string | ✓ | 由来する `analysisResults` |
| `score` | number | ✓ | 比較用総合点（= `totalScore`） |
| `analysisVersion` | string | ✓ | 版が違う点数を同一グラフに引くときの注記に使う |
| `date` | Timestamp | ✓ | 記録日時 |

### 3.8 `ren/{renId}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `name` | string | ✓ | 連名 |
| `description` | string | — | 紹介 |
| `location` | string | — | 主な活動地域 |
| `iconUrl` | string | — | |
| `beginnerFriendly` | boolean | — | 初心者歓迎フラグ。連検索の絞り込みに使う |
| `memberCount` | number | ✓ | 非正規化。Functions で同期 |
| `createdBy` | string | ✓ | 作成した管理者 uid |
| `createdAt` / `updatedAt` | Timestamp | ✓ | |

### 3.9 `ren/{renId}/members/{uid}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | ドキュメント ID と同一 |
| `role` | `'member' \| 'admin'` | ✓ | **この値が連管理者権限の唯一の根拠**（仕様書 6 章の注記） |
| `status` | `'active' \| 'left'` | ✓ | |
| `joinedAt` | Timestamp | ✓ | |

> `users.role == 'ren_admin'` だけでは他の連を操作できません。必ず `ren/{renId}/members/{uid}.role == 'admin'` を検証します。

### 3.10 `joinRequests/{requestId}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | 申請者 |
| `renId` | string | ✓ | 対象連 |
| `message` | string | — | 任意メッセージ |
| `status` | `'pending' \| 'approved' \| 'rejected' \| 'cancelled'` | ✓ | |
| `handledBy` | string | — | 承認 / 却下した管理者 uid |
| `createdAt` / `updatedAt` | Timestamp | ✓ | |

同一ユーザー・同一連で `pending` を重複させないため、`{renId}_{userId}` を ID にする案もありますが、却下後の再申請を新規ドキュメントで扱う仕様書 9.4 の方針と衝突するため、**自動 ID + Functions 側の重複チェック**（`JOIN_REQUEST_ALREADY_PENDING`）とします。

### 3.11 `renStyleReferences/{referenceId}`

連の参照動画とその Embedding。**書き込みは連管理者と Functions のみ**（Embedding は元動画の代替的な個人情報になり得るため。仕様書 14.3）。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `renId` | string | ✓ | 対象の連 |
| `userId` | string \| null | ✓ | 熟練者本人の uid。不明なら null |
| `videoId` | string | ✓ | 参照動画 |
| `poseSeriesPath` | string | ✓ | 姿勢系列 JSON の Storage パス（5 章） |
| `embeddingVersion` | string | ✓ | 例 `style-baseline-v1`。**版が違う Embedding を比較しない** |
| `embeddingRef` | `{ kind: 'inline', vector: number[] }` | ✓ | Embedding 本体。次元が大きくなったら `kind: 'storage'` を追加する |
| `approved` | boolean | ✓ | 代表計算に採用してよいか。既定 false |
| `consent` | `{ obtained: boolean, scope: string, obtainedAt: Timestamp }` | ✓ | 提供者の同意と利用範囲。`obtained == false` は代表計算に使わない |
| `createdAt` / `updatedAt` | Timestamp | ✓ | |

### 3.12 `renStyleProfiles/{renId}`

連の代表 Embedding。**クライアントからは write 不可**（FN-07 のみが書く）。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `renId` | string | ✓ | ドキュメント ID と同一 |
| `embeddingVersion` | string | ✓ | |
| `embeddingRef` | `{ kind: 'inline', vector: number[] }` | ✓ | L2 正規化済みの代表ベクトル |
| `sampleCount` | number | ✓ | 採用した参照の件数。少ない連は UI で注記する |
| `updatedAt` | Timestamp | ✓ | |

承認済み参照が 0 件になったときは、**このドキュメントを削除**します（古い代表が残り続けるほうが危険なため）。

### 3.13 `styleAnalysisResults/{styleAnalysisId}`

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `userId` | string | ✓ | 診断したユーザー |
| `videoId` | string | ✓ | 対象動画 |
| `modelVersion` | string | ✓ | 使用した Embedding 版 |
| `status` | `'processing' \| 'completed' \| 'failed'` | ✓ | クライアントは `onSnapshot` で完了を待つ |
| `results` | `{ renId, renName, similarity, sampleCount }[]` | ✓ | 上位 N 件。`similarity` は**生のコサイン類似度**（表示値への変換はクライアント側） |
| `errorCode` | string \| null | ✓ | `failed` のときのコード（仕様書 13章） |
| `createdAt` | Timestamp | ✓ | |
| `completedAt` | Timestamp \| null | ✓ | |

### 3.14 その他

`announcements` / `activities` / `notifications` / `analysisRules` のフィールドは仕様書 9.3 および 7.9 の定義をそのまま採用します。パスのみ本書 2 章で確定しています。

## 4. 必要な複合インデックス

`firestore.indexes.json` は現在空です。以下を追加します。

| コレクション | フィールド | 用途 |
| --- | --- | --- |
| `posts` | `createdAt` desc | タイムライン（単一フィールドなので自動インデックスで可） |
| `posts` | `tags` array-contains + `createdAt` desc | タグ絞り込み一覧 |
| `videos` | `userId` asc + `createdAt` desc | 自分の練習動画一覧（U-09 / VideoList） |
| `videos` | `userId` asc + `analysisStatus` asc | 解析待ち動画の抽出 |
| `joinRequests` | `renId` asc + `status` asc + `createdAt` desc | R-05 参加リクエスト管理 |
| `joinRequests` | `userId` asc + `createdAt` desc | 自分の申請履歴 |
| `analysisResults` | `userId` asc + `createdAt` desc | 履歴一覧 |
| `styleAnalysisResults` | `userId` asc + `createdAt` desc | スタイル診断履歴（**定義済み**） |
| `renStyleReferences` | `renId` asc + `approved` asc | 代表 Embedding の再計算（FN-07。**定義済み**） |

## 5. Cloud Storage パス命名規則

| 用途 | パス | 公開範囲 |
| --- | --- | --- |
| 練習動画 | `users/{uid}/videos/{videoId}.mp4` | 所有者のみ（既定） |
| 公開投稿動画 | 同上（パスは変えず、Rules と `videos.visibility` で制御） | `visibility == 'public'` のとき閲覧可 |
| ユーザーアイコン | `users/{uid}/icon/{fileName}` | 認証ユーザーは read 可 |
| 連アイコン | `ren/{renId}/icon/{fileName}` | 認証ユーザーは read 可 |
| 連スタイル参照動画 | `ren/{renId}/styleReferences/{referenceId}.mp4` | 連管理者と system のみ |
| 姿勢系列（ユーザー動画） | `users/{uid}/videos/{videoId}.pose.json` | 所有者と system |
| 姿勢系列（連の参照動画） | `ren/{renId}/styleReferences/{referenceId}.pose.json` | 連管理者と system のみ |

**方針**:
- パスに `uid` を含めることで、Storage Rules で所有者判定ができます。
- 現行実装の `videos/{Date.now()}.mp4` は所有者情報を含まず Rules で保護できないため、上記へ移行します。
- 公開時にパスを移動させず、`videos.visibility` を参照して Rules で判定します（オブジェクトのコピーコストを避ける）。
- 推測可能な URL の常時公開を避けるため、非公開動画は `getDownloadURL` を保存せず、都度取得します（仕様書 14.2）。

## 6. 現行実装からの移行

### 6.1 対応表

| 現行 | 移行先 | 変換 |
| --- | --- | --- |
| `Users/{uid}.userName` | `users/{uid}.nickname` | コレクション名を小文字化、フィールド改名 |
| `videos/{id}.title` / `.tags` / `.authorName` / `.likes` / `.commentsCount` | `posts/{postId}` | 投稿情報として切り出す |
| `videos/{id}.videoUrl` | `videos/{videoId}.storagePath` + `posts.videoUrl` | 実体と表示用を分離 |
| `videos/{id}.score`（`Math.random()` 由来） | `analysisResults.totalScore` | **モック値は移行せず破棄する** |
| `videos/{id}/comments/*` | `posts/{postId}/comments/*` | `type` を `advice→instructor` / `comment→normal` に変換 |
| `videos/{id}.likes`（数値） | `posts/{postId}/likes/{uid}` | 数値からドキュメント集合へ。既存の合計値は `likeCount` の初期値として残す |

### 6.2 移行手順

1. 新コレクションへの書き込みを実装（読み取りは旧コレクションを併用）
2. 移行スクリプト（Admin SDK）で既存ドキュメントを変換コピー
3. 読み取りを新コレクションへ切り替え
4. 旧コレクションを read-only にして一定期間観測
5. 旧コレクション削除

> プロトタイプ段階でデータ量が少ないうちは、**既存データを破棄して作り直す**判断も妥当です。`score` はモック値であり保存価値がないため、チームで確認のうえ全削除を選ぶことを推奨します。

## 7. 仕様書に無い実装の扱い（chats）

現行実装には仕様書に存在しない 1 対 1 チャット（`chats/{chatId}/messages`、`chatId` は 2 者の uid をソート連結）があります。

| 論点 | 判断 |
| --- | --- |
| 仕様書との関係 | 未記載。仕様書は連への勧誘を `joinRequests` と `notifications` で実現する想定 |
| セキュリティ | 現在 Rules 未定義。参加者以外が読めてしまう設計になり得る |
| 当面の扱い | **プロトタイプ限定機能**として残す。`chats/{chatId}.participants: string[]` を追加し、Rules で参加者のみに限定する |
| 将来 | 仕様書 v0.4 で「連勧誘 DM」として正式に要件化するか、`joinRequests` + 通知に統合するかを決める（未決定事項として [status/roadmap.md](../status/roadmap.md) に記載） |
