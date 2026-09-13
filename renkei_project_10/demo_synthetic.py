"""MediaPipe 無しで採点コアを検証するデモ。

実際の MediaPipe の座標系を忠実に再現する:
  - ワールド座標: 腰中点が原点（＝腰は動かない）。膝角度の検証用。
  - 画像座標    : 体が画面内で上下に弾む。リズム(FFT)の検証用。

実行: python demo_synthetic.py
"""
import numpy as np

from renkei import PoseSequence, default_pipeline
from renkei.landmarks import Lm, NUM_LANDMARKS


def make_fake_sequence(fps=30.0, seconds=30.0, bpm=120.0, knee_angle_deg=130.0,
                       with_image_coords=True):
    """既知の上下動テンポと膝角度を持つ擬似シーケンスを生成。"""
    n = int(fps * seconds)
    t = np.arange(n) / fps

    # ---- ワールド座標: 腰中点=原点（MediaPipe の仕様どおり）----------
    xyz = np.zeros((n, NUM_LANDMARKS, 3))
    xyz[:, Lm.L_HIP] = (-0.1, 0.0, 0.0)
    xyz[:, Lm.R_HIP] = (0.1, 0.0, 0.0)      # 中点は (0,0,0)
    xyz[:, Lm.L_SHOULDER] = (-0.15, 0.5, 0.0)
    xyz[:, Lm.R_SHOULDER] = (0.15, 0.5, 0.0)

    # 膝角度が厳密に knee_angle_deg になるよう ankle を配置。
    # 頂点=膝。knee->hip は +y 方向。knee->ankle をそこから θ 回した向きに。
    th = np.radians(knee_angle_deg)
    for hip, knee, ankle, sx in ((Lm.L_HIP, Lm.L_KNEE, Lm.L_ANKLE, -0.1),
                                 (Lm.R_HIP, Lm.R_KNEE, Lm.R_ANKLE, 0.1)):
        xyz[:, knee] = (sx, -0.4, 0.0)
        xyz[:, ankle] = (sx, -0.4 + 0.4 * np.cos(th), 0.4 * np.sin(th))

    # ---- 画像座標: 体が上下に弾む（リズムはここに宿る）--------------
    xy = None
    if with_image_coords:
        xy = np.zeros((n, NUM_LANDMARKS, 2))
        bob = 0.03 * np.sin(2 * np.pi * (bpm / 60.0) * t)   # 画面の3%振幅
        hip_y = 0.55 + bob
        xy[:, Lm.L_HIP] = np.stack([np.full(n, 0.45), hip_y], axis=1)
        xy[:, Lm.R_HIP] = np.stack([np.full(n, 0.55), hip_y], axis=1)
        # 肩は腰の上（画像 y は下向き正なので引く）。胴体長 0.15。
        xy[:, Lm.L_SHOULDER] = np.stack([np.full(n, 0.43), hip_y - 0.15], axis=1)
        xy[:, Lm.R_SHOULDER] = np.stack([np.full(n, 0.57), hip_y - 0.15], axis=1)

    return PoseSequence(xyz, np.ones((n, NUM_LANDMARKS)), fps, xy_image=xy)


if __name__ == "__main__":
    from renkei.features import knee_flexion, vertical_signal
    from renkei.scorers.rhythm import estimate_tempo

    print("=== 1. 膝角度の復元（ワールド座標）===")
    for true_angle in (110, 130, 155):
        seq = make_fake_sequence(knee_angle_deg=true_angle)
        est = np.nanmean(knee_flexion(seq, "L"))
        print(f"  真値 {true_angle}度 -> 推定 {est:.1f}度  (誤差 {abs(est-true_angle):.2f})")

    print("\n=== 2. FFT テンポ復元（画像座標, 30秒）===")
    for true_bpm in (90, 120, 150):
        seq = make_fake_sequence(bpm=true_bpm, seconds=30.0)
        est, _, _, _ = estimate_tempo(vertical_signal(seq), seq.fps)
        print(f"  真値 {true_bpm} BPM -> 推定 {est:.1f} BPM  (誤差 {abs(est-true_bpm):.1f})")

    print("\n=== 3. 【回帰テスト】腰が原点のワールド座標をリズムに使わないこと ===")
    # 画像座標を与えないケース = 以前バグっていた状況。
    # ノイズから偽のテンポ(73.6BPM)を出さず、正直に「測れない」と返すべき。
    seq_bad = make_fake_sequence(seconds=4.1, with_image_coords=False)
    from renkei.scorers import RhythmScorer
    r = RhythmScorer().score(seq_bad)
    print(f"  画像座標なし -> tempo={r.metrics.get('tempo_bpm')}, msg='{r.message}'")
    assert r.metrics.get("tempo_bpm") is None, "偽のテンポを返してはいけない"
    print("  OK: 偽のテンポを返さない")

    print("\n=== 4. 【回帰テスト】短い動画を信頼できると言わないこと ===")
    seq_short = make_fake_sequence(seconds=4.1, bpm=120)
    r = RhythmScorer().score(seq_short)
    print(f"  4.1秒 -> 分解能 {r.metrics['resolution_bpm']} BPM/ビン, "
          f"reliable={r.metrics['reliable']}")
    print(f"  msg: {r.message}")
    assert r.metrics["reliable"] is False
    print("  OK: 短さを警告する")

    print("\n=== 5. パイプライン出力（30秒, 120BPM, 膝130度）===")
    seq = make_fake_sequence(bpm=120, knee_angle_deg=130, seconds=30.0)
    print(default_pipeline().run(seq).pretty())
