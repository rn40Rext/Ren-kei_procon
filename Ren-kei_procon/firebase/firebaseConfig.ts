import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCmolmCn2LqONYw3g7xOKXcZrhaDqNrOaM",
  authDomain: "ren-kei.firebaseapp.com",
  projectId: "ren-kei",
  storageBucket: "ren-kei.firebasestorage.app",
  messagingSenderId: "260043722567",
  appId: "1:260043722567:web:0b873c03b2a2a804570662",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;