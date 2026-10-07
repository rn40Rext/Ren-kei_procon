/**
 * 開始までの待ち時間(stance.ts の START_DELAY_OPTIONS_SEC)を端末に覚えておく。
 * 当日に選び直した値が、画面を移ったりアプリを開き直したりしても戻らないようにする。
 * 端末ごとの設定なので Firestore ではなく AsyncStorage(Web では localStorage)に置く。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_START_DELAY_SEC, clampStartDelaySec } from './stance';

const STORAGE_KEY = 'renkei:startDelaySec';

/** 保存されている待ち時間[秒]を読む。無い・読めないときは既定値(1 秒) */
export async function loadStartDelaySec(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_START_DELAY_SEC : clampStartDelaySec(Number(raw));
  } catch {
    return DEFAULT_START_DELAY_SEC;
  }
}

/** 待ち時間[秒]を保存する。失敗しても採点には影響しないので無視する */
export async function saveStartDelaySec(sec: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(clampStartDelaySec(sec)));
  } catch {
    /* 保存できなくても、その場の選択は効いている */
  }
}
