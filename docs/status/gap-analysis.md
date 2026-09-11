# 仕様書 v0.3 と実装の差分（ギャップ分析）

> 調査日: 2026-09-11 / 対象コミット: `d65bdfb`（`refactor/repositories-layer`。`main` は `5d9e796`）
> 比較対象: [仕様書 v0.3](../spec/README.md) ↔ `Ren-kei_procon/src/` `functions/src/` `firestore.rules` `storage.rules` の実装

> ⚠️ **「差分がある」は「実装が間違っている」とは限りません。** 仕様書 v0.3 はチームで合意した確定仕様ではなく、既存資料からの推測で組み立てた文書です（[../spec/README.md](../spec/README.md) の「この文書の位置づけ」）。
>
> 差分の原因は 3 通りあります。**どれなのかは人間が判断してください。**
>
> 1. 実装がまだ追いついていない（大半はこれ）
> 2. 仕様書の推測が外れていて、実装のほうが妥当
> 3. どちらも違っていて、要件から決め直す必要がある

## 1. 要約

**2026-09-08 以降に、連（Ren）機能・連管理者機能・Security Rules・Cloud Functions 基盤がまとめて実装されました。** 前回調査（2026-09-03 / `d8f683e`）から状況が大きく変わっています。

一方で、**仕様書の中核である AI 解析①②（姿勢推定・Rule Engine・スタイル類似度）と成長記録は、依然としてコードが 1 行も存在しません。**

| 領域 | 仕様書 | 実装 | 達成度 |
| --- | --- | --- | --- |
| 認証（AUTH-01/02） | Firebase Auth | ✅ ログイン・新規登録が動作 | ■■■■■ 100% |
| プロフィール（USER-01） | name/icon/profile/danceStyle/role | ✅ 全項目が `users/{uid}` に存在し編集可能 | ■■■■□ 90% |
| 交流広場（COMM-01〜05） | 投稿・詳細・コメント・いいね | 🔶 動作する。ただし練習動画（`videos`）を経由せず直接 `posts` を作る | ■■■■□ 80% |
| 連機能（REN-01〜03 / U-07・U-08） | 検索・参加申請・マイ連 | ✅ 連詳細・参加リクエスト・マイ連が動作 | ■■■■■ 100% |
| 連管理者（R-01〜R-08） | 8 画面 | 🔶 R-01/05/06/07/08 実装済み。**R-02/R-03/R-04 が未実装** | ■■■□□ 60% |
| Security Rules（10章） | コレクション別 CRUD 制御 | ✅ 包括版を実装、Rules Unit Test 46 件が通る | ■■■■□ 85% |
| Cloud Functions（FN-01〜07） | 7 関数 | 🔶 FN-03（縮小版）/04/05/06 と連系の追加関数・トリガ 4 本 | ■■■□□ 50% |
| 練習・AI解析①（PRACTICE-01〜05） | MediaPipe + Rule Engine + スコア | ❌ **カメラプレビューのみ。採点は乱数** | ■□□□□ 5% |
| スタイル判定②（STYLE-01/02） | Motion Encoder + 類似度 | ❌ 未着手 | □□□□□ 0% |
| 成長記録（HIST-01） | GrowthRecords + 成長曲線 | ❌ 未着手。`VideoListScreen` はスタブのまま | □□□□□ 0% |
| 通知（NOTI-01） | Notifications | ❌ 未着手（Rules に受け皿があるだけ） | □□□□□ 0% |

## 2. 機能 ID 別の詳細

