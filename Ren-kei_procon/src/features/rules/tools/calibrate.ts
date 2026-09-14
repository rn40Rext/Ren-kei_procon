/**
 * 閾値較正ツール(TBD-02 / #100)。
 *
 * 連の指導者が OK / NG を付けた練習動画の姿勢系列(U-02 が保存する
 * users/{uid}/videos/{videoId}.pose.json、または renkei_project_10/export_pose_series.py の出力)
 * を、アプリと同じ Rule Engine に流して次を出す:
 *
 *   1. 現在の閾値での判定が OK / NG 群でどう分かれるか(ルール別の成功率・保持率)
 *   2. 各ルールの主指標について、OK 群と NG 群を最もよく分ける閾値の候補
 *      (動画ごとの代表値を並べ、Youden の J = TPR - FPR が最大になる境界)
 *   3. --out を付けると、候補を反映したルールセット JSON(analysisRules 投入用)
 *
 * 使い方:
 *   npm run calibrate -- --dir ./labeled --labels ./labeled/labels.csv [--rules rules.json] [--out suggested.json]
 *
 * labels.csv の形式(1 行目はヘッダ):
 *   file,label,ruleId
 *   taro_take1.pose.json,OK,
 *   taro_take2.pose.json,NG,HIP_LOW
 *   ruleId を書くと、その動画の NG 理由がそのルールだけであることを示す(空なら全ルールに適用)。
 *
 * 出力は表示のみで Firestore には書かない。値の採用は人が判断し、
 * defaultRules.json と docs/design/ai-basic-motion.md 6章を更新すること。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PoseSmoother } from "../../pose/preprocess";
import { PoseFrame } from "../../pose/types";
import { DEFAULT_RULE_SET, RuleSet, frameRules } from "../definitions";
import { MetricsTracker } from "../metrics";
import { createEvaluators, metricKey } from "../ruleEngine";
import { RuleDefinition, RuleEvent, Side } from "../types";

type Label = "OK" | "NG";
type LabeledVideo = { file: string; label: Label; ruleId?: string };

type VideoStats = {
  file: string;
  label: Label;
  ruleId?: string;
  frames: number;
  usableFrames: number;
  /** ルール別: 成功回数 / 試行回数 / MISS 回数 */
  rules: Record<string, { success: number; attempts: number; miss: number }>;
  /** 指標キー別の全フレーム値(代表値の計算用) */
  metricSamples: Record<string, number[]>;
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    }
  }
  return out;
}

function readLabels(path: string): LabeledVideo[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const header = lines[0].split(",").map((s) => s.trim());
  const idx = (name: string) => header.indexOf(name);
  if (idx("file") < 0 || idx("label") < 0) throw new Error("labels.csv には file,label 列が必要です");
  return lines.slice(1).map((l) => {
    const cols = l.split(",").map((s) => s.trim());
    const label = cols[idx("label")].toUpperCase();
    if (label !== "OK" && label !== "NG") throw new Error(`label は OK / NG のみ: ${l}`);
    const ruleId = idx("ruleId") >= 0 ? cols[idx("ruleId")] || undefined : undefined;
    return { file: cols[idx("file")], label, ruleId };
  });
}

function loadFrames(path: string): PoseFrame[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const frames = Array.isArray(raw) ? raw : raw.frames;
  if (!Array.isArray(frames)) throw new Error(`姿勢系列ではありません: ${path}`);
  return frames as PoseFrame[];
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = xs.slice().sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))));
  return s[i];
}

/** アプリと同じ経路で 1 本の姿勢系列を判定し、集計を返す。 */
function analyze(file: string, frames: PoseFrame[], ruleSet: RuleSet, label: Label, ruleId?: string): VideoStats {
  const smoother = new PoseSmoother();
  const tracker = new MetricsTracker();
  const evaluators = createEvaluators(frameRules(ruleSet));
  const stats: VideoStats = { file, label, ruleId, frames: frames.length, usableFrames: 0, rules: {}, metricSamples: {} };
  for (const raw of frames) {
    const f = smoother.apply(raw);
    const values = tracker.update(f);
    if (values.bodyScale !== null && values.bodyScale !== undefined) stats.usableFrames += 1;
    for (const [k, v] of Object.entries(values)) {
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      (stats.metricSamples[k] ??= []).push(v);
    }
    for (const ev of evaluators) {
      const e: RuleEvent | null = ev.evaluate(values, f.timestampMs);
      if (!e) continue;
      const r = (stats.rules[e.ruleId] ??= { success: 0, attempts: 0, miss: 0 });
      r.attempts += 1;
      if (e.grade === "MISS") r.miss += 1;
      else r.success += 1;
    }
  }
  return stats;
}

/** ルールの主指標について、動画 1 本を代表する値(min 型は上位 25%、max 型は下位 25%)。 */
function representative(def: RuleDefinition, stats: VideoStats): number | null {
  const sides: (Side | undefined)[] = def.side === "both" ? ["left", "right"] : def.side === "left" || def.side === "right" ? [def.side] : [undefined];
  const samples = sides.flatMap((side) => stats.metricSamples[metricKey(def.metric, side)] ?? []);
  if (samples.length < 10) return null;
  const isMin = def.minValue !== undefined;
  return percentile(samples, isMin ? 0.75 : 0.25);
}

