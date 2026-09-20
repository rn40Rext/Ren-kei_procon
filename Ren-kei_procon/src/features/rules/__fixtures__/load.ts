/** テストからフィクスチャ JSON を読む。 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PoseFrame } from "../../pose/types";

const here = dirname(fileURLToPath(import.meta.url));

export function loadFixture(name: string): PoseFrame[] {
  const raw = JSON.parse(readFileSync(join(here, `${name}.json`), "utf8"));
  return raw.frames as PoseFrame[];
}
