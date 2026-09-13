"""複数人対応の骨格描画。踊り手（画面中央）と演奏者を描き分けて目視確認する。

このデータの前提:
  - 踊り手は正面・横どちらの映像でも画面中央に位置する。
  - 演奏者（鳴り物）は正面では左、横では奥に位置する。
そこで「腰の中点が画面中央に最も近い人」を踊り手として選ぶ。
前フレームの踊り手位置も少し加味して、演奏者が中央を横切っても保持する。

出力動画で確認すること:
  1. カラーの骨格（DANCER）が常に踊り手に乗っているか
  2. 演奏者にはグレーの骨格が付き、取り違えていないか
  3. 検出率（暗さで骨格が落ちていないか）

実行（renkei_project 直下で、パスを編集してから）:
    python draw_skeleton_multi.py
"""
from __future__ import annotations

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# ---- パス（4本それぞれについて書き換えて実行）--------------------------
VIDEO_PATH = r"C:\Users\micch\procon\video\male_front.MOV"
MODEL_PATH = r"C:\Users\micch\procon\pose_landmarker_full.task"
OUTPUT_PATH = r"C:\Users\micch\procon\video\male_front_skeleton.mp4"

NUM_POSES = 3          # 踊り手＋演奏者を取りこぼさないよう多めに検出
PREV_WEIGHT = 0.5      # 前フレームの踊り手位置を選択にどれだけ効かせるか

L, R, C = (255, 200, 0), (0, 140, 255), (255, 255, 255)   # 踊り手用 BGR
GREY = (120, 120, 120)                                     # 演奏者用

CONNECTIONS = [
    (11, 12), (23, 24), (11, 23), (12, 24),
    (11, 13), (13, 15), (12, 14), (14, 16),
    (23, 25), (25, 27), (24, 26), (26, 28),
]
LEFT_LINKS = {(11, 13), (13, 15), (23, 25), (25, 27)}
RIGHT_LINKS = {(12, 14), (14, 16), (24, 26), (26, 28)}


def hip_center(landmarks) -> tuple[float, float]:
    """腰の中点（画像座標 0..1）。踊り手選別のキー。"""
    lh, rh = landmarks[23], landmarks[24]
    return ((lh.x + rh.x) / 2.0, (lh.y + rh.y) / 2.0)


def pick_dancer(people, prev):
    """中央に最も近い人を踊り手として選ぶ。prev があれば追跡も加味。"""
    center = np.array([0.5, 0.5])

    def cost(idx):
        c = np.array(hip_center(people[idx]))
        d = np.linalg.norm(c - center)
        if prev is not None:
            d += PREV_WEIGHT * np.linalg.norm(c - np.array(prev))
        return d

    return min(range(len(people)), key=cost)


def draw_person(frame, landmarks, w, h, colored: bool):
    pts = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    for a, b in CONNECTIONS:
        if colored:
            color = L if (a, b) in LEFT_LINKS else R if (a, b) in RIGHT_LINKS else C
            thick = 3
        else:
            color, thick = GREY, 2
        cv2.line(frame, pts[a], pts[b], color, thick)
    if colored:
        for x, y in pts:
            cv2.circle(frame, (x, y), 5, (0, 255, 0), -1)


def main() -> None:
    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=NUM_POSES,
        min_pose_detection_confidence=0.5,
    )

    cap = cv2.VideoCapture(VIDEO_PATH)
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    writer = cv2.VideoWriter(
        OUTPUT_PATH, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    prev_center = None
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

            people = result.pose_landmarks or []
            if people:
                detected += 1
                dancer = pick_dancer(people, prev_center)
                # 演奏者（グレー）を先に描き、踊り手を上に重ねる
                for i, person in enumerate(people):
                    if i != dancer:
                        draw_person(frame, person, w, h, colored=False)
                draw_person(frame, people[dancer], w, h, colored=True)

                cx, cy = hip_center(people[dancer])
                prev_center = (cx, cy)
                cv2.putText(frame, "DANCER", (int(cx * w) - 40, int(cy * h) - 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(frame, f"people detected: {len(people)}",
                            (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                            (0, 255, 255), 2)

            writer.write(frame)
            idx += 1
            if idx % 30 == 0:
                print(f"{idx} フレーム処理...")

    cap.release()
    writer.release()
    rate = 100 * detected / total if total else 0
    print(f"完了: {OUTPUT_PATH}")
    print(f"骨格検出できたフレーム: {detected}/{total} ({rate:.0f}%)")
    if rate < 90:
        print("⚠ 検出率が低め。暗さ対策（CLAHE/heavyモデル）を検討してください。")
    print("動画を再生し、DANCER が常に踊り手に乗っているか確認してください。")


if __name__ == "__main__":
    main()
