"""動画から姿勢系列 JSON（pose-series-v1）を書き出す。

アプリ側（AI②: FN-02 / FN-08）が読む形式:
    { "formatVersion": "pose-series-v1",
      "frames": [ { "timestampMs": 0, "landmarks": [ {x, y, visibility} x33 ] }, ... ] }
座標は画像座標（0..1、y は下向き正）。functions/src/style/pose.ts の PoseSeries と同形。

使い方:
    python export_pose_series.py 踊りの動画.MOV -o out.pose.json
    python export_pose_series.py dance.mp4 --crop 0.15 0.9 0 1.0 --max-fps 15

連の参照動画（renStyleReferences）を登録するときは、出力した JSON を
Storage の ren/{renId}/styleReferences/{referenceId}.pose.json に置き、
FN-08 registerStyleReference を呼ぶ（docs/design/api-functions.md）。
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from score_video import MODEL_PATH


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="動画 -> 姿勢系列 JSON (pose-series-v1)")
    p.add_argument("video", help="入力動画")
    p.add_argument("-o", "--output", help="出力 JSON。既定は <動画名>.pose.json")
    p.add_argument("--model", default=MODEL_PATH, help="姿勢推定モデル(.task)")
    p.add_argument("--crop", nargs=4, type=float, metavar=("X0", "X1", "Y0", "Y1"),
                   help="切り出し範囲(0..1)。他の人が映り込む場合に使う")
    p.add_argument("--max-fps", type=float, default=15.0,
                   help="記録する最大フレームレート（既定 15。アプリ側の記録レートと同じ）")
    return p


def to_series(seq, max_fps: float) -> dict:
    """PoseSequence -> pose-series-v1 の dict。検出できなかったフレームは省く。"""
    import numpy as np

    frames = []
    min_interval = 1000.0 / max_fps if max_fps > 0 else 0.0
    last_kept = -1e18
    for i in range(seq.num_frames):
        ts = i * 1000.0 / seq.fps
        if ts - last_kept < min_interval:
            continue
        xy = seq.xy_image[i]
        if not np.isfinite(xy).all():
            continue
        last_kept = ts
        vis = seq.visibility[i]
        frames.append({
            "timestampMs": int(round(ts)),
            "landmarks": [
                {"x": round(float(xy[j, 0]), 4), "y": round(float(xy[j, 1]), 4),
                 "visibility": round(float(vis[j]), 4)}
                for j in range(xy.shape[0])
            ],
        })
    return {"formatVersion": "pose-series-v1", "frames": frames}


def main() -> int:
    args = build_parser().parse_args()
    if not os.path.isfile(args.video):
        print(f"[エラー] 動画が見つかりません: {args.video}")
        return 1
    if not os.path.isfile(args.model):
        print(f"[エラー] モデルが見つかりません: {args.model}（python download_model.py で取得）")
        return 1

    from renkei.pose_extractor import extract_pose

    crop = tuple(args.crop) if args.crop else None
    seq = extract_pose(args.video, args.model, crop=crop)
    if seq.num_frames == 0 or seq.xy_image is None:
        print("[エラー] 動画からフレームを読めませんでした。")
        return 1

    series = to_series(seq, args.max_fps)
    out = args.output or os.path.splitext(args.video)[0] + ".pose.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(series, f, ensure_ascii=False)
    print(f"書き出し: {out}  ({len(series['frames'])} フレーム / "
          f"{seq.num_frames / seq.fps:.1f} 秒 / 検出 {len(series['frames'])}"
          f"/{seq.num_frames})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
