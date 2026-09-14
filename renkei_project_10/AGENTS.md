# AGENTS.md — renkei_project_10 (offline scoring engine, Python)

> Directory-specific rules, in addition to the root [../AGENTS.md](../AGENTS.md).

## What this is

A **Python, offline** scoring engine: one finished video → MediaPipe Pose → 8 explainable
axes (hand height / arm form / hand spread / hand entry / hip lowness / rhythm / stance /
namba) → total, upper-body and lower-body scores with per-axis reasons and raw metrics.

It is **not** what runs inside the app. The app's real-time Rule Engine lives in
`Ren-kei_procon/src/features/rules/` (TypeScript) and the server-side Analysis Score in
`functions/src/analysis/`. This engine is the **calibration and validation tool**:
measure expert footage, derive thresholds, compare against instructor judgement
(`docs/design/ai-basic-motion.md` ch. 6 has the axis ↔ RULE-xx mapping).

## Commands

```bash
pip install -r requirements.txt     # mediapipe is pinned to 0.10.14 (0.10.2x crashes on macOS)
python download_model.py            # models/pose_landmarker_full.task (git-ignored)
python test_scorers.py              # asserts good/bad separation; exit 1 on failure
python demo_synthetic.py            # core without mediapipe
python score_video.py dance.MOV     # score one video
python export_pose_series.py x.MOV  # pose-series-v1 JSON for FN-02 / FN-08
```

## Rules to follow here

- **Never return 0 points for "could not measure".** Use `unmeasured()` from
  `renkei/scorers/base.py` (sets `measured=False`); the pipeline excludes it from
  averages and lists it separately. A 0 would be indistinguishable from "worst possible".
- **Rhythm uses image coordinates (`xy_image`).** World coordinates have the hip at the
  origin, so their vertical signal is always ~0 and FFT would analyse noise
  (see `renkei/landmarks.py`).
- **Thresholds live in `renkei/profiles.py` and carry their source.** Awa Odori differs
  by ren; a score is "closeness to this ren's style", not good/bad.
- **Do not commit** `__pycache__/`, `models/*.task`, `*_pose.npz`, or personal absolute
  paths (`MODEL_PATH` is resolved from `RENKEI_POSE_MODEL` or `models/`).
- Comments and user-facing strings are Japanese; identifiers English (root AGENTS.md ch. 9).
