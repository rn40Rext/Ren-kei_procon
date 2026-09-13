"""較正ツール: 実データから採点の閾値を決め、その根拠をグラフで示す。

やること:
  1. 膝角度の時系列と分布  -> 腰の低さの閾値(FULL_MARK_ANGLE)を実測で決める
  2. 上下動の波形          -> リズムの入力信号が妥当か目視する
  3. FFT スペクトル        -> 目標テンポ(TARGET_BPM)を実測で決める

出力される PNG は、そのまま「なぜこの採点基準なのか」の証拠資料になる。

実行（renkei_project 直下で）:
    python calibrate.py

グラフのラベルは英語。日本語フォントが無い環境で文字化け(豆腐)するのを
避けるため。考察は日本語でコンソールに出る。
"""
from __future__ import annotations

import matplotlib
matplotlib.use("Agg")          # 画面表示せず PNG に保存する
import matplotlib.pyplot as plt
import numpy as np

from renkei.features import interpolate_nans, knee_flexion, vertical_signal
from renkei.landmarks import PoseSequence
from renkei.scorers.rhythm import estimate_tempo

# ---- パス（自分の環境に合わせて）----------------------------------------
VIDEO_PATH = r"C:\Users\micch\procon\video\test.MOV"
MODEL_PATH = r"C:\Users\micch\procon\pose_landmarker_full.task"
OUT_PREFIX = r"C:\Users\micch\procon\video\calib"


# =========================================================================
#  1. 膝角度の解析
# =========================================================================
def analyze_knee(seq: PoseSequence, ax_ts, ax_hist) -> dict:
    """膝角度の時系列と分布を描き、閾値の推奨値を返す。"""
    t = np.arange(seq.num_frames) / seq.fps
    left = knee_flexion(seq, "L")
    right = knee_flexion(seq, "R")
    both = np.nanmean([left, right], axis=0)
    valid = both[np.isfinite(both)]

    # --- 時系列 ---
    ax_ts.plot(t, left, lw=1.2, alpha=0.8, label="Left knee")
    ax_ts.plot(t, right, lw=1.2, alpha=0.8, label="Right knee")
    ax_ts.axhline(np.nanmean(both), color="k", ls="--", lw=1,
                  label=f"mean {np.nanmean(both):.0f} deg")
    ax_ts.set_xlabel("Time [s]")
    ax_ts.set_ylabel("Knee flexion [deg]")
    ax_ts.set_title("Knee angle over time (180=straight, small=deep squat)")
    ax_ts.legend(fontsize=8)
    ax_ts.grid(alpha=0.3)

    # --- 分布 ---
    ax_hist.hist(valid, bins=40, color="tab:blue", alpha=0.75)
    stats = {}
    if valid.size:
        for p, color in ((5, "tab:red"), (50, "k"), (95, "tab:orange")):
            v = np.percentile(valid, p)
            stats[f"p{p}"] = float(v)
            ax_hist.axvline(v, color=color, ls="--", lw=1.2,
                            label=f"p{p} = {v:.0f} deg")
        ax_hist.legend(fontsize=8)
    ax_hist.set_xlabel("Knee flexion [deg]")
    ax_hist.set_ylabel("Frames")
    ax_hist.set_title("Distribution of knee angle")
    ax_hist.grid(alpha=0.3)

    return {
        "mean": float(np.nanmean(both)) if valid.size else float("nan"),
        "min": float(np.nanmin(both)) if valid.size else float("nan"),
        "max": float(np.nanmax(both)) if valid.size else float("nan"),
        "range": float(np.nanmax(both) - np.nanmin(both)) if valid.size else 0.0,
        **stats,
    }


