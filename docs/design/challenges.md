# 先輩からのチャレンジ（設計メモ）

> **仕様書 v0.3 に無い追加機能です。** 2026-10-06 にチャットで決めた内容を、次の人が読めるように記録します。
> チームで正式に合意したものではないため、仕様書 v0.4 で正式化するか、見直すかを決める必要があります。

## 1. 何をする機能か

ホーム画面の「先輩からのチャレンジ」は、これまで見本（サンプル）データ（`src/data/mockChallenges.ts`）だけでした。
この機能で、**連の管理者が自分の連の名義で「お題」を出題できる**ようにします。お題はログインユーザー全員がホーム画面で見られます。

## 2. 決めたこと

| 論点 | 決定 | 理由 |
| --- | --- | --- |
| 出題できる人 | **連の管理者だけ**（`ren/{renId}/members/{uid}.role == 'admin'`） | 「先輩・指導者からのお題」という意味に合う。お知らせ（R-07）と同じ権限の仕組みが使える |
| 入力項目 | 題名・型・踊りの種類・難易度・出題者の肩書き（任意）・見てほしいところ・コツ（1〜5件）・**お手本動画（任意）** | 見本と同じ項目に、お手本動画を加えた |
| 閲覧できる人 | ログインユーザー全員 | ホーム画面に並べるため |
| 編集・削除 | 出題した連の管理者（出題者本人でなくてもよい） | 管理者の交代に備える。編集画面はまだ無く、削除だけ実装 |
| 進め方 | `docs/specs/` は作らず、このメモだけ書いて実装 | デモに間に合わせるため（2026-10-06 ユーザー判断） |

### やらないこと（今回の範囲外）

- 挑戦の記録（誰が挑戦したか・挑戦人数・「挑戦した人の演舞」）。見本にだけ表示し、実データでは出さない（作り物の数字を出さないため）
- お題の編集画面
- 出題時の通知
- 見本データの削除（実データと並べて「見本」の印を付けて表示する）

## 3. データ

### Firestore `challenges/{challengeId}`（トップレベル・自動 ID）

全連のお題をホーム画面で新しい順に並べるため、`ren/{renId}` のサブコレクションではなくトップレベルに置きます（collectionGroup クエリ用のルールを増やさないため）。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `renId` | string | 出題した連。この連の管理者だけが作成・削除できる |
| `renName` | string | 表示用に複製した連の名前 |
| `createdBy` | string | 出題者の uid（`request.auth.uid` と一致必須） |
| `posterName` | string | 出題者の表示名（`users.nickname` など） |
| `posterRole` | string | 出題者の肩書き（任意。例: 指導方・踊り歴20年） |
| `title` | string | 題名（1〜100文字） |
| `move` | string | 型・所作（1〜50文字） |
| `category` | `'male' \| 'female' \| 'narimono'` | 踊りの種類（男踊り／女踊り／鳴り物） |
| `difficulty` | `'beginner' \| 'intermediate' \| 'advanced'` | 難易度（初級／中級／上級） |
| `focus` | string | 先輩が見てほしいところ（1〜500文字） |
| `advice` | `{ point, detail }[]` | コツ（1〜5件） |
| `videoUrl` / `videoPath` | string（任意） | お手本動画の表示用 URL と Storage 上の場所 |
| `createdAt` / `updatedAt` | timestamp | `serverTimestamp()` |

- 管理画面の「この連のお題」は `where('renId', '==', renId)` だけで取り、並べ替えは手元で行います（複合インデックスを増やさないため）。
- ホーム画面は `orderBy('createdAt', 'desc')` で最大 30 件です（単一フィールドなのでインデックスは不要）。

### Cloud Storage `users/{uid}/challengeVideos/{fileName}`

お手本動画の置き場所です。アップロードした本人だけが書き込み・削除でき、ログインユーザー全員が閲覧できます（200MB 未満）。

Storage Rules からは「連の管理者かどうか」を判定できないため（`ren/{renId}/icon` と同じ事情）、**一般ユーザーでもこのパスには動画を置けます。** ただし、お題そのもの（`challenges` ドキュメント）は管理者しか作れないので、一般ユーザーが置いた動画がホーム画面に出ることはありません。削除は、お題を消した人がアップロードした本人のときだけ行います（別の管理者が消した場合は動画が残ります）。

## 4. 画面

| 画面 | ファイル | 内容 |
| --- | --- | --- |
| チャレンジの出題（管理者向け） | `src/screens/ManageChallengesScreen.tsx` | 管理ホームの「チャレンジの出題」から開く。出題フォームと、この連の出題済みのお題（削除可） |
| チャレンジ詳細 | `src/screens/ChallengeDetailScreen.tsx` | `challengeId` なら実データ、`id` なら見本。実データはお手本動画を再生できる |
| ホーム | `src/screens/HomeScreen.tsx` | 「先輩からのチャレンジ」に、実データ（新しい順）→ 見本（「見本」の印付き）の順で並べる |

## 5. 権限の確認（3層）

| 層 | 確認内容 |
| --- | --- |
| Rules | `firestore.rules` の `challenges`。作成は `isRenAdmin(request.resource.data.renId)` と `createdBy == request.auth.uid`、項目の型・長さ・許可値を検証。更新で `renId`・`createdBy`・`createdAt` は変更不可。テストは `tests/rules/challenges.rules.test.mjs` |
| Functions | 使わない（クライアントから直接書き込み、Rules で守る） |
| UI | 管理画面は `useAdminRens()` に含まれる連でだけフォームを出す |

## 6. 未決定・今後

- 仕様書 v0.4 で、画面 ID の付与と正式な要件化をするか
- 挑戦の記録（チャレンジと練習動画・投稿をつなぐ）を作るか
- 本番の Security Rules へのデプロイ（`firebase deploy --only firestore:rules,storage`）は**承認を得てから**行う
