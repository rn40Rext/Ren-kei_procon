/**
 * 連続稽古日数(docs/design/data-model.md 3.6章 analysisResults.createdAt 基準)。
 *
 * MypageScreen.tsx の KEIKO_STATS にあった「連続稽古 18日」は固定の見本値
 * (#127 でこの配列自体が実データ(稽古回数・直近の極め度・自己ベスト)に置き換わるが、
 * 連続稽古日数は含まれていない)。実データから計算するロジックをここに用意し、
 * 画面側への接続は #127 マージ後に行う。
 */
import { Timestamp } from "firebase/firestore";

export type FirestoreDateLike = Timestamp | Date | null | undefined;

function toDate(d: FirestoreDateLike): Date | null {
  if (!d) return null;
  return d instanceof Date ? d : d.toDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * 稽古した日(重複日は1つに圧縮)から、「今日」か「昨日」を起点に
 * 連続している日数を数える。直近の稽古が2日以上前なら記録は途切れているので0。
 * タイムゾーンは呼び出し側(デバイス)のローカル時刻に従う。
 */
export function computePracticeStreak(dates: FirestoreDateLike[], now: Date = new Date()): number {
  const days = Array.from(
    new Set(
      dates
        .map(toDate)
        .filter((d): d is Date => d !== null)
        .map((d) => startOfDay(d).getTime())
    )
  )
    .map((t) => new Date(t))
    .sort((a, b) => b.getTime() - a.getTime());

  if (days.length === 0) return 0;

  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const mostRecent = days[0];
  if (mostRecent.getTime() !== today.getTime() && mostRecent.getTime() !== yesterday.getTime()) {
    return 0;
  }

  let streak = 1;
  let cursor = mostRecent;
  for (let i = 1; i < days.length; i++) {
    const expectedPrev = addDays(cursor, -1);
    if (days[i].getTime() === expectedPrev.getTime()) {
      streak++;
      cursor = expectedPrev;
    } else {
      break;
    }
  }
  return streak;
}
