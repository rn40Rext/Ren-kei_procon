"""上半身の採点。連への聞き取りで挙がった基本に対応する。

根拠となった指導内容:
  - 「腰を落とすのと手を上げるっていうのは、これはもう基本」
  - 「ずっと上げたらしんどいんで、下がってくる」
      -> 上げるだけでなく“維持できているか”が見どころ。
         平均の高さではなく「基準より上にあった時間の割合」で測る。
  - 「手の出し方が、上から出すようにお願いしたんですけど、下から出てくれました」
      -> 初心者の典型的な誤り。手を出す局面の軌跡の向きで判定できる。
"""
from __future__ import annotations

import numpy as np

from ..features import interpolate_nans, joint_angle
from ..landmarks import Lm, PoseSequence
from .base import Part, ScoreResult, Scorer, linear_map


def _wrist_above_ratio(seq: PoseSequence, reference: Lm) -> tuple[float, dict]:
    """手首が基準関節より上にあった割合を返す。

    画像座標は y が下向き正なので、「上にある」= y が小さい。

    男踊りは左右の手を交互に動かすため、常に両手が同時に頭上にある
    わけではない（熟練者の実測でも 両手同時 44% に対し 片手ずつ 約69%）。
    そのため「両手同時」ではなく「左右それぞれの平均」を指標にする。
    """
    ref_y = interpolate_nans(seq.joint_image(reference)[:, 1])
    lw = interpolate_nans(seq.joint_image(Lm.L_WRIST)[:, 1])
    rw = interpolate_nans(seq.joint_image(Lm.R_WRIST)[:, 1])

    left_above = lw < ref_y
    right_above = rw < ref_y
    both = left_above & right_above

    left_r = float(np.mean(left_above))
    right_r = float(np.mean(right_above))
    mean_r = 0.5 * (left_r + right_r)

    return mean_r, {
        "left_above_ratio": round(left_r, 3),
        "right_above_ratio": round(right_r, 3),
        "both_hands_ratio": round(float(np.mean(both)), 3),
    }


class HandHeightScorer(Scorer):
    """手の高さとキープ。両手が頭より上に保てているか。"""

    axis = "手の高さ・キープ"
    part = Part.UPPER

    # 基準にする関節。鼻（頭の高さ）を使う。
    REFERENCE = Lm.NOSE

    def __init__(self, profile=None):
        from ..profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.FULL_MARK_RATIO = self.profile.get("hand_keep_full", 0.70)
        self.ZERO_MARK_RATIO = self.profile.get("hand_keep_zero", 0.15)

    def score(self, seq: PoseSequence) -> ScoreResult:
        if not seq.has_image_coords:
            return ScoreResult(self.axis, 0.0,
                               "画像座標が無いため手の高さを判定できません。",
                               {"keep_ratio": None}, self.part)

        ratio, detail = _wrist_above_ratio(seq, self.REFERENCE)
        s = linear_map(ratio, self.ZERO_MARK_RATIO, self.FULL_MARK_RATIO)

        # 前半と後半を比べ、疲れて下がっていないかを見る
        half = seq.num_frames // 2
        if half > 5:
            first, _ = _wrist_above_ratio(_slice(seq, 0, half), self.REFERENCE)
            second, _ = _wrist_above_ratio(_slice(seq, half, seq.num_frames),
                                           self.REFERENCE)
            drop = first - second
        else:
            first = second = drop = float("nan")

        if s >= 70:
            msg = "手がしっかり上がっています。"
            if np.isfinite(drop) and drop > 0.2:
                msg = "手は上がっていますが、後半で下がってきています。"
        elif s >= 40:
            msg = "手をもう少し高く、頭の上まで上げましょう。"
        else:
            msg = "手が下がっています。頭の上まで上げてキープしましょう。"

        metrics = {"keep_ratio": round(ratio, 3), **detail}
        if np.isfinite(drop):
            metrics.update({"first_half": round(first, 3),
                            "second_half": round(second, 3),
                            "drop": round(drop, 3)})

        return ScoreResult(self.axis, s, msg, metrics, self.part)


