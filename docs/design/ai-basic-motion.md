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

## 3. 姿勢推定の組み込み（TBD-01）

React Native で MediaPipe を動かす方式が未確定です。以下を比較検証します。

| 方式 | 概要 | 利点 | 懸念 |
| --- | --- | --- | --- |
| A. `react-native-vision-camera` + Frame Processor + ネイティブ MediaPipe | iOS/Android の MediaPipe Tasks を直接叩く | 性能が最も高い。10fps 以上を狙いやすい | Expo Go 不可（Dev Client 必須）。ネイティブコードを書く必要あり |
| B. `expo-gl` / WebView + MediaPipe Tasks (JS/WASM) | Web 版 MediaPipe を WebView 内で実行 | 実装が容易、JS のみ | フレーム受け渡しのオーバーヘッド。目標 300ms を満たせない可能性 |
| C. TensorFlow Lite + `react-native-fast-tflite` | MoveNet 等の軽量モデルを直接推論 | 依存が軽い | MediaPipe の landmark 定義と異なり、仕様書の指標式を読み替える必要 |
| D. サーバ送信 | 動画をアップロードして解析 | クライアント実装が最小 | **リアルタイム不可**。仕様書 3.2 の方針に反する |

**推奨**: まず B で Rule Engine を含む縦の導線を通し（Prototype 1 の完了条件を満たす）、性能が足りなければ A へ移行する。C/D は代替案として保留。

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
| カメラ映像 | 全身が入る構図を推奨。人物検出信頼度が低い場合は警告 | ✅ プレビュー表示のみ実装 |
| 骨格オーバーレイ | landmark と骨格線を重ねる。公開動画に焼き込むかは要検討 | ❌ |
| 状態表示 | `READY` / `ANALYZING` 等 | ❌ |
| 即時評価 | GREAT / GOOD / MISS を短時間表示 | ❌ |
| 改善メッセージ | 「手を上げよう」等。Rule Engine の失敗理由から生成 | ❌ |
| LIVE SCORE | Game Score の累積 | ❌ |
| 項目ゲージ | 高さ / キープ / 交互などの進捗（`RuleEvaluator.progress()`） | ❌ |
| 操作 | 開始 / 停止 / 保存。解析中は状態を明示 | ⚠️ 「採点終了」ボタンのみ |

### U-03 解析結果（[ResultScreen](../../Ren-kei_procon/src/screens/ResultScreen.tsx)）

総合評価（0〜100）、項目別評価、AI コメント、グラフ、「コミュニティへ投稿」ボタン。現状はプレースホルダーのみ。

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
