import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebaseConfig';
import { DanceStyle, UserProfile } from '../types/firestore';

/** users/{uid} とプロフィールアイコンへのアクセスを集約する(docs/design/data-model.md 3.1章)。 */

export interface UserProfileInput {
  nickname: string;
  profile: string;
  danceStyle: DanceStyle;
  icon: string;
}

/**
 * 新規登録時にusers/{uid}を作成する(#39)。
 * roleは必ず'user'で作る。昇格はクライアントからできない(firestore.rulesで保護)。
 */
export async function createUserDocument(uid: string, email: string | null): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name: email?.split('@')[0] || '',
    nickname: '',
    mail: email || '',
    icon: '',
    profile: '',
    danceStyle: null,
    role: 'user',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** ログイン中ユーザーの表示名(users/{uid}のnicknameを優先、無ければメール先頭)。投稿・コメントの記名に使う。 */
export async function myDisplayName(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return '踊り子';
  try {
    const profile = await fetchUserProfile(user.uid);
    if (profile) {
      return (
        (profile.nickname && String(profile.nickname).trim()) ||
        (profile.name && String(profile.name).trim()) ||
        user.email?.split('@')[0] ||
        '踊り子'
      );
    }
  } catch {
    /* ignore */
  }
  return user.email?.split('@')[0] || '踊り子';
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ uid, ...snap.data() } as UserProfile) : null;
}

/**
 * プロフィールを更新する。
 * role/uid/createdAtは送らない(firestore.rulesでも保護されているが、
 * 意図せず差分に含めないようにする)。
 */
export async function saveUserProfile(uid: string, input: UserProfileInput): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      nickname: input.nickname,
      profile: input.profile,
      danceStyle: input.danceStyle,
      icon: input.icon,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** プロフィールアイコンをアップロードし、表示用URLを返す(storage.rulesで本人のみ書き込み可)。 */
export async function uploadUserIcon(uid: string, blob: Blob): Promise<string> {
  const iconRef = ref(storage, `users/${uid}/icon/${Date.now()}.jpg`);
  await uploadBytes(iconRef, blob);
  return getDownloadURL(iconRef);
}
