"""骨格を動画に重ねて描画し、検出が正しいか目視確認するツール。

描画には画像座標(pose_landmarks; 0..1)を使う。採点で使うワールド座標は
3D なので画面に直接描けないため、こちらは別に取り出す。
一方、画面に出す膝角度は採点と同じワールド座標から計算する（数字の整合性のため）。

実行（renkei_project 直下で）:
    python draw_skeleton.py
実行後、OUTPUT_PATH の動画を再生して関節が正しく乗っているか確認する。
"""
from __future__ import annotations

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# ---- パス（自分の環境に合わせて）----------------------------------------
VIDEO_PATH = r"C:\Users\micch\procon\video\test.MOV"
MODEL_PATH = r"C:\Users\micch\procon\pose_landmarker_full.task"
OUTPUT_PATH = r"C:\Users\micch\procon\video\test_skeleton.mp4"

# ---- 色分け（左=水色 / 右=オレンジ / 中央=白）----------------------------
# 左右を色で分けると「左右が入れ替わって拾われている」ミスに気づきやすい。
# 注意: MediaPipe の左右は“本人視点”なので、画面上では鏡写しに見える。
L, R, C = (255, 200, 0), (0, 140, 255), (255, 255, 255)   # BGR

# 描画する骨格の接続（関節番号 a, b, 色）
CONNECTIONS = [
    (11, 12, C), (23, 24, C),          # 肩ライン・腰ライン
    (11, 23, C), (12, 24, C),          # 胴体の左右
    (11, 13, L), (13, 15, L),          # 左腕（肩-肘-手首）
    (12, 14, R), (14, 16, R),          # 右腕
    (23, 25, L), (25, 27, L),          # 左脚（腰-膝-足首）
    (24, 26, R), (26, 28, R),          # 右脚
]


def angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """点 b を頂点とする角 ABC を度で返す（3D 単一点）。採点と同じ計算。"""
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-9)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def main() -> None:
    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
    )

    cap = cv2.VideoCapture(VIDEO_PATH)
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)   # 縦動画の横倒しを自動補正
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    writer = cv2.VideoWriter(
        OUTPUT_PATH, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h)
    )

    detected, total = 0, 0
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            total += 1

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(mp_image, int(idx * 1000 / fps))

            if result.pose_landmarks:
                detected += 1
                lms = result.pose_landmarks[0]                 # 画像座標(0..1)
                pts = [(int(lm.x * w), int(lm.y * h)) for lm in lms]

                for a, b, color in CONNECTIONS:                # 骨（線）
                    cv2.line(frame, pts[a], pts[b], color, 3)
                for x, y in pts:                               # 関節（点）
                    cv2.circle(frame, (x, y), 5, (0, 255, 0), -1)

                # 膝角度はワールド座標から計算して左上に表示（採点と同じ量）
                if result.pose_world_landmarks:
                    wl = result.pose_world_landmarks[0]
                    def P(i): return np.array([wl[i].x, wl[i].y, wl[i].z])
                    lk = angle(P(23), P(25), P(27))
                    rk = angle(P(24), P(26), P(28))
                    cv2.putText(frame, f"L knee {lk:.0f} / R knee {rk:.0f} deg",
                                (20, 50), cv2.FONT_HERSHEY_SIMPLEX,
                                1.0, (0, 255, 255), 2)

            writer.write(frame)
            idx += 1
            if idx % 30 == 0:
                print(f"{idx} フレーム処理...")

    cap.release()
    writer.release()
    rate = 100 * detected / total if total else 0
    print(f"完了: {OUTPUT_PATH}")
    print(f"骨格検出できたフレーム: {detected}/{total} ({rate:.0f}%)")
    print("動画を再生して、関節が体に正しく乗っているか確認してください。")


if __name__ == "__main__":
    main()
