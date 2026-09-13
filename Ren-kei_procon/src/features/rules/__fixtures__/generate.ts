/**
 * フィクスチャ JSON の生成スクリプト。
 *
 *   npm run fixtures
 *
 * 生成物は git 管理する(CI が実機なしでルール判定をテストできるようにする。#14)。
 * synth.ts を変えたら再生成してコミットする。
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASIC_FORM, HANDS_UP_ONLY, STANDING, synthesize } from "./synth";

const here = dirname(fileURLToPath(import.meta.url));

const fixtures: Record<string, ReturnType<typeof synthesize>> = {
  // 手を上げて腰を落とした基本の構え(3 秒)。全ルールが GOOD/GREAT になる
  "basic_form": synthesize(BASIC_FORM, { frames: 90, noise: 0.004, seed: 11 }),
  // 棒立ち・手下げ(5 秒)。missAfterMs(4 秒)を超えるので MISS が出る
  "standing": synthesize(STANDING, { frames: 150, noise: 0.004, seed: 12 }),
  // 手だけ上げている(3 秒)。手のルールだけ成立し腰は不成立
  "hands_up_only": synthesize(HANDS_UP_ONLY, { frames: 90, noise: 0.004, seed: 13 }),
  // 基本の構えの鏡像(左右一貫性のテスト)
  "basic_form_mirror": synthesize(BASIC_FORM, { frames: 90, noise: 0.004, seed: 11, mirror: true }),
  // 足首が見えていない(全身が映っていない → NOT_READY)
  "ankles_hidden": synthesize(BASIC_FORM, { frames: 60, seed: 14, hidden: [27, 28] }),
  // 手の高さが閾値の直上・直下で揺れる(チャタリング検証)
  "hand_chatter": synthesize(
    (t) => ({ ...BASIC_FORM, handHeight: 0.06 + 0.012 * Math.sin(2 * Math.PI * 4 * t) }),
    { frames: 150, seed: 15 }
  ),
  // 112 BPM で腰が上下する(リズム判定)。10 秒
  "rhythm_112bpm": synthesize(BASIC_FORM, { frames: 300, seed: 16, bob: { amplitude: 0.03, bpm: 112 }, noise: 0.002 }),
};

for (const [name, frames] of Object.entries(fixtures)) {
  const path = join(here, `${name}.json`);
  writeFileSync(path, JSON.stringify({ formatVersion: "pose-series-v1", frames }));
  console.log(`wrote ${path} (${frames.length} frames)`);
}
