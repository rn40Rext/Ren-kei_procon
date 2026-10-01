import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

// Admin SDK の初期化は1回だけ行う(複数の関数ファイルから読み込まれても二重初期化しない)
if (getApps().length === 0) {
  initializeApp();
}

/** Admin SDK の Firestore。Security Rules を経由しない */
export const db = getFirestore();

/** Admin SDK の Cloud Storage */
export const storage = getStorage();
