/**
 * Embedding のベクトル演算。
 *
 * コサイン類似度で比較するため、保存前に必ず L2 正規化する
 * （docs/design/ai-style-similarity.md 4章）。
 */

/**
 * L2 正規化する。ゼロベクトルはそのまま返す。
 * @param {number[]} v 入力ベクトル
 * @return {number[]} ノルム 1 のベクトル
 */
export function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm < 1e-12) return v.slice();
  return v.map((x) => x / norm);
}

/**
 * コサイン類似度。-1〜1。
 * @param {number[]} a ベクトル A
 * @param {number[]} b ベクトル B
 * @return {number} 類似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-12) return 0;
  return dot / denom;
}

/**
 * 代表ベクトルを作る。
 * 各サンプルを L2 正規化してから平均し、平均後にもう一度正規化する。
 * 正規化を忘れると、ノルムの大きいサンプルが代表を支配してしまう。
 * @param {Array<Array<number>>} vectors 参照 Embedding。1 件以上
 * @return {number[]} 代表 Embedding
 */
export function meanEmbedding(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error("meanEmbedding requires at least one vector");
  }
  const dim = vectors[0].length;
  const acc = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) {
      throw new Error(
        `dimension mismatch: ${v.length} vs ${dim}`,
      );
    }
    const unit = l2Normalize(v);
    for (let i = 0; i < dim; i++) acc[i] += unit[i];
  }
  for (let i = 0; i < dim; i++) acc[i] /= vectors.length;
  return l2Normalize(acc);
}
