"""腰の低さ（男踊り）の採点。ルールベース＝完全に説明可能。"""
from __future__ import annotations

import numpy as np

from ..features import knee_flexion
from ..landmarks import PoseSequence
from .base import Part, ScoreResult, Scorer, linear_map


class HipLownessScorer(Scorer):
    axis = "腰の低さ"
    part = Part.LOWER

    # 膝屈曲角[度]。small=深く曲げている(良), large=直立(要改善)。
    # 基準値はプロファイル（連ごとの実測）から取る。

    def __init__(self, profile=None):
        from ..profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.FULL_MARK_ANGLE = self.profile.get("knee_full", 120.0)
        self.ZERO_MARK_ANGLE = self.profile.get("knee_zero", 175.0)

    def score(self, seq: PoseSequence) -> ScoreResult:
        # 左右の膝屈曲角の平均を代表値に（片側の検出抜けに強くする）
        angles = np.nanmean(
            [knee_flexion(seq, "L"), knee_flexion(seq, "R")], axis=0
        )
        mean_angle = float(np.nanmean(angles))

        s = linear_map(mean_angle, self.ZERO_MARK_ANGLE, self.FULL_MARK_ANGLE)

        if s >= 70:
            msg = "腰の低さが基準に近いです。"
        elif s >= 40:
            msg = ("この連の踊りに比べると腰が高めです。"
                   "もう少し膝を曲げると近づきます。")
        else:
            msg = ("この連の踊りに比べると腰がかなり高いです。"
                   "膝を深く曲げて腰を落としましょう。")

        return ScoreResult(
            axis=self.axis, score=s, message=msg,
            metrics={"mean_knee_angle_deg": round(mean_angle,1)}, part=self.part,
        )
