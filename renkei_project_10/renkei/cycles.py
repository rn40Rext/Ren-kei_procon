"""往復とステップ周期の自動区切り。

阿波踊りの練習動画には 2 つの周期が重なっている。

  1) 往復（左右の折り返し）: 数秒周期のゆっくりした動き。
     熟練者動画の「5 往復」がこれ。左右方向の位置から検出する。
  2) ステップ（基本動作の 1 周期）: 0.5 秒前後の速い動き。
     採点の 1 単位。上下動から検出する。

どちらも「周期信号のピーク/ゼロ交差を拾う」問題なので、
平滑化 -> 極値検出 -> 最小間隔で間引き、という同じ骨格で処理する。
（SciPy に依存しないよう、必要な処理は自前で実装している）
"""
from __future__ import annotations

import numpy as np

from .features import interpolate_nans, torso_length_image
from .landmarks import Lm, PoseSequence


# =========================================================================
#  信号処理の基礎部品
# =========================================================================
def moving_average(x: np.ndarray, win: int) -> np.ndarray:
    """移動平均による平滑化。細かいノイズで偽のピークが出るのを防ぐ。"""
    if win <= 1:
        return x
    win = int(win) | 1                      # 奇数にして中心を保つ
    pad = win // 2
    padded = np.pad(x, pad, mode="edge")
    kernel = np.ones(win) / win
    return np.convolve(padded, kernel, mode="valid")


def find_peaks(x: np.ndarray, min_distance: int = 1,
               prominence: float = 0.0,
               prom_window: int | None = None) -> np.ndarray:
    """極大点のインデックスを返す簡易ピーク検出。

    min_distance: これより近いピークは、値の大きい方だけを残す
    prominence:   この高さ以上、周囲より突出しているピークだけを採用
    prom_window:  突出度を測る窓幅[サンプル]。省略時は min_distance。
                  ゆっくりした周期の信号では、窓が狭いと山の裾までしか
                  見えず突出度を過小評価するので、周期に応じて広く取る。
    """
    if len(x) < 3:
        return np.array([], dtype=int)

    # 単純な極大（前後より大きい点）
    cand = np.where((x[1:-1] > x[:-2]) & (x[1:-1] >= x[2:]))[0] + 1
    if prominence > 0 and len(cand):
        win = prom_window if prom_window is not None else min_distance
        keep = []
        for i in cand:
            lo = max(0, i - win)
            hi = min(len(x), i + win + 1)
            # 左右それぞれの谷を見て、浅い方を基準にする（突出度の定義）
            left_min = np.min(x[lo:i + 1])
            right_min = np.min(x[i:hi])
            base = max(left_min, right_min)
            if x[i] - base >= prominence:
                keep.append(i)
        cand = np.array(keep, dtype=int)

    if min_distance <= 1 or len(cand) == 0:
        return cand

    # 値の大きい順に採用し、近すぎるものを捨てる
    order = cand[np.argsort(x[cand])[::-1]]
    taken: list[int] = []
    for i in order:
        if all(abs(i - j) >= min_distance for j in taken):
            taken.append(int(i))
    return np.array(sorted(taken), dtype=int)


