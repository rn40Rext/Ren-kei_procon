# 画面設計とナビゲーション

> 出典: [仕様書 5章 画面設計（一般ユーザー）](../spec/05-screens-user.md) / [6章 画面設計（連管理者）](../spec/06-screens-ren-admin.md)
> 付録C「画面ごとの項目ID・入力制約・イベント・API呼出表」に対応する文書です。

## 1. 画面 ID と実装ファイルの対応

### 一般ユーザー（U-01〜U-10）

| 画面 ID | 画面名 | 実装ファイル | 実装状況 | 呼び出す API / データ |
| --- | --- | --- | --- | --- |
| U-01 | ホーム / 認証 | [LoginScreen.tsx](../../Ren-kei_procon/src/screens/LoginScreen.tsx)<br>[HomeScreen.tsx](../../Ren-kei_procon/src/screens/HomeScreen.tsx) | ✅ 実装済み | Firebase Auth |
| U-02 | 踊り解析 | [ScoringScreen.tsx](../../Ren-kei_procon/src/screens/ScoringScreen.tsx)<br>[CameraScreen.tsx](../../Ren-kei_procon/src/screens/CameraScreen.tsx) | 🔶 骨組みのみ | MediaPipe, Rule Engine, Storage |
| U-03 | 解析結果 | [ResultScreen.tsx](../../Ren-kei_procon/src/screens/ResultScreen.tsx) | ❌ プレースホルダー | FN-01 |
| U-04 | コミュニティ | [CommunityScreen.tsx](../../Ren-kei_procon/src/screens/CommunityScreen.tsx) | ✅ 実装済み | `posts` 購読 |
| U-05 | 投稿詳細 | 同上（`VideoDetailScreen` として内包） | ✅ 実装済み | `comments`, `likes` |
| U-06 | 投稿作成 | 同上（モーダル） | 🔶 直接書き込み | FN-03 へ移行 |
| U-07 | 連への参加リクエスト | **未作成**（[RequestScreen.tsx](../../Ren-kei_procon/src/screens/RequestScreen.tsx) は空） | ❌ | `ren` 検索, FN-04 |
| U-08 | マイ連 | [GroupScreen.tsx](../../Ren-kei_procon/src/screens/GroupScreen.tsx) | ❌ スタブ | `ren`, `members`, `announcements` |
| U-09 | マイページ | [MypageScreen.tsx](../../Ren-kei_procon/src/screens/MypageScreen.tsx) | 🔶 部分実装 | `users/{uid}` |
| U-10 | 成長曲線 | **未作成** | ❌ | `growthRecords` |

### 連管理者（R-01〜R-08）

| 画面 ID | 画面名 | 実装ファイル | 実装状況 | 呼び出す API |
| --- | --- | --- | --- | --- |
| R-01 | 管理ホーム | 未作成 | ❌ | `joinRequests`, `posts`, 通知 |
| R-02 | 投稿一覧 | 未作成 | ❌ | `posts` 検索 |
| R-03 | 投稿詳細 | 未作成 | ❌ | `posts`, `analysisResults` |
| R-04 | アドバイス送信 | 未作成 | ❌ | `comments`（`type: 'instructor'`） |
| R-05 | 参加リクエスト管理 | 未作成 | ❌ | FN-05 |
| R-06 | メンバー管理 | 未作成 | ❌ | `ren/{renId}/members` |
| R-07 | お知らせ管理 | 未作成 | ❌ | FN-06 |
| R-08 | 活動情報管理 | 未作成 | ❌ | `ren/{renId}/activities` |

### 仕様書 8 章に対応する画面（画面 ID なし）