# =========================================================================
#  2 & 3. 上下動とスペクトルの解析
# =========================================================================
def analyze_rhythm(seq: PoseSequence, ax_sig, ax_spec) -> dict:
    """上下動の波形と FFT スペクトルを描き、テンポの推奨値を返す。"""
    if not seq.has_image_coords:
        for ax in (ax_sig, ax_spec):
            ax.text(0.5, 0.5, "No image coords", ha="center", va="center")
        return {"error": "画像座標がありません"}

    sig = interpolate_nans(vertical_signal(seq))
    t = np.arange(len(sig)) / seq.fps
    duration = len(sig) / seq.fps
    resolution_bpm = 60.0 / duration

    # --- 時間波形（トレンド除去後を重ねて見せる）---
    detrended = sig - np.polyval(np.polyfit(t, sig, 1), t)
    ax_sig.plot(t, detrended, lw=1.2, color="tab:green")
    ax_sig.set_xlabel("Time [s]")
    ax_sig.set_ylabel("Vertical motion [torso units]")
    ax_sig.set_title(f"Body bobbing signal (std={np.std(sig):.4f})")
    ax_sig.grid(alpha=0.3)

    # --- スペクトル ---
    tempo, peak_hz, freqs, spec = estimate_tempo(sig, seq.fps)
    if not np.isfinite(tempo):
        ax_spec.text(0.5, 0.5, "No peak found", ha="center", va="center")
        return {"error": "ピークが見つかりません"}

    bpm_axis = freqs * 60.0
    ax_spec.plot(bpm_axis, spec, lw=1.2, color="tab:purple")
    ax_spec.axvspan(60, 240, color="gray", alpha=0.12, label="search band")
    ax_spec.axvline(tempo, color="r", ls="--", lw=1.5,
                    label=f"peak {tempo:.1f} BPM")

    # 上位3ピークを拾う（倍音／半分のテンポを見抜くため）
    band_idx = np.where((freqs >= 1.0) & (freqs <= 4.0))[0]
    top = band_idx[np.argsort(spec[band_idx])[::-1][:3]] if band_idx.size else []
    peaks = [(float(freqs[i] * 60.0), float(spec[i])) for i in top]
    for bpm_v, _ in peaks[1:]:
        ax_spec.axvline(bpm_v, color="tab:orange", ls=":", lw=1,
                        label=f"2nd/3rd {bpm_v:.0f} BPM")

    ax_spec.set_xlim(0, 300)
    ax_spec.set_xlabel("Tempo [BPM]")
    ax_spec.set_ylabel("Magnitude")
    ax_spec.set_title(f"FFT spectrum (resolution {resolution_bpm:.1f} BPM/bin)")
    ax_spec.legend(fontsize=8)
    ax_spec.grid(alpha=0.3)

    return {
        "tempo_bpm": float(tempo),
        "duration_sec": float(duration),
        "resolution_bpm": float(resolution_bpm),
        "signal_std": float(np.std(sig)),
        "top_peaks": peaks,
        "reliable": bool(resolution_bpm <= 5.0),
    }


# =========================================================================
#  レポート
# =========================================================================
def report(knee: dict, rhythm: dict, seq: PoseSequence) -> None:
    detect_rate = 100.0 * np.mean(np.isfinite(seq.xyz[:, 25, 0]))
    print("=" * 58)
    print("較正レポート")
    print("=" * 58)
    print(f"フレーム数 : {seq.num_frames}  /  fps: {seq.fps:.1f}")
    print(f"骨格検出率 : {detect_rate:.0f}%")

    print("\n--- 膝角度（腰の低さ）------------------------------------")
    print(f"  平均 {knee['mean']:.1f}度 / 最小 {knee['min']:.1f}度 "
          f"/ 最大 {knee['max']:.1f}度")
    print(f"  可動範囲 {knee['range']:.1f}度  "
          f"(小さいと動きが硬い / 大きいとよく屈伸している)")
    if "p5" in knee:
        print(f"  5%点 {knee['p5']:.0f}度 / 中央 {knee['p50']:.0f}度 "
              f"/ 95%点 {knee['p95']:.0f}度")
        print("\n  [推奨] hip_lowness.py の閾値:")
        print(f"    FULL_MARK_ANGLE = {knee['mean']:.0f}"
              f"   # この動画の平均を満点の基準にする場合")
        print(f"    ZERO_MARK_ANGLE = {max(knee['p95'], 170):.0f}"
              f"   # 立っている状態")
        print("  ※ 熟練者の動画で測った値を入れるのが本筋。"
              "初心者の動画なら『目標』にはならない。")

    print("\n--- リズム -----------------------------------------------")
    if "error" in rhythm:
        print(f"  解析できません: {rhythm['error']}")
        return
    print(f"  動画長 {rhythm['duration_sec']:.1f}秒 "
          f"-> 分解能 {rhythm['resolution_bpm']:.1f} BPM/ビン")
    print(f"  上下動の大きさ(std) {rhythm['signal_std']:.4f}")
    print(f"  推定テンポ {rhythm['tempo_bpm']:.1f} BPM")
    if rhythm["top_peaks"]:
        cand = " / ".join(f"{b:.0f}BPM" for b, _ in rhythm["top_peaks"])
        print(f"  ピーク上位3: {cand}")
        print("  ※ 2倍・半分の関係なら倍音。実際の拍がどれか動画と照合を。")
    if not rhythm["reliable"]:
        print("\n  [警告] 動画が短く、テンポの推定値は信用できません。")
        print("         20秒以上（できれば30秒）で撮り直してください。")
    else:
        print("\n  [推奨] rhythm.py の閾値:")
        print(f"    TARGET_BPM = {rhythm['tempo_bpm']:.0f}")
        print("  ※ お囃子に合わせた熟練者の動画で測ること。")


def main() -> None:
    from renkei.pose_extractor import extract_pose

    print(f"動画を解析中: {VIDEO_PATH}")
    seq = extract_pose(VIDEO_PATH, MODEL_PATH)
    print(f"{seq.num_frames} フレーム抽出完了\n")

    fig, axes = plt.subplots(2, 2, figsize=(14, 9))
    knee = analyze_knee(seq, axes[0, 0], axes[0, 1])
    rhythm = analyze_rhythm(seq, axes[1, 0], axes[1, 1])
    fig.suptitle("Ren-Kei calibration report", fontsize=14)
    fig.tight_layout()

    out = f"{OUT_PREFIX}_report.png"
    fig.savefig(out, dpi=120)
    print(f"グラフを保存: {out}\n")

    report(knee, rhythm, seq)


if __name__ == "__main__":
    main()
