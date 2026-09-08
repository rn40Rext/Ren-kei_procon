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

実行コマンド（導入後）:

```bash
firebase emulators:exec --only firestore,storage "npm run test:rules"
```

## 7. 適用手順

1. 上記 Rules を `firestore.rules` / `storage.rules` へ反映（サンプルの `restaurants` は削除）
2. Emulator でユニットテストを通す
3. `firebase deploy --only firestore:rules,storage` で反映
4. `firestore.indexes.json` に [data-model.md 4章](data-model.md#4-必要な複合インデックス) のインデックスを追加し `firebase deploy --only firestore:indexes`

> Rules を先に厳格化すると、現行実装（`Users` 大文字コレクション、`videos` への直接 score 書き込み等）は動かなくなります。**データモデル移行と同じイシューで進める**必要があります。
