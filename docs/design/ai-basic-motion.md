# AI機能① 基本動作トレーニング 実装設計

> 出典: [仕様書 7章 AI機能① 基本動作トレーニング](../spec/07-ai-basic-motion.md) / [12.1 基本動作練習シーケンス](../spec/12-sequences.md)
> 付録C「Rule Engine の閾値一覧・判定疑似コード・バージョン管理表」に対応する文書です。

## 1. 設計原則（仕様書 D-01〜D-04）

1. 阿波踊りの「上手さ」を一括採点する独自深層学習モデルは**作らない**。
2. 既存の姿勢推定（MediaPipe）で関節座標を取得し、**明示的なルール**で判定する。
3. 判定根拠を説明できること、閾値を後から変えられることを最優先する。
4. リアルタイムの **Game Score** と、履歴用の **Analysis Score（0〜100）** を分離する。

> 現在の実装では `CommunityScreen.tsx` が投稿時に `score: Math.floor(Math.random() * 20) + 80` を書き込んでいます。これは AI 採点ではなくモック値です。本設計の実装により置き換えます。

## 2. 処理パイプライン

```
カメラフレーム
   │  expo-camera
   ▼
[1] 姿勢推定 (MediaPipe Pose Landmarker)
   │  33 landmarks × {x, y, z, visibility}
   ▼
[2] 前処理  低信頼度点の除外 → 時間方向の平滑化
   │
   ▼
[3] 正規化  bodyScale で割る（体格・撮影距離の影響を除去）
   │  NormalizedFrame
   ▼
[4] Rule Engine  RULE-01〜07 を並列評価、状態機械で SUCCESS/MISS を発火
   │  RuleEvent[]
   ├──────────────▶ [5] リアルタイム UI（GREAT/GOOD/MISS、ゲージ、改善メッセージ）
   ├──────────────▶ [6] Game Score 加算（LIVE SCORE）
   ▼
[7] セッション集計  ルール別成功率・rawMetrics
   │
   ▼
[8] FN-01 finalizeBasicAnalysis（Cloud Functions）
   │  Analysis Score 0〜100 を算出し保存
   ▼
analysisResults + growthRecords
```

[1]〜[7] はクライアント、[8] はバックエンド（スコア改ざん防止のため）。

**実装（2026-09-13）**: [1] `Ren-kei_procon/src/features/pose/PoseDetector.web.ts`、[2] `pose/preprocess.ts`、[3] `pose/normalize.ts`、[4] `rules/ruleEngine.ts` + `rules/metrics.ts`、[5]〜[6] `features/analysis/useLiveAnalysis.ts` + `screens/CameraScreen.tsx`、[7] `rules/session.ts`、[8] `functions/src/analysis/finalizeBasicAnalysis.ts` + `score.ts`。全体を束ねるのは `useLiveAnalysis`。詳細は 12 章。

## 3. 姿勢推定の組み込み（TBD-01 → 決定済み）

