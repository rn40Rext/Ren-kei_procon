/**
 * 連スタイル類似度の実データ検証ツール(仕様書 8.6 / #101)。
 *
 * 参照動画とユーザー動画の姿勢系列(pose-series-v1 JSON)から Embedding を作り、
 * 仕様書 8.6 の検証項目を計算して Markdown の表で出す。Firestore には触らない。
 *
 *   npm run validate:style -- --refs <refsDir> --users <usersDir> \
 *     [--expected expected.csv]
 *
 * ディレクトリの形:
 *   refsDir/<renId>/<何でも>.pose.json      連ごとの熟練者の参照動画(3 本以上を推奨)
 *   usersDir/<personId>/<takeId>.pose.json  一般ユーザーの別テイク(5 人 × 3 テイクを推奨)
 *   expected.csv(任意): personId,renId  … 検証 6・7 用。「この人はこの連の動きを真似た」の正解
 *
 * 出力する検証項目:
 *   1. 同一人物の別テイクで 1 位の連が一致する割合(合格: 70% 以上)
 *   2. 撮影距離: 系列を縮小(0.6 倍)しても 1 位が変わらない割合
 *   3. 左右反転: 反転前後の類似度差が 0.05 以内の割合
 *   4. 再生速度: ±20% で 1 位が変わらない割合
 *   5. 連内個人差 < 連間差(参照 Embedding の連内平均距離と連間平均距離)
 *   6/7. expected.csv がある場合、1 位が期待どおりの割合(人が付けた正解との一致)
 */
import {readFileSync, readdirSync, statSync} from "node:fs";
import {join} from "node:path";
import {encodeStyleEmbedding} from "../style/encoder";
import {
  LM,
  Landmark,
  PoseFrame,
  PoseSeries,
  parsePoseSeries,
} from "../style/pose";
import {cosineSimilarity, meanEmbedding} from "../style/vector";

type Args = Record<string, string>;

/**
 * --key value 形式の引数を読む。
 * @param {string[]} argv 引数
 * @return {Args} キーと値
 */
function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const next = argv[i + 1];
      out[argv[i].slice(2)] =
        next && !next.startsWith("--") ? argv[++i] : "true";
    }
  }
  return out;
}

/**
 * ディレクトリ直下のサブディレクトリごとに *.pose.json を集める。
 * @param {string} root ルート
 * @return {Map<string, string[]>} サブディレクトリ名 → ファイルパス
 */
function collect(root: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(dir, f));
    if (files.length > 0) out.set(name, files);
  }
  return out;
}

/**
 * JSON を読んで PoseSeries にする。
 * @param {string} path パス
 * @return {PoseSeries} 姿勢系列
 */
function load(path: string): PoseSeries {
  return parsePoseSeries(JSON.parse(readFileSync(path, "utf8")));
}

const LR_PAIRS: [number, number][] = [
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_ELBOW, LM.R_ELBOW],
  [LM.L_WRIST, LM.R_WRIST],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_KNEE, LM.R_KNEE],
  [LM.L_ANKLE, LM.R_ANKLE],
];

/**
 * 左右反転した映像を模す(x を反転し、左右の landmark を入れ替える)。
 * @param {PoseSeries} s 元
 * @return {PoseSeries} 反転後
 */
function mirror(s: PoseSeries): PoseSeries {
  const frames: PoseFrame[] = s.frames.map((f) => {
    const lm: Landmark[] = f.landmarks.map((p) => ({...p, x: 1 - p.x}));
    for (const [a, b] of LR_PAIRS) {
      const tmp = lm[a];
      lm[a] = lm[b];
      lm[b] = tmp;
    }
    return {timestampMs: f.timestampMs, landmarks: lm};
  });
  return {...s, frames};
}

/**
 * 撮影距離の違いを模す(画面中央に向けて縮小)。
 * @param {PoseSeries} s 元
 * @param {number} k 倍率
 * @return {PoseSeries} 縮小後
 */
function shrink(s: PoseSeries, k: number): PoseSeries {
  return {
    ...s,
    frames: s.frames.map((f) => ({
      timestampMs: f.timestampMs,
      landmarks: f.landmarks.map((p) => ({
        ...p,
        x: 0.5 + (p.x - 0.5) * k,
        y: 0.5 + (p.y - 0.5) * k,
      })),
    })),
  };
}

/**
 * 再生速度の違いを模す(タイムスタンプを伸縮)。
 * @param {PoseSeries} s 元
 * @param {number} speed 1.2 なら 20% 速い
 * @return {PoseSeries} 変換後
 */
function respeed(s: PoseSeries, speed: number): PoseSeries {
  return {
    ...s,
    frames: s.frames.map((f) => ({
      timestampMs: f.timestampMs / speed,
      landmarks: f.landmarks,
    })),
  };
}

/**
 * 代表 Embedding との類似度で 1 位の連を返す。
 * @param {number[]} v ユーザーの Embedding
 * @param {Map<string, number[]>} profiles 連ごとの代表 Embedding
 * @return {{renId: string, sims: Array<[string, number]>}} 1 位と全類似度
 */
