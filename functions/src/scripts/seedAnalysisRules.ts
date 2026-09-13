/**
 * analysisRules/{ruleId} の初期投入(仕様書 7.9 / #21)。
 *
 *   # エミュレータへ
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-renkei \
 *     npm run seed:rules
 *   # 本番へ(要: gcloud auth application-default login 等の資格情報。実行前に承認を得る)
 *   GCLOUD_PROJECT=ren-kei npm run seed:rules
 *
 * 正本はアプリのバンドル既定値 Ren-kei_procon/src/features/rules/defaultRules.json。
 * 既に存在するルールは上書きしない(--force で上書き)。閾値の運用変更は
 * Firebase コンソールから直接編集し、アプリ再起動で反映される。
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

const DEFAULTS_PATH = resolve(
  __dirname,
  "../../../Ren-kei_procon/src/features/rules/defaultRules.json",
);

/**
 * 既定ルールを Firestore へ書く。
 * @return {Promise<void>}
 */
async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();

  const raw = JSON.parse(readFileSync(DEFAULTS_PATH, "utf8")) as {
    version: string;
    rules: Record<string, unknown>[];
    rhythm: Record<string, unknown>;
  };

  let written = 0;
  let skipped = 0;
  for (const rule of raw.rules) {
    const ruleId = String(rule.ruleId);
    const ref = db.collection("analysisRules").doc(ruleId);
    const snap = await ref.get();
    if (snap.exists && !force) {
      skipped += 1;
      continue;
    }
    const doc: Record<string, unknown> = {
      ...rule,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // リズム設定は RHYTHM ルールのドキュメントに同居させる
    if (ruleId === "RHYTHM") doc.rhythm = raw.rhythm;
    await ref.set(doc);
    written += 1;
  }
  const summary =
    `analysisRules: ${written} written, ${skipped} skipped ` +
    `(version ${raw.version})`;
  console.log(summary + (skipped > 0 ? " — 上書きするには --force" : ""));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
