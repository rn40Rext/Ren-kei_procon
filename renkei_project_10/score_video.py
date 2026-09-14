"""動画を 1 本渡すだけで採点するコマンド。

これまで preview_crop.py -> extract_clean.py -> score_test.py と
分かれていた流れを 1 本にまとめたもの。

    抽出（骨格） -> 妥当性の検証 -> 採点 -> 結果表示

使い方:
    python score_video.py 踊りの動画.MOV
    python score_video.py C:\\path\\to\\video.mp4

よく使う指定:
    --model  モデル(.task)の場所。既定は MODEL_PATH。
    --crop   演奏者など他の人が映り込む場合に範囲を絞る。
             例: --crop 0.15 0.90 0.0 1.0  （左右15%〜90%だけ使う）
    --save   骨格を .npz に保存して次回以降の再採点を速くする。
    --json   結果を JSON で出す（アプリ組み込み時の受け渡し用）。

引数なしで実行すると、動画の選び方を案内する。
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# ---- 既定のモデルパス ----------------------------------------------------
# 環境変数 RENKEI_POSE_MODEL があればそれを、無ければこのファイルと同じ場所の
# models/pose_landmarker_full.task を使う（models/ は git 管理外。README 参照）。
MODEL_PATH = os.environ.get(
    "RENKEI_POSE_MODEL",
    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 "models", "pose_landmarker_full.task"),
)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="阿波踊り（男踊り）の動画を採点します。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="例:\n"
               "  python score_video.py dance.MOV\n"
               "  python score_video.py dance.MOV --save\n"
               "  python score_video.py dance.MOV --crop 0.15 0.9 0.0 1.0\n",
    )
    p.add_argument("video", nargs="?", help="採点する動画ファイル")
    p.add_argument("--model", default=MODEL_PATH,
                   help="姿勢推定モデル(.task)の場所")
    p.add_argument("--crop", nargs=4, type=float, metavar=("X0", "X1", "Y0", "Y1"),
                   help="切り出し範囲(0..1)。他の人が映り込む場合に使う")
    p.add_argument("--save", action="store_true",
                   help="骨格データを .npz に保存する")
    p.add_argument("--json", action="store_true",
                   help="結果を JSON で出力する")
    p.add_argument("--quiet", action="store_true",
                   help="途中経過を表示しない")
    return p


def check_inputs(args) -> bool:
    """動画とモデルが実在するか先に確かめ、無ければ具体的に案内する。"""
    ok = True
    if not os.path.isfile(args.video):
        print(f"[エラー] 動画が見つかりません: {args.video}")
        print("  パスの綴りを確認してください。空白を含む場合は")
        print('  引用符で囲みます: python score_video.py "my video.MOV"')
        ok = False
    if not os.path.isfile(args.model):
        print(f"[エラー] モデルが見つかりません: {args.model}")
        print("  pose_landmarker_full.task の場所を --model か環境変数")
        print("  RENKEI_POSE_MODEL で指定してください。取得は README の手順:")
        print("    python download_model.py")
        ok = False
    return ok


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.video:
        parser.print_help()
        print("\n動画を指定してください。例: python score_video.py dance.MOV")
        return 1

    if not check_inputs(args):
        return 1

    # 重いライブラリは入力確認のあとで読み込む（誤入力時の待ち時間を減らす）
    import numpy as np
    from renkei import default_pipeline
    from renkei.pose_extractor import extract_pose
    from renkei.validate import describe_runs, validate

    # --json のときは途中経過を stderr に出し、stdout を JSON だけにする
    # （パイプで受ける側が JSON をそのまま読めるように）
    if args.quiet:
        log = lambda *a: None  # noqa: E731
    elif args.json:
        log = lambda *a: print(*a, file=sys.stderr)  # noqa: E731
    else:
        log = print

    crop = tuple(args.crop) if args.crop else None
    log(f"解析中: {os.path.basename(args.video)}")
    if crop:
        log(f"  切り出し: {crop}")

    # ---- 1. 骨格の抽出 ----
    seq = extract_pose(args.video, args.model, crop=crop)
    if seq.num_frames == 0:
        print("[エラー] 動画からフレームを読めませんでした。")
        print("  iPhone の HEVC 形式だと読めない場合があります。")
        print("  カメラ設定を「互換性優先」にして撮り直すか、mp4 に変換してください。")
        return 1

    duration = seq.num_frames / seq.fps
    log(f"  {seq.num_frames} フレーム / {duration:.1f} 秒")

    # ---- 2. 骨格の妥当性を検証 ----
    result = validate(seq)
    st = result["stats"]
    log(f"  骨格を検出: {st['detected']}/{st['total']} "
        f"({100*st['detected']/max(st['total'],1):.0f}%) / "
        f"使えるフレーム {st['valid_pct']:.0f}%")

    warnings: list[str] = []
    if st["detected"] == 0:
        print("[エラー] 骨格を検出できませんでした。")
        print("  全身がカメラに収まっているか、明るさが十分かを確認してください。")
        return 1
    if st["valid_pct"] < 70:
        warnings.append(
            f"骨格が正しく取れたフレームが {st['valid_pct']:.0f}% しかありません。"
            "他の人の映り込みがある場合は --crop で範囲を絞ってください。")
    if duration < 20:
        warnings.append(
            f"動画が {duration:.0f} 秒と短めです。リズムを正確に測るには "
            "20 秒以上（できれば 30 秒）が必要です。")

    # ---- 3. 採点 ----
    report = default_pipeline().run(seq)

    # ---- 4. 出力 ----
    if args.json:
        print(json.dumps({
            "video": os.path.basename(args.video),
            "duration_sec": round(duration, 1),
            "total": round(report.total, 1),
            "upper": None if report.upper is None else round(report.upper, 1),
            "lower": None if report.lower is None else round(report.lower, 1),
            "profile": report.profile_name,
            "advice": report.advice(),
            "notes": report.notes(),
            "unmeasured": report.unmeasured(),
            "axes": [
                {"axis": r.axis, "part": r.part,
                 "score": round(r.score, 1) if r.measured else None,
                 "measured": r.measured,
                 "message": r.message, "metrics": r.metrics}
                for r in report.breakdown
            ],
            "quality": {"detected_pct": round(100*st["detected"]/st["total"], 1),
                        "valid_pct": round(st["valid_pct"], 1)},
            "warnings": warnings,
        }, ensure_ascii=False, indent=2))
    else:
        print()
        print(report.pretty())
        if warnings:
            print("\n■ 撮影についての注意")
            for w in warnings:
                print(f"  ・{w}")

    # ---- 5. 骨格の保存（任意）----
    if args.save:
        out = os.path.splitext(args.video)[0] + "_pose.npz"
        np.savez_compressed(
            out, xyz=seq.xyz, visibility=seq.visibility,
            xy_image=seq.xy_image, fps=seq.fps,
            valid=result["valid"], ratio=result["ratio"])
        log(f"\n骨格を保存: {out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
