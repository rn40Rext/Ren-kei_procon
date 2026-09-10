import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

/**
 * firestore.rulesを読み込み、テスト環境を初期化する。
 * projectIdはテストファイルごとに別プロジェクトにしてデータを分離する。
 */
export async function setupTestEnv(projectId) {
  const rules = readFileSync(join(repoRoot, "firestore.rules"), "utf8");
  return initializeTestEnvironment({ projectId, firestore: { rules } });
}
