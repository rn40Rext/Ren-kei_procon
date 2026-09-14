"""姿勢推定モデル（MediaPipe Pose Landmarker .task）を models/ に取得する。

    python download_model.py            # full（既定）
    python download_model.py --variant lite

models/ は git 管理外（.gitignore）。score_video.py / export_pose_series.py は
環境変数 RENKEI_POSE_MODEL が無ければ models/pose_landmarker_full.task を使う。
アプリ側（Ren-kei_procon/src/features/pose/PoseDetector.web.ts）と同じ配布元・版。
"""
from __future__ import annotations

import argparse
import os
import sys
import urllib.request

BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker"
URLS = {
    "lite": f"{BASE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full": f"{BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": f"{BASE}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--variant", choices=sorted(URLS), default="full")
    args = p.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "models")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"pose_landmarker_{args.variant}.task")
    if os.path.isfile(out):
        print(f"既にあります: {out}")
        return 0
    print(f"取得中: {URLS[args.variant]}")
    urllib.request.urlretrieve(URLS[args.variant], out)
    print(f"保存: {out} ({os.path.getsize(out) / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
