# コーディング規約

> 実装時に守る規約です。**既存コードがこの規約に反している場合は、規約が正**です（既存コードを真似ないでください）。段階的に直します。

## 1. 大前提: アプリ本体は `Ren-kei_procon/` にある

```
Ren-kei_procon/            ← リポジトリルート（Firebase 設定とドキュメント）
└── Ren-kei_procon/        ← ★ Expo アプリ本体。npm install / expo start はここ
```

ルート直下の `package.json` はアプリのものではありません（不正な依存エントリが残っており整理予定 → [#55](../../../issues/55)）。**アプリの依存を追加するときは `Ren-kei_procon/package.json` を編集します。**

## 2. TypeScript

| ルール | 理由 |
| --- | --- |
| `strict: true` を維持する | `tsconfig.json` で有効。緩めない |
| **`useNavigation<any>()` を使わない** | `NativeStackNavigationProp<RootStackParamList, '画面名'>` を使う。`any` で型検査を回避したために、未登録画面への遷移がコンパイル時に検出できず実行時クラッシュしていました（[#51](../../../issues/51)） |
| `as any` / `@ts-ignore` を安易に使わない | 使う場合は理由をコメントに書く |
| 新しい画面を追加したら `RootStackParamList` に型を追加する | パラメータ付きで定義する |
| コミット前に `npx tsc --noEmit` を通す | [definition-of-done.md](definition-of-done.md) |

## 3. ディレクトリと責務

```
Ren-kei_procon/src/
├── screens/          画面コンポーネント。UI とユーザー操作のみ
├── components/       再利用する UI 部品
├── navigation/       React Navigation の定義
├── config/           Firebase 初期化 ★ここが正（firebase/ 配下の重複は削除予定 #56）
├── features/         ドメインロジック
│   ├── pose/         姿勢推定ラッパ・座標正規化
│   ├── rules/        Rule Engine（RULE-01〜07）
│   ├── scoring/      Game Score / Analysis Score
│   └── style/        スタイル類似度 API 呼び出し
├── repositories/     Firestore / Storage アクセスを集約
├── types/            Firestore Entity の型定義
├── hooks/            useAuth など共通フック
└── theme/            colors.ts など
```

### 画面から Firestore を直接呼ばない

```ts
// ✗ 現在の実装（CommunityScreen.tsx 等）
import { collection, addDoc } from 'firebase/firestore';
await addDoc(collection(db, 'videos'), { ... });

// ✓ repositories 層を経由する
import { createPost } from '../repositories/posts';
await createPost({ videoId, title, tags });
```

理由: データモデルや Security Rules を変更したとき、影響が画面に直撃します。現在 `CommunityScreen.tsx` / `MypageScreen.tsx` / `ChatScreen.tsx` が SDK を直接呼んでおり、[#57](../../../issues/57) のデータ移行で全画面を触る必要が出ています。

### `auth.currentUser` を画面から直接読まない

`useAuth()` フック経由にします。現在 `HomeScreen` / `CommunityScreen` / `MypageScreen` が直参照しており、認証状態の変化に追従しません。

## 4. Firestore

命名規約と全コレクションのフィールド定義は [docs/design/data-model.md](../design/data-model.md) が正です。要点のみ:

| 対象 | 規約 | 例 |
| --- | --- | --- |
| コレクション名 | 英語・複数形・小文字始まり | `users`, `videos`, `joinRequests` |
| フィールド名 | lowerCamelCase | `createdAt`, `totalScore` |
| 日時 | `serverTimestamp()` で書く。クライアント時刻を使わない | `createdAt: serverTimestamp()` |
| 列挙値 | 小文字スネーク | `pending`, `ren_admin` |
| ドキュメント ID | 自動 ID。所有者が一意に定まるものは自然キー | `users/{uid}`, `posts/{postId}/likes/{uid}` |

> 既存の `Users/{uid}`（大文字始まり）は規約違反です。[#39](../../../issues/39) で `users` へ移行します。**新規コードでは `Users` を使わないでください。**

### カウンタに `increment()` を使わない

```ts
// ✗ 同一ユーザーが無制限に加算できる
await updateDoc(doc(db, 'videos', id), { likes: increment(1) });

// ✓ ドキュメント ID を uid にして 1 人 1 回を Rules で保証し、
//   カウンタは Cloud Functions のトリガで集約クエリから再集計する
await setDoc(doc(db, 'posts', postId, 'likes', uid), { userId: uid, createdAt: serverTimestamp() });
```

Cloud Functions のトリガは at-least-once 配信のため、`increment()` は重複実行でずれます。しかも**ずれたことに気づけません**。

## 5. スタイル

| ルール | 内容 |
| --- | --- |
| 色は `src/theme/colors.ts` に集約 | 現在 `HomeScreen` / `MypageScreen` / `LoginScreen` に `COLORS` が別々に定義されています |
| 阿波踊りの伝統色を使う | 藍 `#001E43` / 朱 `#E60012` / 金茶 `#D4AF37`（`HomeScreen` の定義が基準） |
| `StyleSheet.create()` を使う | インラインスタイルの多用を避ける |
| アイコンは `lucide-react-native` | `lucide-react`（Web 用）は使わない。削除予定 → [#55](../../../issues/55) |

## 6. Expo

**Expo は SDK バージョンで API が変わります。コードを書く前に対象バージョンの公式ドキュメントを確認してください。**

- 現在のアプリの実体: `expo ^54.0.36`
- `Ren-kei_procon/AGENTS.md` は v57 を前提とした記述 → **どちらが正か未確定**（[#55](../../../issues/55)）
- ドキュメント: <https://docs.expo.dev/versions/>

記憶やサンプルコードではなく、そのバージョンのドキュメントを読んでください。

## 7. エラー処理

エラーコードは仕様書 13 章の体系に合わせます（[docs/spec/13-error-handling.md](../spec/13-error-handling.md)）。

- クライアント側の判定エラー: `CAMERA_PERMISSION_DENIED`, `PERSON_NOT_DETECTED`, `LOW_LANDMARK_CONFIDENCE`, `MULTIPLE_PERSONS_DETECTED`
- サーバ側: `UNAUTHORIZED`, `FORBIDDEN`, `ANALYSIS_FAILED`, `JOIN_REQUEST_ALREADY_PENDING`, `INVALID_STATUS_TRANSITION`, `POST_VIDEO_NOT_PUBLICABLE`

**表示文言はクライアント側の辞書で解決します。** サーバはコードを返すだけにしてください（文言変更のたびにデプロイしたくないため）。

`Alert.alert("エラー", "失敗しました")` のような情報のないメッセージは避け、ユーザーが次に何をすればよいか書きます。

## 8. コメントと言語

| 対象 | 言語 |
| --- | --- |
| コメント | 日本語で構いません。既存コードも日本語です |
| 識別子（変数・関数・型） | 英語 |
| ユーザー向け文言 | 日本語 |
| コミットメッセージ | 日本語で構いません |

コメントは**why を書きます**。what はコードを読めば分かります。

```ts
// ✗ 手首の Y 座標を取得する
// ✓ 画像座標は下方向が正なので、頭より上にある手首は差が正になる
```

既存コードの `// 💡 追加` `// ⚠️ Firebaseのパスが2種類あったため` のような作業メモは、コミット前に削除してください。

## 9. テスト

| 対象 | 方法 |
| --- | --- |
| Rule Engine | 固定 landmark 系列を JSON フィクスチャで与えるユニットテスト（`src/features/rules/__fixtures__/`）。実機なしで CI 実行できるようにする |
| Security Rules | `@firebase/rules-unit-testing` + Emulator（[#42](../../../issues/42)） |
| Cloud Functions | Emulator |

境界値・ノイズ・欠損のケースを必ず含めます（仕様書 15.1）。

## 10. 新しいファイルを作るとき

1. 上記 3 章のディレクトリ責務に従う
2. 既存の似たファイルの構造を踏襲する（ただし規約違反は真似ない）
3. `docs/design/` に設計がある場合はそれに従う
4. 迷ったら人間に確認する
