# 仕様書 v0.3 と実装の差分（ギャップ分析）

> 調査日: 2026-09-03 / 対象コミット: `d8f683e`（main）
> 比較対象: [仕様書 v0.3](../spec/README.md) ↔ `Ren-kei_procon/src/` の実装

## 1. 要約

認証と交流広場（動画投稿・閲覧・コメント・チャット）は動作します。一方、**仕様書の中核である AI 解析・連（Ren）機能・連管理者機能・成長記録・権限モデルは未実装**です。

| 領域 | 仕様書 | 実装 | 達成度 |
| --- | --- | --- | --- |
| 認証（AUTH-01/02） | Firebase Auth | ✅ ログイン・新規登録が動作 | ■■■■■ 100% |
| 交流広場（COMM-01〜05） | 投稿・詳細・コメント・いいね | ✅ 動作（データモデルは簡略版） | ■■■■□ 80% |
| プロフィール（USER-01） | name/icon/profile/danceStyle/role | 🔶 `userName` のみ | ■■□□□ 30% |
| 練習・AI解析①（PRACTICE-01〜05） | MediaPipe + Rule Engine + スコア | ❌ カメラプレビューのみ。採点は乱数 | ■□□□□ 10% |
| スタイル判定②（STYLE-01/02） | Motion Encoder + 類似度 | ❌ 未着手 | □□□□□ 0% |
| 連機能（REN-01〜03） | 検索・申請・マイ連 | ❌ スタブのみ | □□□□□ 0% |
| 連管理者（REN-04〜07 / R-01〜08） | 8 画面 | ❌ 画面が存在しない | □□□□□ 0% |
| 成長記録（HIST-01） | GrowthRecords + 成長曲線 | ❌ 未着手 | □□□□□ 0% |
| 通知（NOTI-01） | Notifications | ❌ 未着手 | □□□□□ 0% |
| Security Rules（10章） | コレクション別 CRUD 制御 | ❌ サンプルのまま / Storage 全開放 | □□□□□ 0% |
| Cloud Functions（FN-01〜07） | 7 関数 | ❌ テンプレートのまま | □□□□□ 0% |

## 2. 機能 ID 別の詳細

| 機能 ID | 機能名 | 状態 | 実装箇所 / 不足内容 |
| --- | --- | --- | --- |
| AUTH-01 | 新規登録 | ✅ | `LoginScreen.tsx`（登録モード切替） |
| AUTH-02 | ログイン | ✅ | `LoginScreen.tsx` + `AppNavigator.tsx` の `onAuthStateChanged` |
| USER-01 | プロフィール閲覧/編集 | 🔶 | `MypageScreen.tsx` でニックネームのみ編集可。`icon` `profile` `danceStyle` `role` が未実装 |
| PRACTICE-01 | カメラ撮影 | 🔶 | `CameraScreen.tsx` は権限取得とプレビューのみ。**録画・保存が未実装** |
| PRACTICE-02 | リアルタイム判定 | ❌ | 姿勢推定ライブラリが未導入 |
| PRACTICE-03 | ゲームスコア | ❌ | — |
| PRACTICE-04 | 解析結果 | ❌ | `ResultScreen.tsx` は「ここに採点結果が表示されます」のみ |
| PRACTICE-05 | 保存 | ❌ | `analysisResults` / `growthRecords` コレクションが無い |
| STYLE-01/02 | 連スタイル類似度 | ❌ | 該当コードが存在しない |
| COMM-01 | 投稿一覧 | ✅ | `CommunityScreen.tsx`（`videos` を `onSnapshot` で購読） |
| COMM-02 | 投稿作成 | 🔶 | 動作するが、クライアントから Storage/Firestore へ直接書き込み。FN-03 未経由 |
| COMM-03 | 投稿詳細 | ✅ | `VideoDetailScreen`（同ファイル内） |
| COMM-04 | コメント/アドバイス | 🔶 | `type: 'advice' \| 'comment'` で実装。ただし**指導者コメントの権限検証が無く、誰でも「師匠の教え」を投稿できる** |
| COMM-05 | いいね | 🔶 | `increment(1)` で加算。**同一ユーザーが無制限に加算できる** |
| REN-01〜03 | 連検索・詳細・申請 | ❌ | `GroupScreen.tsx` はテキスト 1 行のスタブ |
| REN-04〜07 | 連管理 | ❌ | 画面・データ・権限すべて未実装 |
| HIST-01 | 成長曲線 | ❌ | `VideoListScreen.tsx` もスタブ |
| NOTI-01 | 通知 | ❌ | — |

