# Security Rules 設計

> 出典: [仕様書 10章 認証・認可・Security Rules方針](../spec/10-auth-and-security-rules.md) / [15.2 Security Rules テスト](../spec/15-testing.md)
> 仕様書の CRUD 権限表を、実際に配置する Rules コードへ落とし込む文書です。

## 1. 現状の問題（着手前に必ず読むこと）

| # | 現状 | リスク |
| --- | --- | --- |
| S-1 | `firestore.rules` は Firebase のサンプル（`restaurants` / `ratings`）のままで、実際に使う `users` / `videos` / `chats` に一切ルールが無い | 未定義パスは既定で全拒否。**本番でアプリが動かない**。逆にテストモードで運用していれば全開放 |
| S-2 | `storage.rules` が `allow read, write: if true` | **誰でも動画をアップロード・上書き・削除できる**。認証すら不要 |
| S-3 | `users.role` に相当するフィールドが無い | 連管理者権限を検証する土台が無い |
| S-4 | 投稿の `likes` / `commentsCount` をクライアントが `increment()` で直接更新 | 無制限に加算できる（いいね数の改ざん） |
| S-5 | スコアをクライアントが直接書き込み | スコア改ざん（仕様書 10.3 が明示的に禁じている） |

S-2 は公開前に必ず修正が必要です。

## 1.5. 実装との既知の差分（2026-09-08時点、S-4は2026-09-10に#48で解消）

S-1（#57）とS-2（#50）は本書の内容に沿って先行実装・本番デプロイ済みです。S-4も#48実装により本書の方針通りになりました。

