# 仕様書 v0.3 と実装の差分（ギャップ分析）

> 調査日: 2026-09-13（AI 解析①②の実装を反映）/ 前回: 2026-09-11 `d65bdfb`
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

**2026-09-13 に AI 解析①（姿勢推定・正規化・Rule Engine・リアルタイム UI・FN-01 によるスコア確定）と AI 解析②（ベースライン Embedding・FN-02/07/08/09・ランキング UI）を実装しました。** 乱数の「AI採点」は廃止され、投稿のスコアは `analysisResults.totalScore` 由来か「未採点」のどちらかです。残る大きな未実装は成長曲線（U-10）・通知・ネイティブ（iOS/Android）でのリアルタイム判定、そして**実地データによる閾値確定と妥当性確認**です。

| 領域 | 仕様書 | 実装 | 達成度 |
| --- | --- | --- | --- |
| 認証（AUTH-01/02） | Firebase Auth | ✅ ログイン・新規登録が動作 | ■■■■■ 100% |
| プロフィール（USER-01） | name/icon/profile/danceStyle/role | ✅ 全項目が `users/{uid}` に存在し編集可能 | ■■■■□ 90% |
| 交流広場（COMM-01〜05） | 投稿・詳細・コメント・いいね | 🔶 動作する。ただし練習動画（`videos`）を経由せず直接 `posts` を作る | ■■■■□ 80% |
| 連機能（REN-01〜03 / U-07・U-08） | 検索・参加申請・マイ連 | ✅ 連詳細・参加リクエスト・マイ連が動作 | ■■■■■ 100% |
| 連管理者（R-01〜R-08） | 8 画面 | 🔶 R-01/05/06/07/08 実装済み。**R-02/R-03/R-04 が未実装** | ■■■□□ 60% |
| Security Rules（10章） | コレクション別 CRUD 制御 | ✅ 包括版を実装、Rules Unit Test 46 件が通る | ■■■■□ 85% |
| Cloud Functions（FN-01〜09） | 7 関数 + 追加 2 | ✅ FN-01/02/03（縮小版）/04/05/06/07/08/09 とトリガ 5 本 | ■■■■□ 90% |
| 練習・AI解析①（PRACTICE-01〜05） | MediaPipe + Rule Engine + スコア | ✅ **Web 版**でリアルタイム判定（RULE-01〜07）・LIVE SCORE・FN-01 でスコア確定・履歴保存。ネイティブは未対応（TBD-01 方式 A）。**閾値は暫定・実地検証未実施** | ■■■■□ 80% |
| スタイル判定②（STYLE-01/02） | Motion Encoder + 類似度 | ✅ バックエンドと UI。姿勢系列は AI① が生成。**実データ検証（8.6 の 1・6・7）が未実施のため「検証中・参考値」表示** | ■■■■□ 75% |
| 成長記録（HIST-01） | GrowthRecords + 成長曲線 | 🔶 `growthRecords` は FN-01 が作成。U-10 のグラフ画面は未実装、`VideoListScreen` はスタブ | ■■□□□ 40% |
| 通知（NOTI-01） | Notifications | ❌ 未着手（Rules に受け皿があるだけ） | □□□□□ 0% |

## 2. 機能 ID 別の詳細

