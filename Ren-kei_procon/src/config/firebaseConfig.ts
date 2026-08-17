import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCest7-39T_Mi-Q6RQzHH2LTY4Zljya8_U",
  authDomain: "ren-kei-936c9.firebaseapp.com",
  projectId: "ren-kei-936c9",
  storageBucket: "ren-kei-936c9.firebasestorage.app",
  messagingSenderId: "332550363788",
  appId: "1:332550363788:web:067af7b5de2d7bb5c4b9a9",
  measurementId: "G-KLHCMB4PN3"
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