| 項目 | 本書の方針 | 現在の実装 | 状態 |
| --- | --- | --- | --- |
| `posts` の所有者フィールド名 | `userId` | `userId`（旧実装の `authorId` から統一済み） | 一致 |
| `posts.likeCount` / `commentCount` の更新 | クライアントから一切触らせず、`likes`/`comments` サブコレクションから Cloud Functions トリガ（`count()` 集計）で同期 | `functions/src/triggers/onLikeWrite.ts` / `onCommentWrite.ts` が `count()` 集計で同期。`firestore.rules` の `posts` update は投稿者本人でも `likeCount`/`commentCount` を変更不可 | ✅ **一致**（[#48](../../issues/48)で解消） |

旧実装（クライアントのトランザクションで `increment()`）は#48で廃止した。`CommunityScreen.tsx` の `onLike`/`onSend` は `likes`/`comments` ドキュメントの作成のみを行い、カウンタの同期はトリガーに一本化している。

### #40 実装時の差分（2026-09-10時点）

`firestore.rules` は本章のコード例に沿って `analysisResults` / `styleAnalysisResults` / `users/{uid}/growthRecords` / `users/{uid}/notifications` / `ren`(+members/announcements/activities) / `joinRequests` / `renStyle*` / `analysisRules` を追加した（いずれもアプリ側に書き込む機能がまだ無いため休眠中。`videos`/`posts`/`users`/`chats` の既存ルールは変更していない）。`renStyleReferences` のみ、本章のコード例をそのまま使うと `create` 時に `resource` が存在せずエラーになるバグがあったため、`create` は `request.resource.data.renId` を見る形に分けて実装している。

以下は本章・5章のコード例からあえて外した点。

| 項目 | 本章の方針 | 実装状況 | 理由 |
| --- | --- | --- | --- |
| Storage の「明示的に許可した以外は全拒否」（5章末尾） | 全拒否をデフォルトにする | **採用せず**。既存の包括ルール（認証+サイズ制限のみ）を維持 | `CommunityScreen.tsx` の投稿動画アップロードが `videos/{Date.now()}.mp4`（所有者情報を含まないフラットなパス）を今も使っており、全拒否にすると投稿機能が壊れる。パス規約への移行はフロント側の変更を伴うため別issue化を検討 |
| Storage の `isValidVideo()`/`isValidImage()`（contentType検証） | `contentType.matches('video/.*')` 等で検証 | **見送り**。サイズ制限のみ実装 | React Native側でアップロード時に正しい `contentType` が送られるか実機未検証（#50と同じ判断）。既に#39で使われている `users/{uid}/icon/` を壊すリスクがある |
| `firestore.indexes.json` の複合インデックス（4章末尾の表） | `videos`/`joinRequests`/`analysisResults`等に複合インデックスを追加 | **追加せず**（空のまま） | 該当する複合クエリを発行するアプリコードがまだ存在しない。クエリが実際に必要になった時点で追加する方針 |

Firestore Rules Unit Test（`@firebase/rules-unit-testing`、要Java）でスコア保護・`isRenAdmin()`・`joinRequests` の状態遷移・`renStyleReferences` のバグ修正・既存ルールの回帰が無いことを確認済み。自動テストへの組み込みは引き続き#42のスコープ。

## 2. 権限判定の基本原則

1. `request.auth.uid` を所有者判定の唯一の根拠にする。
2. **連管理者権限は `users.role` だけで判定しない。** 対象連の `ren/{renId}/members/{uid}.role == 'admin'` を必ず確認する（仕様書 10.3）。
3. スコア（`analysisResults` / `growthRecords`）はクライアントから書けない。Cloud Functions（Admin SDK）のみが書く。Admin SDK は Rules を経由しないため、Rules 側は「クライアント全拒否」と書けばよい。
4. 状態遷移（`joinRequests.status`）は遷移元と遷移先の組み合わせを検証する。
5. 保護フィールド（`users.role`、`posts.likeCount` など）は更新差分に含まれていないことを確認する。

## 3. CRUD 権限表（実装版）

仕様書 10.2 を物理パスへ対応させたものです。`self` = 本人、`renAdmin` = 対象連の管理者、`system` = Cloud Functions。

| パス | read | create | update | delete |
| --- | --- | --- | --- | --- |
| `users/{uid}` | 認証済み | self | self（`role` 除く） | self |
| `videos/{videoId}` | self、または `visibility == 'public'` | self | self（`analysisStatus`/`latestAnalysisId` 除く） | self |
| `posts/{postId}` | 認証済み | self（対象 video の所有者） | 投稿者（`likeCount`/`commentCount` 除く） | 投稿者 |
| `posts/{postId}/comments/{id}` | 認証済み | 認証済み | コメント本人 | コメント本人 |
| `posts/{postId}/likes/{uid}` | 認証済み | self（ID == uid） | ✗ | self |
| `analysisResults/{id}` | self | ✗（system のみ） | ✗ | ✗ |
| `users/{uid}/growthRecords/{id}` | self | ✗ | ✗ | ✗ |
| `ren/{renId}` | 認証済み | 認証済み（作成者が自動で admin になる） | renAdmin | renAdmin |
| `ren/{renId}/members/{uid}` | 認証済み | ✗（system / renAdmin） | renAdmin | renAdmin または self（脱退） |
| `ren/{renId}/announcements/{id}` | 認証済み | renAdmin | renAdmin | renAdmin |
| `ren/{renId}/activities/{id}` | 認証済み | renAdmin | renAdmin | renAdmin |
| `joinRequests/{id}` | 申請者 self または renAdmin | self（`status == 'pending'` 固定） | self は `pending→cancelled` のみ / renAdmin は `pending→approved\|rejected` のみ | ✗ |
| `users/{uid}/notifications/{id}` | self | ✗ | self（`read` のみ） | self |
| `renStyleProfiles/{renId}` | 認証済み | ✗ | ✗ | ✗ |
| `renStyleReferences/{id}` | renAdmin | renAdmin | renAdmin | renAdmin |
| `styleAnalysisResults/{id}` | self | ✗ | ✗ | self |
| `analysisRules/{ruleId}` | 認証済み | ✗ | ✗ | ✗ |
| `chats/{chatId}` | 参加者のみ | 参加者を含む形で self | ✗ | ✗ |
| `chats/{chatId}/messages/{id}` | 参加者のみ | 参加者（`senderId == uid`） | ✗ | 送信者 |

## 4. Firestore Rules 実装案

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- ヘルパー ----------
    function isSignedIn() {
      return request.auth != null;
    }
    function isSelf(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    // 対象連の管理者か（users.role ではなく members で判定する）
    function isRenAdmin(renId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/ren/$(renId)/members/$(request.auth.uid))
        && get(/databases/$(database)/documents/ren/$(renId)/members/$(request.auth.uid)).data.role == 'admin';
    }
    // 更新差分に保護フィールドが含まれていないか
    function notChanging(fields) {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny(fields);
    }
    function onlyChanging(fields) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
    }

    // ---------- users ----------
    match /users/{uid} {
      allow read: if isSignedIn();
      allow create: if isSelf(uid)
                    && request.resource.data.role == 'user';   // 自己昇格の防止
      allow update: if isSelf(uid)
                    && notChanging(['role', 'uid', 'createdAt']);
      allow delete: if isSelf(uid);

      // 成長記録は system のみが書く（Admin SDK は Rules を通らない）
      match /growthRecords/{recordId} {
        allow read: if isSelf(uid);
        allow write: if false;
      }

      match /notifications/{notificationId} {
        allow read: if isSelf(uid);
        allow create: if false;
        allow update: if isSelf(uid) && onlyChanging(['read']);
        allow delete: if isSelf(uid);
      }
    }

    // ---------- videos ----------
    match /videos/{videoId} {
      allow read: if isSignedIn()
                  && (resource.data.userId == request.auth.uid
                      || resource.data.visibility == 'public');
      allow create: if isSignedIn()
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.visibility == 'private'
                    && request.resource.data.analysisStatus == 'uploaded';
      // 解析状態とスコア参照は system が更新する
      allow update: if isSelf(resource.data.userId)
                    && notChanging(['userId', 'analysisStatus', 'latestAnalysisId', 'createdAt']);
      allow delete: if isSelf(resource.data.userId);
    }

    // ---------- posts ----------
    match /posts/{postId} {
      allow read: if isSignedIn();
      // publishPost (FN-03) を使わずクライアントから作る場合の最低条件
      allow create: if isSignedIn()
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.likeCount == 0
                    && request.resource.data.commentCount == 0;
      // カウンタはクライアントに触らせない
      allow update: if isSelf(resource.data.userId)
                    && notChanging(['userId', 'videoId', 'likeCount', 'commentCount', 'createdAt']);
      allow delete: if isSelf(resource.data.userId);

      match /comments/{commentId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn()
                      && request.resource.data.userId == request.auth.uid
                      // instructor コメントは対象連の管理者のみ
                      && (request.resource.data.type == 'normal'
                          || (request.resource.data.type == 'instructor'
                              && isRenAdmin(request.resource.data.renId)));
        // 権限は「投稿者」ではなく「コメント自身の userId」で判定する（仕様書 10.3）
        allow update: if isSelf(resource.data.userId) && notChanging(['userId', 'type', 'createdAt']);
        allow delete: if isSelf(resource.data.userId);
      }

      // ドキュメント ID を uid にすることで 1 ユーザー 1 いいねを保証する
      match /likes/{uid} {
        allow read: if isSignedIn();
        allow create: if isSelf(uid) && request.resource.data.userId == uid;
        allow update: if false;
        allow delete: if isSelf(uid);
      }
    }

    // ---------- analysisResults ----------
    match /analysisResults/{analysisId} {
      allow read: if isSelf(resource.data.userId);
      allow write: if false;   // system のみ
    }

    match /styleAnalysisResults/{styleAnalysisId} {
      allow read: if isSelf(resource.data.userId);
      allow create, update: if false;
      allow delete: if isSelf(resource.data.userId);
    }

    // ---------- ren ----------
    match /ren/{renId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.createdBy == request.auth.uid;
      allow update: if isRenAdmin(renId) && notChanging(['createdBy', 'memberCount', 'createdAt']);
      allow delete: if isRenAdmin(renId);

      match /members/{uid} {
        allow read: if isSignedIn();
        allow create: if isRenAdmin(renId);          // 通常は FN-05 経由（system）
        allow update: if isRenAdmin(renId);
        allow delete: if isRenAdmin(renId) || isSelf(uid);   // 本人の脱退を許可
      }

      match /announcements/{announcementId} {
        allow read: if isSignedIn();
        allow write: if isRenAdmin(renId);
      }

      match /activities/{activityId} {
        allow read: if isSignedIn();
        allow write: if isRenAdmin(renId);
      }
    }

    // ---------- joinRequests ----------
    match /joinRequests/{requestId} {
      allow read: if isSelf(resource.data.userId) || isRenAdmin(resource.data.renId);
      allow create: if isSignedIn()
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status == 'pending';
      // 申請者は取消のみ / 管理者は承認・却下のみ（状態遷移を検証する）
      allow update: if (isSelf(resource.data.userId)
                        && resource.data.status == 'pending'
                        && request.resource.data.status == 'cancelled')
                    || (isRenAdmin(resource.data.renId)
                        && resource.data.status == 'pending'
                        && request.resource.data.status in ['approved', 'rejected']);
      allow delete: if false;
    }

    // ---------- renStyle* ----------
    match /renStyleReferences/{referenceId} {
      allow read, write: if isRenAdmin(resource.data.renId);
    }
    match /renStyleProfiles/{renId} {
      allow read: if isSignedIn();
      allow write: if false;   // FN-07 (system) のみ
    }

    // ---------- analysisRules（判定閾値のマスタ） ----------
    match /analysisRules/{ruleId} {
      allow read: if isSignedIn();
      allow write: if false;   // 運用者がコンソール / Functions から更新
    }

    // ---------- chats（仕様書外・プロトタイプ限定） ----------
    match /chats/{chatId} {
      allow read: if isSignedIn() && request.auth.uid in resource.data.participants;
      allow create: if isSignedIn() && request.auth.uid in request.resource.data.participants;
      allow update, delete: if false;

      match /messages/{messageId} {
        function participants() {
          return get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        }
        allow read: if isSignedIn() && request.auth.uid in participants();
        allow create: if isSignedIn()
                      && request.auth.uid in participants()
                      && request.resource.data.senderId == request.auth.uid;
        allow update: if false;
        allow delete: if isSelf(resource.data.senderId);
      }
    }
  }
}
```

> ⚠️ `isRenAdmin()` は `get()` を使うため、1 リクエストあたりのドキュメント読み取り回数を消費します（Rules の `get`/`exists` は 1 リクエスト 10 回まで）。連管理画面のように連続判定が必要な場所では、Custom Claims（`request.auth.token.renAdminOf`）への移行を検討します。→ 未決定事項として [status/roadmap.md](../status/roadmap.md) に記載。

## 5. Storage Rules 実装案

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function isValidVideo() {
      return request.resource.size < 200 * 1024 * 1024          // 200MB 上限
        && request.resource.contentType.matches('video/.*');
    }
    function isValidImage() {
      return request.resource.size < 5 * 1024 * 1024            // 5MB 上限
        && request.resource.contentType.matches('image/.*');
    }

    // 練習動画: 所有者のみ。公開判定は Firestore 側の videos.visibility で行うため、
    // 公開動画は投稿時に downloadUrl を発行して posts に持たせる運用とする。
    match /users/{uid}/videos/{fileName} {
      allow read: if isOwner(uid);
      allow write: if isOwner(uid) && isValidVideo();
    }

    match /users/{uid}/icon/{fileName} {
      allow read: if isSignedIn();
      allow write: if isOwner(uid) && isValidImage();
    }

    match /ren/{renId}/icon/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();      // TODO: Firestore の members を参照できないため Functions 経由に寄せる
    }

    // 連スタイル参照動画: 一般ユーザーには読ませない
    match /ren/{renId}/styleReferences/{fileName} {
      allow read: if false;              // system / 管理者は Admin SDK 経由で扱う
      allow write: if false;
    }

    // 明示的に許可した以外は全拒否
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

> Storage Rules は Firestore を参照できません（`firestore.get()` は Firestore Rules 専用）。そのため「公開動画を全員に read させる」制御は Storage 側では表現できず、**投稿時に発行した `downloadUrl` を `posts` に持たせる**方式を採ります。トークン付き URL のため、投稿を削除しても URL 自体は有効に残る点に注意し、非公開化の際は Functions でトークンを再発行（`firebase-admin` の `getSignedUrl` / メタデータ更新）します。

## 6. テスト設計（15.2 対応）

`@firebase/rules-unit-testing` + Firestore Emulator で以下を自動テストします。

```
functions/test/rules/            または  tests/rules/
├── users.rules.test.ts
├── videos.rules.test.ts
├── posts.rules.test.ts
├── joinRequests.rules.test.ts
├── ren.rules.test.ts
└── chats.rules.test.ts
```

必須テストケース（仕様書 15.2 の 6 項目 + 本設計の追加分）:

| # | ケース | 期待 |
| --- | --- | --- |
| 1 | 他人の `visibility == 'private'` な動画を read | 拒否 |
| 2 | 自分の `growthRecords.score` を update | 拒否 |
| 3 | 一般ユーザーが `users/{self}.role` を `ren_admin` へ update | 拒否 |
| 4 | 申請者が自分の `joinRequests.status` を `approved` へ update | 拒否 |
| 5 | 連 A の管理者が連 B の `announcements` を create | 拒否 |
| 6 | コメント A の投稿者がコメント B を delete | 拒否 |
| 7 | 投稿者以外が `posts.likeCount` を update | 拒否 |
| 8 | 同一ユーザーが同じ投稿へ 2 回 like（同 ID への再 create） | 2 回目は拒否 |
| 9 | チャット参加者以外が `messages` を read | 拒否 |
| 10 | 未認証で `videos` を read | 拒否 |
| 11 | 所有者が自分の private 動画を read | 許可 |
| 12 | 連管理者が自連の `joinRequests` を `approved` へ update | 許可 |

### #42 実装時の差分（2026-09-10時点）

- 配置は `tests/rules/`（`functions/test/rules/` ではない。Cloud Functions のコードと Security Rules のテストは別物のため）。ファイル形式も `.rules.test.ts` ではなく `.rules.test.mjs`（Node 標準の `node:test` を使用。tsc のビルドステップを増やさないため。#46 の Cloud Functions 側のテストと同じ方針）。`scores.rules.test.mjs`（`analysisResults`/`growthRecords`）を6ファイル構成に追加している。
- 実行は `npm run test:rules`（ルートの `package.json`）→ `firebase emulators:exec --only firestore,storage "npm --prefix tests/rules test"`。GitHub Actions（`.github/workflows/rules-tests.yml`）で `firestore.rules`/`storage.rules`/`tests/rules/**` の変更時に自動実行する。
- ケース6（コメントAの投稿者がコメントBをdelete）を検証するため、`posts/comments` の update/delete を「全員拒否」から「コメント本人のみ許可」（仕様書10.3の原則通り）に直した。削除UI自体はまだ無いため見た目の挙動は変わらない。
- ケース7（投稿者以外が`posts.likeCount`をupdate）は、文字通りには検証できない。`likeCount`/`commentCount`はクライアントの暫定対応として認証済みユーザーなら誰でも更新できる設計のため（1.5章参照、#48で置き換え予定）。テストは実際に効いている境界（他フィールドと同時には更新できない）を検証している。
- `type: 'instructor'` コメントの作成者を `isRenAdmin()` で絞るテストケースは意図的に `skip` している。連機能（`ren`/`members`）が未実装で誰も連管理者になれないため、今締めると「師匠の教え」機能を誰も使えなくなる。連機能実装時に対応する方針とした。

実行コマンド（導入後）:

```bash
firebase emulators:exec --only firestore,storage "npm run test:rules"
```

### #26・#27 実装時の差分（2026-09-10時点）

- `ren/{renId}` の `create` を、本章 3 章の CRUD 表（「認証済み」）から **`false` に変更**した。連本体の作成と、作成者を `role: 'admin'` のメンバーとして登録する処理をアトミックに行うため `createRen`（Cloud Functions、#26 で新設）に一本化したため。`members` の `create` は元々 `false`（このドキュメントの当初案通り）。
- `joinRequests/{id}` の `create` も、本章 3 章の CRUD 表（「self（`status == 'pending'` 固定）」）から **`false` に変更**した。重複 pending 申請・既存メンバーの再申請チェックは複数ドキュメントにまたがる検証で Rules では表現できないため、`submitJoinRequest`（Cloud Functions、#27 で実装）に一本化した。
- `submitJoinRequest` は FN-04 の設計（`docs/design/api-functions.md`）通りだが、「対象連の管理者へ通知を作成」は `notifications` 機能自体が未実装（#43）のため見送った。

エミュレータ（Firestore + Functions + Auth）で `createRen`・`submitJoinRequest` の実際の呼び出しを確認済み（連作成＋管理者登録、重複 pending 申請の拒否、既存メンバーの再申請拒否、入力バリデーション）。

### #29 実装時の差分（2026-09-10時点）

- `requireRenAdmin(uid, renId)` を本章冒頭のサンプルコード通り `functions/src/lib/guards.ts` に実装した。現時点で呼び出す連管理者向け Function はまだ無いが、R-02〜R-08（#30〜#34）実装時にそのまま使う想定。
- クライアント側の `useAdminRens()`（`src/hooks/useAdminRens.ts`）は `collectionGroup('members')` に `userId`/`role`/`status` の等価条件3つで問い合わせる。コレクショングループクエリは自動インデックスの対象外のため、`firestore.indexes.json` に `queryScope: COLLECTION_GROUP` の複合インデックスを追加した。
- R-01 管理ホーム（`AdminHomeScreen.tsx`）は、フック・ガード・入り口の出し分け（`MypageScreen.tsx` に管理者のみ表示の「連の管理」メニューを追加）・複数連の切り替え・未対応の参加リクエスト件数までを実装した。**「新着投稿」の表示範囲は #30 の未確定事項 N-3（自連メンバーのみ／全公開投稿）が決まっていないため、「通知」は #43 が未実装のため、R-02〜R-08 への遷移は該当画面がまだ無いため、いずれも「準備中」のプレースホルダーに留めている。**

エミュレータ（Firestore Admin SDK）で `requireRenAdmin()` 相当のロジックと `collectionGroup` クエリの絞り込み（admin かつ active のみ）を確認済み。

**マージ後の追記**: 実機で `useAdminRens()` が `Missing or insufficient permissions` になる不具合が発生した。原因は、ネストしたパス指定ルール（`match /ren/{renId}/members/{uid}`）は通常の `get`/`list` には適用されるが **`collectionGroup` クエリには適用されない**という Firestore の仕様（Admin SDK 経由のエミュレータ検証では Rules 自体を経由しないため見逃していた）。再帰ワイルドカード（`match /{path=**}/members/{uid}`）で read 専用のルールを別途追加して解消した（詳細は 4 章の `members` のルールを参照）。

### #32 実装時の差分（2026-09-10時点）

- FN-05 `updateJoinRequestStatus`（`functions/src/ren/updateJoinRequestStatus.ts`）は本章冒頭のガード方針通り `requireRenAdmin(uid, renId)` を使う。`joinRequests.status` の更新・`members` 作成・通知作成を1つのトランザクションで行う。
- `notifications`（`users/{uid}/notifications/{notificationId}`）へ書き込む処理は本関数が**リポジトリで初めて**実装した。フィールド定義は `docs/design/data-model.md` に個別の定義が無く、`docs/spec/09-data-design.md` §9.3 の Notifications 定義（`userId`/`type`/`referenceId`/`title`/`body`/`read`/`createdAt`）をそのまま採用した。
- `joinRequests.update` の Rules を、連管理者による直接 `approved`/`rejected` への更新を許可する分岐ごと削除し、`false`寄りに強化した（申請者本人の `pending→cancelled` のみ残す）。承認・却下を `updateJoinRequestStatus` 経由に一本化し、`members` 作成・通知作成との同期性が Rules 側の直接 update で崩れないようにするため（3章 CRUD 表・`tests/rules/joinRequests.rules.test.mjs` を更新）。
- `firestore.indexes.json` に `joinRequests(renId, status, createdAt)` の複合インデックス（本issueの受け入れ条件）と、申請者の投稿動画一覧表示用に `posts(userId, createdAt)` の複合インデックスを追加した。
- Functions のリージョン（`asia-northeast1`）と Firestore のロケーション（`nam5`）が異なる点について、本関数はトランザクション内で読み取り2回（`joinRequests`・`ren`）＋書き込み最大3回（`joinRequests`・`members`・`notifications`）を行うマルチステップな処理であり、`docs/design/api-functions.md` 6章 N-4 が「見直しを検討」と留保していたケースに該当する。今回はリージョン変更のような大きな決定は行わず、実装のみ先行させた。エミュレータでの実測では体感できる遅延は無かったが、本番でのレイテンシ悪化が疑われた場合は改めてチームでリージョン方針を見直すこと。

エミュレータ（Firestore + Functions + Auth）で `updateJoinRequestStatus` の実際の呼び出しを確認済み（承認時の `members` 作成・通知作成・トランザクション、却下時の通知のみ作成、`pending` 以外への再承認拒否(`INVALID_STATUS_TRANSITION`)、他連の管理者による操作拒否、非管理者による操作拒否）。

### #33 実装時の差分（2026-09-11時点）

- 仕様書の FN-01〜07 一覧には無いが、`createRen`（#26）と同様の理由で `updateMemberRole` と `removeMember` を新設した（`functions/src/ren/updateMemberRole.ts` / `removeMember.ts`）。「最後の管理者を降格・削除できない」という ren 単位の不変条件は、Rules の `get()`/`exists()` だけでは残り管理者数を数えられず表現できないため、Cloud Functions（トランザクション内で `role=='admin' && status=='active'` を集計）に一本化した。
- 上記に伴い `ren/{renId}/members/{uid}` の Rules を強化した。`update` は常に `false`（`updateMemberRole` 経由のみ）、`delete` は本人の脱退（`isSelf(uid)`）のみ直接許可し、連管理者による他メンバーの直接 `update`/`delete` は不可にした（`removeMember` 経由のみ）。本人による脱退は本issueの注記どおり変更していない（脱退時に「最後の管理者かどうか」はチェックしない。連が管理者不在になり得る点は仕様書側の既知の制約として残る）。
- 「最後の管理者」制約を拒否するエラーコードは仕様書13章に専用のものが無いため、`INVALID_STATUS_TRANSITION` を流用した（状態遷移として不正、という点で意味が近いため。新規コード追加は行っていない）。
- `ren.memberCount` の増減追従は、既存の `onMemberWrite` トリガ（#48 実装、`ren/{renId}/members` の書き込みで `status=='active'` を数え直す）がそのまま使えたため、本issue用の追加実装は不要だった。エミュレータで役割変更・除名後に `memberCount` が再集計されることを確認済み。
- R-06 メンバー管理画面（`MemberManagementScreen.tsx`）は、一覧・役割変更・除名・プロフィール/投稿履歴への導線（既存の `UserProfileScreen` へ遷移）を実装した。UI 判断として、一覧に表示される行のうち**自分自身の行には役割変更・除名ボタンを出さない**（自分の権限を誤って落とす事故を防ぐため。Functions 側は自分自身を対象にしても動作する）。

エミュレータ（Firestore + Functions + Auth）で `updateMemberRole`・`removeMember` の実際の呼び出しを確認済み（昇格・降格、残り管理者がいる場合の降格・除名の成功、最後の管理者の降格・除名の拒否(`INVALID_STATUS_TRANSITION`)、除名後の `memberCount` 再集計、他連の管理者による操作拒否）。

### #28 実装時の差分（2026-09-11時点）

- `GroupScreen.tsx` を「所属している連のグループ」の1行スタブ（実際にはローカル state のみで完結する連作成フォームだった）から、実際の U-08 マイ連画面に置き換えた。所属連の情報・活動情報・お知らせ・自分の役割を表示し、複数連所属時はタブで切り替える。既存の連作成（`createRen` 呼び出し）機能はモーダルとして残し、機能を落とさないようにした。
- `src/hooks/useMyRens.ts`（新規）: `useAdminRens()`（#29）と同様に `collectionGroup('members')` を使うが、`role` の絞り込みが無い点が異なる（管理者に限らず所属している全ての連を返す）。この形の等価条件（`userId`+`status`のみ、`role`を挟まない）は既存の `members(userId, role, status)` インデックスでは賄えないため、`firestore.indexes.json` に `members(userId, status)`（`COLLECTION_GROUP`）を追加した。
- `ren/{renId}/activities`・`announcements` の読み取りは元々 `allow read: if isSignedIn();` のままで足りるため、Rules 変更は無し。#34（お知らせ・活動情報の管理画面/FN-06）が未実装のため、実際にデータを作成する手段が無く、現状は空状態（「まだありません」）の表示のみ確認できる。
- 受け入れ条件の「メンバー一覧（人数、自分の役割）」は、`ren.memberCount` と自分の `role` の表示のみとした。メンバー個々の詳細な一覧は既に管理者向けの `MemberManagementScreen`（#33）が担っており、一般メンバー向けに別の一覧UIを重複実装しなかった。

エミュレータ（Firestore + Auth、クライアントSDK）で `useMyRens` 相当の `collectionGroup` クエリ（複数連所属時の件数、所属していないユーザーは0件）と、活動情報のstartAt昇順・お知らせのcreatedAt降順の並び順を確認済み。

### #34 実装時の差分（2026-09-11時点）

**TBD-15（お知らせ・活動情報の公開範囲）の結論**: 現状維持（`allow read: if isSignedIn();`。サインイン済みなら所属者でなくても閲覧可能）とする。ユーザー判断（2026-09-11）。理由: `ren` ドキュメント自体・R-01管理ホームなど他の連情報も同じ「誰でも read」の扱いで統一しているため。**将来的にメンバー限定のメッセージ機能（所属者のみ読める連絡）を別途追加したいという要望があり**、その際は本チケットの「誰でも read」の結論とは別に、新しいコレクション（例: 所属者限定の `ren/{renId}/memberMessages` 等）を新設し、`isRenMember(renId)` のようなヘルパーを追加して対応する想定。既存の `announcements`/`activities` の公開範囲は変更しない。

- FN-06 `createAnnouncement`（`functions/src/ren/createAnnouncement.ts`）は設計通り実装。通知の宛先は `status=='active'` のメンバーから**作成者自身を除外**する。500件超のバッチ分割は`docs/design/api-functions.md` FN-06参照。
- R-07 お知らせ管理（`ManageAnnouncementsScreen.tsx`）・R-08 活動情報管理＋連基本情報編集（`ManageActivitiesScreen.tsx`、`createRen`/更新は既存の `ren` update Rules で足りるため直接Firestore書き込み）を実装。日時入力は専用の日付選択UIライブラリを新規導入せず、`YYYY-MM-DD HH:mm` 形式のテキスト入力＋パース検証とした（他の箇所と同様、新規依存追加を避ける方針）。
- **想定外だった修正（storage.rulesの包括ルール不具合)**: 連アイコンを対象連の管理者のみ書き込み可にする際、Storage Rulesの Cross-Service Rules（`firestore.get()`）でFirestoreの`ren/{renId}/members/{uid}.role`を直接参照する形にした。ところが検証中、`storage.rules`末尾の包括ルール（`match /{allPaths=**} { allow create, update: if request.auth != null && size<200MB; }`）が、この新ルールを含め既存の**すべての制限付きルール**（`users/{uid}/videos`の所有者限定、`users/{uid}/icon`の所有者限定、`ren/{renId}/styleReferences`の`allow ...: if false`）を実質無効化していた（同一パスに複数のmatchが一致する場合はいずれかが許可すれば許可される、というFirebase Rulesの仕様のため）ことが判明した。任意のsigned-inユーザーが他人の動画・アイコンを上書きできる状態が本番に存在していたことになる。ユーザー確認のうえ、この包括ルールを削除し、実際にCommunityScreenが使っている`videos/{fileName}`（公開投稿動画）専用のルールを新設、それ以外はデフォルト拒否に変更した。#34自体のスコープを超える修正だが、ren アイコンの管理者限定化と両立できないため合わせて対応した。

エミュレータ（Firestore + Functions + Auth + Storage）で以下を確認済み: `createAnnouncement`呼び出し(announcements作成・通知の宛先絞り込み・脱退済み/作成者除外・文字数バリデーション・他連管理者と一般メンバーからの拒否)、Storageの`ren/{renId}/icon`が対象連の管理者のみ書き込み可であること、`videos/{fileName}`は署名済みユーザーなら誰でも書き込み可であること、`users/{uid}/videos`・`icon`・`ren/{renId}/styleReferences`が包括ルール撤去後も意図通り制限されること、未知のパスがデフォルト拒否になること。

**マージ後の追記（連アイコンのCross-Service Rulesを撤回）**: 上記の`ren/{renId}/icon`の`firestore.get()`ベースの管理者チェックは、エミュレータでは正しく動作したが、本番デプロイ後に実機で`storage/unauthorized`エラーが発生し、管理者本人でもアイコンを更新できない不具合が判明した（原因未特定。Cross-Service Rulesのエミュレータ/本番間の何らかの差異と推測されるが、確証は得られていない）。信頼性を優先し、Storage RulesでのFirestore参照はやめ、`updateRenIcon`（Cloud Functions/Admin SDK、新設）経由に切り替えた。クライアントは本人のみ書き込み可能な一時領域（`users/{uid}/renIconUploads/{renId}/{fileName}`、新設）へアップロードし、本関数が`requireRenAdmin`検証後に`ren/{renId}/icon/`へ`move`、ダウンロードトークンを発行して`ren.iconUrl`を更新する。`ren/{renId}/icon`への直接書き込みは`allow write: if false`とした。エミュレータ（Storage + Firestore + Functions + Auth）で、正常系（管理者による更新・`ren.iconUrl`反映）、一般メンバーからの拒否、他人の一時パスを指定した場合の拒否、`ren/{renId}/icon`への直接書き込みが拒否されることを確認済み。**教訓**: Cross-Service Rules（Storage RulesからのFirestore参照）はエミュレータでの検証だけでは本番動作の保証にならない可能性があるため、今後同様の機能を使う場合は本番の実機確認を必須とすること。

### #30 実装時の差分（2026-09-11時点）

**N-3（連管理者に見せる投稿の範囲）の結論**: 案B（全公開投稿を閲覧可、自連メンバーはハイライト）で決定（ユーザー判断、2026-09-11）。理由は本issueが提示したとおり、仕様書1.2の「実際の連・地域コミュニティへの橋渡し」という目的、パンフレットの連による勧誘機能と整合するため。`posts`コレクションは元々`allow read: if isSignedIn();`（コミュニティ機能として全ユーザーに公開）のままなので、この決定に伴うRules変更は無い。

- R-02/R-03（`ManagePostsScreen.tsx`）は`posts`コレクションを直接購読し（`CommunityScreen.tsx`と同じデータソース）、連管理者向けの検索・並び替え・詳細表示のビューを追加しただけで、新しいコレクションやRulesは増やしていない。自連メンバーのハイライトは、対象連の`members`（`status=='active'`）のuid集合と`post.userId`を突き合わせるクライアント側の判定。
- 「非公開の練習動画が管理者にも見えない」という受け入れ条件は、本画面が`videos`コレクション（練習動画、非公開デフォルト）に一切アクセスせず、常に`posts`（投稿時点で公開済みの動画）のみを参照する設計のため、構造的に満たされる。
- 「AI採点結果（総合・項目別スコア）」は、FN-01（AI採点確定）・`analysisResults`コレクションが未実装のため、`posts.score`（`publishPost`が発行する暫定モック値、#41参照）の総合スコアのみを表示し、項目別スコアは「未実装のため表示できません」という注記に留めた。FN-01実装後、`analysisResults`と連携する形に置き換える想定。
- 「アドバイスを送る」ボタンはUIとして設置し、当初は遷移先のR-04（アドバイス送信画面）がまだ無かったため「準備中」を案内するのみだったが、#31でR-04（`AdviceComposeScreen.tsx`）を実装し、実際に遷移するようにした。
- 「未アドバイス優先」の並び替えは、各投稿の`comments`サブコレクションに`type=='instructor'`のドキュメントが1件でも存在するかをクライアント側で個別に確認して判定する（`limit(1)`のクエリ、投稿件数が多くない前提の実装）。

### #31 実装時の差分（2026-09-12時点）

- issue本文は現行実装の`type`が`'advice'/'comment'`だと指摘していたが、実際には既に`'instructor'/'normal'`（仕様書9.2準拠）になっており、この読み替えは不要だった。`docs/design/data-model.md` 3.4章の古い注記を削除した(実態と乖離していた記録を修正)。
- `posts/{postId}/comments/{commentId}`のRulesを強化した。`type=='instructor'`の場合のみ`renId`を必須にし、`isRenAdmin(renId)`を検証する（`isRenAdmin`は呼び出し本人がそのrenIdの管理者かどうかを見るため、他人の連の管理者を騙ることはできない）。あわせて、issueの受け入れ条件にあった本文の文字数検証（1〜1000文字）もこの機会にRulesへ追加した（従来は無かった）。
- `tests/rules/posts.rules.test.mjs`の既存のskipテスト（「連機能が未実装のため」という理由で#26以降ずっとskipされ続けていた）を有効化し、あわせて正常系（自分の連のrenIdでは作成できる）・異常系（他連のrenIdは騙れない・renId無しでは作成できない）のテストを追加した。
- 投稿者への通知は、Cloud Functionsの新規呼び出しではなく既存の`onCommentWrite`トリガ（#48、`commentCount`の再集計用）を拡張する形にした。`type=='instructor'`の新規作成時のみ、投稿者の`users/{uid}/notifications`に通知を作成する（`type: 'comment'`。仕様書9.3のtype例に準拠）。通知ドキュメントIDにコメントIDをそのまま使うことで、トリガのat-least-once配信による重複作成を防いでいる（`set()`は同じ内容で上書きするだけになるため）。
- クライアント側（`CommunityScreen.tsx`）は、`useAdminRens()`でユーザーが管理者である連の一覧を取得し、1件以上あれば「師匠の教え」タブへの投稿を許可する。複数の連を管理している場合は暫定的に最初の連の管理者として投稿する（issueに明示的な言及が無いため、シンプルな実装を優先した）。管理者でないユーザーが「師匠の教え」タブを開いた場合、投稿欄自体を「指導者コメントは連の管理者のみ投稿できます」という案内に置き換える（タブ自体は誰でも閲覧できるままにする。閲覧はRules上も制限していないため）。

エミュレータ（Firestore + Functions + Auth）で以下を確認済み: 連管理者が自分の連のrenIdで指導者コメントを送信できること、投稿者への通知（`type: 'comment'`、`referenceId`が投稿ID、本文がコメント本文と一致）が作成されること、`commentCount`が引き続き正しく再集計されること、`type:'normal'`のコメントでは通知が作成されないこと。

## 7. 適用手順

1. 上記 Rules を `firestore.rules` / `storage.rules` へ反映（サンプルの `restaurants` は削除）
2. Emulator でユニットテストを通す
3. `firebase deploy --only firestore:rules,storage` で反映
4. `firestore.indexes.json` に [data-model.md 4章](data-model.md#4-必要な複合インデックス) のインデックスを追加し `firebase deploy --only firestore:indexes`

> Rules を先に厳格化すると、現行実装（`Users` 大文字コレクション、`videos` への直接 score 書き込み等）は動かなくなります。**データモデル移行と同じイシューで進める**必要があります。