| 機能 ID | 機能名 | 状態 | 実装箇所 / 不足内容 |
| --- | --- | --- | --- |
| AUTH-01 | 新規登録 | ✅ | `LoginScreen.tsx`。`users/{uid}` を `role: 'user'` で作成する |
| AUTH-02 | ログイン | ✅ | `LoginScreen.tsx` + `AppNavigator.tsx` の `onAuthStateChanged` |
| USER-01 | プロフィール閲覧/編集 | ✅ | `MypageScreen.tsx`。nickname / profile / danceStyle / icon を編集可能。`role` は Rules で保護され変更不可 |
| PRACTICE-01 | カメラ撮影 | ✅ | `PoseCameraView.web.tsx`（getUserMedia + MediaRecorder で録画）。保存済み動画の入力も可。ネイティブは `PoseCameraView.tsx` がプレビューと案内のみ |
| PRACTICE-02 | リアルタイム判定 | ✅ | `features/pose/`（MediaPipe Tasks WASM・平滑化・正規化）+ `features/rules/`（RULE-01〜06 の状態機械、RULE-07 は自己相関）。full/GPU で 58fps（[ai-basic-motion.md 3章](../design/ai-basic-motion.md)） |
| PRACTICE-03 | ゲームスコア | ✅ | `rules/gameScore.ts`。GREAT 100 / GOOD 60 / MISS 0、5 コンボごとに倍率（暫定・TBD-06） |
| PRACTICE-04 | 解析結果 | ✅ | `ResultScreen.tsx`。総合・項目別・AI コメント・LIVE SCORE を別枠表示 |
| PRACTICE-05 | 保存 | ✅ | `videos` + Storage（動画・姿勢系列）→ FN-01 が `analysisResults` / `growthRecords` を作成 |
| STYLE-01/02 | 連スタイル類似度 | 🔶 | エンコーダ・FN-02/07/08/09・`StyleResultScreen.tsx`。姿勢系列は AI① が生成するようになった。**仕様書 8.6 の検証 1・6・7（実データ）が未実施**のため「検証中・参考値」の帯付きで表示 |
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
| AnalysisResults | ✅ `analysisResults/{uid}_{clientRequestId}` | FN-01 のみが書く。`posts.score` はここからの非正規化コピー（乱数モックは廃止） |
| GrowthRecord(s) | ✅ `users/{uid}/growthRecords/{analysisId}` | FN-01 が作成。表示（U-10）は未実装 |
| Notifications | ❌ | Rules のみ |
| RenStyleReferences / RenStyleProfiles / StyleAnalysisResults | ✅ | FN-08 / FN-07 / FN-02 が書く |
| AnalysisRules | ✅ `analysisRules/{ruleId}` | read 専用。`functions npm run seed:rules` で投入 |
| （仕様書外） | ➕ `chats/{chatId}/messages` | 仕様書に存在しない 1 対 1 チャット。Rules は当事者 2 人のみに制限済み |

## 4. AI 採点の実態