/** OK 群を正例として Youden の J が最大になる境界を探す。 */
function bestThreshold(def: RuleDefinition, okVals: number[], ngVals: number[]): { threshold: number; j: number; tpr: number; fpr: number } | null {
  if (okVals.length === 0 || ngVals.length === 0) return null;
  const isMin = def.minValue !== undefined;
  const all = [...okVals, ...ngVals].sort((a, b) => a - b);
  let best = { threshold: NaN, j: -Infinity, tpr: 0, fpr: 0 };
  for (let i = 0; i < all.length - 1; i++) {
    const t = (all[i] + all[i + 1]) / 2;
    const pass = (v: number) => (isMin ? v >= t : v <= t);
    const tpr = okVals.filter(pass).length / okVals.length;
    const fpr = ngVals.filter(pass).length / ngVals.length;
    const j = tpr - fpr;
    if (j > best.j) best = { threshold: t, j, tpr, fpr };
  }
  return Number.isFinite(best.threshold) ? best : null;
}

function fmt(v: number | null | undefined, digits = 3): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "  -  " : v.toFixed(digits);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !args.labels) {
    console.error("usage: npm run calibrate -- --dir <poseDir> --labels <labels.csv> [--rules rules.json] [--out suggested.json]");
    process.exit(1);
  }
  const ruleSet: RuleSet = args.rules ? (JSON.parse(readFileSync(args.rules, "utf8")) as RuleSet) : DEFAULT_RULE_SET;
  const labeled = readLabels(args.labels);
  const results = labeled.map((l) => analyze(l.file, loadFrames(join(args.dir, l.file)), ruleSet, l.label, l.ruleId));

  console.log(`動画 ${results.length} 本(OK ${results.filter((r) => r.label === "OK").length} / NG ${results.filter((r) => r.label === "NG").length})、ルールセット ${ruleSet.version}\n`);
  console.log("## 1. 動画ごとの判定(現在の閾値)");
  console.log("file | label | frames(usable) | " + frameRules(ruleSet).map((r) => r.ruleId).join(" | "));
  for (const r of results) {
    const cells = frameRules(ruleSet).map((def) => {
      const s = r.rules[def.ruleId];
      return s ? `${s.success}/${s.attempts}` : "-";
    });
    console.log(`${r.file} | ${r.label} | ${r.frames}(${r.usableFrames}) | ${cells.join(" | ")}`);
  }

  console.log("\n## 2. ルール別: OK 群と NG 群の代表値と、分離する閾値の候補");
  console.log("rule | metric | 現在(GOOD) | OK群 中央値 | NG群 中央値 | 候補 | J=TPR-FPR | TPR | FPR");
  const suggested: RuleSet = JSON.parse(JSON.stringify(ruleSet));
  for (const def of frameRules(ruleSet)) {
    // ruleId 付きの NG はそのルールにだけ NG として効かせる。ruleId 無しの NG は全ルールに効く
    const relevant = results.filter((r) => r.label === "OK" || !r.ruleId || r.ruleId === def.ruleId);
    const okVals = relevant.filter((r) => r.label === "OK").map((r) => representative(def, r)).filter((v): v is number => v !== null);
    const ngVals = relevant.filter((r) => r.label === "NG").map((r) => representative(def, r)).filter((v): v is number => v !== null);
    const current = def.minValue ?? def.maxValue;
    const best = bestThreshold(def, okVals, ngVals);
    console.log(
      `${def.ruleId} | ${def.metric} | ${fmt(current)} | ${fmt(percentile(okVals, 0.5))} (n=${okVals.length}) | ${fmt(percentile(ngVals, 0.5))} (n=${ngVals.length}) | ${fmt(best?.threshold)} | ${fmt(best?.j, 2)} | ${fmt(best?.tpr, 2)} | ${fmt(best?.fpr, 2)}`
    );
    if (best && best.j >= 0.5) {
      const target = suggested.rules.find((r) => r.ruleId === def.ruleId)!;
      if (def.minValue !== undefined) {
        target.minValue = Number(best.threshold.toFixed(3));
        // GREAT ラインは OK 群の中央値(暫定)
        target.idealMinValue = Number(percentile(okVals, 0.5).toFixed(3));
      } else if (def.maxValue !== undefined) {
        target.maxValue = Number(best.threshold.toFixed(3));
        target.idealMaxValue = Number(percentile(okVals, 0.5).toFixed(3));
      }
    }
  }
  console.log("\nJ が 0.5 未満のルールは、この動画集合では OK / NG を分けられていない(閾値以外の要因か、動画数不足)。");
  console.log("候補は代表値(min 型: 各動画の上位 25% 点、max 型: 下位 25% 点)に基づく境界で、採用は指導者と相談して決める。");

  if (args.out) {
    suggested.version = `${ruleSet.version}-calibrated-${new Date().toISOString().slice(0, 10)}`;
    for (const r of suggested.rules) r.version = suggested.version;
    writeFileSync(args.out, JSON.stringify(suggested, null, 2));
    console.log(`\n候補を反映したルールセットを書き出しました: ${args.out}(version ${suggested.version})`);
    console.log("確認のうえ defaultRules.json を更新し、functions の npm run seed:rules -- --force で analysisRules に反映する。");
  }
}

main();
