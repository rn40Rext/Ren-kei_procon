"""リズム採点。上下動の周期をスペクトルから推定する DSP パート。

流れ:
  鉛直信号 -> 補間 -> トレンド除去 -> 窓関数 -> rFFT -> 帯域内ピーク -> テンポ[BPM]
テンポと位相の安定性をスコア化する。ここは信号処理の腕の見せ所で、
「阿波踊りに特化してどこまで有用か」への技術的な差別化ポイントにもなる。
"""
from __future__ import annotations

import numpy as np

from ..features import interpolate_nans, vertical_signal
from ..landmarks import PoseSequence
from .base import Part, ScoreResult, Scorer, linear_map


def estimate_tempo(signal: np.ndarray, fps: float,
                   bpm_range: tuple[float, float] = (60.0, 240.0)):
    """信号の主要テンポ[BPM]とスペクトルを推定する。

    returns: (tempo_bpm, peak_freq_hz, freqs, magnitude)
    """
    n = len(signal)
    if n < 8:
        return float("nan"), float("nan"), np.array([]), np.array([])

    # 1) DC・線形トレンド除去（呼吸やカメラ揺れの低周波を落とす）
    t = np.arange(n)
    coeffs = np.polyfit(t, signal, deg=1)
    detrended = signal - np.polyval(coeffs, t)

    # 2) ハン窓でスペクトル漏れを抑える
    windowed = detrended * np.hanning(n)

    # 3) 実 FFT。振幅スペクトルと周波数軸[Hz]。
    spectrum = np.abs(np.fft.rfft(windowed))
    freqs = np.fft.rfftfreq(n, d=1.0 / fps)

    # 4) 想定テンポ帯域（Hz）内で最大ピークを探す
    lo_hz, hi_hz = bpm_range[0] / 60.0, bpm_range[1] / 60.0
    band = (freqs >= lo_hz) & (freqs <= hi_hz)
    if not band.any():
        return float("nan"), float("nan"), freqs, spectrum

    band_idx = np.where(band)[0]
    peak = band_idx[np.argmax(spectrum[band_idx])]
    peak_freq = float(freqs[peak])
    return peak_freq * 60.0, peak_freq, freqs, spectrum


class RhythmScorer(Scorer):
    axis = "リズム"
    part = Part.LOWER

    # テンポの基準はプロファイル（連ごとの実測）から取る。
    # 連への聞き取りでは「練習は本番より落としたテンポで」とあり、
    # 本番用のテンポは別プロファイルに分ける余地がある。

    def __init__(self, profile=None):
        from ..profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.TARGET_BPM = self.profile.get("tempo", 112.0)
        self.TOLERANCE_BPM = self.profile.get("tempo_tolerance", 30.0)

    # 安全網の閾値
    MIN_MOTION_STD = 1e-3       # 上下動がこれ未満なら「測れない」と判定
    MAX_RESOLUTION_BPM = 5.0    # 分解能がこれより粗い＝動画が短すぎる

    def score(self, seq: PoseSequence) -> ScoreResult:
        if not seq.has_image_coords:
            return ScoreResult(self.axis, 0.0,
                               "画像座標が無いためリズムを解析できません。",
                               {"tempo_bpm": None}, self.part)

        sig = interpolate_nans(vertical_signal(seq))

        # --- 安全網 1: 上下動が実質ゼロなら解析しない -------------------
        # ノイズを FFT にかけると帯域端に張り付いた無意味な値が出るため、
        # 「測れなかった」と正直に返す。
        if np.std(sig) < self.MIN_MOTION_STD:
            return ScoreResult(self.axis, 0.0,
                               "上下動が検出できませんでした。"
                               "全身が映っているか確認してください。",
                               {"tempo_bpm": None,
                                "signal_std": float(np.std(sig))})

        tempo, peak_freq, freqs, spec = estimate_tempo(sig, seq.fps)

        if not np.isfinite(tempo):
            return ScoreResult(self.axis, 0.0,
                               "動きが小さく、リズムを検出できませんでした。",
                               {"tempo_bpm": None}, self.part)

        # --- 安全網 2: 周波数分解能のチェック --------------------------
        # 分解能 Δf = 1/T は観測長でのみ決まる。動画が短いと BPM が
        # 粗い刻みでしか測れず、推定値に意味が無くなる。
        duration = seq.num_frames / seq.fps
        resolution_bpm = 60.0 / duration
        too_short = resolution_bpm > self.MAX_RESOLUTION_BPM

        # ピークの鋭さ = 拍の安定度。帯域内平均に対するピーク比を補助指標に。
        band = (freqs >= 0.5) & (freqs <= 4.0)
        sharpness = float(spec[np.argmax(spec)] / (np.mean(spec[band]) + 1e-9))

        deviation = abs(tempo - self.TARGET_BPM)
        s = linear_map(deviation, self.TOLERANCE_BPM, 0.0)

        if too_short:
            msg = (f"動画が短く（{duration:.1f}秒）テンポを正確に測れません。"
                   f"20秒以上で撮影してください。")
        elif s >= 70:
            msg = "テンポが基準に近いです。"
        elif s >= 40:
            fast = tempo > self.TARGET_BPM
            msg = ("この連の踊りに比べるとテンポが速めです。" if fast
                   else "この連の踊りに比べるとテンポが遅めです。")
        else:
            msg = "拍に乗り切れていません。お囃子に合わせて上下動を。"

        return ScoreResult(
            axis=self.axis, score=s, message=msg,
            metrics={"tempo_bpm": round(tempo, 1),
                     "target_bpm": self.TARGET_BPM,
                     "peak_sharpness": round(sharpness, 2),
                     "duration_sec": round(duration, 1),
                     "resolution_bpm": round(resolution_bpm, 1),
                     "reliable": not too_short}, part=self.part,
        )