def _slice(seq: PoseSequence, a: int, b: int) -> PoseSequence:
    """フレーム範囲を切り出した PoseSequence を作る（内部用）。"""
    return PoseSequence(
        seq.xyz[a:b], seq.visibility[a:b], seq.fps,
        xy_image=None if seq.xy_image is None else seq.xy_image[a:b],
    )


class ArmFormScorer(Scorer):
    """腕の形。肘を曲げて構えられているか。

    指導映像の男踊りでは、腕をまっすぐ伸ばすのではなく肘を曲げ、
    手を頭の上あたりに保つ形になっている。
    「手が高いほど良い」わけではなく、正しい形を保てているかを見る。

    肘角度 = 肩-肘-手首 の角度。180 度に近いほど棒のように伸びた状態。
    基準値は連ごとに異なるため profiles.py から取る。
    """

    axis = "腕の形"
    part = Part.UPPER

    def __init__(self, profile=None):
        from ..profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.target = self.profile.get("elbow_angle", 144.6)
        self.tolerance = self.profile.get("elbow_tolerance", 62.0)

    def score(self, seq: PoseSequence) -> ScoreResult:
        angles = []
        for sh, el, wr in ((Lm.L_SHOULDER, Lm.L_ELBOW, Lm.L_WRIST),
                           (Lm.R_SHOULDER, Lm.R_ELBOW, Lm.R_WRIST)):
            a = joint_angle(seq.joint(sh), seq.joint(el), seq.joint(wr))
            if np.isfinite(a).sum() > 0:
                angles.append(a)

        if not angles:
            return ScoreResult(self.axis, 0.0, "腕の形を検出できませんでした。",
                               {"elbow_angle_deg": None}, self.part)

        mean_angle = float(np.nanmean(angles))
        s = linear_map(abs(mean_angle - self.target), self.tolerance, 0.0)

        # 流派によって腕の形は異なる。誤りとして断定せず、
        # 「基準にしている連の踊り方との違い」として伝える。
        if s >= 70:
            msg = "腕の形が基準に近いです。"
        elif mean_angle > self.target:
            msg = ("この連の踊りに比べると腕が伸びています。"
                   "肘を軽く曲げると近づきます。")
        else:
            msg = ("この連の踊りに比べると肘が曲がっています。"
                   "もう少し腕を伸ばすと近づきます。")

        return ScoreResult(self.axis, s, msg,
                           {"elbow_angle_deg": round(mean_angle, 1),
                            "target_deg": round(self.target, 1),
                            "left_deg": round(float(np.nanmean(angles[0])), 1),
                            "right_deg": round(float(np.nanmean(angles[-1])), 1)},
                           self.part)


class HandSpreadScorer(Scorer):
    """手の広がり。手首間の距離を肩幅で正規化して測る。

    どのくらい開くかは連によって異なるため、基準値は profiles.py から取る。
    """

    axis = "手の位置"
    part = Part.UPPER

    def __init__(self, profile=None):
        from ..profiles import DEFAULT_PROFILE
        self.profile = profile or DEFAULT_PROFILE
        self.target = self.profile.get("hand_spread", 2.46)
        self.tolerance = self.profile.get("hand_spread_tolerance", 2.10)

    def score(self, seq: PoseSequence) -> ScoreResult:
        shoulder = np.linalg.norm(
            seq.joint(Lm.L_SHOULDER) - seq.joint(Lm.R_SHOULDER), axis=1)
        wrist = np.linalg.norm(
            seq.joint(Lm.L_WRIST) - seq.joint(Lm.R_WRIST), axis=1)

        with np.errstate(invalid="ignore", divide="ignore"):
            ratio = wrist / np.where(shoulder > 1e-6, shoulder, np.nan)
        med = float(np.nanmedian(ratio))

        if not np.isfinite(med):
            return ScoreResult(self.axis, 0.0, "手の位置を検出できませんでした。",
                               {"spread_ratio": None}, self.part)

        s = linear_map(abs(med - self.target), self.tolerance, 0.0)

        if s >= 70:
            msg = "手の位置が基準に近いです。"
        elif med > self.target:
            msg = "この連の踊りに比べると手が開いています。"
        else:
            msg = ("この連の踊りに比べると手がまとまっています。"
                   "もう少し大きく開くと近づきます。")

        return ScoreResult(self.axis, s, msg,
                           {"spread_ratio": round(med, 2),
                            "target": round(self.target, 2)}, self.part)


