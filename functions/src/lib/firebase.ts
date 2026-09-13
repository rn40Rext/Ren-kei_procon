import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();
}

/** Admin SDK の Firestore。Security Rules を経由しない */
export const db = getFirestore();

/** Admin SDK の Cloud Storage */
export const storage = getStorage();
