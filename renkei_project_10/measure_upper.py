"""上半身の閾値を実測するツール。

ArmFormScorer / HandSpreadScorer の目標値は指導映像の見た目からの
暫定値なので、熟練者のデータで実測して置き換える。

複数の .npz をまとめて比べられるようにしてある。
熟練者と自分の値を並べると、どこが違うのかがそのまま分かる。

実行（renkei_project 直下で）:
    python measure_upper.py
"""
from __future__ import annotations

import numpy as np

from renkei.features import interpolate_nans, joint_angle
from renkei.landmarks import Lm, PoseSequence
from renkei.scorers import detect_view

# ---- 比較したい .npz を並べる（ラベル, パス）--------------------------
TARGETS = [
    ("熟練者・正面", r"C:\Users\micch\procon\video\male_front_pose.npz"),
    ("熟練者・横",   r"C:\Users\micch\procon\video\male_side_pose.npz"),
    ("自分",         r"C:\Users\micch\procon\video\matsumae_pose.npz"),
]


def load(path: str) -> tuple[PoseSequence, np.ndarray]:
    d = np.load(path)
    seq = PoseSequence(d["xyz"], d["visibility"], float(d["fps"]),
                       xy_image=d["xy_image"])
    valid = d["valid"] if "valid" in d else np.ones(seq.num_frames, bool)
    return seq, valid


def measure(seq: PoseSequence, valid: np.ndarray) -> dict:
    """上半身の各指標を、有効フレームだけで集計する。"""
    # --- 肘角度 ---
    elbows = []
    for sh, el, wr in ((Lm.L_SHOULDER, Lm.L_ELBOW, Lm.L_WRIST),
                       (Lm.R_SHOULDER, Lm.R_ELBOW, Lm.R_WRIST)):
        elbows.append(joint_angle(seq.joint(sh), seq.joint(el), seq.joint(wr)))
    elbow = np.nanmean(elbows, axis=0)[valid]

    # --- 手首間の距離 / 肩幅 ---
    shoulder_w = np.linalg.norm(
        seq.joint(Lm.L_SHOULDER) - seq.joint(Lm.R_SHOULDER), axis=1)
    wrist_w = np.linalg.norm(
        seq.joint(Lm.L_WRIST) - seq.joint(Lm.R_WRIST), axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        spread = (wrist_w / np.where(shoulder_w > 1e-6, shoulder_w, np.nan))[valid]

    # --- 手首が鼻より上にあった割合 ---
    keep = None
    if seq.has_image_coords:
        ref = interpolate_nans(seq.joint_image(Lm.NOSE)[:, 1])
        lw = interpolate_nans(seq.joint_image(Lm.L_WRIST)[:, 1])
        rw = interpolate_nans(seq.joint_image(Lm.R_WRIST)[:, 1])
        keep = 0.5 * (np.mean((lw < ref)[valid]) + np.mean((rw < ref)[valid]))

    view, _, conf = detect_view(seq)

    def stats(x):
        x = x[np.isfinite(x)]
        if x.size == 0:
            return None
        return {"median": float(np.median(x)),
                "p25": float(np.percentile(x, 25)),
                "p75": float(np.percentile(x, 75))}

    return {"view": view, "view_conf": conf,
            "elbow": stats(elbow), "spread": stats(spread),
            "keep_ratio": None if keep is None else float(keep),
            "frames": int(valid.sum())}


def main() -> None:
    rows = []
    for label, path in TARGETS:
        try:
            seq, valid = load(path)
        except Exception as e:                     # noqa: BLE001
            print(f"[スキップ] {label}: {e}")
            continue
        rows.append((label, measure(seq, valid)))

    if not rows:
        print("読み込めるデータがありませんでした。TARGETS のパスを確認してください。")
        return

    print("=" * 72)
    print("上半身の実測値")
    print("=" * 72)
    print(f"{'':<14}{'視点':<8}{'肘角度(中央値)':>16}{'手首間/肩幅':>14}"
          f"{'頭上キープ':>12}")
    print("-" * 72)
    for label, m in rows:
        el = f"{m['elbow']['median']:.1f}度" if m["elbow"] else "--"
        sp = f"{m['spread']['median']:.2f}" if m["spread"] else "--"
        kp = f"{m['keep_ratio']:.3f}" if m["keep_ratio"] is not None else "--"
        print(f"{label:<14}{m['view']:<8}{el:>16}{sp:>14}{kp:>12}")

    print("\n--- 詳細（四分位）---")
    for label, m in rows:
        print(f"\n[{label}]  有効 {m['frames']} フレーム")
        if m["elbow"]:
            e = m["elbow"]
            print(f"  肘角度      : {e['p25']:.1f} - {e['median']:.1f} "
                  f"- {e['p75']:.1f} 度")
        if m["spread"]:
            s = m["spread"]
            print(f"  手首間/肩幅 : {s['p25']:.2f} - {s['median']:.2f} "
                  f"- {s['p75']:.2f}")

    # --- 閾値の提案（熟練者・正面を基準にする）---
    expert = next((m for label, m in rows if "熟練" in label
                   and m["view"] == "front"), None)
    if expert and expert["elbow"] and expert["spread"]:
        print("\n" + "=" * 72)
        print("推奨する閾値（熟練者・正面の実測より）")
        print("=" * 72)
        e, s = expert["elbow"], expert["spread"]
        print("  upper_body.py の ArmFormScorer:")
        print(f"    TARGET_ANGLE = {e['median']:.0f}")
        print(f"    TOLERANCE    = {max(40, (e['p75']-e['p25'])*2.5):.0f}"
              f"   # 四分位幅の2.5倍")
        print("\n  upper_body.py の HandSpreadScorer:")
        print(f"    TARGET_RATIO = {s['median']:.2f}")
        print(f"    TOLERANCE    = {max(0.6, (s['p75']-s['p25'])*2.5):.2f}")
        print("\n  ※ 横向きの映像は奥側の手足が隠れて値がずれるため、")
        print("     上半身の基準は正面の映像から取ること。")


if __name__ == "__main__":
    main()
