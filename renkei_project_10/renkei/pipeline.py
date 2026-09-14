"""採点パイプライン。部位ごとに集計し、総合点と内訳を返す。

表示する数値は 3 つ:
    総合点 / 上半身の点数 / 下半身の点数

連の指導が「足だけ練習」「上半身だけ」と部位で分かれているため、
採点も同じ切り口にしてある。なんば（手足の連動）はどちらの部位にも
属さないので部位別には出さず、総合点にのみ反映する。

総合点だけでなく軸ごとの根拠と説明を必ず返すのが方針。
「なぜこの点か」が常に開示されるので、black box にならない。
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .landmarks import PoseSequence
from .scorers.base import Part, ScoreResult, Scorer


@dataclass
class Report:
    total: float                       # 総合点
    upper: float | None                # 上半身の点数
    lower: float | None                # 下半身の点数
    breakdown: list[ScoreResult]       # 全軸の詳細
    part_weights: dict = field(default_factory=dict)
    profile_name: str = ""             # 基準にした連・流派
    profile_source: str = ""           # その由来（審査・表示用）

    def axes_of(self, part: str) -> list[ScoreResult]:
        return [r for r in self.breakdown if r.part == part]

    def advice(self, limit: int = 2, threshold: float = 70.0) -> list[str]:
        """直すべき点を、点数の低い軸から返す。アプリの助言表示用。

        threshold 以上の軸は「できている」ので助言に混ぜない。
        褒め言葉が改善点として並ぶと、何を直せばよいか分からなくなる。

        参考値（reliable=False）の軸も除く。測れていない可能性のある
        指摘を最優先で見せると、誤った方向に練習させてしまう。
        """
        low = [r for r in self.breakdown
               if r.measured and r.score < threshold
               and r.metrics.get("reliable") is not False]
        low.sort(key=lambda r: r.score)
        return [r.message for r in low[:limit]]

    def notes(self) -> list[str]:
        """参考値扱いになった軸の説明。助言とは分けて表示する。"""
        return [f"{r.axis}: {r.message}" for r in self.breakdown
                if r.measured and r.metrics.get("reliable") is False]

    def unmeasured(self) -> list[str]:
        """測れなかった軸。0 点ではなく「対象外」として別枠で示す。"""
        return [f"{r.axis}: {r.message}" for r in self.breakdown
                if not r.measured]

    def praise(self, threshold: float = 80.0) -> list[str]:
        """できている軸。励ましの表示用。"""
        good = [r for r in self.breakdown if r.measured and r.score >= threshold]
        good.sort(key=lambda r: -r.score)
        return [r.axis for r in good]

    def pretty(self) -> str:
        lines = [
            "=" * 46,
            f"  総合点   {self.total:5.1f} / 100",
            f"  上半身   {self._fmt(self.upper)}"
            f"      下半身   {self._fmt(self.lower)}",
            "=" * 46,
        ]
        if self.profile_name:
            lines.append(f"  評価基準: {self.profile_name}")
            lines.append("  ※ 阿波踊りは連によって踊り方が異なります。"
                         "点数は上記の連の")
            lines.append("     踊り方を基準にした「近さ」であり、"
                         "優劣ではありません。")
        for part in (Part.UPPER, Part.LOWER, Part.COORDINATION):
            axes = self.axes_of(part)
            if not axes:
                continue
            lines.append(f"\n【{part}】")
            for r in axes:
                if r.measured:
                    lines.append(f"  {r.axis:<14} {r.score:5.1f}点  {r.message}")
                else:
                    lines.append(f"  {r.axis:<14}   --   {r.message}")
                for k, v in r.metrics.items():
                    lines.append(f"      └ {k}: {v}")
        advice = self.advice()
        if advice:
            lines.append("\n■ 重点アドバイス")
            for a in advice:
                lines.append(f"  ・{a}")
        good = self.praise()
        if good:
            lines.append("\n■ できているところ: " + " / ".join(good))
        if not advice:
            lines.append("  基本はよくできています。")
        notes = self.notes()
        if notes:
            lines.append("\n■ 参考値（正確に測れていない項目）")
            for n in notes:
                lines.append(f"  ・{n}")
        missing = self.unmeasured()
        if missing:
            lines.append("\n■ 測れなかった項目（点数には含めていません）")
            for n in missing:
                lines.append(f"  ・{n}")
        return "\n".join(lines)

    @staticmethod
    def _fmt(v: float | None) -> str:
        return f"{v:5.1f} / 100" if v is not None else "   -- (対象なし)"


class ScoringPipeline:
    """(Scorer, 重み) を部位ごとに束ねて採点する。"""

    def __init__(self, scorers: list[tuple[Scorer, float]],
                 part_weights: dict | None = None,
                 profile=None):
        from .profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.scorers = scorers
        # 総合点における部位の比率。既定は上半身と下半身を同等に扱い、
        # なんばを補助的に加える。熟練者データや連の意見で調整する前提。
        self.part_weights = part_weights or {
            Part.UPPER: 0.4,
            Part.LOWER: 0.4,
            Part.COORDINATION: 0.2,
        }

    @staticmethod
    def _weighted(results: list[tuple[ScoreResult, float]]) -> float | None:
        """(結果, 重み) の重み付き平均。対象が無ければ None。

        metrics に reliable=False がある軸は「参考値」なので、
        重みを 1/4 に落として総合点への影響を抑える。
        測れていない可能性のある数値で点数を左右させないため。
        """
        # 測れなかった軸(measured=False)は対象外。0 点として平均に入れると
        # 「検出できなかった」が「最低の出来」と同じ扱いになってしまう。
        results = [(r, w) for r, w in results if r.measured]
        if not results:
            return None
        adjusted = [
            (r, w * (0.25 if r.metrics.get("reliable") is False else 1.0))
            for r, w in results
        ]
        total_w = sum(w for _, w in adjusted)
        if total_w <= 0:
            return None
        return sum(r.score * w for r, w in adjusted) / total_w

    def run(self, seq: PoseSequence) -> Report:
        results = [(s.score(seq), w) for s, w in self.scorers]
        all_results = [r for r, _ in results]

        # --- 部位ごとに集計 ---
        part_scores: dict[str, float | None] = {}
        part_reliable: dict[str, bool] = {}
        for part in (Part.UPPER, Part.LOWER, Part.COORDINATION):
            in_part = [(r, w) for r, w in results if r.part == part]
            part_scores[part] = self._weighted(in_part)
            # その部位の軸がすべて参考値なら、部位ごと信頼できない
            part_reliable[part] = any(
                r.measured and r.metrics.get("reliable") is not False
                for r, _ in in_part)

        # --- 総合点 = 部位の重み付き平均（存在する部位だけで正規化）---
        # 参考値しかない部位は重みを 1/4 にして、測れていない軸で
        # 総合点が大きく動かないようにする。
        present = [
            (part_scores[p],
             self.part_weights.get(p, 0.0) * (1.0 if part_reliable[p] else 0.25))
            for p in part_scores if part_scores[p] is not None
        ]
        total_w = sum(w for _, w in present)
        total = (sum(s * w for s, w in present) / total_w) if total_w else 0.0

        return Report(
            total=total,
            upper=part_scores[Part.UPPER],
            lower=part_scores[Part.LOWER],
            breakdown=all_results,
            part_weights=self.part_weights,
            profile_name=self.profile.name,
            profile_source=self.profile.source,
        )


def default_pipeline(profile=None) -> ScoringPipeline:
    """男踊りの構成。

    閾値は profile（連ごとの実測値）から取る。
    別の連を基準にしたい場合は、その StyleProfile を渡す。
    """
    from .profiles import DEFAULT_PROFILE
    profile = profile or DEFAULT_PROFILE
    from .scorers import (ArmFormScorer, HandEntryScorer, HandHeightScorer,
                          HandSpreadScorer, HipLownessScorer, NambaScorer,
                          RhythmScorer, StanceWidthScorer)
    return ScoringPipeline([
        # 上半身: 高さだけでなく「形」も見る。
        # 高さのみだと、頭上に上げてさえいれば満点になり、
        # 腕を伸ばしきった雑な形と正しい構えが区別できない。
        (HandHeightScorer(profile), 0.35),   # 「手を上げてキープ」が基本
        (ArmFormScorer(profile), 0.30),      # 腕の構え（連ごとに異なる）
        (HandSpreadScorer(profile), 0.15),   # 手の開き（連ごとに異なる）
        (HandEntryScorer(), 0.20),           # 「手は上から出す」
        # 下半身
        (HipLownessScorer(profile), 0.4),    # 「低いほどかっこいい」
        (RhythmScorer(profile), 0.4),        # 2 拍子に乗れているか
        (StanceWidthScorer(profile), 0.2),   # 「足は肩幅ぐらい」
        # 連動
        (NambaScorer(), 1.0),                # 右手右足を同時に出す
    ], profile=profile)
