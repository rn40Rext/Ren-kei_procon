# Expo SDK version

This app is on **Expo SDK 54** (`expo: ^54.0.36` in `package.json`).

Expo APIs change between SDK versions. Before writing any code, read the docs for
**this** version — not the latest:

https://docs.expo.dev/versions/v54.0.0/

This applies especially to `expo-camera`, `expo-av`, `expo-image-picker`, and
`expo-file-system`, where the API changed across recent SDKs.

If `package.json` no longer says `^54`, trust `package.json` and update this file.

> This file previously pointed to v57, which was never the version actually
> installed. Resolved in [#55](../../issues/55).

# Feature modules (AI analysis)

| Path | What it is | Test |
| --- | --- | --- |
| `src/features/pose/` | Landmark types, normalisation (`bodyScale` etc.), EMA smoothing, `PoseDetector` (Web: MediaPipe Tasks; native: stub), pose-series recorder | `normalize.test.ts` |
| `src/features/rules/` | Rule Engine state machine, metrics, rhythm (autocorrelation), Game Score, session aggregation, `defaultRules.json` (provisional thresholds) | `ruleEngine.test.ts`, `rhythm.test.ts`, `pipeline.test.ts` + JSON fixtures |
| `src/features/analysis/` | `useLiveAnalysis` (binds everything for U-02), UI types | — |
| `src/features/style/` | AI② display rules and feature flags | — |

Run `npm test` before committing; it needs no device. `npm run fixtures` regenerates the fixtures from `__fixtures__/synth.ts`.

Thresholds are provisional (TBD-02). Change them in `defaultRules.json` **and** document the change in `docs/design/ai-basic-motion.md` ch. 6; production values live in Firestore `analysisRules`.

