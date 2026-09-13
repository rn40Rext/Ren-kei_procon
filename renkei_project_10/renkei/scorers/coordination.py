"""足幅（下半身）と、なんば（手足の連動）の採点。

根拠となった指導内容:
  - 「足は肩幅ぐらいまで開いてもらって」        -> StanceWidthScorer
  - 「右足を出したら、右手が前に出るとか、これが基本」-> NambaScorer

なんばは阿波踊りを他の踊りと分ける最大の特徴なので、
上半身・下半身のどちらにも入れず「連動」として独立させ、総合点に反映する。
"""
from __future__ import annotations

import numpy as np

from ..features import interpolate_nans
from ..landmarks import Lm, PoseSequence
from .base import Part, ScoreResult, Scorer, linear_map


class StanceWidthScorer(Scorer):
    """足の開き。肩幅を基準に、広すぎず狭すぎずを見る。"""

    axis = "足幅"
    part = Part.LOWER

    def __init__(self, profile=None):
        from ..profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.TARGET_RATIO = self.profile.get("stance_ratio", 0.95)
        self.TOLERANCE = self.profile.get("stance_tolerance", 0.60)

    def score(self, seq: PoseSequence) -> ScoreResult:
        shoulder = np.linalg.norm(
            seq.joint(Lm.L_SHOULDER) - seq.joint(Lm.R_SHOULDER), axis=1)
        ankle = np.linalg.norm(
            seq.joint(Lm.L_ANKLE) - seq.joint(Lm.R_ANKLE), axis=1)

        with np.errstate(invalid="ignore", divide="ignore"):
            ratio = ankle / np.where(shoulder > 1e-6, shoulder, np.nan)
        med = float(np.nanmedian(ratio))

        if not np.isfinite(med):
            return ScoreResult(self.axis, 0.0, "足の位置を検出できませんでした。",
                               {"stance_ratio": None}, self.part)

        s = linear_map(abs(med - self.TARGET_RATIO), self.TOLERANCE, 0.0)

        if s >= 70:
            msg = "足の開きが基準に近いです。"
        elif med < self.TARGET_RATIO:
            msg = ("この連の踊りに比べると足が狭めです。"
                   "もう少し開くと近づきます。")
        else:
            msg = ("この連の踊りに比べると足が開いています。"
                   "少し狭めると近づきます。")

        return ScoreResult(self.axis, s, msg,
                           {"stance_ratio": round(med, 2),
                            "target": self.TARGET_RATIO}, self.part)


def detect_view(seq: PoseSequence) -> tuple[str, int, float]:
    """撮影角度を判定し、「人物の前後方向」にあたる軸を返す。

    MediaPipe のワールド座標はカメラ基準であって人物基準ではない。
    そのため「前後」がどの軸になるかは撮影角度で変わる。

      正面撮影: 肩は左右(x)に開く   -> 人物の前後 = z（奥行き）
      横撮影  : 肩は奥行き(z)に並ぶ -> 人物の前後 = x（画面横）

    肩幅がどちらの軸に現れているかで判定する。

    returns: (view, axis_index, confidence)
      confidence は 0..1。0.5 付近は斜めで、どちらとも言えない。
    """
    ls = seq.joint(Lm.L_SHOULDER)
    rs = seq.joint(Lm.R_SHOULDER)
    spread_x = float(np.nanmedian(np.abs(ls[:, 0] - rs[:, 0])))
    spread_z = float(np.nanmedian(np.abs(ls[:, 2] - rs[:, 2])))
    total = spread_x + spread_z
    if total < 1e-6:
        return "unknown", 2, 0.0
    if spread_x >= spread_z:
        return "front", 2, spread_x / total      # 前後は z
    return "side", 0, spread_z / total           # 前後は x


class NambaScorer(Scorer):
    """なんば：同じ側の手と足が同時に前へ出ているか。

    阿波踊りの最も基本かつ特徴的な動き。
    「右足を出したら、右手が前に出る」（連への聞き取りより）

    測り方:
      同じ側の手首と足首の「前後位置」の相関を見る。
      同側が同時に前に出ていれば正の相関、
      普通の歩行のように逆（右足と左手）なら負の相関になる。

    注意:
      前後がどの座標軸にあたるかは撮影角度で変わるため、
      肩の広がりから角度を判定して軸を選ぶ。
      正面撮影では前後が奥行き(z)にあたり推定が不安定なので、
      信頼度を併記して低い場合は参考値として扱う。
    """

    axis = "なんば"
    part = Part.COORDINATION

    FULL_MARK_CORR = 0.5      # この相関で満点
    ZERO_MARK_CORR = -0.2     # これ以下は逆（普通の歩き）
    MIN_MOTION = 0.01         # 前後の動きがこれ未満なら判定しない

    def score(self, seq: PoseSequence) -> ScoreResult:
        view, ax, view_conf = detect_view(seq)

        corrs, motions = [], []
        for wrist, ankle in ((Lm.L_WRIST, Lm.L_ANKLE),
                             (Lm.R_WRIST, Lm.R_ANKLE)):
            w = interpolate_nans(seq.joint(wrist)[:, ax])
            a = interpolate_nans(seq.joint(ankle)[:, ax])
            if np.std(w) < self.MIN_MOTION or np.std(a) < self.MIN_MOTION:
                continue
            w = w - np.mean(w)
            a = a - np.mean(a)
            corrs.append(float(np.corrcoef(w, a)[0, 1]))
            motions.append(min(float(np.std(w)), float(np.std(a))))

        base_metrics = {"view": view, "axis": "xyz"[ax],
                        "view_confidence": round(view_conf, 2)}

        if not corrs:
            return ScoreResult(self.axis, 0.0,
                               "手足の前後の動きが小さく、なんばを判定できません。",
                               {**base_metrics, "correlation": None,
                                "reliable": False}, self.part)

        corr = float(np.mean(corrs))
        motion = float(np.mean(motions))
        s = linear_map(corr, self.ZERO_MARK_CORR, self.FULL_MARK_CORR)

        # 正面撮影では人物の前後方向が奥行き(z)にあたり、単眼推定の精度が
        # 足りない。同一の踊りを正面と横から撮って比較した実測でも、
        #   横   : 相関 +0.51 / 左右のばらつき 0.06  -> 読み取れる
        #   正面 : 相関 -0.04 / 左右のばらつき 0.22  -> 読み取れない
        # となった。そのため正面では原則として参考値として扱い、
        # 横撮影と同等の明確な相関が出た場合に限り信頼できるとする。
        spread = float(np.std(corrs)) if len(corrs) > 1 else 0.0
        if view == "front":
            reliable = (motion >= 0.03 and spread < 0.15
                        and abs(corr) >= self.FULL_MARK_CORR)
        else:
            reliable = motion >= 0.03 and spread < 0.5

        if not reliable:
            if view == "front":
                msg = ("正面からの映像では手足の前後の動きを正確に測れないため、"
                       "なんばの判定は参考値です。"
                       "横からも撮影するとより正確に測れます。")
            else:
                msg = "前後の動きが読み取りにくく、なんばの判定は参考値です。"
        elif s >= 70:
            msg = "同じ側の手足が揃っています（なんば）。"
        elif s >= 40:
            msg = "手足の連動が不安定です。右足と右手を一緒に出す意識を。"
        else:
            msg = "手足が逆に出ています。同じ側の手足を同時に出しましょう。"

        return ScoreResult(self.axis, s, msg,
                           {**base_metrics,
                            "correlation": round(corr, 3),
                            "corr_spread": round(spread, 3),
                            "motion_std": round(motion, 4),
                            "reliable": reliable}, self.part)