function rank(
  v: number[],
  profiles: Map<string, number[]>,
): {renId: string; sims: [string, number][]} {
  const sims: [string, number][] = [...profiles.entries()]
    .map(([renId, r]) => [renId, cosineSimilarity(v, r)] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  return {renId: sims[0][0], sims};
}

const pct = (n: number, d: number): string =>
  d === 0 ? "-" : `${((100 * n) / d).toFixed(0)}% (${n}/${d})`;

/**
 * 実行する。
 * @return {void}
 */
function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.refs || !args.users) {
    console.error(
      "usage: npm run validate:style -- --refs <refsDir> --users <usersDir> " +
        "[--expected expected.csv]",
    );
    process.exit(1);
  }

  // --- 代表 Embedding ---
  const refVectors = new Map<string, number[][]>();
  for (const [renId, files] of collect(args.refs)) {
    const vs: number[][] = [];
    for (const f of files) {
      try {
        vs.push(encodeStyleEmbedding(load(f)).vector);
      } catch (e) {
        console.warn(`skip ${f}: ${String(e)}`);
      }
    }
    if (vs.length > 0) refVectors.set(renId, vs);
  }
  if (refVectors.size < 2) {
    console.error(
      "参照 Embedding が 2 連未満です。refsDir/<renId>/*.pose.json を確認してください。",
    );
    process.exit(1);
  }
  const profiles = new Map<string, number[]>();
  for (const [renId, vs] of refVectors) profiles.set(renId, meanEmbedding(vs));

  // --- 検証 5: 連内個人差 < 連間差 ---
  let within = 0;
  let withinN = 0;
  for (const [renId, vs] of refVectors) {
    const r = profiles.get(renId)!;
    for (const v of vs) {
      within += 1 - cosineSimilarity(v, r);
      withinN += 1;
    }
  }
  let between = 0;
  let betweenN = 0;
  const ids = [...profiles.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      between +=
        1 - cosineSimilarity(profiles.get(ids[i])!, profiles.get(ids[j])!);
      betweenN += 1;
    }
  }
  const withinMean = withinN ? within / withinN : NaN;
  const betweenMean = betweenN ? between / betweenN : NaN;

  // --- ユーザーの別テイク ---
  const expected = new Map<string, string>();
  if (args.expected) {
    for (const line of readFileSync(args.expected, "utf8")
      .split(/\r?\n/)
      .slice(1)) {
      const [person, renId] = line.split(",").map((s) => s.trim());
      if (person && renId) expected.set(person, renId);
    }
  }

  let consistentPeople = 0;
  let people = 0;
  let distanceStable = 0;
  let mirrorOk = 0;
  let speedStable = 0;
  let takes = 0;
  let expectedHit = 0;
  let expectedN = 0;
  const rows: string[] = [];

  for (const [person, files] of collect(args.users)) {
    const tops: string[] = [];
    for (const f of files) {
      let series: PoseSeries;
      let base: number[];
      try {
        series = load(f);
        base = encodeStyleEmbedding(series).vector;
      } catch (e) {
        console.warn(`skip ${f}: ${String(e)}`);
        continue;
      }
      takes += 1;
      const top = rank(base, profiles);
      tops.push(top.renId);

      const far = rank(
        encodeStyleEmbedding(shrink(series, 0.6)).vector,
        profiles,
      );
      if (far.renId === top.renId) distanceStable += 1;

      const mir = encodeStyleEmbedding(mirror(series)).vector;
      if (1 - cosineSimilarity(base, mir) <= 0.05) mirrorOk += 1;

      const fast = rank(
        encodeStyleEmbedding(respeed(series, 1.2)).vector,
        profiles,
      );
      const slow = rank(
        encodeStyleEmbedding(respeed(series, 0.8)).vector,
        profiles,
      );
      if (fast.renId === top.renId && slow.renId === top.renId) {
        speedStable += 1;
      }

      const exp = expected.get(person);
      if (exp) {
        expectedN += 1;
        if (exp === top.renId) expectedHit += 1;
      }
      rows.push(
        `${person} | ${f.split("/").pop()} | ${top.renId} | ` +
          top.sims.map(([r, s]) => `${r}=${s.toFixed(3)}`).join(", ") +
          (exp ? ` | 期待 ${exp} ${exp === top.renId ? "✓" : "✗"}` : ""),
      );
    }
    if (tops.length >= 2) {
      people += 1;
      if (tops.every((t) => t === tops[0])) consistentPeople += 1;
    }
  }

  console.log("## テイクごとの 1 位\n");
  console.log("person | take | 1位 | 類似度 | 期待");
  for (const r of rows) console.log(r);

  console.log("\n## 仕様書 8.6 の検証項目\n");
  console.log("| # | 項目 | 合格基準 | 結果 |");
  console.log("| --- | --- | --- | --- |");
  console.log(
    `| 1 | 同一人物の別テイクで同じ連が 1 位 | 70% 以上 | ${pct(consistentPeople, people)} ` +
      "(2 テイク以上ある人が対象) |",
  );
  console.log(
    `| 2 | 撮影距離(0.6 倍に縮小)で 1 位が変わらない | 全テイク | ${pct(distanceStable, takes)} |`,
  );
  console.log(
    `| 3 | 左右反転で類似度差 0.05 以内 | 全テイク | ${pct(mirrorOk, takes)} |`,
  );
  console.log(
    `| 4 | 再生速度 ±20% で 1 位が変わらない | 全テイク | ${pct(speedStable, takes)} |`,
  );
  console.log(
    `| 5 | 連内個人差 < 連間差 | 連内 < 連間 | 連内 ${withinMean.toFixed(4)} / ` +
      `連間 ${betweenMean.toFixed(4)} → ` +
      `${withinMean < betweenMean ? "✓" : "✗"} |`,
  );
  console.log(
    "| 6/7 | 人が付けた正解(expected.csv)と 1 位が一致 | 概ね一致 | " +
      `${expectedN ? pct(expectedHit, expectedN) : "expected.csv 未指定"} |`,
  );
  console.log(
    "\n7(体格・撮影条件ではなくスタイルを捉えているか)は、同一人物が別の連の動きを真似た" +
      "テイクを usersDir に入れ、expected.csv でその連を正解にして測る。",
  );
  console.log("結果は docs/design/ai-style-similarity.md 7章の表に転記する。");
}

main();