**2026-09-13 時点: 仕様書 7 章の姿勢推定・正規化・7 つの判定ルール・状態遷移・スコア分離はすべて実装されています**（[ai-basic-motion.md 12章](../design/ai-basic-motion.md)）。`publishPost` の乱数（`Math.random()`）は廃止し、投稿のスコアは `analysisResults.totalScore` の非正規化コピーか、無ければ「未採点」表示です（[#58](../../../issues/58)）。

**それでも「AI が正しい」とは言えない点**（デモ・発表で補足すべきこと）:

- **閾値はすべて暫定**（TBD-02）。仕様書 7.4 の「連の指導者確認後に確定」は未実施。数値の根拠は設計上の初期値で、実地データでの較正はこれから。
- **指導者が OK/NG と判断した動画での妥当性確認は未実施**（エピック #5 の完了条件の 1 つ）。合成データのテスト（33 件）で確認できるのは「設計どおりに状態機械が動く」ことまで。
- **リアルタイム判定は Web 版（ブラウザ）のみ**。iOS / Android アプリではネイティブの姿勢推定（TBD-01 方式 A）が未着手で、案内表示になる。
- **サーバは集計値を信頼している**。クライアントが `totalScore` を書けないことは保証するが、集計値の改ざんは防げない（サーバ側再解析は未決定事項）。
- AI②（連スタイル類似度）は **「検証中・参考値」の帯付き**。仕様書 8.6 の実データ検証（1・6・7）が未実施。

参考: オフライン採点エンジン `renkei_project_10/`（Python・8 軸）を実写の阿波踊り動画（Wikimedia Commons、群舞の正面撮影 46 秒）に通した結果は総合 37.7（腰の低さ 71 / リズム 0 / なんばは参考値）。群舞で 1 人の追跡が安定しない条件なので数値そのものに意味は無いが、**mediapipe 0.10.14 で端から端まで動く**ことは確認した（0.10.2x は macOS で起動直後に落ちる）。

## 5. セキュリティ上の差分

前回調査時点の S-1〜S-6 は解消済みです。**残っているのは次の 3 点です。**

| # | 内容 | 状態 |
| --- | --- | --- |
| S-9 | 投稿動画の Storage パスが `videos/{Date.now()}.mp4` で所有者情報を含まない。所有者ベースの保護ができない | 未対応（[#41](../../../issues/41)） |
| S-10 | Storage の `contentType` 検証が無い（サイズ上限のみ） | 意図的な見送り。React Native から正しい値が送られるか実機未検証のため（[#40](../../../issues/40) にコメント済み） |
| S-11 | 本番プロジェクト `ren-kei` に最新の Rules が反映されているか未確認 | 未確認。プロジェクトへのアクセス権を持つアカウントでのみ確認できる（[#40](../../../issues/40)） |

解消済みの項目:

- ✅ `storage.rules` の全開放 → 認証必須 + 所有者ベース + デフォルト拒否（[#50](../../../issues/50) / [#40](../../../issues/40)）
- ✅ Firestore のサンプル Rules（`restaurants` / `ratings`）→ 全コレクションの CRUD 制御（[#40](../../../issues/40)）
- ✅ `users.role` の自己昇格防止（[#39](../../../issues/39)）
- ✅ 指導者コメント（`type: 'instructor'`）を誰でも作成できる問題 → `renId` + `isRenAdmin(renId)` の検証を追加（[#31](../../../issues/31)）。`tests/rules/posts.rules.test.mjs` のskipテストも有効化済み
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
| Videos と Posts の分離 | 別 Entity。練習動画は private、投稿は public | `posts` は分離済み。`videos` は練習終了時に作成され、U-03 からの投稿で `videoId` が紐付く。ギャラリーから直接選んだ投稿は `videoId` 無し | ✅ ほぼ解消。残りは `publishPost` の `analysisStatus` 検証（[#47](../../../issues/47)） |
| リアルタイム判定の実行場所 | クライアント優先（3.2）。方式は TBD-01 | **Expo Web + MediaPipe Tasks（WASM）**。ネイティブは未対応 | ✅ 決定済み（[ai-basic-motion.md 3章](../design/ai-basic-motion.md)）。実機アプリで必要になったら方式 A を追加 |
| リズムの周期推定 | FFT を想定（7.8） | 自己相関（8 秒窓で分解能が足りるため）。オフライン版は FFT | ✅ 実装側の判断を設計に記録（[ai-basic-motion.md 8章](../design/ai-basic-motion.md)）。仕様書は「案」なので矛盾ではない |
| Analysis Score の対象項目 | 4 項目（手・腰・停止・リズム）（7.7） | 同じ 4 項目の単純平均。RULE-05/06 は項目別に出すが総合に含めない | ✅ 仕様書どおり。重みは TBD-05 |
| いいねの持ち方 | Likes Entity | `posts/{id}/likes/{uid}` | ✅ 解消済み |
| 所属連の持ち方 | `Users.ren` と RenMembers が併存（TBD-11） | RenMembers に一本化 | ✅ 決定済み（[data-model.md](../design/data-model.md)） |
| コメント種別 | `normal` / `instructor` | 同じ | ✅ 解消済み。権限検証も実装済み（[#31](../../../issues/31)） |
| 1 対 1 チャット | 記載なし | 実装済み。Rules で当事者のみに制限 | **プロトタイプ限定機能として残す**。v0.4 で正式化を判断（N-1） |
| お知らせ・活動情報の公開対象 | TBD-15 | ログイン済みなら誰でも read できる | ✅ **現状維持で決定**（[#34](../../../issues/34)）。将来メンバー限定メッセージ機能を別途検討 |
| 連アイコンの更新経路 | 記載なし | Storage Cross-Service Rules が本番で不安定だったため、Cloud Functions（Admin SDK）経由に変更 | 実装側の判断。[storage.rules](../../storage.rules) にコメントとして記録済み |

## 8. 次のアクション

1. **閾値の確定（TBD-02）と実地の妥当性確認** — 連の指導者が OK/NG と判断した動画を集め、`analysisResults.rawMetrics` と `renkei_project_10/calibrate.py` の実測から `analysisRules` を更新する。エピック #5 の完了条件で唯一残っている項目
2. **AI② の実データ検証（8.6 の 1・6・7）** — 2〜3 連 × 熟練者 3 名の参照動画（同意付き）と 5 人 × 3 テイク。`export_pose_series.py` → FN-08 で登録できる
3. **本番への反映** — `firebase deploy --only functions,firestore:rules,firestore:indexes,storage` と `functions npm run seed:rules`（承認が必要）
4. **U-10 成長曲線（[#37](../../../issues/37)）** — `growthRecords` は溜まり始めるので表示だけが足りない
5. **[#40](../../../issues/40) の本番反映確認** — S-11

優先順位とマイルストーンは [roadmap.md](roadmap.md) を参照してください。
