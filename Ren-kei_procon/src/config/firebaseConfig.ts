import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCmolmCn2LqONYw3g7xOKXcZrhaDqNrOaM",
  authDomain: "ren-kei.firebaseapp.com",
  projectId: "ren-kei",
  storageBucket: "ren-kei.firebasestorage.app",
  messagingSenderId: "260043722567",
  appId: "1:260043722567:web:0b873c03b2a2a804570662"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions側(functions/src/index.ts)のリージョン設定と合わせる
export const functions = getFunctions(app, "asia-northeast1");

export default app;