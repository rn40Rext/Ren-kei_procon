"""汚染を除いた骨格抽出。切り出し＋妥当性検証をまとめて実行する。

手順:
  1. preview_crop.py で切り出し範囲を確定する（演奏者を枠外に出す）
  2. その値を CROP に書き写してこれを実行
  3. レポートで「使えるフレーム」が十分あるか確認
  4. 結果は .npz に保存され、後段（往復の区切り・基準値算出）で読み込む

実行（renkei_project 直下で）:
    python extract_clean.py
"""
from __future__ import annotations

import numpy as np

from renkei.pose_extractor import extract_pose
from renkei.validate import describe_runs, validate

# ---- 対象（4本それぞれ書き換えて実行）----------------------------------
VIDEO_PATH = r"C:\Users\micch\procon\video\male_side.MOV"
MODEL_PATH = r"C:\Users\micch\procon\pose_landmarker_full.task"
OUTPUT_NPZ = r"C:\Users\micch\procon\video\male_side_pose.npz"

# preview_crop.py で確定した値を入れる (x0, x1, y0, y1)
CROP = (0.10, 0.72, 0.0, 1.0)


def main() -> None:
    print(f"抽出中: {VIDEO_PATH}")
    print(f"切り出し: {CROP}")
    seq = extract_pose(VIDEO_PATH, MODEL_PATH, crop=CROP)
    print(f"{seq.num_frames} フレーム / fps={seq.fps:.1f}\n")

    result = validate(seq)
    st = result["stats"]

    print("=" * 54)
    print("骨格の妥当性レポート")
    print("=" * 54)
    print(f"  全フレーム      : {st['total']}")
    print(f"  検出できた      : {st['detected']} "
          f"({100*st['detected']/st['total']:.1f}%)")
    print(f"  合成と判定      : {st['merged']} "
          f"({100*st['merged']/st['total']:.1f}%)")
    print(f"  使えるフレーム  : {st['valid']} ({st['valid_pct']:.1f}%)")
    print(f"  左右骨長比 中央値: {st['median_ratio']:.2f}  (1.0が理想)")

    bad_runs = describe_runs(~result["valid"], seq.fps)
    if bad_runs:
        print("\n  除外した区間:")
        for r in bad_runs[:12]:
            print(f"    {r}")
        if len(bad_runs) > 12:
            print(f"    ... 他 {len(bad_runs)-12} 区間")

    if st["valid_pct"] < 80:
        print("\n⚠ 使えるフレームが少なめです。")
        print("  切り出し範囲をもっと狭めて演奏者を確実に除外するか、")
        print("  モデルを heavy に変えて再実行してください。")
    else:
        print("\n✓ 十分なフレームが確保できました。")

    np.savez_compressed(
        OUTPUT_NPZ,
        xyz=seq.xyz, visibility=seq.visibility,
        xy_image=seq.xy_image, fps=seq.fps,
        valid=result["valid"], ratio=result["ratio"],
    )
    print(f"\n保存: {OUTPUT_NPZ}")


if __name__ == "__main__":
    main()
