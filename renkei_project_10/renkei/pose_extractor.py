"""動画 -> PoseSequence の抽出。MediaPipe Tasks API を使う。

依存(mediapipe, opencv)は関数内で遅延 import する。
これにより採点・DSP 部分は mediapipe 無しでもテスト/実行できる。

事前準備（1 回だけ）:
  pip install mediapipe opencv-python numpy
  モデルをダウンロード:
    https://storage.googleapis.com/mediapipe-models/pose_landmarker/
      pose_landmarker_full/float16/latest/pose_landmarker_full.task
"""
from __future__ import annotations

import numpy as np

from .landmarks import NUM_LANDMARKS, PoseSequence


def extract_pose(video_path: str, model_path: str,
                 max_frames: int | None = None,
                 crop: tuple[float, float, float, float] | None = None,
                 num_poses: int = 1) -> PoseSequence:
    """動画からワールド座標＋画像座標の時系列を取り出す。

    crop: (x0, x1, y0, y1) を 0..1 の割合で指定すると、その範囲だけを
        切り出してから姿勢推定する。踊り手の周囲だけに絞ることで、
        近くに立つ演奏者と手足が混ざって 1 体に合成される事故を防ぐ。
        返す画像座標は元フレーム基準に戻すので、後段の処理は変えなくてよい。
    num_poses: 検出する人数の上限。
    """
    import cv2  # 遅延 import
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=num_poses,
        min_pose_detection_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)   # 縦動画の横倒しを自動補正
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    xyz_frames: list[np.ndarray] = []
    vis_frames: list[np.ndarray] = []
    img_frames: list[np.ndarray] = []

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok or (max_frames and idx >= max_frames):
                break

            H, W = frame.shape[:2]
            if crop is not None:
                x0, x1, y0, y1 = crop
                px0, px1 = int(x0 * W), int(x1 * W)
                py0, py1 = int(y0 * H), int(y1 * H)
                sub = frame[py0:py1, px0:px1]
            else:
                px0, py0 = 0, 0
                px1, py1 = W, H
                sub = frame

            rgb = cv2.cvtColor(sub, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts_ms = int(idx * 1000.0 / fps)
            result = landmarker.detect_for_video(mp_image, ts_ms)

            xyz = np.full((NUM_LANDMARKS, 3), np.nan)
            vis = np.zeros(NUM_LANDMARKS)
            img = np.full((NUM_LANDMARKS, 2), np.nan)

            # ワールド座標: 腰中点が原点の 3D。関節角度の計算用。
            if result.pose_world_landmarks:
                for j, lm in enumerate(result.pose_world_landmarks[0]):
                    xyz[j] = (lm.x, lm.y, lm.z)
                    vis[j] = lm.visibility
            # 画像座標: 体の上下動＝リズム解析用。
            # 切り出した場合は元フレーム基準の割合に戻す。
            if result.pose_landmarks:
                sw, sh = px1 - px0, py1 - py0
                for j, lm in enumerate(result.pose_landmarks[0]):
                    img[j] = ((px0 + lm.x * sw) / W, (py0 + lm.y * sh) / H)

            xyz_frames.append(xyz)
            vis_frames.append(vis)
            img_frames.append(img)
            idx += 1

    cap.release()
    return PoseSequence(
        np.array(xyz_frames), np.array(vis_frames), fps,
        xy_image=np.array(img_frames),
    )
