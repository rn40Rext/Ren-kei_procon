"""踊り方のプロファイル（流派・連ごとの基準値）。

阿波踊りは同じ「男踊り」でも連によって形が異なる。
連への聞き取りより:

    「男踊りって言うても、ほれんの暴れ踊りと、ごじゃ兵さんの踊り方だったら、
      基本は同じなんですけど、こっからの先は違う」
    「最終的な良し悪しっていうのは、この連の人に言ってもらわんといかん」

そのため採点の基準値は「唯一の正解」ではなく、
どの連の踊り方を基準にしているかを必ず明示する。

実測でもそれが確認できた。指導映像の踊り手は肘を曲げた構えだったのに対し、
基準データを提供いただいた踊り手は肘 144.6 度・手首間が肩幅の 2.46 倍と、
腕を大きく伸ばして広げる形だった。どちらも正しい男踊りであり、
一方を誤りとして扱ってはならない。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class StyleProfile:
    """ある連・流派の男踊りの基準値。

    値はすべて熟練者の映像からの実測。出典を name/source に明記する。
    """
    name: str                      # 表示名（例: さゝゆり連（達粋連系）男踊り）
    source: str                    # 由来の説明。審査・ユーザー表示に使う
    thresholds: dict = field(default_factory=dict)

    def get(self, key: str, default=None):
        return self.thresholds.get(key, default)


# 基準データを提供いただいた連の男踊り。
# 熟練者・正面 734 フレームの実測（中央値と四分位）に基づく。
SASAYURI_MALE = StyleProfile(
    name="さゝゆり連（達粋連系）の男踊り",
    source=(
        "阿南市・さゝゆり連の熟練者にご協力いただいた映像（正面・約24秒）の実測値。"
        "同連は達粋連から踊り方を継承しています。"
    ),
    thresholds={
        # --- 上半身 ---
        # 肘角度[度]: 実測 中央値 144.6 / 四分位 132.6-150.5
        "elbow_angle": 144.6,
        # 許容幅は四分位幅(17.9)の約3.5倍。流派差を吸収するためやや広めに取る。
        "elbow_tolerance": 62.0,
        # 手首間/肩幅: 実測 中央値 2.46 / 四分位 1.98-2.72
        "hand_spread": 2.46,
        "hand_spread_tolerance": 2.10,
        # 手首が頭より上にある割合: 実測 0.692
        "hand_keep_full": 0.70,
        "hand_keep_zero": 0.15,
        # --- 下半身 ---
        # 膝屈曲角[度]: 実測 正面 128.2 / 横 115.9
        "knee_full": 120.0,
        "knee_zero": 175.0,
        # 足首間/肩幅: 実測 0.95
        "stance_ratio": 0.95,
        "stance_tolerance": 0.60,
        # テンポ[BPM]: 実測 正面 112.8 / 横 111.2
        "tempo": 112.0,
        "tempo_tolerance": 30.0,
    },
)

DEFAULT_PROFILE = SASAYURI_MALE
