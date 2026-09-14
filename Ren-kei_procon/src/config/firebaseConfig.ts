import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// 開発・検証用: EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true で起動すると
// Firebase Emulator Suite(firebase.json のポート)へ接続する。
// 本番データに触らずに U-02 → FN-01 → U-03 の縦の導線を確認できる。
export const USING_FIREBASE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "true";
// エミュレータは `firebase emulators:start --project demo-renkei` で起こす前提。
// Functions の呼び出し URL と Firestore の名前空間に projectId が入るため、
// アプリ側もエミュレータの projectId に揃える(揃えないと Functions が 404/CORS になる)
const EMULATOR_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT || "demo-renkei";

const firebaseConfig = {
  apiKey: "AIzaSyCmolmCn2LqONYw3g7xOKXcZrhaDqNrOaM",
  authDomain: "ren-kei.firebaseapp.com",
  projectId: USING_FIREBASE_EMULATOR ? EMULATOR_PROJECT_ID : "ren-kei",
  storageBucket: USING_FIREBASE_EMULATOR ? `${EMULATOR_PROJECT_ID}.appspot.com` : "ren-kei.firebasestorage.app",
  messagingSenderId: "260043722567",
  appId: "1:260043722567:web:0b873c03b2a2a804570662"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions側(functions/src/index.ts)のリージョン設定と合わせる
export const functions = getFunctions(app, "asia-northeast1");

if (USING_FIREBASE_EMULATOR) {
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectFunctionsEmulator(functions, host, 5001);
}

export default app;