## 3. データモデルの差分

仕様書 9 章の Entity に対する実装状況です。物理パスの確定案は [design/data-model.md](../design/data-model.md) にあります。

| 仕様書 Entity | 実装 | 差分の内容 |
| --- | --- | --- |
| Users | ⚠️ `Users/{uid}` | フィールドは `userName` のみ。**`role` が無いため連管理者を判定できない**。コレクション名が大文字始まりで規約違反 |
| Videos | ⚠️ `videos/{id}` | Posts と混在。`visibility` `analysisStatus` が無く**公開/非公開の区別が存在しない**（全動画が実質公開） |
| Posts | ❌ | `videos` に統合されている |
| Comments | ⚠️ `videos/{id}/comments` | 親が `posts` ではなく `videos`。`type` の値が仕様書と異なる（`advice`/`comment` ↔ `instructor`/`normal`） |
| Likes | ❌ | `videos.likes`（数値）のみ。誰がいいねしたかの記録が無く重複防止ができない |
| GrowthRecord(s) | ❌ | 未実装 |
| Ren | ❌ | 未実装 |
| JoinRequests | ❌ | 未実装 |
| AnalysisResults | ❌ | 未実装。スコアは `videos.score` に乱数で入っている |
| RenMembers | ❌ | 未実装 |
| Announcements | ❌ | 未実装 |
| RenActivities | ❌ | 未実装 |
| Notifications | ❌ | 未実装 |
| RenStyleReferences / RenStyleProfiles / StyleAnalysisResults | ❌ | 未実装 |
| （仕様書外） | ➕ `chats/{chatId}/messages` | 仕様書に存在しない 1 対 1 チャット。Rules 未定義 |

## 4. AI 採点の実態

仕様書 7 章は姿勢推定・正規化・7 つの判定ルール・状態遷移・スコア分離を詳細に定義していますが、実装は次の 1 行です。

```ts
// Ren-kei_procon/src/screens/CommunityScreen.tsx:76
score: Math.floor(Math.random() * 20) + 80,
```

投稿時に 80〜99 のランダム値を書き込んでいるだけで、動画の内容は一切解析していません。UI 上は「AI {score}点」と表示されるため、**画面を見る限り AI が動いているように見えてしまう**点に注意が必要です（デモ時の説明も含む）。

不足しているもの:

- 姿勢推定ライブラリ（MediaPipe / TFLite）の導入
- 座標正規化（bodyScale による体格・距離の吸収）
- Rule Engine（RULE-01〜07）と状態機械
- Game Score / Analysis Score の分離
- 判定閾値の管理とバージョニング（`analysisVersion`）

## 5. セキュリティ上の差分（優先度: 高）

| # | 仕様書の要求 | 実装 | 影響 |
| --- | --- | --- | --- |
| S-1 | 10.2 のコレクション別 CRUD 制御 | `firestore.rules` は Firebase のサンプル（`restaurants` / `ratings`）のまま。実コレクションのルールが無い | 未定義パスは既定で全拒否 → 本番構成ではアプリが動かない。逆にテストモード運用なら**全開放** |
| S-2 | 14.2 Storage も所有権・公開範囲を制御 | `storage.rules` が `allow read, write: if true` | **未認証の第三者が動画をアップロード・上書き・削除できる** |
| S-3 | 10.3 `users.role` の自己昇格を防ぐ | `role` フィールド自体が無い | 権限モデルが存在しない |
| S-4 | 10.3 スコアをクライアントから編集不可にする | クライアントが `videos.score` を直接書き込み | スコア改ざん可能 |
| S-5 | 10.3 コメント権限はコメント自身の `userId` で判定 | Rules が無いため判定なし | 他人のコメントを削除し得る |
| S-6 | 14.3 練習動画は既定 private | `visibility` が無く全動画が公開扱い | 意図しない動画の公開 |
| S-7 | 14.3 動画削除時は Storage 実体も削除 | 削除機能自体が未実装 | 将来の課題 |

**S-2 は公開前に必ず修正が必要**です。修正案は [design/security-rules.md](../design/security-rules.md) に実コードとして用意しました。

## 6. 実装上の既知の不具合