| 画面 | 実装ファイル | 扱い |
| --- | --- | --- |
| 動きの類似度（連スタイル類似度ランキング） | [StyleResultScreen.tsx](../../Ren-kei_procon/src/screens/StyleResultScreen.tsx) | 仕様書 8.2 の「上位連を UI に表示し、連詳細・参加リクエストへ接続する」に対応。**U-xx の画面 ID は割り当てられていない**（5 章の画面一覧に無いため）。イシュー [#25](../../../issues/25) の実装。**検証（仕様書 8.6）が通るまでフラグで非公開**（`src/features/style/featureFlags.ts`）。v0.4 で画面 ID を採番するか要判断 |

### 仕様書に無い実装

| 画面 | 実装ファイル | 扱い |
| --- | --- | --- |
| ユーザープロフィール | [UserProfileScreen.tsx](../../Ren-kei_procon/src/screens/UserProfileScreen.tsx) | U-05 からの導線として妥当。仕様書 v0.4 で正式化を検討 |
| 1 対 1 チャット | [ChatScreen.tsx](../../Ren-kei_procon/src/screens/ChatScreen.tsx) | 仕様書外。プロトタイプ限定（[data-model.md 7章](data-model.md#7-仕様書に無い実装の扱いchats)） |
| 設定 | [SettingScreen.tsx](../../Ren-kei_procon/src/screens/SettingScreen.tsx) | スタブ。U-09 の一部として実装 |
| お問い合わせ | [ContactInfoScreen.tsx](../../Ren-kei_procon/src/screens/ContactInfoScreen.tsx) | スタブ。U-09 の一部として実装 |
| 自分の動画一覧 | [VideoListScreen.tsx](../../Ren-kei_procon/src/screens/VideoListScreen.tsx) | スタブ。U-09 の「保存動画」に相当 |

## 2. ナビゲーション定義の現状と問題

`AppNavigator.tsx` に登録されている画面と、コード中で `navigate()` されている画面が一致していません。

### 登録済み（ログイン後）

`Home` / `Community` / `Scoring` / `Mypage` / `VideoList` / `Group` / `ContactInfo` / `Setting` / `StyleResult`

### 未登録なのに `navigate()` されている ⚠️

| 遷移先 | 呼び出し元 | 結果 |
| --- | --- | --- |
| `Camera` | [ScoringScreen.tsx:114](../../Ren-kei_procon/src/screens/ScoringScreen.tsx#L114) | 実行時エラー |
| `Result` | [CameraScreen.tsx:56](../../Ren-kei_procon/src/screens/CameraScreen.tsx#L56) | 実行時エラー |
| `Request` | [HomeScreen.tsx:83](../../Ren-kei_procon/src/screens/HomeScreen.tsx#L83) | 実行時エラー |
| `UserProfile` | [CommunityScreen.tsx:226](../../Ren-kei_procon/src/screens/CommunityScreen.tsx#L226) | 実行時エラー |
| `Chat` | [UserProfileScreen.tsx:13](../../Ren-kei_procon/src/screens/UserProfileScreen.tsx#L13) | 実行時エラー |

さらに `RootStackParamList` の型定義にも `Camera` / `Result` / `Request` が無いため、`ScoringScreen` や `CameraScreen` の `RouteProp<RootStackParamList, 'Camera'>` は型エラーになります（各画面が `useNavigation<any>()` で型検査を回避しているため気づきにくい状態）。

## 3. あるべきナビゲーション構成

```
RootNavigator
├── (未認証) AuthStack
│   └── Login                     U-01
└── (認証済み) MainStack
    ├── Home                      U-01（ログイン後）
    ├── PracticeStack             練習フロー（モーダル表示推奨）
    │   ├── Scoring               U-02 前段（種類・部位の選択）
    │   ├── Camera                U-02 本体
    │   └── Result                U-03
    ├── Community                 U-04
    │   ├── PostDetail            U-05
    │   ├── PostCreate            U-06
    │   └── UserProfile           （仕様書外）
    ├── RenSearch                 U-07
    ├── MyRen                     U-08
    ├── Mypage                    U-09
    │   ├── VideoList
    │   ├── Setting
    │   └── ContactInfo
    ├── GrowthChart               U-10
    ├── Chat                      （仕様書外・プロトタイプ限定）
    └── (role: ren_admin のみ) AdminStack
        ├── AdminHome             R-01
        ├── AdminPostList         R-02
        ├── AdminPostDetail       R-03
        ├── AdminAdviceCompose    R-04
        ├── AdminJoinRequests     R-05
        ├── AdminMembers          R-06
        ├── AdminAnnouncements    R-07
        └── AdminActivities       R-08
```

### 型定義

```ts
export type RootStackParamList = {
  // 認証
  Login: undefined;

  // 一般
  Home: undefined;
  Scoring: undefined;
  Camera: { danceType: DanceType; scorePart: ScorePart };
  Result: { analysisId: string; videoId: string };
  Community: undefined;
  PostDetail: { postId: string };
  PostCreate: { videoId?: string };
  UserProfile: { userId: string; userName: string };
  RenSearch: undefined;
  RenDetail: { renId: string };
  MyRen: { renId?: string };
  Mypage: undefined;
  VideoList: undefined;
  GrowthChart: undefined;
  Setting: undefined;
  ContactInfo: undefined;
  Chat: { chatId: string; recipientName: string; initialMessage?: string };

  // 連管理者
  AdminHome: undefined;
  AdminPostList: { renId: string };
  AdminPostDetail: { renId: string; postId: string };
  AdminAdviceCompose: { renId: string; postId: string };
  AdminJoinRequests: { renId: string };
  AdminMembers: { renId: string };
  AdminAnnouncements: { renId: string };
  AdminActivities: { renId: string };
};
```

**方針**: `useNavigation<any>()` をやめ、`NativeStackNavigationProp<RootStackParamList, '画面名'>` を使います。現在 `any` で型検査を回避しているために、上記のような未登録画面への遷移がコンパイル時に検出できていません。

### 連管理者画面の出し方

`ren/{renId}/members/{uid}.role == 'admin'` である連が 1 つ以上あるユーザーにのみ `AdminStack` を表示します。`users.role` だけで判定しないのは、複数連の管理者になり得るためです（[security-rules.md 2章](security-rules.md#2-権限判定の基本原則)）。

```ts
const { adminRenIds } = useAdminRens();   // members を横断検索して取得
// adminRenIds.length > 0 のときのみ管理タブ / 導線を表示
```

## 4. 画面遷移の要点（仕様書 5.3）

| 遷移 | 条件 |
| --- | --- |
| U-02 → U-03 | 練習終了・FN-01 による解析確定後 |
| U-03 → U-06 | 解析済み動画をコミュニティへ投稿する場合 |
| U-04 → U-05 | タイムラインの投稿をタップ |
| U-07 → U-08 | 参加申請が承認され `members` へ登録された後 |
| U-09 → U-10 | 成長曲線への導線 |
| R-03 → R-04 | 投稿詳細からアドバイス送信へ |
| R-05 → 通知 | 承認・却下時に申請者へ通知 |

## 5. 共通 UI

### BottomNav（[BottomNav.tsx](../../Ren-kei_procon/src/components/BottomNav.tsx)）

現在 4 タブ（ホーム / 解析 / 広場 / マイページ）。仕様書の 10 画面を踏まえ、以下を検討します。

| 現状 | 課題 | 対応案 |
| --- | --- | --- |
| `position: 'absolute'` で各画面が個別に配置 | 画面ごとに `paddingBottom` を調整する必要があり、抜けが発生しやすい | React Navigation の Bottom Tab Navigator へ移行し、タブとスタックを分離する |
| 「連」への導線が無い | U-07 / U-08 に到達しにくい | タブを 5 つにする（ホーム / 解析 / 広場 / 連 / マイページ） |
| `route.name` でアクティブ判定 | 子画面（U-05 等）でハイライトが消える | タブナビゲータに任せる |

### 色定義の重複

`COLORS` 定数が `HomeScreen.tsx`（阿波踊りの伝統色: 藍・朱・金茶）、`MypageScreen.tsx`、`LoginScreen.tsx` にそれぞれ別定義されています。`src/theme/colors.ts` へ集約します。

```ts
// src/theme/colors.ts
export const COLORS = {
  indigo: '#001E43',       // 藍色
  indigoLight: '#1E3A8A',
  vermilion: '#E60012',    // 朱色
  gold: '#D4AF37',         // 金茶
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  danger: '#EF4444',
} as const;
```

## 6. 入力制約

| 画面 | 項目 | 制約 |
| --- | --- | --- |
| U-01 | メールアドレス | 形式検証。Auth のエラーコードで分岐（実装済み） |
| U-01 | パスワード | 6 文字以上（実装済み） |
| U-06 | タイトル | 必須、1〜100 文字 |
| U-06 | 説明 | 0〜1000 文字 |
| U-06 | タグ | 既定リストからの複数選択 |
| U-06 | 動画 | 200MB 以下、`video/*` |
| U-07 | 申請メッセージ | 0〜500 文字 |
| U-09 | ニックネーム | 1〜20 文字（現在は空文字チェックのみ） |
| R-04 | アドバイス | 1〜1000 文字 |
| R-07 | お知らせ | タイトル 1〜100 / 本文 1〜2000 文字 |
