# Ren-Kei 採点コア（骨組み）

阿波踊りの動画を骨格推定し、**説明可能なスコア**を返す採点エンジンの土台。

## 重要: 座標系の使い分け
MediaPipe は 2 系統の座標を返す。**混同すると無言で壊れる**。

| 座標系 | 原点 | 使う場面 |
|---|---|---|
| ワールド座標 `xyz` | **腰の中点** | 関節角度（腰の低さ、なんば） |
| 画像座標 `xy_image` | 画面左上 | **体の上下動＝リズム(FFT)** |

ワールド座標は腰が原点なので、`midpoint(L_HIP, R_HIP)` は**常に (0,0,0)**。
これを上下動として FFT にかけると数値ノイズを解析することになり、
帯域端に張り付いた偽のテンポが出る（実際に踏んだ）。
上下動は必ず `xy_image` から取ること。`RhythmScorer` には
「上下動が実質ゼロなら測れないと返す」安全網を入れてある。

## 採点の構成（男踊り）
表示は **総合点 / 上半身 / 下半身** の 3 項目。
連への聞き取りで、指導が「足だけ練習」「上半身だけ」と部位で分かれていたため、
採点も同じ切り口にしてある。

| 部位 | 軸 | 聞き取りでの根拠 |
|---|---|---|
| 上半身 | 手の高さ・キープ | 「腰を落とすのと手を上げるのが基本」「ずっと上げたらしんどいんで下がってくる」 |
| 上半身 | 腕の形 | 指導映像の男踊りは肘を曲げた構え。高さだけ見ると雑な形と区別できない |
| 上半身 | 手の位置 | 頭の上あたりにまとめる。大きく横に広げない |
| 上半身 | 手の出し方 | 「上から出すようにお願いしたら、下から出てくれました」（初心者の典型） |
| 下半身 | 腰の低さ | 「低いほどかっこいい」 |
| 下半身 | リズム | 「鉦のチャチャンチャチャンって2拍子」 |
| 下半身 | 足幅 | 「足は肩幅ぐらいまで開いて」 |
| 連動 | なんば | 「右足を出したら、右手が前に出る」= 阿波踊り最大の特徴 |

なんばは上半身・下半身どちらにも属さないため部位別には出さず、総合点にのみ反映する。

## 設計方針
採点を「差し替え可能な軸の集合」にしてある。各軸は独立した `Scorer` で、
数値だけでなく **なぜその点か（説明文＋根拠の測定値）** を返す。
総合点は軸ごとの重み付き和で、内訳が常に開示される。
→ 審査コメントの「採点基準が不透明」「難所をどう解決するか説明が欲しい」への回答。

## 構成
```
renkei/
  landmarks.py      # 33関節の定義と PoseSequence(時系列骨格)
  pose_extractor.py # 動画 -> PoseSequence（MediaPipe Tasks API）
  features.py       # 座標 -> 特徴量（関節角・上下動信号・正規化）
  profiles.py       # 連ごとの基準値（StyleProfile）
  validate.py       # 骨格の妥当性検証（2人が合成された骨格を除く）
  cycles.py         # 往復・ステップ周期の検出
  scorers/
    base.py         # Scorer インターフェース / ScoreResult
    hip_lowness.py  # 腰の低さ（ルールベース）
    rhythm.py       # リズム（FFT でテンポ推定＝DSPパート）
  pipeline.py       # 各 Scorer を重み付きで束ね、内訳付きで返す
score_video.py      # ★動画1本を渡すだけで採点（通常はこれを使う）
demo_synthetic.py   # MediaPipe 無しでコアを検証（回帰テスト入り）
test_scorers.py     # 各採点軸が正しく判別するかのテスト
measure_upper.py    # 上半身の基準値を実測して閾値を出す
draw_skeleton.py    # 骨格を動画に重ねて目視確認
calibrate.py        # 実データから閾値を実測し、根拠をグラフ化
```

## 使い方（動画 1 本を採点する）
```bash
pip install -r requirements.txt
python download_model.py            # models/pose_landmarker_full.task を取得（1 回だけ）
python score_video.py 踊りの動画.MOV
```
抽出・検証・採点をまとめて実行して結果を表示する。

