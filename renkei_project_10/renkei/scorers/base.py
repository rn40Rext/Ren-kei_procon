"""採点器の共通インターフェース。

設計の要:
- 各採点軸は独立した Scorer として実装する（腰の低さ、なんば、リズム…）。
- 返り値は数値だけでなく「なぜその点か」の説明文と根拠となる測定値を必ず持つ。
  -> 審査での「採点基準が不透明」「難所をどう解決するのか説明が欲しい」への回答。
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..landmarks import PoseSequence


@dataclass
class ScoreResult:
    axis: str                          # 軸名（例: "腰の低さ"）
    score: float                       # 0..100
    message: str                       # ユーザー向けの一言アドバイス
    metrics: dict = field(default_factory=dict)  # 根拠の生値（膝角度など）
    part: str = "下半身"                # 属する部位


class Part:
    """採点軸が属する部位。

    連の指導が「足だけ練習」「上半身だけ」と部位ごとに分かれているため、
    採点も同じ切り口にする。ユーザーに見せるのは総合・上半身・下半身の 3 項目。

    COORDINATION（なんば＝右手右足を同時に出す等の手足連動）は
    どちらの部位にも属さないので、部位別の点数には出さず総合点にだけ反映する。
    阿波踊りの最重要の基本なので、軸としては必ず持つ。
    """
    UPPER = "上半身"
    LOWER = "下半身"
    COORDINATION = "連動"


class Scorer:
    """全採点軸の基底クラス。score() を実装するだけで pipeline に載る。"""
    axis: str = "base"
    part: str = Part.LOWER

    def score(self, seq: PoseSequence) -> ScoreResult:  # noqa: D401
        raise NotImplementedError


def linear_map(value: float, lo: float, hi: float) -> float:
    """value を [lo, hi] -> [0, 100] に線形写像してクリップ。

    採点を単純な数式にしておくと基準が完全に説明可能になる。
    lo は 0 点、hi は 100 点に対応（lo>hi でも可＝小さいほど高得点）。
    """
    t = (value - lo) / (hi - lo)
    return float(max(0.0, min(1.0, t)) * 100.0)