class HandEntryScorer(Scorer):
    """手を「上から」出せているか。下から上げる動きは初心者の典型。

    手を前に出す局面（手首が前方＝画面上で体の中心から離れていく区間）で、
    手首の高さが下降しているか上昇しているかを見る。
    上から出せていれば下降、下から出していれば上昇になる。
    """

    axis = "手の出し方"
    part = Part.UPPER

    FULL_MARK_RATIO = 0.75   # 上から出せている割合
    ZERO_MARK_RATIO = 0.25

    def score(self, seq: PoseSequence) -> ScoreResult:
        if not seq.has_image_coords:
            return ScoreResult(self.axis, 0.0,
                               "画像座標が無いため手の出し方を判定できません。",
                               {"from_above_ratio": None}, self.part)

        # 「前に出す」方向は撮影角度で座標軸が変わるため、なんばと同様に判定する。
        # 画面上の横位置で代用すると、手が体の左右どちらにも振れるため
        # 「出している局面」を取り違える（合成データで判別不能になった）。
        from .coordination import detect_view
        view, ax, view_conf = detect_view(seq)

        ratios, samples = [], 0
        for wrist in (Lm.L_WRIST, Lm.R_WRIST):
            fwd = interpolate_nans(seq.joint(wrist)[:, ax])     # 前後位置
            wy = interpolate_nans(seq.joint_image(wrist)[:, 1])  # 高さ(下向き正)

            if np.std(fwd) < 1e-4:
                continue

            d_fwd = np.diff(fwd)
            dy = np.diff(wy)

            # 前へ出している局面だけを取り出す。
            # 引く局面を混ぜると、上下の判定が打ち消し合う。
            span = np.percentile(np.abs(d_fwd), 60)
            forward = np.abs(d_fwd) > span
            # 前方向の符号は撮影の向きで反転しうるので、
            # 移動量の大きい側を「出している」とみなす
            sign = 1.0 if np.mean(d_fwd[forward]) >= 0 else -1.0
            extending = forward & ((d_fwd * sign) > 0)
            if extending.sum() < 3:
                continue

            # 出す局面で手が下降していた割合 = 上から出せている割合
            ratios.append(float(np.mean(dy[extending] > 0)))
            samples += int(extending.sum())

        if not ratios:
            return ScoreResult(self.axis, 0.0,
                               "手の動きが小さく判定できませんでした。",
                               {"from_above_ratio": None, "view": view},
                               self.part)

        ratio = float(np.mean(ratios))
        s = linear_map(ratio, self.ZERO_MARK_RATIO, self.FULL_MARK_RATIO)

        if s >= 70:
            msg = "手を上から出せています。"
        elif s >= 40:
            msg = "手を出すとき、もう少し上から降ろすように。"
        else:
            msg = "手が下から出ています。一度上げてから前に出しましょう。"

        return ScoreResult(self.axis, s, msg,
                           {"from_above_ratio": round(ratio, 3),
                            "view": view, "axis": "xyz"[ax],
                            "samples": samples}, self.part)

        if not ratios:
            return ScoreResult(self.axis, 0.0,
                               "手の動きが小さく判定できませんでした。",
                               {"from_above_ratio": None}, self.part)

        ratio = float(np.mean(ratios))
        s = linear_map(ratio, self.ZERO_MARK_RATIO, self.FULL_MARK_RATIO)

        if s >= 70:
            msg = "手を上から出せています。"
        elif s >= 40:
            msg = "手を出すとき、もう少し上から降ろすように。"
        else:
            msg = "手が下から出ています。一度上げてから前に出しましょう。"

        return ScoreResult(self.axis, s, msg,
                           {"from_above_ratio": round(ratio, 3),
                            "samples": samples}, self.part)
