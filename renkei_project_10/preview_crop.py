"""切り出し範囲のプレビュー。演奏者が範囲外になっているか目で確認する。

姿勢推定をかける前に、切り出し枠を静止画に描いて確認するためのツール。
枠の中に演奏者が入っていなければ、手足が混ざって 1 体に合成される事故を防げる。

使い方:
  1. 下の CROP を仮の値で実行 -> PNG を見る
  2. 演奏者が枠に入っていたら CROP を狭めて再実行
  3. 確定したら、その値を extract_clean.py の CROP に書き写す

実行（renkei_project 直下で）:
    python preview_crop.py
"""
from __future__ import annotations

import cv2
import numpy as np

VIDEO_PATH = r"C:\Users\micch\procon\video\male_side.MOV"
OUTPUT_PATH = r"C:\Users\micch\procon\video\crop_preview.jpg"

# (x0, x1, y0, y1) を 0..1 の割合で指定。
# 男・横は演奏者が画面奥（右寄り）なので右を削る。
# 男・正面は演奏者が画面左なので左を削る。
CROP = (0.10, 0.72, 0.0, 1.0)

# 確認するフレームの時刻[秒]（合成が起きていた区間を入れておくとよい）
TIMES = [0.0, 0.5, 1.0, 4.5]


def main() -> None:
    cap = cv2.VideoCapture(VIDEO_PATH)
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    tiles = []
    for t in TIMES:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, frame = cap.read()
        if not ok:
            continue
        h, w = frame.shape[:2]
        x0, x1, y0, y1 = CROP
        p0 = (int(x0 * w), int(y0 * h))
        p1 = (int(x1 * w), int(y1 * h))

        # 枠の外を暗くして、何が除外されるか一目で分かるようにする
        dark = (frame * 0.3).astype(np.uint8)
        dark[p0[1]:p1[1], p0[0]:p1[0]] = frame[p0[1]:p1[1], p0[0]:p1[0]]
        cv2.rectangle(dark, p0, p1, (0, 255, 0), 3)
        cv2.putText(dark, f"{t}s", (12, 40), cv2.FONT_HERSHEY_SIMPLEX,
                    1.1, (0, 0, 255), 3)
        tiles.append(cv2.resize(dark, (360, int(360 * h / w))))

    cap.release()
    if not tiles:
        print("フレームを読めませんでした。パスを確認してください。")
        return

    out = np.hstack(tiles)
    cv2.imwrite(OUTPUT_PATH, out, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(f"保存: {OUTPUT_PATH}")
    print(f"CROP = {CROP}")
    print("明るい部分だけが姿勢推定にかけられます。")
    print("演奏者が明るい枠の中に入っていたら、CROP を狭めて再実行してください。")


if __name__ == "__main__":
    main()