def dominant_period(x: np.ndarray, fps: float,
                    min_sec: float = 1.0, max_sec: float = 30.0) -> float:
    """信号の主要な周期[秒]を推定する。往復のようなゆっくりした動き用。

    自己相関のピークから求める。FFT だと分解能が周期の長さに対して
    粗くなりやすいため、時間領域で見る方が扱いやすい。
    """
    n = len(x)
    if n < 8:
        return float("nan")
    y = x - np.mean(x)
    ac = np.correlate(y, y, mode="full")[n - 1:]
    if ac[0] <= 0:
        return float("nan")
    ac = ac / ac[0]

    lo = max(1, int(min_sec * fps))
    hi = min(n - 1, int(max_sec * fps))
    if hi <= lo:
        return float("nan")

    seg = ac[lo:hi]
    peaks = find_peaks(seg, min_distance=max(2, lo // 2), prominence=0.05)
    if len(peaks) == 0:
        return float((lo + int(np.argmax(seg))) / fps)
    return float((lo + peaks[0]) / fps)


# =========================================================================
#  信号の取り出し
# =========================================================================
def lateral_signal(seq: PoseSequence) -> np.ndarray:
    """左右方向の位置信号（画像座標）。往復の検出に使う。

    腰の中点の x を胴体長で正規化する。踊り手が左右に移動すると
    大きくうねるので、その山と谷が折り返し点になる。
    """
    x = seq.midpoint_image(Lm.L_HIP, Lm.R_HIP)[:, 0]
    scale = np.nanmedian(torso_length_image(seq))
    if not np.isfinite(scale) or scale == 0:
        scale = 1.0
    return interpolate_nans(x / scale)


def vertical_step_signal(seq: PoseSequence) -> np.ndarray:
    """上下動の信号（画像座標）。ステップ周期の検出に使う。"""
    from .features import vertical_signal
    return interpolate_nans(vertical_signal(seq))


# =========================================================================
#  往復の検出
# =========================================================================
def _turns_at_scale(smooth: np.ndarray, fps: float, half: float,
                    amp: float) -> np.ndarray:
    """折り返し間隔の目安 half[秒] を仮定して折り返し点を拾う。"""
    min_dist = max(2, int(half * 0.5 * fps))
    prom_win = max(min_dist, int(half * fps))
    prom = 0.2 * amp
    highs = find_peaks(smooth, min_dist, prom, prom_win)
    lows = find_peaks(-smooth, min_dist, prom, prom_win)
    return np.array(sorted(np.concatenate([highs, lows])), dtype=int)


def detect_round_trips(seq: PoseSequence, valid: np.ndarray | None = None,
                       min_seconds: float | None = None) -> dict:
    """左右移動の折り返し点を検出し、往復区間に分割する。

    折り返しの間隔が事前に分からないため、複数の時間スケールを試し、
    「折り返しが最も等間隔に並ぶ」スケールを採用する。
    往復は一定のテンポで繰り返されるので、正しいスケールでは間隔が揃い、
    誤ったスケールでは間隔がばらつく。この規則性を手がかりにする。

    min_seconds: 折り返し間隔を直接指定したい場合に使う（省略可）。
    """
    sig = lateral_signal(seq)
    fps = seq.fps
    duration = seq.num_frames / fps

    # 往復はゆっくりした動きなので強めに平滑化（0.5 秒窓）
    smooth = moving_average(sig, int(0.5 * fps))
    amp = float(np.percentile(smooth, 95) - np.percentile(smooth, 5))

    if min_seconds is not None:
        turns = _turns_at_scale(smooth, fps, min_seconds * 2.0, amp)
        best_half = min_seconds * 2.0
    else:
        # 動画長を 2〜14 分割した各スケールを候補にする。
        # 規則性だけで選ぶと「折り返しが少ないほど間隔が揃う」ため
        # 取りこぼしが有利になってしまう。そこで
        # 「十分に等間隔（CV が閾値以下）な候補の中で、最も多く拾えたもの」
        # を採用する。同数ならより規則的な方を選ぶ。
        CV_LIMIT = 0.30
        candidates = []
        for div in range(2, 15):
            half = duration / div
            if half < 0.6:
                continue
            t = _turns_at_scale(smooth, fps, half, amp)
            if len(t) < 2:
                continue
            gaps = np.diff(t) / fps
            cv = float(np.std(gaps) / max(np.mean(gaps), 1e-9))
            candidates.append((t, cv, half))

        regular = [c for c in candidates if c[1] <= CV_LIMIT]
        pool = regular if regular else candidates
        if pool:
            # 検出数の多さを優先し、同数なら CV の小さい方
            turns, _, best_half = max(pool, key=lambda c: (len(c[0]), -c[1]))
        else:
            turns, best_half = np.array([], dtype=int), None

    segments = [(int(a), int(b)) for a, b in zip(turns[:-1], turns[1:])]
    gaps = np.diff(turns) / fps if len(turns) > 1 else np.array([])

    return {
        "signal": sig,
        "smooth": smooth,
        "turn_indices": turns,
        "turn_times": turns / fps,
        "segments": segments,
        "amplitude": amp,
        "num_turns": len(turns),
        "period_sec": float(2 * best_half) if best_half else None,
        "gap_mean": float(np.mean(gaps)) if len(gaps) else None,
        "gap_cv": float(np.std(gaps) / np.mean(gaps)) if len(gaps) else None,
    }


# =========================================================================
#  ステップ周期の検出
# =========================================================================
def detect_steps(seq: PoseSequence, bpm_range=(60.0, 240.0)) -> dict:
    """上下動からステップ周期を検出する。

    FFT で大まかなテンポを掴んでから、そのテンポに合った最小間隔で
    ピークを拾う。FFT だけでは各ステップの時刻が分からないので、
    「周波数で当たりをつけて時間領域で拾う」二段構えにしている。
    """
    from .scorers.rhythm import estimate_tempo

    sig = vertical_step_signal(seq)
    fps = seq.fps
    tempo, _, _, _ = estimate_tempo(sig, fps, bpm_range)

    smooth = moving_average(sig, max(3, int(0.08 * fps)))

    if np.isfinite(tempo) and tempo > 0:
        period_frames = 60.0 / tempo * fps
        min_dist = max(2, int(period_frames * 0.6))     # 周期の 6 割は空ける
    else:
        min_dist = max(2, int(0.25 * fps))

    amp = float(np.percentile(smooth, 95) - np.percentile(smooth, 5))
    peaks = find_peaks(smooth, min_dist, 0.2 * amp)

    intervals = np.diff(peaks) / fps if len(peaks) > 1 else np.array([])
    return {
        "signal": sig,
        "smooth": smooth,
        "peak_indices": peaks,
        "peak_times": peaks / fps,
        "intervals_sec": intervals,
        "tempo_bpm": float(tempo) if np.isfinite(tempo) else None,
        "step_count": len(peaks),
        # ステップ間隔のばらつき = リズムの安定度。許容幅の実測に使う。
        "interval_std": float(np.std(intervals)) if len(intervals) else None,
        "interval_mean": float(np.mean(intervals)) if len(intervals) else None,
    }
