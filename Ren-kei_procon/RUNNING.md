# アプリの起動方法（Ren-Kei / 阿波踊り練習支援アプリ）

Expo (React Native) 製。アプリのコードはこの `Ren-kei_procon/` フォルダ内にあります。
以下のコマンドはすべて **この `Ren-kei_procon/` フォルダ**で実行してください
（`firebase.json` などがある1つ上のフォルダではありません）。

---

## 1. 必要なもの

| もの | 補足 |
|---|---|
| **Node.js 20 以上** | `node -v` で確認 |
| **Git** | |
| **スマホの Expo Go アプリ** | App Store / Google Play。**Expo Go は最新の SDK 57 専用**。このアプリも SDK 57 なので一致しています |
| （任意）**Expo アカウント** | トンネル接続を使う場合のみ必要。https://expo.dev/signup |

PC とスマホは基本的に**同じ Wi‑Fi**につなぎます。

---

## 2. セットアップ（初回のみ）

```bash
# リポジトリを取得済みなら不要
git clone https://github.com/rn40Rext/Ren-kei_procon.git

cd Ren-kei_procon/Ren-kei_procon   # ← アプリのフォルダ（2階層目）

npm install
```

---

## 3. 開発サーバーを起動

```bash
npm start
```

（内部的には `npx expo start` が走ります）
起動したら、このターミナルは**開いたまま**にしておきます。QR コードが表示されます。

> **「You need to be signed in to Expo Go」** と出る場合は、トンネル接続になっています。
> → **方法 A**（下記）で LAN 接続にするか、Expo にログインしてください。

---

## 4. 端末で開く

### A. iPhone / Android（Expo Go・同じ Wi‑Fi）— 推奨

1. `npm start` のターミナルに出ている **QR コード**を読む
   - iPhone: 標準カメラアプリで読む
   - Android: Expo Go アプリ内のスキャナーで読む
2. 数十秒待つとアプリが立ち上がります

QR が読めない / うまくいかない場合は、Expo Go の
**「Enter URL manually」**に `exp://<PCのIP>:8081` を直接入力します。
PC の IP は次で確認：

```bash
# Windows
ipconfig | findstr IPv4
# mac / Linux
ipconfig getifaddr en0
```

### B. ブラウザ（動作確認用）

```bash
npm run web
```

または `npm start` 実行中のターミナルで **`w`** キー。

### C. Android エミュレータ / iOS シミュレータ

`npm start` 実行中のターミナルで **`a`**（Android）/ **`i`**（iOS・Mac のみ）。
事前に Android Studio / Xcode のセットアップが必要です。

---

## 5. Wi‑Fi が使えない環境（大学など）：トンネル接続

同じ Wi‑Fi につなげない・ルーターの「プライバシーセパレーター」で機器間通信が遮断される、
などの場合はトンネル接続を使います。**Expo アカウントへのログインが必須**です。

```bash
# 1. 一度ログイン（Google 連携アカウントは事前に expo.dev でパスワードを設定）
npx expo login
npx expo whoami        # 名前が出れば OK

# 2. トンネルで起動
npx expo start --tunnel
```

3. スマホの **Expo Go アプリでも同じアカウントでサインイン**（下タブ「Profile」）
4. ターミナルの**新しい QR**を読む（古い QR・「Try again」は使わない）

---

## 6. Firebase（バックエンド）

- 設定は [src/config/firebaseConfig.ts](src/config/firebaseConfig.ts)（プロジェクト `ren-kei`）
- ネイティブでの認証永続化のため `@react-native-async-storage/async-storage` を使用しています
- Firestore のセキュリティルールは**リポジトリのルート**（1階層上）の `firestore.rules` で管理。
  反映は上のフォルダで：
  ```bash
  cd ..
  firebase deploy --only firestore:rules
  ```
  （`firebase login` 済みが前提。未導入なら `npm i -g firebase-tools`）

---

## 7. うまくいかないとき

| 症状 | 対処 |
|---|---|
| **「Project is incompatible with this version of Expo Go」** | Expo Go は SDK 57 専用。このアプリも SDK 57 なので、Expo Go を最新に更新すれば解消 |
| **「You need to be signed in to Expo Go and Expo CLI」** | トンネル接続 + 未ログイン。§4-A の LAN 接続にするか §5 のログイン。「Try again」は無意味（古い URL を再試行するだけ） |
| **ログイン画面が出ない / 真っ白** | Metro キャッシュ破損の可能性。`npx expo start -c` で起動 |
| **`TreeFS: Failed to make parent directory entry` / ビルド失敗** | Metro キャッシュ破損。PowerShell で `Remove-Item -Recurse -Force "$env:TEMP\metro-*","$env:TEMP\haste-map-*"` → 再起動 |
| **VS Code で `expo/tsconfig.base が見つかりません`** | エディタの表示だけの問題（`npx tsc --noEmit` は通る）。コマンドパレット →「TypeScript: Restart TS Server」or「Developer: Reload Window」。VS Code はこのフォルダ（`Ren-kei_procon/Ren-kei_procon`）を開く |
| **`Could not connect to development server`** | PC とスマホが別ネットワーク／Windows ファイアウォールが Node をブロック。ファイアウォールで Node.js のプライベート通信を許可、または §5 のトンネル |
| **依存関係の警告** | `npx expo install --fix` で SDK 57 に揃える。`npx expo-doctor` で健全性チェック |

### キャッシュを完全に消してやり直す

```bash
# アプリのフォルダで
rm -rf node_modules
npm install
npx expo start -c
```

> 注：このプロジェクトは **OneDrive 同期フォルダ内かつ日本語パス**にあります。
> OneDrive がファイルをクラウド専用にしたり同期でロックしたりして、
> Metro のキャッシュ破損・ビルド失敗が起きやすいです。可能なら
> `C:\dev\Ren-kei_procon` のような **OneDrive 外・英数字パス**への移動を推奨します。

---

## 8. その他

- 型チェック： `npm run typecheck`
- 現在このブランチ `feature/awaodori-ui` は Expo SDK 57 + UI 全面刷新版です。
  `main` はチームのバックエンド作業ブランチで SDK は別の場合があります。
