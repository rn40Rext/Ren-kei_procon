---
paths:
  - "Ren-kei_procon/src/screens/**"
  - "Ren-kei_procon/src/components/**"
  - "Ren-kei_procon/src/navigation/**"
  - "Ren-kei_procon/App.tsx"
---

# 画面・ナビゲーションを編集するときのルール

**編集前に [docs/rules/coding.md](../../docs/rules/coding.md) を読んでください。** 以下はその抜粋です。

## 型を `any` で回避しない

```ts
// ✗ 禁止
const navigation = useNavigation<any>();

// ✓
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
```

`any` で型検査を回避したために、未登録画面への遷移がコンパイル時に検出されず実行時クラッシュしていました（[#51](../../../../issues/51)）。

## 画面を追加したら 3 箇所を必ず更新する

1. `RootStackParamList` に型を追加（パラメータ付き）
2. `AppNavigator` に `Stack.Screen` として登録
3. 遷移元の `navigate()` の型が通ることを確認

**現在 `Camera` / `Result` / `Request` / `UserProfile` / `Chat` が未登録なのに `navigate()` されています。** 触るときは併せて直してください。

## Firestore を直接呼ばない

```ts
// ✗ 画面から SDK を直接叩く（既存コードはこうなっているが規約違反）
import { collection, addDoc } from 'firebase/firestore';

// ✓ repositories 層を経由する
import { createPost } from '../repositories/posts';
```

`auth.currentUser` の直参照も同様に避け、`useAuth()` を使ってください。

## 色を画面ごとに定義しない

`src/theme/colors.ts` に集約します。阿波踊りの伝統色（藍 `#001E43` / 朱 `#E60012` / 金茶 `#D4AF37`）が基準です。

## 画面 ID との対応を確認する

各画面は仕様書の U-xx / R-xx に対応します。実装ファイルとの対応表は [docs/design/screens.md](../../docs/design/screens.md) にあります。**仕様書に無い画面を追加する場合は人間に確認してください。**

## Expo の API はバージョンで変わる

現在の実体は `expo ^54`。`Ren-kei_procon/AGENTS.md` は v57 前提の記述で未確定です（[#55](../../../../issues/55)）。カメラ・動画・画像選択の API を書く前に <https://docs.expo.dev/versions/> で対象バージョンを確認してください。
