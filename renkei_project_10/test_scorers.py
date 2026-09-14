"""全採点軸の判別テスト。良い例と悪い例で点差がつくか確認する。"""
import numpy as np
from renkei.landmarks import PoseSequence, NUM_LANDMARKS, Lm
from renkei import default_pipeline


def make(fps=30.0, T=20.0, bpm=112.0, knee=122.0, hands_up=True,
         namba=True, from_above=True, stance=0.95, fatigue=False,
         elbow=144.6, spread=2.46):
    n = int(fps*T); t = np.arange(n)/fps; w = 2*np.pi*(bpm/60)*t
    xyz = np.zeros((n, NUM_LANDMARKS, 3)); xy = np.zeros((n, NUM_LANDMARKS, 2))
    # world: 肩幅0.3
    xyz[:, Lm.L_SHOULDER] = (-0.15, 0.5, 0); xyz[:, Lm.R_SHOULDER] = (0.15, 0.5, 0)
    xyz[:, Lm.L_HIP] = (-0.1, 0, 0); xyz[:, Lm.R_HIP] = (0.1, 0, 0)
    th = np.radians(knee)
    for kn, an, sx in ((Lm.L_KNEE, Lm.L_ANKLE, -0.15*stance),
                       (Lm.R_KNEE, Lm.R_ANKLE, 0.15*stance)):
        xyz[:, kn] = (sx, -0.4, 0)
        xyz[:, an] = (sx, -0.4+0.4*np.cos(th), 0.4*np.sin(th))
    swing = 0.06*np.sin(w)
    xyz[:, Lm.L_ANKLE, 2] += swing; xyz[:, Lm.R_ANKLE, 2] += -swing
    hs = swing if namba else -swing
    xyz[:, Lm.L_WRIST, 2] = hs; xyz[:, Lm.R_WRIST, 2] = -hs
    xyz[:, Lm.L_WRIST, 1] = 0.75; xyz[:, Lm.R_WRIST, 1] = 0.75
    # 腕の形: 肩-肘-手首 が elbow 度になるよう肘を配置。
    # 手首間の距離 = spread * 肩幅(0.3)。
    half = 0.5 * spread * 0.30
    for sh, el, wr, sx in ((Lm.L_SHOULDER, Lm.L_ELBOW, Lm.L_WRIST, -1.0),
                           (Lm.R_SHOULDER, Lm.R_ELBOW, Lm.R_WRIST, 1.0)):
        xyz[:, wr, 0] = sx * half
        S = xyz[0, sh]; W = np.array([sx*half, 0.75, xyz[0, wr, 2]])
        mid = 0.5*(S+W); chord = np.linalg.norm(W-S)
        # 肘は S,W の垂直二等分線上。肘角度 elbow から必要な高さを出す
        Lseg = chord/(2*np.sin(np.radians(elbow)/2))      # 上腕=前腕の長さ
        h = np.sqrt(max(Lseg**2-(chord/2)**2, 1e-9))
        d = W-S; d = d/ (np.linalg.norm(d)+1e-9)
        perp = np.cross(d, np.array([0.0,0.0,1.0]))
        perp = perp/(np.linalg.norm(perp)+1e-9)
        xyz[:, el] = mid + perp*h*sx
    # image
    bob = 0.02*np.sin(w)
    xy[:, Lm.NOSE] = np.stack([np.full(n, 0.5), 0.25+bob], 1)
    xy[:, Lm.L_HIP] = np.stack([np.full(n, 0.47), 0.55+bob], 1)
    xy[:, Lm.R_HIP] = np.stack([np.full(n, 0.53), 0.55+bob], 1)
    xy[:, Lm.L_SHOULDER] = np.stack([np.full(n, 0.45), 0.40+bob], 1)
    xy[:, Lm.R_SHOULDER] = np.stack([np.full(n, 0.55), 0.40+bob], 1)
    base = 0.18 if hands_up else 0.45
    out = np.sin(w)
    # 左手の前後は hs=sin(w) 系。出す局面は d(hs)>0 すなわち cos(w)>0。
    # 上から出す = その局面で y が増加(下降) -> y は sin(w) 形
    ysig = np.sin(w) if from_above else -np.sin(w)
    hy = base + bob + 0.05*ysig
    if fatigue:
        hy = hy + np.linspace(0, 0.22, n)
    xy[:, Lm.L_WRIST] = np.stack([0.45-0.08*out, hy], 1)
    xy[:, Lm.R_WRIST] = np.stack([0.55+0.08*out, hy], 1)
    return PoseSequence(xyz, np.ones((n, NUM_LANDMARKS)), fps, xy_image=xy)


if __name__ == "__main__":
    pipe = default_pipeline()
    cases = [
        ("良い踊り(基準)", {}),
        ("手が下がっている", {"hands_up": False}),
        ("後半で手が疲れて下がる", {"fatigue": True}),
        ("手を下から出す", {"from_above": False}),
        ("腰が高い(棒立ち)", {"knee": 170.0}),
        ("なんばが逆(普通の歩き)", {"namba": False}),
        ("足幅が狭い", {"stance": 0.35}),
        ("テンポが遅い", {"bpm": 70.0}),
        ("腕を伸ばしきっている", {"elbow": 178.0}),
        ("肘を曲げすぎ", {"elbow": 95.0}),
        ("手がまとまりすぎ", {"spread": 0.8}),
    ]
    base = pipe.run(make()).total
    print(f"{'条件':<24}{'総合':>7}{'上半身':>8}{'下半身':>8}  基準との差")
    print("-"*62)
    failures = []
    # 良い踊り（基準）は高得点、悪い例はいずれも基準より明確に低くなること
    if base < 90:
        failures.append(f"基準の総合点が低すぎる: {base:.1f}")
    for name, kw in cases:
        r = pipe.run(make(**kw))
        d = r.total - base
        print(f"{name:<24}{r.total:7.1f}{r.upper:8.1f}{r.lower:8.1f}  {d:+6.1f}")
        if name != "良い踊り(基準)" and d > -2.0:
            failures.append(f"{name}: 基準との差 {d:+.1f} が小さすぎる")
    print("\n" + "="*62)
    print("悪い例の詳細（手が下がっている）")
    print("="*62)
    print(pipe.run(make(hands_up=False)).pretty())

    if failures:
        print("\nFAILED:")
        for f in failures:
            print("  -", f)
        raise SystemExit(1)
    print("\nOK: 全ての悪い例が基準より低い")
