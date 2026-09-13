"""往復・ステップの区切りを可視化して確認するツール。

extract_clean.py が保存した .npz を読み込み、
  - 左右移動から「往復の折り返し」
  - 上下動から「ステップ周期」
を検出して、グラフと数値で示す。

出力される PNG で、折り返しが実際の往復（5 回）と合っているか、
ステップが踊りの拍と合っているかを目で確認する。

実行（renkei_project 直下で）:
    python segment_cycles.py
"""
from __future__ import annotations

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from renkei.cycles import detect_round_trips, detect_steps
from renkei.landmarks import PoseSequence

# ---- 対象（4本それぞれ書き換えて実行）----------------------------------
NPZ_PATH = r"C:\Users\micch\procon\video\male_front_pose.npz"
OUT_PNG = r"C:\Users\micch\procon\video\male_front_cycles.png"

# 折り返し同士の最小間隔[秒]。検出が多すぎ/少なすぎるとき調整する。
MIN_TURN_SECONDS = 1.5


def load_sequence(path: str) -> tuple[PoseSequence, np.ndarray]:
    d = np.load(path)
    seq = PoseSequence(d["xyz"], d["visibility"], float(d["fps"]),
                       xy_image=d["xy_image"])
    valid = d["valid"] if "valid" in d else np.ones(seq.num_frames, bool)
    return seq, valid


def main() -> None:
    seq, valid = load_sequence(NPZ_PATH)
    dur = seq.num_frames / seq.fps
    print(f"読み込み: {NPZ_PATH}")
    print(f"{seq.num_frames} フレーム / {dur:.1f} 秒 / fps={seq.fps:.1f}")
    print(f"有効フレーム: {int(valid.sum())} ({100*valid.mean():.1f}%)\n")

    rt = detect_round_trips(seq, min_seconds=MIN_TURN_SECONDS)
    st = detect_steps(seq)

    t = np.arange(seq.num_frames) / seq.fps
    fig, axes = plt.subplots(3, 1, figsize=(13, 10), sharex=True)

    # --- 1. 左右移動と折り返し ---
    ax = axes[0]
    ax.plot(t, rt["signal"], lw=0.9, alpha=0.45, color="tab:gray", label="raw")
    ax.plot(t, rt["smooth"], lw=1.8, color="tab:blue", label="smoothed")
    for i, ti in enumerate(rt["turn_times"]):
        ax.axvline(ti, color="tab:red", ls="--", lw=1.4,
                   label="turning point" if i == 0 else None)
    ax.set_ylabel("Lateral position")
    ax.set_title(f"Round trips: {rt['num_turns']} turning points, "
                 f"{len(rt['segments'])} segments")
    ax.legend(fontsize=8, loc="upper right")
    ax.grid(alpha=0.3)

    # --- 2. 上下動とステップ ---
    ax = axes[1]
    ax.plot(t, st["signal"], lw=0.9, alpha=0.45, color="tab:gray", label="raw")
    ax.plot(t, st["smooth"], lw=1.4, color="tab:green", label="smoothed")
    ax.plot(st["peak_times"], st["smooth"][st["peak_indices"]], "v",
            color="tab:orange", ms=6, label="step")
    ax.set_ylabel("Vertical motion")
    tempo = st["tempo_bpm"]
    ax.set_title(f"Steps: {st['step_count']} detected"
                 + (f", tempo {tempo:.1f} BPM" if tempo else ""))
    ax.legend(fontsize=8, loc="upper right")
    ax.grid(alpha=0.3)

    # --- 3. 有効フレーム（除外区間の位置）---
    ax = axes[2]
    ax.fill_between(t, 0, valid.astype(float), step="mid",
                    color="tab:green", alpha=0.5)
    ax.set_ylim(-0.1, 1.2)
    ax.set_ylabel("Valid")
    ax.set_xlabel("Time [s]")
    ax.set_title("Valid frames (green = usable, gaps = excluded)")
    ax.grid(alpha=0.3)

    fig.tight_layout()
    fig.savefig(OUT_PNG, dpi=115)
    print(f"グラフを保存: {OUT_PNG}\n")

    # ---- 数値レポート ----
    print("=" * 56)
    print("往復（左右の折り返し）")
    print("=" * 56)
    print(f"  折り返し回数: {rt['num_turns']}")
    print(f"  時刻[秒]: {np.round(rt['turn_times'], 1)}")
    if len(rt["segments"]):
        lens = [(b - a) / seq.fps for a, b in rt["segments"]]
        print(f"  区間長: 平均 {np.mean(lens):.2f}秒 "
              f"/ ばらつき {np.std(lens):.2f}秒")
    print("  ※ 実際の往復回数と合っているか確認。多すぎる場合は")
    print("     MIN_TURN_SECONDS を大きくしてください。")

    print("\n" + "=" * 56)
    print("ステップ（基本動作の周期）")
    print("=" * 56)
    print(f"  検出したステップ数: {st['step_count']}")
    if st["tempo_bpm"]:
        print(f"  テンポ: {st['tempo_bpm']:.1f} BPM")
    if st["interval_mean"]:
        print(f"  ステップ間隔: 平均 {st['interval_mean']:.3f}秒 "
              f"/ 標準偏差 {st['interval_std']:.3f}秒")
        cv = st["interval_std"] / st["interval_mean"]
        print(f"  ばらつき(変動係数): {cv:.3f}")
        print("  ※ 熟練者のこの値が「リズムの許容幅」の実測根拠になります。")


if __name__ == "__main__":
    main()
