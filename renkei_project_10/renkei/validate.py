"""骨格の妥当性検証。2人が合成された骨格を自動で見つけて除外する。

背景:
  演奏者が踊り手のすぐ後ろに立っていると、MediaPipe が 2 人の手足を
  混ぜて 1 体の骨格を作ることがある（検出人数は 1 のままなので気づきにくい）。
  この骨格から基準値を作ると、エラーを出さないまま数値だけが嘘になる。

判定の考え方:
  同一人物なら左右の骨の長さはほぼ等しい（左大腿 ≒ 右大腿）。
  2 人にまたがると、この対称性が壊れる。
  ワールド座標の長さ比を見るので、正面・横どちらの映像でも同じ基準で使える
  （画面上の見かけの距離を使う方法は、正面と横で意味が変わってしまう）。
"""
from __future__ import annotations

import numpy as np

from .landmarks import Lm, PoseSequence

# 左右で対になる骨（上腕・前腕・大腿・下腿）
BONE_PAIRS = [
    ((Lm.L_SHOULDER, Lm.L_ELBOW), (Lm.R_SHOULDER, Lm.R_ELBOW)),   # 上腕
    ((Lm.L_ELBOW, Lm.L_WRIST), (Lm.R_ELBOW, Lm.R_WRIST)),         # 前腕
    ((Lm.L_HIP, Lm.L_KNEE), (Lm.R_HIP, Lm.R_KNEE)),               # 大腿
    ((Lm.L_KNEE, Lm.L_ANKLE), (Lm.R_KNEE, Lm.R_ANKLE)),           # 下腿
]

# 左右の骨長比がこれを超えたら別人の骨が混ざっていると判断
MAX_ASYMMETRY = 1.6


def _bone_len(seq: PoseSequence, a: Lm, b: Lm) -> np.ndarray:
    """骨の長さの時系列（ワールド座標）。shape (T,)。"""
    return np.linalg.norm(seq.joint(a) - seq.joint(b), axis=1)


def asymmetry_ratio(seq: PoseSequence) -> np.ndarray:
    """各フレームの左右非対称度。1.0 が完全対称、大きいほど異常。shape (T,)。"""
    ratios = []
    for (la, lb), (ra, rb) in BONE_PAIRS:
        left = _bone_len(seq, la, lb)
        right = _bone_len(seq, ra, rb)
        big = np.maximum(left, right)
        small = np.minimum(left, right)
        with np.errstate(invalid="ignore", divide="ignore"):
            ratios.append(big / np.where(small > 1e-6, small, np.nan))
    # 最も壊れている骨で判定する（1 本でも別人なら異常）
    return np.nanmax(np.array(ratios), axis=0)


def validate(seq: PoseSequence, max_asymmetry: float = MAX_ASYMMETRY) -> dict:
    """骨格の妥当性を検査し、使えるフレームのマスクと統計を返す。

    returns:
      valid:   shape (T,) bool。True のフレームだけ基準値の算出に使う。
      ratio:   非対称度の時系列
      stats:   件数などのサマリ
    """
    ratio = asymmetry_ratio(seq)
    detected = np.isfinite(seq.xyz[:, int(Lm.L_HIP), 0])

    merged = np.isfinite(ratio) & (ratio > max_asymmetry)
    valid = detected & ~merged

    return {
        "valid": valid,
        "ratio": ratio,
        "stats": {
            "total": int(seq.num_frames),
            "detected": int(detected.sum()),
            "merged": int(merged.sum()),
            "valid": int(valid.sum()),
            "valid_pct": float(100.0 * valid.sum() / max(seq.num_frames, 1)),
            "median_ratio": float(np.nanmedian(ratio)),
        },
    }


def describe_runs(mask: np.ndarray, fps: float, gap: int = 6) -> list[str]:
    """True の連続区間を「x.x-y.y秒」の文字列にまとめる（報告用）。"""
    idx = np.where(mask)[0]
    if len(idx) == 0:
        return []
    runs, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap:
            runs.append((start, prev))
            start = i
        prev = i
    runs.append((start, prev))
    return [f"{a / fps:.1f}-{b / fps:.1f}s" for a, b in runs]