| 機能 ID | 機能名 | 状態 | 実装箇所 / 不足内容 |
| --- | --- | --- | --- |
| AUTH-01 | 新規登録 | ✅ | `LoginScreen.tsx`。`users/{uid}` を `role: 'user'` で作成する |
| AUTH-02 | ログイン | ✅ | `LoginScreen.tsx` + `AppNavigator.tsx` の `onAuthStateChanged` |
| USER-01 | プロフィール閲覧/編集 | ✅ | `MypageScreen.tsx`。nickname / profile / danceStyle / icon を編集可能。`role` は Rules で保護され変更不可 |
| PRACTICE-01 | カメラ撮影 | 🔶 | `CameraScreen.tsx` は `expo-camera` のプレビューと「採点終了」ボタンのみ。**録画も保存もしていない** |
| PRACTICE-02 | リアルタイム判定 | ❌ | 姿勢推定ライブラリが未導入（TBD-01 未決定） |
| PRACTICE-03 | ゲームスコア | ❌ | — |
| PRACTICE-04 | 解析結果 | ❌ | `ResultScreen.tsx` は「ここに採点結果が表示されます」の固定文言 |
| PRACTICE-05 | 保存 | ❌ | `analysisResults` / `growthRecords` にドキュメントを書く実装が無い（Rules と型の受け皿のみ） |
| STYLE-01/02 | 連スタイル類似度 | ❌ | 該当コードが存在しない |
| COMM-01 | 投稿一覧 | ✅ | `CommunityScreen.tsx`（`posts` を購読） |
| COMM-02 | 投稿作成 | 🔶 | `publishPost`（Cloud Functions）経由。ただし**練習動画 `videos` を作らずに直接 `posts` を作る縮小版**（[#47](../../../issues/47)） |
| COMM-03 | 投稿詳細 | ✅ | `CommunityScreen.tsx` 内の `PostDetailScreen` |
| COMM-04 | コメント/アドバイス | 🔶 | `type: 'instructor' \| 'normal'` で実装。**指導者コメントの権限検証が無く、誰でも「師匠の教え」を投稿できる**（[#31](../../../issues/31)） |
| COMM-05 | いいね | ✅ | `posts/{postId}/likes/{uid}` で 1 人 1 回を保証。`likeCount` はトリガが `count()` で再集計 |
| REN-01 | 連詳細 | ✅ | `GroupScreen.tsx`（`ren` / `members`） |
| REN-02 | 連検索・参加申請（U-07） | ✅ | `RequestScreen.tsx` + `submitJoinRequest` |
| REN-03 | マイ連（U-08） | ✅ | `GroupScreen.tsx` + `useMyRens` |
| R-01 | 管理ホーム | ✅ | `AdminHomeScreen.tsx`。複数連の切り替えに対応 |
| R-02 | 投稿一覧（管理者ビュー） | ❌ | 未実装（[#30](../../../issues/30)） |
| R-03 | 投稿詳細（管理者ビュー） | ❌ | 未実装（[#30](../../../issues/30)） |
| R-04 | アドバイス送信 | ❌ | 未実装（[#31](../../../issues/31)）。COMM-04 の権限検証もこのイシューで締める |
| R-05 | 参加リクエスト管理 | ✅ | `ManageJoinRequestsScreen.tsx` + `updateJoinRequestStatus` |
| R-06 | メンバー管理 | ✅ | `MemberManagementScreen.tsx` + `updateMemberRole` / `removeMember` |
| R-07 | お知らせ管理 | ✅ | `ManageAnnouncementsScreen.tsx` + `createAnnouncement` |
| R-08 | 活動情報管理 | ✅ | `ManageActivitiesScreen.tsx` |
| HIST-01 | 成長曲線 | ❌ | `VideoListScreen.tsx` はスタブのまま |
| NOTI-01 | 通知 | ❌ | 生成トリガも一覧 UI も無い |

## 3. データモデルの差分

仕様書 9 章の Entity に対する実装状況です。物理パスの確定案は [design/data-model.md](../design/data-model.md) にあります。

| 仕様書 Entity | 実装 | 差分の内容 |
| --- | --- | --- |
| Users | ✅ `users/{uid}` | `role` を含む全項目あり。大文字始まりの `Users` は廃止済み |
| Videos | ⚠️ `videos/{id}` | **Rules と型だけが存在し、ドキュメントを作る実装が無い**。投稿フローは `videos` を経由しない（[#41](../../../issues/41) / [#47](../../../issues/47)） |
| Posts | ✅ `posts/{id}` | `videos` から分離済み |
| Comments | ✅ `posts/{id}/comments` | `type` は仕様書どおり `instructor` / `normal`。ただし `instructor` の権限検証が無い |
| Likes | ✅ `posts/{id}/likes/{uid}` | uid をドキュメント ID にして重複を防止。カウンタはトリガが再集計 |
| Ren | ✅ `ren/{renId}` | — |
| RenMembers | ✅ `ren/{renId}/members/{uid}` | 連管理権限はここの `role` で判定する |
| JoinRequests | ✅ `joinRequests/{id}` | 状態遷移は Functions 経由に一本化 |
| Announcements | ✅ `ren/{renId}/announcements` | — |
| RenActivities | ✅ `ren/{renId}/activities` | — |
| AnalysisResults | ❌ | Rules のみ。**スコアは `posts.score` に乱数で入っている** |
| GrowthRecord(s) | ❌ | Rules のみ |
| Notifications | ❌ | Rules のみ |
| RenStyleReferences / RenStyleProfiles / StyleAnalysisResults | ❌ | Rules のみ |
| （仕様書外） | ➕ `chats/{chatId}/messages` | 仕様書に存在しない 1 対 1 チャット。Rules は当事者 2 人のみに制限済み |

## 4. AI 採点の実態

**仕様書 7 章の姿勢推定・正規化・7 つの判定ルール・状態遷移・スコア分離は、いずれも未実装です。** 現在スコアを決めているのは次の 1 行です。

```ts
// functions/src/community/publishPost.ts:85
score: Math.floor(Math.random() * 20) + 80,
```

前回調査ではクライアント（`CommunityScreen.tsx`）が乱数を書いていました。[#47](../../../issues/47) で Cloud Functions へ移りましたが、**乱数であること自体は変わっていません。** 改ざんはできなくなった一方で、サーバが出した値に見えるぶん**むしろ本物らしく見える**点に注意が必要です。

UI 側は `CommunityScreen.tsx` が「AI {score}点」「AI採点 {score}点」と表示しており、**画面を見る限り AI が動いているように見えます**（[#58](../../../issues/58) が未対応）。デモ・発表では必ず口頭で補足してください。

不足しているもの:

- 姿勢推定ライブラリ（MediaPipe / TFLite）の導入（TBD-01）
- 座標正規化（bodyScale による体格・距離の吸収）
- Rule Engine（RULE-01〜07）と状態機械
- Game Score / Analysis Score の分離
- 判定閾値の管理とバージョニング（`analysisVersion`）

## 5. セキュリティ上の差分

前回調査時点の S-1〜S-6 は解消済みです。**残っているのは次の 4 点です。**

| # | 内容 | 状態 |
| --- | --- | --- |
| S-8 | **指導者コメント（`type: 'instructor'`）を誰でも作成できる。** `firestore.rules` は `type in ['instructor', 'normal']` しか見ていない | 未対応（[#31](../../../issues/31)）。`tests/rules/posts.rules.test.mjs` の該当テストは skip されており、スキップ理由「連機能が未実装だから」はすでに成立していない |
| S-9 | 投稿動画の Storage パスが `videos/{Date.now()}.mp4` で所有者情報を含まない。所有者ベースの保護ができない | 未対応（[#41](../../../issues/41)） |
| S-10 | Storage の `contentType` 検証が無い（サイズ上限のみ） | 意図的な見送り。React Native から正しい値が送られるか実機未検証のため（[#40](../../../issues/40) にコメント済み） |
| S-11 | 本番プロジェクト `ren-kei` に最新の Rules が反映されているか未確認 | 未確認。プロジェクトへのアクセス権を持つアカウントでのみ確認できる（[#40](../../../issues/40)） |

解消済みの項目:

- ✅ `storage.rules` の全開放 → 認証必須 + 所有者ベース + デフォルト拒否（[#50](../../../issues/50) / [#40](../../../issues/40)）
- ✅ Firestore のサンプル Rules（`restaurants` / `ratings`）→ 全コレクションの CRUD 制御（[#40](../../../issues/40)）
- ✅ `users.role` の自己昇格防止（[#39](../../../issues/39)）
- ✅ スコアのクライアント書き込み → `posts` の `create` を Rules で禁止し Functions 経由に一本化（[#47](../../../issues/47)）
- ✅ コメント権限をコメント自身の `userId` で判定（[#40](../../../issues/40)）
- ✅ 連 A の管理者が連 B を操作できないことを Rules・Functions の両方で検証（[#29](../../../issues/29)）
- ✅ 動画削除時の Storage 実体削除トリガ（[#48](../../../issues/48)）

未認証アクセスの外形確認（2026-09-11 実施、認証不要の読み取りのみ）:

```
GET https://firebasestorage.googleapis.com/v0/b/ren-kei.firebasestorage.app/o  → 403
GET https://firestore.googleapis.com/v1/projects/ren-kei/databases/(default)/documents/posts → 403
```

## 6. 実装上の既知の不具合・技術的負債

前回調査の B-1〜B-11 は B-7 を除いてすべて解消済みです（[#50](../../../issues/50)〜[#57](../../../issues/57)）。

| # | 内容 | 状態 |
| --- | --- | --- |
| B-9 | `docs/api/aip_list` が空ファイル。`docs/api/api.design.md` が現行設計と乖離 | 未対応（[#59](../../../issues/59)） |
| B-12 | `useNavigation<any>()` が `CommunityScreen` / `MypageScreen` など複数画面に残っている。[coding.md](../rules/coding.md) 2 章違反 | 未対応。該当箇所に TODO コメントあり |
| B-13 | `auth.currentUser` を画面から直接参照している（`useAuth()` が無い）。認証状態の変化に追従しない | 未対応（[#91](../../../issues/91) のスコープ外として分離） |
| B-14 | `src/theme/colors.ts` が無く、画面ごとに `COLORS` を定義している。阿波踊りの伝統色（藍 `#001E43` / 緋 `#E60012` / 金 `#D4AF37`）は `HomeScreen` にしか無い | 未対応 |
| B-15 | `ContactInfoScreen` / `SettingScreen` / `VideoListScreen` / `UserProfileScreen` がスタブ | `VideoListScreen` は [#38](../../../issues/38) で実装予定。他 3 つはイシュー未作成 |

解消済み（前回からの変化）:

- ✅ B-1 / B-2 5 画面のナビゲータ未登録（[#51](../../../issues/51)）
- ✅ B-3 認証状態の二重購読（[#53](../../../issues/53)）
- ✅ B-4 `firebaseConfig.ts` の重複（[#56](../../../issues/56)）
- ✅ B-5 / B-6 依存関係の不整合（[#55](../../../issues/55)）
- ✅ B-7 `firestore.indexes.json` が空 → 複合インデックス 5 件を追加（[#40](../../../issues/40) ほか）
- ✅ B-8 「指導リクエスト」の位置づけ → U-07 として作り直し（[#27](../../../issues/27)）
- ✅ B-10 `.gitignore` のコンフリクト残骸（[#52](../../../issues/52)）
- ✅ B-11 `package.json` の `scripts` / `main` 欠落（[#54](../../../issues/54)）
- ✅ 画面からの Firestore 直接呼び出し → `src/repositories/` へ集約（[#91](../../../issues/91)）

## 7. 仕様書と実装で解釈が分かれている点

> ⚠️ **「判断」列は提案です。** 仕様書自体が推測なので、「仕様書に合わせる」が常に正しいとは限りません。**チームで確認してください。**

| 論点 | 仕様書 | 実装 | 判断 |
| --- | --- | --- | --- |
| Videos と Posts の分離 | 別 Entity。練習動画は private、投稿は public | `posts` は分離済み。ただし `videos` を作る実装がまだ無い | ✅ 仕様書に合わせる方針で進行中（[#41](../../../issues/41) / [#47](../../../issues/47) の残作業） |
| いいねの持ち方 | Likes Entity | `posts/{id}/likes/{uid}` | ✅ 解消済み |
| 所属連の持ち方 | `Users.ren` と RenMembers が併存（TBD-11） | RenMembers に一本化 | ✅ 決定済み（[data-model.md](../design/data-model.md)） |
| コメント種別 | `normal` / `instructor` | 同じ | ✅ 解消済み。ただし権限検証は未実装 |
| 1 対 1 チャット | 記載なし | 実装済み。Rules で当事者のみに制限 | **プロトタイプ限定機能として残す**。v0.4 で正式化を判断（N-1） |
| お知らせ・活動情報の公開対象 | TBD-15 | ログイン済みなら誰でも read できる | **未決定**。連メンバー限定にするかを [#34](../../../issues/34) で決める必要がある |
| 連アイコンの更新経路 | 記載なし | Storage Cross-Service Rules が本番で不安定だったため、Cloud Functions（Admin SDK）経由に変更 | 実装側の判断。[storage.rules](../../storage.rules) にコメントとして記録済み |

## 8. 次のアクション

1. **[#58](../../../issues/58) AI 採点がモックである旨を UI に明示する** — 発表・デモで最もリスクが高い。実装コストは小さい
2. **[#13](../../../issues/13) MediaPipe の組み込み方式を決める（TBD-01）** — クリティカルパスの先頭。ここが決まらないと AI 系 18 件が動かない
3. **[#31](../../../issues/31) 指導者コメントの権限検証** — S-8。連機能が揃った今、Rules を締められる
4. **[#40](../../../issues/40) の本番反映確認** — S-11

優先順位とマイルストーンは [roadmap.md](roadmap.md) を参照してください。