よく使う指定:
```bash
python score_video.py dance.MOV --save                  # 骨格を .npz に保存
python score_video.py dance.MOV --crop 0.15 0.9 0 1.0   # 映り込みを除く
python score_video.py dance.MOV --json                   # アプリ組み込み用
```
モデルの場所は `--model` か環境変数 `RENKEI_POSE_MODEL` で指定する
（既定は `models/pose_landmarker_full.task`。`models/` は git 管理外）。

### アプリ（AI②）向けの姿勢系列を書き出す
```bash
python export_pose_series.py 熟練者の動画.MOV -o ref.pose.json
```
`pose-series-v1` 形式の JSON（`functions/src/style/pose.ts` と同形）を出す。
連の参照動画を登録するときは、これを Storage の
`ren/{renId}/styleReferences/{referenceId}.pose.json` に置いて FN-08 を呼ぶ
（`docs/design/api-functions.md`）。

### アプリのリアルタイム判定との関係
アプリ（`Ren-kei_procon/src/features/rules/`）はカメラ映像を **1 フレームずつ**
RULE-01〜07 で判定し、終了後にサーバ（FN-01）が Analysis Score を確定する。
このディレクトリの採点は **録り終えた動画 1 本** を 8 軸で採点する
オフライン版で、閾値の較正・熟練者データの実測・指導者との突き合わせに使う。
両者の軸の対応は `docs/design/ai-basic-motion.md` 6章の表を参照。

### 「測れなかった」の扱い
検出できなかった軸は 0 点ではなく `measured=False` になり、総合点・部位点・
助言から除外して「測れなかった項目」として別枠で表示する
（0 点として平均に入れると「検出できなかった」が「最低の出来」と同じ扱いになるため）。

### macOS で mediapipe が落ちる場合
`mediapipe` 0.10.2x 系は macOS(Apple Silicon)で
`DrishtiMetalHelper ... Check failed: service_ Service is unavailable` を出して
起動直後に落ちる。`requirements.txt` は動作を確認した 0.10.14 に固定している。

## 開発・較正用のツール
```bash
pip install -r requirements.txt

# 1) MediaPipe 無しでコアを検証（FFTと採点の動作確認）
python demo_synthetic.py

# 2) 骨格が正しく乗るか目視確認（パスを編集してから）
python draw_skeleton.py

# 3) 実データから閾値を較正（パスを編集してから）
python calibrate.py

# 4) 実データで採点
python download_model.py
python score_video.py dance.mp4
```
`test_scorers.py` は良い例・悪い例の点差を assert する（悪い例が基準より
2 点以上低くなければ終了コード 1）。CI で回せる。

## 次に足す軸（未実装）
- **なんば検出**: 同側の手首/足首の前後変位の相関 ← 阿波踊り特化の目玉
- **手の高さ**: 手首が肩より上か
- **熟練者比較(DTW)**: テンポ差を吸収して系列を整列し総合類似度

## 座標軸の視点依存（重要）
ワールド座標は**カメラ基準**であり人物基準ではない。
「人物の前後方向」がどの軸かは撮影角度で変わる。

| 撮影 | 肩の開き | 人物の前後 |
|---|---|---|
| 正面 | 左右(x)に開く | **z**（奥行き） |
| 横 | 奥行き(z)に並ぶ | **x**（画面横） |

`detect_view()` が肩の広がりから角度を判定し、なんば・手の出し方が
正しい軸を選ぶ。固定で z を見ていた頃は横向き映像で無意味な値が出ていた。

### ナンバが正面で測れないこと（実測）
同一の踊りを正面と横から撮って比較した結果:

| 視点 | 相関 | 左右のばらつき | 判定 |
|---|---|---|---|
| 横 | +0.51 | 0.06 | なんば成立 |
| 正面 | -0.04 | 0.22 | 読み取れず |

正面では前後が奥行きにあたり単眼推定の精度が足りない。
`NambaScorer` は信頼度を自動評価し、低い場合は点数を断定せず
「参考値」として提示する。

## キャリブレーション
`FULL_MARK_ANGLE` / `TARGET_BPM` などの閾値は仮値。
`calibrate.py` を熟練者の参照動画にかけて実測値に置き換える。
出力される PNG がそのまま「なぜこの採点基準か」の証拠資料になる。

### 撮影の条件
- **20秒以上（推奨30秒）**。FFT の分解能 Δf = 1/T は観測長でのみ決まる。
  4秒だと 14.7 BPM 刻みでしか測れず無意味。30秒なら 2 BPM。
- 全身が枠に収まり、一定のテンポで踊り続けること。
