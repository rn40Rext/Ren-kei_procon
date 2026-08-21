import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyCmolmCn2LqONYw3g7xOKXcZrhaDqNrOaM",
  authDomain: "ren-kei.firebaseapp.com",
  projectId: "ren-kei",
  storageBucket: "ren-kei.firebasestorage.app",
  messagingSenderId: "260043722567",
  appId: "1:260043722567:web:0b873c03b2a2a804570662"

};

// 二重初期化防止
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 💡 標準のgetAuthを使用（未インストールのパッケージに依存しない安全な書き方）
export const auth = getAuth(app);

// 💡 Firestore Database（リアルタイム同期用）
export const db = getFirestore(app);

// 💡 Storage（安全なフォールバック設計）
let storageInstance: any = null;
try {
  storageInstance = getStorage(app);
} catch (e) {
  console.warn("Storage is not configured:", e);
}
export const storage = storageInstance;

export default app;