**決定（2026-09-13、[#13](../../../issues/13)）: Prototype 1 は方式 B' = Expo Web + MediaPipe Tasks Vision（`@mediapipe/tasks-vision` 1.0.1、WASM + WebGL）で実装する。** WebView ではなく、アプリ自体を Expo Web（`react-native-web`）で動かし、`<video>` 要素を Pose Landmarker に直接渡す。ネイティブ（iOS / Android）は方式 A（`react-native-vision-camera` + ネイティブ MediaPipe）を後続とし、現状は `PoseDetector.ts` のスタブが `POSE_NOT_SUPPORTED` を返す。

採用理由:

1. アプリはすでに Web で動く（`react-native-web` / `expo start --web`）ため、ネイティブビルドも Dev Client も要らず、デモをノート PC で投影できる。
2. 計測で目標（10fps 以上・遅延 300ms 以内）を大きく上回った（下表）。
3. Web 実装（`PoseDetector.web.ts`）とネイティブ実装は同じ `PoseDetector` インタフェースで差し替えられる。

### 計測結果（受け入れ条件「10fps 以上・300ms 以内」）

計測条件: 実写の阿波踊り動画（Wikimedia Commons「Awa dance-koenji-aug2017」CC BY-SA 4.0、854×480、30fps）を `<video>` で再生し、`detectForVideo` を毎フレーム呼ぶ。Apple Silicon Mac、アプリ内ブラウザ（Chromium）、10 秒間。

| モデル / delegate | 推論 fps | 推論時間 avg | 推論時間 max | 検出率 |
| --- | --- | --- | --- | --- |
| **full / GPU（採用）** | **58.2**（映像の 60fps に追従） | **12.9 ms** | 315 ms（初回） | 578 / 583 |
| lite / CPU | 58.0 | 16.7 ms | 97 ms | 510 / 581（検出率が落ちる） |
| lite / GPU | 17.5 | 52 ms | 7,132 ms（WASM/GPU の初回起動込み） | 174 / 175 |

- 初回フレームは WASM とシェーダのコンパイルで数秒かかる。UI は `loading`（モデル読み込み中）状態を明示し、判定開始ボタンを無効化する。
- 遅延はフレーム取得 → 推論 → 判定 → 描画までを同一 rAF 内で行い、推論 13ms + 判定 <1ms なので 300ms を十分下回る。
- 実測ページ: `PoseDetector.web.ts` と同じ CDN / モデル URL を使う簡易ページで測った。再計測するときは `docs/design/ai-basic-motion.md` のこの表を更新する。

### 前処理（受け入れ条件「低信頼度点の除外と平滑化」）

`pose/preprocess.ts` の `PoseSmoother`。visibility < 0.5 の点は座標を前回値で埋め（visibility はそのまま残し、後段の正規化関数が null 判定に使う）、座標は時定数 80ms の指数移動平均で平滑化する（フレーム間隔に応じて係数を変え、fps が揺れても同じ時定数になる）。

### 比較した方式（記録）

React Native で MediaPipe を動かす方式として、以下を比較した。

| 方式 | 概要 | 利点 | 懸念 |
| --- | --- | --- | --- |
| A. `react-native-vision-camera` + Frame Processor + ネイティブ MediaPipe | iOS/Android の MediaPipe Tasks を直接叩く | 性能が最も高い。10fps 以上を狙いやすい | Expo Go 不可（Dev Client 必須）。ネイティブコードを書く必要あり |
| B. `expo-gl` / WebView + MediaPipe Tasks (JS/WASM) | Web 版 MediaPipe を WebView 内で実行 | 実装が容易、JS のみ | フレーム受け渡しのオーバーヘッド。目標 300ms を満たせない可能性 |
| C. TensorFlow Lite + `react-native-fast-tflite` | MoveNet 等の軽量モデルを直接推論 | 依存が軽い | MediaPipe の landmark 定義と異なり、仕様書の指標式を読み替える必要 |
| D. サーバ送信 | 動画をアップロードして解析 | クライアント実装が最小 | **リアルタイム不可**。仕様書 3.2 の方針に反する |

当初は「B で縦の導線を通し、性能が足りなければ A」としていた。実装では WebView を挟まず Expo Web 上で直接動かす B' にしたため、フレーム受け渡しのオーバーヘッド（B の懸念）は発生しない。A は実機アプリで必要になった時点で着手する（`PoseDetector` の実装を追加するだけで Rule Engine 側は変わらない）。D（サーバ送信）は `renkei_project_10/`（Python・オフライン 8 軸採点）として較正・検証用に併存している（12.3 節）。

> Expo のバージョンによって使える API が変わります。実装前に `AGENTS.md` の指示どおり、対象バージョンの公式ドキュメント（https://docs.expo.dev/versions/ ）を確認してください。

### 使用する landmark

仕様書 7.2 に従い、以下を使います（MediaPipe Pose の index）。

| 部位 | index |
| --- | --- |
| nose | 0 |
| left/right shoulder | 11 / 12 |
| left/right elbow | 13 / 14 |
| left/right wrist | 15 / 16 |
| left/right hip | 23 / 24 |
| left/right knee | 25 / 26 |
| left/right ankle | 27 / 28 |

## 4. 正規化（仕様書 7.3）

画像座標は下方向が正（`y` が大きいほど下）である前提です。

```ts
// src/features/pose/normalize.ts
export type Landmark = { x: number; y: number; z?: number; visibility: number };
export type Frame = { landmarks: Landmark[]; timestampMs: number };

const MIN_VISIBILITY = 0.5;

function center(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(a.visibility, b.visibility) };
}

/** 身長相当のスケール。これで割ることで体格差・撮影距離の影響を除く */
export function bodyScale(f: Frame): number | null {
  const shoulderCenter = center(f.landmarks[11], f.landmarks[12]);
  const ankleCenter = center(f.landmarks[27], f.landmarks[28]);
  if (shoulderCenter.visibility < MIN_VISIBILITY || ankleCenter.visibility < MIN_VISIBILITY) {
    return null; // 全身が映っていない → NOT_READY
  }
  return Math.hypot(shoulderCenter.x - ankleCenter.x, shoulderCenter.y - ankleCenter.y);
}

/** 手の高さ: 頭より上にあるほど正の大きな値 */
export function normalizedHandHeight(f: Frame, side: 'left' | 'right', scale: number): number {
  const wrist = f.landmarks[side === 'left' ? 15 : 16];
  const head = f.landmarks[0];
  return (head.y - wrist.y) / scale;
}

/** 腰の低さ: 腰が落ちているほど小さい値 */
export function normalizedHipHeight(f: Frame, scale: number): number {
  const hipCenter = center(f.landmarks[23], f.landmarks[24]);
  const ankleCenter = center(f.landmarks[27], f.landmarks[28]);
  return (ankleCenter.y - hipCenter.y) / scale;
}

/** 手の速度: 停止判定に使う */
export function normalizedVelocity(prev: Frame, cur: Frame, idx: number, scale: number): number {
  const dt = (cur.timestampMs - prev.timestampMs) / 1000;
  if (dt <= 0) return 0;
  const a = prev.landmarks[idx];
  const b = cur.landmarks[idx];
  return Math.hypot(b.x - a.x, b.y - a.y) / scale / dt;
}
```

### 膝角度（RULE-03 用）

```ts
export function kneeAngleDeg(f: Frame, side: 'left' | 'right'): number {
  const [h, k, a] = side === 'left' ? [23, 25, 27] : [24, 26, 28];
  const v1 = { x: f.landmarks[h].x - f.landmarks[k].x, y: f.landmarks[h].y - f.landmarks[k].y };
  const v2 = { x: f.landmarks[a].x - f.landmarks[k].x, y: f.landmarks[a].y - f.landmarks[k].y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
```

## 5. Rule Engine の状態機械（仕様書 7.5）

単一フレームで成功判定してはいけません。座標の揺れで GOOD/MISS が反転するのを防ぐため、**連続成立時間**と**ヒステリシス**を持たせます。

```
        visibility < 閾値
   ┌──────────────────────────┐
   ▼                          │
NOT_READY ──visibility OK──▶ READY ──条件成立──▶ HOLDING ──holdDuration 経過──▶ SUCCESS
                               ▲                    │                              │
                               │      条件を外れた  │                              │
                               └────────────────────┘                              │
                               ▲                                                   │
                               └───────────────────────────────────────────────────┘
                               ▲
                               │  期待タイミング超過
                            MISS ◀──────────────
```

```ts
// src/features/rules/ruleEngine.ts
export type RuleState = 'NOT_READY' | 'READY' | 'HOLDING' | 'SUCCESS' | 'MISS';
export type Grade = 'GREAT' | 'GOOD' | 'MISS';

export type RuleDefinition = {
  ruleId: string;                  // 例: 'HAND_ABOVE_HEAD'
  name: string;
  metric: string;                  // 使用する指標名
  minValue?: number;               // 最低基準（GOOD ライン）
  maxValue?: number;
  idealMinValue?: number;          // 理想範囲（GREAT ライン）
  idealMaxValue?: number;
  holdDurationMs?: number;         // 連続成立が必要な時間
  releaseMarginRatio?: number;     // ヒステリシス。既定 0.1（10% 余裕を持って解除）
  enabled: boolean;
  version: string;
};

export type RuleEvent = {
  ruleId: string;
  grade: Grade;
  timestampMs: number;
  message?: string;                // 改善メッセージ（MISS 時）
  value: number;                   // 判定に使った実測値（rawMetrics 用）
};

export class RuleEvaluator {
  private state: RuleState = 'NOT_READY';
  private holdStartMs: number | null = null;

  constructor(private def: RuleDefinition) {}

  /** metric 値を毎フレーム渡す。value が null なら検出不能 */
  evaluate(value: number | null, timestampMs: number): RuleEvent | null {
    if (value === null) {
      this.state = 'NOT_READY';
      this.holdStartMs = null;
      return null;
    }

    const inRange = this.inRange(value, false);
    const inIdeal = this.inIdealRange(value);

    switch (this.state) {
      case 'NOT_READY':
      case 'READY':
        if (inRange) {
          this.state = 'HOLDING';
          this.holdStartMs = timestampMs;
        }
        return null;

      case 'HOLDING': {
        // ヒステリシス: 解除は少し広い範囲で判定し、チャタリングを防ぐ
        if (!this.inRange(value, true)) {
          this.state = 'READY';
          this.holdStartMs = null;
          return null;
        }
        const held = timestampMs - (this.holdStartMs ?? timestampMs);
        if (held >= (this.def.holdDurationMs ?? 0)) {
          this.state = 'READY';           // 発火後すぐ次の判定へ戻す
          this.holdStartMs = null;
          return {
            ruleId: this.def.ruleId,
            grade: inIdeal ? 'GREAT' : 'GOOD',
            timestampMs,
            value,
          };
        }
        return null;
      }
      default:
        this.state = 'READY';
        return null;
    }
  }

  /** 進捗 0..1。UI の項目ゲージに使う */
  progress(timestampMs: number): number {
    if (this.state !== 'HOLDING' || this.holdStartMs === null) return 0;
    const need = this.def.holdDurationMs ?? 1;
    return Math.min(1, (timestampMs - this.holdStartMs) / need);
  }

  private inRange(value: number, forRelease: boolean): boolean {
    const margin = forRelease ? (this.def.releaseMarginRatio ?? 0.1) : 0;
    const min = this.def.minValue !== undefined ? this.def.minValue * (1 - margin) : -Infinity;
    const max = this.def.maxValue !== undefined ? this.def.maxValue * (1 + margin) : Infinity;
    return value >= min && value <= max;
  }

  private inIdealRange(value: number): boolean {
    if (this.def.idealMinValue === undefined && this.def.idealMaxValue === undefined) return false;
    return value >= (this.def.idealMinValue ?? -Infinity) && value <= (this.def.idealMaxValue ?? Infinity);
  }
}
```

### 実装での拡張（`rules/ruleEngine.ts`）

上の疑似コードに加えて、実装では次を持つ（いずれも `RuleDefinition` のフィールドで analysisRules から変更できる）。

| 拡張 | 目的 |
| --- | --- |
| `conditions[]`（複合条件） | RULE-03「腰 かつ 膝」、RULE-05「水平距離 かつ 手が頭より上」を単一ルールと同じ状態機械で扱う |
| `side: 'both'` | 手のルールを左右 2 つの評価器に展開し、左右別に発火する（[#15](../../../issues/15)）。指標は `normalizedHandHeight:left` のようにキーに側を付ける |
| `cooldownMs` | 発火直後に条件が成立し続けても連続発火しない（HAND_ABOVE_HEAD は 1.5 秒） |
| `missAfterMs` | READY（条件未成立）が続いたら MISS を発火し改善メッセージを出す。0 で無効 |
| `danceType` | 男踊り / 女踊りでルールを出し分ける受け皿（TBD-03） |

RULE-04「手を止める」は `rules/metrics.ts` の `MetricsTracker` が「直前 700ms 以内に正規化速度 0.8 以上の動作があった」ときだけ速度指標を渡す。棒立ちの静止を「止めた」と判定しないため（仕様書 7.4「位置だけで判定しない」）。

## 6. ルール一覧と閾値の初期値（TBD-02）

**下記の数値はすべて暫定です。** 連の指導者へのヒアリング後に確定します（仕様書 TBD-02）。単位は「bodyScale で正規化した比率」です。

| ID | ruleId | 指標 | 最低基準(GOOD) | 理想(GREAT) | hold | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| RULE-01 | `HAND_ABOVE_HEAD` | `normalizedHandHeight` | `> 0.05` | `> 0.12` | 200ms | 手首が頭より上 |
| RULE-02 | `HAND_KEEP` | RULE-01 成立の継続 | `> 0.05` | `> 0.12` | 800ms | 「上げたまま保つ」 |
| RULE-03 | `HIP_LOW` | `normalizedHipHeight` + `kneeAngleDeg` | 腰 `< 0.55` かつ 膝 `< 160°` | 腰 `< 0.48` かつ 膝 `< 145°` | 500ms | 身長正規化を必須とする |
| RULE-04 | `HAND_STOP` | `normalizedVelocity`（手首） | `< 0.30` | `< 0.15` | 250ms | 「出して止める」。位置だけで判定しない |
| RULE-05 | `HAND_POSITION` | 手首が頭上の許容領域内 | 水平距離 `< 0.25` | `< 0.15` | 200ms | 左右差・男女差は要検討（TBD-03） |
| RULE-06 | `BASE_POSTURE` | RULE-03 + 上体角度の同時成立 | 複合条件 | 複合条件 | 1000ms | |
| RULE-07 | `RHYTHM` | 腰上下動の周期と基準拍の差 | 誤差 `< 15%` | `< 7%` | — | 下記 8 章 |

### 閾値の外部化（仕様書 7.9）

閾値をアプリに埋め込むと、変更のたびにリリースが必要になります。Firestore の `analysisRules/{ruleId}` に `RuleDefinition` を置き、起動時に取得してキャッシュします。

```
analysisRules/HAND_ABOVE_HEAD
  { ruleId, name: '手の高さ', metric: 'normalizedHandHeight',
    minValue: 0.05, idealMinValue: 0.12, holdDurationMs: 200,
    enabled: true, version: 'v1' }
```

- オフライン時・取得失敗時はアプリ内バンドルの既定値へフォールバックします。
- `version` は `analysisResults.analysisVersion` に記録し、過去スコアとの比較可能性を担保します（仕様書 7.7）。

**実装（[#21](../../../issues/21)）**: 既定値は `Ren-kei_procon/src/features/rules/defaultRules.json`（上表と同じ値）。`repositories/analysisRules.ts` の `loadRuleSet()` がセッション開始時に `analysisRules` を全件読み、ルール ID ごとに既定値を上書きしてメモリにキャッシュする（Firestore に無いルールは既定値のまま）。取得失敗時は `source: 'bundled'` で続行し、U-02 画面下部に「内蔵の既定値」と表示する。リズムの設定（基準 BPM・許容・窓長）は `analysisRules/RHYTHM` の `rhythm` フィールドに置く。初期投入は `cd functions && npm run seed:rules`（Firestore Emulator / 本番どちらにも使える。既存ドキュメントは `--force` なしでは上書きしない）。Security Rules は `analysisRules` を認証済み read 専用にしている。

### 男踊り / 女踊りの扱い（TBD-03 → 暫定決定）

**暫定決定（2026-09-13、[#18](../../../issues/18)）: 案 C（当面は共通ルール）+ 案 A の受け皿。** `RuleDefinition.danceType`（`'male' | 'female' | 'all'`）を持ち、`createEvaluators(defs, danceType)` が一致しないルールを除外する。現状の既定ルールはすべて `danceType` 未指定（= 共通）。女踊り固有の閾値が指導者ヒアリングで決まったら、`analysisRules` に `danceType: 'female'` のドキュメントを追加するだけで分離できる（アプリ改修不要）。理由: 女踊りの基準値を裏付ける実測が無く、根拠の無い分岐を先に作ると「仕様書 7.4 の未確定点」を勝手に確定することになるため。

### オフライン採点エンジン（`renkei_project_10/`）との軸の対応

`renkei_project_10/` は録り終えた動画 1 本を Python で 8 軸採点するオフライン版（[#98](../../../pull/98)）。リアルタイム判定とは目的が異なる（較正・熟練者データの実測・指導者との突き合わせ）。軸の対応は次のとおりで、閾値は両者で独立に持っている（Python 側は `renkei/profiles.py` の連ごとの実測値）。

| RULE | アプリ（リアルタイム・1 フレーム） | Python（オフライン・動画 1 本） |
| --- | --- | --- |
| RULE-01/02 手の高さ・キープ | `normalizedHandHeight` の hold | `HandHeightScorer`（手首が鼻より上だった時間の割合・前半後半の低下） |
| RULE-03 腰の低さ | `normalizedHipHeight` + `kneeAngleDeg` | `HipLownessScorer`（膝屈曲角の平均） |
| RULE-04 手を止める | `normalizedHandVelocity`（動作直後のみ） | （なし） |
| RULE-05 手の位置 | `normalizedHandHorizontalOffset` | `HandSpreadScorer`（手首間 / 肩幅）・`ArmFormScorer`（肘角度） |
| RULE-06 基本姿勢維持 | `basePostureMargin`（腰・膝・上体の複合） | （なし。`StanceWidthScorer` 足幅が近い） |
| RULE-07 リズム | 自己相関で BPM（8 秒窓） | `RhythmScorer`（FFT。20 秒以上必要） |
| （なし） | — | `HandEntryScorer` 手を上から出す・`NambaScorer` なんば |

`HandEntryScorer` と `NambaScorer` はリアルタイム化の候補（1 振り・数秒の窓で判定できる）。Python 側の 8 軸をサーバ採点（Cloud Run）としてアプリに接続する案は 12.3 節。

## 7. Game Score（仕様書 7.6）

| 評価 | 条件 | 加点 |
| --- | --- | --- |
| GREAT | 理想範囲で達成 | +100 |
| GOOD | 最低基準で達成 | +60 |
| MISS | 失敗・タイミング逸脱 | +0 |
| COMBO | 連続成功 | `floor(combo / 5)` 倍のボーナス（MVP では未実装可） |

Game Score はローカル状態として保持し、**Firestore へは `analysisResults.gameScore` としてのみ保存**します。UX 調整用の値であり、阿波踊りの絶対評価ではありません。

## 8. リズム評価（RULE-07 / TBD-04）

仕様書 7.8 は腰の上下動を FFT で周波数解析する案を示しています。MVP 実装方針:

1. 腰中心 `y` の時系列を 3〜5 フレームの移動平均で平滑化する。
2. 直近 4〜8 秒のウィンドウを切り出し、平均を引いて DC 成分を除去する。
3. FFT で主周波数を求める（`fft-js` 等の軽量ライブラリ、または自己相関で代替）。
4. 主周波数 → BPM（`bpm = freqHz * 60`）へ変換し、基準 BPM との相対誤差を評価する。

```ts
rhythmScore = clamp(100 * (1 - |userBpm - baseBpm| / baseBpm / TOLERANCE), 0, 100)
```

**基準 BPM の決め方が未確定です（TBD-04）。** 候補:

| 案 | 内容 | 評価 |
| --- | --- | --- |
| A | 固定 BPM の練習用音源をアプリが再生する | 最も簡単で誤差が定義しやすい。**MVP 推奨** |
| B | ユーザーが BPM を選択する | 段階的練習に向く |
| C | 端末マイクで実際の鳴り物を拾って推定 | 実戦的だが実装難度が高い。将来 |

阿波踊りは 2 拍子であるため、腰の上下動は 1 拍ごと・2 拍ごとのどちらにも現れ得ます。**主周波数の 1/2・2 倍も許容候補として比較し、最も誤差が小さいものを採用**します。

### 実装と決定（[#19](../../../issues/19)）

- **周期推定は FFT ではなく自己相関**（`rules/rhythm.ts`）。FFT の分解能 Δf = 1/T は 8 秒窓で 7.5 BPM 刻みにしかならないが、自己相関のラグはサンプル単位で刻めるうえ放物線補間で細かくできる。腰中心 y を 30fps に再標本化 → 5 点移動平均 → 平均除去 → 自己相関 → 最大値の 85% 以上の高さを持つ最初の局所最大（基本周期）→ BPM。周期の整数倍にも同じ高さのピークが出るため「最初の」局所最大を採る。上下動の分散が実質ゼロならノイズから偽の周期を拾わず `null` を返す。
- 探索範囲の下限は `bpmMin / 2`（30 BPM）まで下げ、2 拍に 1 回しか腰が沈まない踊り方も拾ってから 1/2・2 倍の補正をかける。
- 窓は 8 秒（`windowMs`）、4 秒未満（`minWindowMs`）では推定しない。1 秒ごとに推定し、GREAT（誤差 7% 以下）/ GOOD（15% 以下）/ MISS を `RHYTHM` のイベントとして発火する。
- 合成データでの検証: 90 / 112 / 130 BPM を ±3 BPM 以内で復元、56 BPM の上下動を 112 として評価（`rules/rhythm.test.ts`）。

**TBD-04（基準 BPM の決め方）→ 暫定決定: 案 B（ユーザーが選ぶ）。** U-02 の前段（`ScoringScreen`）で 96 / 104 / 112 / 120 / 128 から選ぶ。既定の 112 は `renkei_project_10/renkei/profiles.py` にあるさゝゆり連の熟練者映像の実測値（正面 112.8 / 横 111.2 BPM）。案 A（練習用音源の再生）は音源の権利処理と端末スピーカーの遅延が要るため MVP では行わない。案 C（マイクで鳴り物を拾う）は将来。

## 9. Analysis Score（仕様書 7.7）

セッション終了時、クライアントは集計値を FN-01 へ送り、**サーバ側でスコアを確定**します。

```ts
// 項目別スコア（0〜100）
handHeightScore = 100 * (great * 1.0 + good * 0.7) / attempts
hipHeightScore  = 100 * holdRatio            // 基準内で維持できた時間の割合
stopScore       = 100 * (stopSuccess / stopAttempts)
rhythmScore     = 上記 8 章の式

// 総合（初期は単純平均。指導者評価との比較後に重みを確定 → TBD-05）
totalScore = mean([handHeightScore, hipHeightScore, stopScore, rhythmScore].filter(存在する項目))
```

**実装（[#20](../../../issues/20) / [#35](../../../issues/35)）**: `functions/src/analysis/score.ts`（純関数）と `finalizeBasicAnalysis.ts`（FN-01）。手の高さは RULE-01 と RULE-02 の回数を合算して成功率にする。RULE-05 手の位置・RULE-06 基本姿勢は `handPositionScore` / `basePostureScore` として項目別に保存するが、**重みが決まるまで総合には入れない**（TBD-05 は単純平均のまま未決定）。総合は 4 項目のうち集計が存在するものの単純平均。クライアントが `totalScore` を送ってきても無視する。冪等性は `clientRequestId` をドキュメント ID（`{uid}_{clientRequestId}`）に使って担保する。

`feedback` はルール根拠から生成します。

```ts
[
  { type: 'good',    ruleId: 'HAND_ABOVE_HEAD', message: '手の高さは安定していました' },
  { type: 'improve', ruleId: 'HIP_LOW',         message: '腰の位置がやや高いです。膝をもう少し曲げましょう' },
]
```

## 10. U-02 / U-03 画面要件

### U-02 踊り解析（[ScoringScreen](../../Ren-kei_procon/src/screens/ScoringScreen.tsx) + [CameraScreen](../../Ren-kei_procon/src/screens/CameraScreen.tsx)）

| 領域 | 要件 | 現状 |
| --- | --- | --- |
| カメラ映像 | 全身が入る構図を推奨。人物検出信頼度が低い場合は警告 | ✅ Web: `PoseCameraView.web.tsx`。`PERSON_NOT_DETECTED` / `MULTIPLE_PERSONS_DETECTED` / `NOT_FULL_BODY` / `LOW_LANDMARK_CONFIDENCE` を上部に表示。カメラ拒否は `CAMERA_PERMISSION_DENIED` の案内。保存済み動画の入力（「動画ファイルで試す」）も可 |
| 骨格オーバーレイ | landmark と骨格線を重ねる。公開動画に焼き込むかは要検討 | ✅ canvas に描画。主人物は色付き、他の人物は薄く。動画には焼き込まない |
| 状態表示 | `READY` / `ANALYZING` 等 | ✅ `loading` / `READY` / `ANALYZING` / `保存・採点中` |
| 即時評価 | GREAT / GOOD / MISS を短時間表示 | ✅ 映像中央に 0.9 秒表示 |
| 改善メッセージ | 「手を上げよう」等。Rule Engine の失敗理由から生成 | ✅ `RuleDefinition.improveMessage`（analysisRules で変更可） |
| LIVE SCORE | Game Score の累積 | ✅ 右パネル。COMBO 表示あり |
| 項目ゲージ | 高さ / キープ / 交互などの進捗（`RuleEvaluator.progress()`） | ✅ HOLDING 中は進捗、それ以外は条件への近さ。リズムは推定 BPM を表示 |
| 操作 | 開始 / 停止 / 保存。解析中は状態を明示 | ✅ 判定を開始 / 終了して採点 / 中止。終了時に動画・姿勢系列を Storage へ保存し FN-01 で確定 → U-03 |

ネイティブ（iOS / Android）では `PoseCameraView.tsx` がプレビューと「Web 版で利用できます」の案内だけを出す（TBD-01 の方式 A が未着手のため）。

### U-03 解析結果（[ResultScreen](../../Ren-kei_procon/src/screens/ResultScreen.tsx)）

総合評価（0〜100）、項目別評価、AI コメント、グラフ、「コミュニティへ投稿」ボタン。

**実装（[#20](../../../issues/20)）**: `analysisResults/{analysisId}` を購読して表示。総合（Analysis Score）と項目別バー、`feedback`（改善点を先に）、`analysisVersion`。Game Score は「練習中の LIVE SCORE（参考値）」として別枠で、別物であることを文言で明示する（D-04）。「動きの類似度を見る」→ `StyleResult`（AI②）、「コミュニティへ投稿」→ `Community`（`shareVideoId` を渡し、投稿フォームに練習動画を入れる。`publishPost` が `analysisResults.totalScore` を投稿に載せる）。グラフは項目別の横バー（外部ライブラリなし）。

## 11. テスト（仕様書 15.1）

| 種別 | 内容 |
| --- | --- |
| Unit | 固定 landmark 系列を入力し、各ルールが期待どおり判定されるか |
| 境界値 | 閾値の直前 / 直後、`holdDurationMs` の直前 / 直後 |
| ノイズ | 座標に揺れを加えたとき GOOD/MISS がチャタリングしないか（ヒステリシスの検証） |
| 欠損 | 手首・足首の `visibility` が低いとき誤加点しないか |
| 左右 | 左右の手、鏡像で一貫するか |
| 実地 | 連の指導者が OK/NG と判断した動画に対して判定が妥当か |

テスト用フィクスチャは `src/features/rules/__fixtures__/` に JSON で置き、実機なしで CI 実行できるようにします。

**実施状況（2026-09-13）**: `cd Ren-kei_procon && npm test`（`node --test` + `tsx`、33 件）。

| 種別 | テスト |
| --- | --- |
| Unit | `pose/normalize.test.ts`（正規化が撮影距離に依存しない・膝角度・上体角）、`rules/ruleEngine.test.ts`（GREAT/GOOD の区別・複合条件・左右展開・danceType 除外） |
| 境界値 | 閾値 0.049 / 0.051、hold 199ms / 200ms |
| ノイズ | ±0.004 の揺れで HOLDING が解除されない。`hand_chatter.json` で MISS が混ざらない |
| 欠損 | 手首・足首の visibility が低いとき null → NOT_READY、発火ゼロ（`ankles_hidden.json`） |
| 左右 | 鏡像フィクスチャで同じルールが同じ回数成功する |
| リズム | 合成 90/112/130 BPM を ±3 で復元、56 BPM → 112、短い窓・平坦で推定しない |
| 縦の導線 | `pipeline.test.ts`: 平滑化 → 指標 → 状態機械 → 集計 → FN-01 payload（`totalScore` を含まない）まで |
| サーバ | `cd functions && npm test`（`score.test.ts`）、`npm run verify:emulator`（FN-01 の保存・冪等・他人の動画拒否） |
| 実地 | ❌ **未実施**。連の指導者が OK/NG と判断した動画での妥当性確認は、閾値（TBD-02）の確定と同時に行う。`renkei_project_10/score_video.py` と `analysisResults.rawMetrics` を突き合わせ材料にする |

フィクスチャは `npm run fixtures`（`__fixtures__/generate.ts`）で合成する。合成データは MediaPipe の推定誤差・遮蔽・服装を含まないので、**確認できるのは状態機械と正規化が設計どおりに動くことまで**で、閾値の妥当性は実地でしか確認できない。

## 12. 実装状況とデータの流れ（2026-09-13）

### 12.1 1 回の練習で起きること（仕様書 12.1 との対応）

1. U-02 前段（`ScoringScreen`）で踊りの種類・部位・基準 BPM を選ぶ。
2. `CameraScreen` が `PoseCameraView` からカメラ（または動画ファイル）を受け取り、`useLiveAnalysis.prepare()` が analysisRules とモデルを読み込む（`loading` → `ready`）。
3. 「判定を開始」で毎フレーム: 推論 → 平滑化 → 指標 → 各 `RuleEvaluator` → イベント → Game Score / メッセージ / ゲージ。腰 y は `RhythmAnalyzer` へ、姿勢は `PoseSeriesRecorder`（15fps に間引き）へ。カメラのときは `MediaRecorder` で録画する。
4. 「終了して採点」で `videos` を作成（`visibility: 'private'` / `analysisStatus: 'uploaded'`）→ 動画を `users/{uid}/videos/{videoId}.webm` へ、姿勢系列を `…/{videoId}.pose.json` へ → `SessionAggregator.build()` の集計値を FN-01 へ。
5. FN-01 が `analysisResults` / `users/{uid}/growthRecords` を作り、`videos.analysisStatus = 'completed'` にする。
6. `ResultScreen` が結果を表示。姿勢系列があるので AI②（FN-02）にそのまま進める。

TBD-07（練習動画を常に保存するか）は**暫定的に「常に保存」**で実装した。録画に失敗した（`MediaRecorder` 非対応など）場合は動画なし・姿勢系列のみで確定する。

### 12.2 完了条件の確認（[#5](../../../issues/5)）

| 完了条件 | 状況 |
| --- | --- |
| 10fps 以上でランドマーク取得 | ✅ full/GPU 58fps（3 章） |
| RULE-01〜07 が状態機械として動作し GREAT/GOOD/MISS を発火 | ✅ RULE-01〜06 は `RuleEvaluator`、RULE-07 は `RhythmAnalyzer`（テスト 11 章） |
| 判定結果がリアルタイムに UI へ反映 | ✅ 骨格・LIVE SCORE・改善メッセージ・ゲージ（10 章） |
| 終了後に Analysis Score を算出し履歴保存 | ✅ FN-01（9 章）。`growthRecords` も作成 |
| 閾値をアプリ改修なしで変更 | ✅ analysisRules（6 章） |
| 指導者が OK/NG と判断した動画で判定が妥当 | ❌ **未実施**（実地データと指導者の判断が必要。TBD-02 と同時に） |

### 12.3 残課題

- **閾値の確定（TBD-02）**: 既定値はすべて暫定。`renkei_project_10/calibrate.py` の実測と `analysisResults.rawMetrics` を材料に指導者ヒアリングで決め、`analysisRules` を更新する。
- **ネイティブ対応（方式 A）**: `PoseDetector` のネイティブ実装。Rule Engine 側は変更不要。
- **サーバ側の再解析**: 現状は FN-01 がクライアントの集計値を信頼する（docs/design/api-functions.md の注記どおり）。`renkei_project_10/` を Cloud Run に載せ、保存した動画 / 姿勢系列から 8 軸を再採点して `analysisResults` に添える案がある（TBD-12 と合わせて判断）。
- **項目重み（TBD-05）**: 単純平均のまま。指導者評価との比較後に確定。
- **Game Score の点数（TBD-06）**: 暫定値（GREAT 100 / GOOD 60 / MISS 0 / 5 コンボごとに倍率 +1）。UX テスト後に確定。
