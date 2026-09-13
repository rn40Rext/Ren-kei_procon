"""骨格ランドマークの定義とデータ構造。

MediaPipe Pose は 1 人あたり 33 点の関節を、2 つの座標系で返す。

1) ワールド座標 (xyz): 腰の中点を原点とするメートル系の 3D。
   注意: 原点が腰なので「腰の絶対位置」は常にゼロで、体の上下動は表せない。
   関節角度など、平行移動に依らない量の計算に使う。

2) 画像座標 (xy_image): 画面上の位置を 0..1 に正規化した 2D。
   こちらは体が画面内で上下に弾む動きを保持しているので、リズム解析に使う。
   y は下向きが正（画像の慣習）だが、FFT の振幅は符号に依らないので問題ない。

この 2 系統を使い分けるのが重要。混同すると「常にゼロの信号」を
解析してしまい、ノイズから無意味なテンポが出る。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum

import numpy as np


class Lm(IntEnum):
    """よく使う関節のインデックス（MediaPipe Pose の 33 点定義）。"""
    NOSE = 0
    L_SHOULDER = 11
    R_SHOULDER = 12
    L_ELBOW = 13
    R_ELBOW = 14
    L_WRIST = 15
    R_WRIST = 16
    L_HIP = 23
    R_HIP = 24
    L_KNEE = 25
    R_KNEE = 26
    L_ANKLE = 27
    R_ANKLE = 28


NUM_LANDMARKS = 33


@dataclass
class PoseSequence:
    """1 本の動画から抽出した時系列の骨格。

    xyz:        shape (T, 33, 3) ワールド座標 [m]。腰中点が原点。角度計算用。
    visibility: shape (T, 33)    各関節の可視信頼度 0..1。
    fps:        サンプリング周波数（DSP でそのまま使う）。
    xy_image:   shape (T, 33, 2) 画像座標 0..1。上下動＝リズム解析用。
                省略可（None）だが、その場合リズム採点は使えない。
    """
    xyz: np.ndarray
    visibility: np.ndarray
    fps: float
    xy_image: np.ndarray | None = None

    def __post_init__(self) -> None:
        assert self.xyz.ndim == 3 and self.xyz.shape[1:] == (NUM_LANDMARKS, 3), \
            f"xyz は (T,33,3) が必要: {self.xyz.shape}"
        assert self.visibility.shape == self.xyz.shape[:2]
        if self.xy_image is not None:
            assert self.xy_image.shape == (self.num_frames, NUM_LANDMARKS, 2), \
                f"xy_image は (T,33,2) が必要: {self.xy_image.shape}"

    @property
    def num_frames(self) -> int:
        return self.xyz.shape[0]

    @property
    def has_image_coords(self) -> bool:
        return self.xy_image is not None

    # ---- ワールド座標（角度計算用）------------------------------------
    def joint(self, lm: Lm) -> np.ndarray:
        """1 関節の軌跡（ワールド座標）。shape (T, 3)。"""
        return self.xyz[:, int(lm), :]

    def midpoint(self, a: Lm, b: Lm) -> np.ndarray:
        """2 関節の中点（ワールド座標）。shape (T, 3)。

        注意: midpoint(L_HIP, R_HIP) は原点の定義そのものなので常に ~0。
        上下動が欲しい場合は joint_image を使うこと。
        """
        return 0.5 * (self.joint(a) + self.joint(b))

    # ---- 画像座標（リズム解析用）--------------------------------------
    def joint_image(self, lm: Lm) -> np.ndarray:
        """1 関節の軌跡（画像座標 0..1）。shape (T, 2)。"""
        if self.xy_image is None:
            raise ValueError(
                "画像座標が無い PoseSequence です。extract_pose で抽出するか、"
                "xy_image を渡してください（リズム解析に必要）。"
            )
        return self.xy_image[:, int(lm), :]

    def midpoint_image(self, a: Lm, b: Lm) -> np.ndarray:
        """2 関節の中点（画像座標）。shape (T, 2)。腰の上下動はこちらで取る。"""
        return 0.5 * (self.joint_image(a) + self.joint_image(b))
