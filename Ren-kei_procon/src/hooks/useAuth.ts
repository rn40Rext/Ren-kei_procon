/**
 * 認証状態を扱う共通フック。
 *
 * 画面から auth.currentUser を直接参照しない（docs/rules/coding.md）。
 */
import { useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebaseConfig";

export type AuthState = {
  user: User | null;
  uid: string | null;
  /** 初回の認証状態が確定するまで true */
  loading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(auth.currentUser === null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, uid: user?.uid ?? null, loading };
}