| # | 内容 | 該当箇所 |
| --- | --- | --- |
| B-1 | `Camera` / `Result` / `Request` / `UserProfile` / `Chat` の 5 画面が `AppNavigator` に未登録なのに `navigate()` されている → **実行時に遷移が失敗する** | [AppNavigator.tsx](../../Ren-kei_procon/src/navigation/AppNavigator.tsx) |
| B-2 | `RootStackParamList` に `Camera` / `Result` / `Request` の型が無く、`ScoringScreen` / `CameraScreen` の `RouteProp` が型不整合。各画面が `useNavigation<any>()` で回避しているため検出されていない | 同上 |
| B-3 | `App.tsx` が `AppNavigator` に `user` prop を渡しているが、`AppNavigator` は受け取らず自身で認証状態を購読。**購読が二重** | [App.tsx](../../Ren-kei_procon/App.tsx) |
| B-4 | `firebase/firebaseConfig.ts` と `src/config/firebaseConfig.ts` が重複（`App.tsx` は前者、画面は後者を import） | — |
| B-5 | ルート直下の `package.json` に `"undefined": "@expo/metro-runtime]"` という不正な依存エントリ。Expo/React/TypeScript のバージョンもアプリ側と不一致 | [package.json](../../package.json) |
| B-6 | `lucide-react`（Web 用）と `lucide-react-native` が併存 | [Ren-kei_procon/package.json](../../Ren-kei_procon/package.json) |
| B-7 | `firestore.indexes.json` が空。タグ絞り込みやユーザー別一覧のクエリで複合インデックスが必要になる | [firestore.indexes.json](../../firestore.indexes.json) |
| B-8 | `HomeScreen` の「指導リクエスト」は `navigate('Request')` を呼ぶが、`RequestScreen.tsx` は空実装。仕様書 U-07（連への参加リクエスト）とも別物 | [RequestScreen.tsx](../../Ren-kei_procon/src/screens/RequestScreen.tsx) |
| B-9 | `docs/api/aip_list` が空ファイル。`docs/api/api.design.md` の「投稿API」も実装と乖離（実際はクライアント直接書き込み） | [docs/api/](../api/) |
| B-10 | ルートの `.gitignore` に**マージコンフリクトの残骸がコミットされている**（1 行目 `<<<<<<< HEAD`、3 行目 `=======`、73 行目 `>>>>>>> 52bfe7c`）。`node_modules` が競合ブロック内にあるが偶然パターンとして解釈されるため動いてしまっている | [.gitignore](../../.gitignore) |
| B-11 | アプリの `package.json` に `scripts` と `main` が無い。`npm start` が使えず、`npx expo start` を直接叩く必要がある（`index.ts` で `registerRootComponent` しているため `"main": "index.ts"` が必要） | [Ren-kei_procon/package.json](../../Ren-kei_procon/package.json) |

> B-1〜B-11 は**今回のイシュー化対象外**（未実装機能に絞ったため）です。着手前に別途イシュー化するか、関連する機能実装のイシュー内で一緒に直す想定です。
>
> このうち **B-1（ナビゲーション未登録）と B-10（コンフリクト残骸）は影響が明確で修正も小さい**ため、早めの対処を推奨します。

## 7. 仕様書と実装で解釈が分かれている点

| 論点 | 仕様書 | 実装 | 判断 |
| --- | --- | --- | --- |
| Videos と Posts の分離 | 別 Entity。練習動画は private、投稿は public | 1 コレクションに統合、全公開 | **仕様書に合わせる**（プライバシー要件 14.3 のため） |
| いいねの持ち方 | Likes Entity（追加推奨） | `videos.likes` の数値 | **仕様書に合わせる**（重複防止のため） |
| 所属連の持ち方 | `Users.ren` と RenMembers が併存（TBD-11） | 未実装 | **RenMembers に一本化**（[data-model.md](../design/data-model.md) で決定） |
| コメント種別 | `normal` / `instructor` | `comment` / `advice` | **仕様書に合わせる** |
| 1 対 1 チャット | 記載なし | 実装済み | **プロトタイプ限定機能として残す**。v0.4 で正式化を判断 |
| 「指導リクエスト」 | 記載なし（U-07 は連への参加申請） | `HomeScreen` にメニューあり・画面は空 | 仕様書に無い機能。**U-07 に統合するか、v0.4 で要件化** |

## 8. 次のアクション

1. **セキュリティの最低ライン確保**: `storage.rules` の全開放を閉じる（[design/security-rules.md](../design/security-rules.md) 5 章）
2. **データモデルの確定と移行**: `users` / `videos` / `posts` の分離（[design/data-model.md](../design/data-model.md) 6 章）
3. **Prototype 1 の縦の導線**: カメラ → 姿勢推定 → RULE-01 → LIVE SCORE を 1 本通す（[roadmap.md](roadmap.md)）

優先順位とマイルストーンは [roadmap.md](roadmap.md) を参照してください。
