/**
 * 投稿者・コメントした人などのプロフィールアイコン(users/{uid}.icon の画像URL)をまとめて取る。
 * 投稿やコメントには uid しか入っていないので、表示する画面側で引く。
 * 同じ人は1回だけ取得し、結果はアプリを開いている間だけ覚えておく
 * (アイコンを変えた直後は、画面を開き直すまで古いままのことがある)。
 * アイコンを設定していない人・取得できなかった人は '' を返す(頭文字の表示にする)。
 */
import { useEffect, useState } from 'react';
import { fetchUserProfile } from '../repositories/users';

/** uid → アイコンURL('' はアイコン無し・取得失敗) */
const cache = new Map<string, string>();

export function useUserIcons(uids: (string | undefined)[]): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({});
  // 配列の中身が同じなら再取得しないよう、並べ替えて1つの文字列にする
  const key = [...new Set(uids.filter((u): u is string => !!u))].sort().join(',');

  useEffect(() => {
    const wanted = key ? key.split(',') : [];
    let alive = true;
    const publish = () => {
      if (alive) setIcons(Object.fromEntries(wanted.map((u) => [u, cache.get(u) ?? ''])));
    };
    publish();
    const missing = wanted.filter((u) => !cache.has(u));
    if (missing.length === 0) {
      return () => {
        alive = false;
      };
    }
    Promise.all(
      missing.map((u) =>
        fetchUserProfile(u).then(
          (p) => void cache.set(u, p?.icon ?? ''),
          () => void cache.set(u, '')
        )
      )
    ).then(publish);
    return () => {
      alive = false;
    };
  }, [key]);

  return icons;
}
