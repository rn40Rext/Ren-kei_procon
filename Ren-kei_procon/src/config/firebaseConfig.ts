import { Platform } from "react-native";
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
// getReactNativePersistence は firebase/auth の React Native ビルドにのみ含まれ、
// 既定の型定義には無いため型チェックを個別に無効化する。
// @ts-ignore
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 開発・検証用: EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true で起動すると
// Firebase Emulator Suite（firebase.json のポート）へ接続する。
// 本番データに触らずに U-02 → FN-01 → U-03 の縦の導線を確認できる。
export const USING_FIREBASE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "true";
const EMULATOR_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT || "demo-renkei";

const firebaseConfig = {
  apiKey: "AIzaSyCmolmCn2LqONYw3g7xOKXcZrhaDqNrOaM",
  authDomain: "ren-kei.firebaseapp.com",
  projectId: USING_FIREBASE_EMULATOR ? EMULATOR_PROJECT_ID : "ren-kei",
  storageBucket: USING_FIREBASE_EMULATOR ? `${EMULATOR_PROJECT_ID}.appspot.com` : "ren-kei.firebasestorage.app",
  messagingSenderId: "260043722567",
  appId: "1:260043722567:web:0b873c03b2a2a804570662",
};

// アプリは一度だけ初期化する（Fast Refresh や複数 import に耐える）
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * 認証インスタンス。
 * - Web: 既定の getAuth（ブラウザの永続化を利用）
 * - Expo Go / ネイティブ: AsyncStorage を明示した initializeAuth。
 *   これを省くと onAuthStateChanged が解決せず、ログイン画面が出ない不具合が起きる。
 */
let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // 既に initializeAuth 済み（Fast Refresh 時など）
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions側(functions/src/index.ts)のリージョン設定と合わせる
export const functions = getFunctions(app, "asia-northeast1");

if (USING_FIREBASE_EMULATOR) {
  // エミュレータは `firebase emulators:start --project demo-renkei` で起こす前提。
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectFunctionsEmulator(functions, host, 5001);
}

export default app;
