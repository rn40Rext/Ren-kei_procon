"""骨格座標から採点に使う特徴量を作るヘルパー群。

ここは「生の座標 -> 意味のある量」への変換だけを担当する。
採点ロジック（閾値やスコア化）は scorers 側に置き、責務を分ける。
"""
from __future__ import annotations

import numpy as np

from .landmarks import Lm, PoseSequence


def joint_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    """点 B を頂点とする角 ABC を各フレームで計算して度で返す。

    a,b,c はいずれも shape (T,3)。膝の屈曲角などに使う。
    """
    ba = a - b
    bc = c - b
    # 内積 / (|ba||bc|) -> cosθ。ゼロ割は nan に落として後段で無視できるように。
    denom = np.linalg.norm(ba, axis=1) * np.linalg.norm(bc, axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        cos = np.sum(ba * bc, axis=1) / denom
    cos = np.clip(cos, -1.0, 1.0)
    return np.degrees(np.arccos(cos))


def knee_flexion(seq: PoseSequence, side: str = "L") -> np.ndarray:
    """膝の屈曲角[度]の時系列。180 に近いほど直立、小さいほど深く曲げている。

    「腰の低さ（男踊り）」の一次指標。
    """
    hip, knee, ankle = (Lm.L_HIP, Lm.L_KNEE, Lm.L_ANKLE) if side == "L" \
        else (Lm.R_HIP, Lm.R_KNEE, Lm.R_ANKLE)
    return joint_angle(seq.joint(hip), seq.joint(knee), seq.joint(ankle))


def torso_length(seq: PoseSequence) -> np.ndarray:
    """肩中心-腰中心の距離[m]。身体スケールの基準。個人差の正規化に使う。"""
    shoulder = seq.midpoint(Lm.L_SHOULDER, Lm.R_SHOULDER)
    hip = seq.midpoint(Lm.L_HIP, Lm.R_HIP)
    return np.linalg.norm(shoulder - hip, axis=1)


def torso_length_image(seq: PoseSequence) -> np.ndarray:
    """肩中心-腰中心の距離（画像座標）。画面内での体の大きさ。

    撮影距離が変わっても比較できるよう、上下動をこれで割って正規化する。
    """
    shoulder = seq.midpoint_image(Lm.L_SHOULDER, Lm.R_SHOULDER)
    hip = seq.midpoint_image(Lm.L_HIP, Lm.R_HIP)
    return np.linalg.norm(shoulder - hip, axis=1)


def vertical_signal(seq: PoseSequence) -> np.ndarray:
    """体の上下動の 1 次元信号。リズム解析(FFT)の入力。

    【重要】必ず「画像座標」を使う。
    ワールド座標は腰の中点が原点と定義されているため、腰の絶対位置は
    常にゼロで上下動を一切含まない。そちらを使うと数値ノイズを
    解析することになり、無意味なテンポが出る。

    画像座標の y（下向き正）を胴体長で割ってスケール正規化する。
    符号の向きは FFT の振幅に影響しないのでそのままでよい。
    """
    center_y = seq.midpoint_image(Lm.L_HIP, Lm.R_HIP)[:, 1]
    scale = np.nanmedian(torso_length_image(seq))
    if not np.isfinite(scale) or scale == 0:
        scale = 1.0
    return center_y / scale


def leg_extension_signal(seq: PoseSequence) -> np.ndarray:
    """脚の伸縮の 1 次元信号（ワールド座標ベース）。リズムの代替指標。

    ワールド座標では腰が固定で足が動くので、腰-足首の鉛直距離が
    しゃがみ／伸びの周期をそのまま表す。カメラが動く場合や
    画像座標が無い場合のフォールバックとして使える。
    """
    ankle_y = 0.5 * (seq.joint(Lm.L_ANKLE)[:, 1] + seq.joint(Lm.R_ANKLE)[:, 1])
    scale = np.nanmedian(torso_length(seq))
    if not np.isfinite(scale) or scale == 0:
        scale = 1.0
    return ankle_y / scale


def interpolate_nans(x: np.ndarray) -> np.ndarray:
    """検出抜けフレーム(nan)を線形補間で埋める。1 次元信号用。"""
    x = x.copy()
    idx = np.arange(len(x))
    good = np.isfinite(x)
    if good.sum() < 2:
        return np.nan_to_num(x)
    x[~good] = np.interp(idx[~good], idx[good], x[good])
    return x
