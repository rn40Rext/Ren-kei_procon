# AGENTS.md — Expo アプリ本体

> ルートの [../AGENTS.md](../AGENTS.md) に加えて、このディレクトリ固有のルールです。

## ⚠️ Expo は変わる

**コードを書く前に、対象バージョンの公式ドキュメントを読んでください。** 記憶やネット上のサンプルは古いバージョンのものです。

<https://docs.expo.dev/versions/>

### バージョンが未確定です

| 出どころ | バージョン |
| --- | --- |
| `package.json` の実体 | `expo ^54.0.36` |
| この文書の以前の記述 | v57 前提（`https://docs.expo.dev/versions/v57.0.0/` を読むよう指示していた） |

**どちらが正か決まっていません**（[#55](../../issues/55)）。`package.json` を確認してから、そのバージョンのドキュメントを参照してください。バージョンを上げる場合は人間の承認を取ってください。

特に破壊的変更が起きやすい領域:

- `expo-camera`（`Camera` → `CameraView` への変更など）
- `expo-av` → `expo-video` / `expo-audio` への分離
- `expo-image-picker`（`MediaTypeOptions` の非推奨化）
- `expo-file-system` の API 再編

## コマンド

```bash
npm install
npx expo start          # ⚠ package.json に scripts が無い（#54）
npx tsc --noEmit        # 型検査。コミット前に必須
```

`i` で iOS Simulator、`a` で Android Emulator、`w` で Web。

## ディレクトリ責務

```
src/
├── screens/          画面。UI とユーザー操作のみ
├── components/       再利用する UI 部品
├── navigation/       React Navigation の定義
├── config/           Firebase 初期化 ★ここが正
├── features/         ドメインロジック（pose / rules / scoring / style）
├── repositories/     Firestore / Storage アクセスを集約
├── types/            Firestore Entity の型
├── hooks/            useAuth など
└── theme/            colors.ts
```

`features/` `repositories/` `types/` `hooks/` `theme/` は**まだ存在しません**。作成する設計になっています（[../docs/design/architecture.md](../docs/design/architecture.md) 4章）。

## このディレクトリで特に守ること

全文は [../docs/rules/coding.md](../docs/rules/coding.md)。要点:

- **`useNavigation<any>()` を使わない。** 型回避のせいで未登録画面への遷移がコンパイル時に検出できず、実行時クラッシュしていました（[#51](../../issues/51)）
- **画面から `firebase/firestore` を直接呼ばない。** `src/repositories/` を経由する
- **`auth.currentUser` を画面から直参照しない。** `useAuth()` を使う
- **色を画面ごとに定義しない。** `src/theme/colors.ts` に集約する（現在 3 ファイルに散在）
- **`lucide-react` を import しない。** `lucide-react-native` を使う
- 画面を追加したら `RootStackParamList` と `AppNavigator` の両方を更新する

## 既知の不具合

このディレクトリに関するもの。触る範囲に含まれるなら併せて直すか、別イシューに委ねる判断をしてください。

| # | 内容 |
| --- | --- |
| [#51](../../issues/51) | `Camera` / `Result` / `Request` / `UserProfile` / `Chat` がナビゲータ未登録なのに `navigate()` されている。**遷移するとクラッシュ** |
| [#53](../../issues/53) | `App.tsx` と `AppNavigator.tsx` で `onAuthStateChanged` の購読が二重 |
| [#54](../../issues/54) | `package.json` に `scripts` と `main` が無い |
| [#55](../../issues/55) | ルート `package.json` の不正依存、Expo バージョン不一致、`lucide-react` 併存 |
| [#56](../../issues/56) | `firebase/firebaseConfig.ts` と `src/config/firebaseConfig.ts` の重複 |
| [#58](../../issues/58) | AI 採点が `Math.random()` のモックなのに「AI 87点」と表示される |

## 画面 ID との対応

各画面は仕様書の U-xx / R-xx に対応します。対応表とあるべきナビゲーション構成は [../docs/design/screens.md](../docs/design/screens.md) にあります。

**仕様書に無い画面を追加する場合は人間に確認してください。** 既に `ChatScreen` / `UserProfileScreen`（1対1チャット）が仕様書外の実装として存在し、扱いが未決定です。
