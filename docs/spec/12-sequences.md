<!-- 出典: Ren-Kei_システム仕様書_基本設計書_v0.3.docx / 章ごとに分割したもの。原本の記述は改変していない。 -->
> **Ren-Kei システム仕様書・基本設計書 v0.3** — 12. 主要シーケンス
>
> [← 11. バックエンド／論理API設計](11-backend-api.md) ｜ [章一覧](README.md) ｜ [13. エラー・例外設計 →](13-error-handling.md)

---

# 12. 主要シーケンス

## 12.1 基本動作練習

1.  ユーザーがU-02を開きカメラ権限を許可する。

2.  カメラフレームをMediaPipeへ入力し、姿勢ランドマークを取得する。

3.  Rule Engineが各フレーム/時間窓を評価し、GREAT/GOOD/MISSとメッセージをUIへ返す。

4.  練習中はGame Scoreをローカルで加算する。

5.  終了時に動画をCloud Storageへ保存しVideosを作成する（動画保存を任意にするか要検討）。

6.  最終指標をsystem処理へ渡しAnalysisResultsを確定する。

7.  GrowthRecordsをsystemが作成し、U-03/U-10へ反映する。

## 12.2 コミュニティ投稿

1.  U-03またはU-06で解析済みvideoIdを選択する。

2.  title/descriptionを入力する。

3.  publishPostでPostsを作成し、対象Videos.visibilityをpublicへ変更する。

4.  U-04のタイムラインに表示する。

5.  他ユーザーはU-05でコメント/いいねを作成する。

## 12.3 連参加

1.  U-07でRenを検索し、任意メッセージ付きJoinRequestを作成する。

2.  R-05で対象連管理者がpending申請を確認する。

3.  承認時、JoinRequestをapprovedへ更新しRenMembersを作成する。

4.  ユーザーへ通知し、U-08でマイ連情報を表示する。

## 12.4 連スタイル類似度

1.  ユーザー動画をStorageへ保存し、スタイル解析を開始する。

2.  Motion EncoderでEmbeddingを生成する。

3.  同一modelVersionのRenStyleProfilesとコサイン類似度を計算する。

4.  上位N件をStyleAnalysisResultsへ保存する。

5.  UIで「動きの類似度」として表示し、Ren詳細/参加申請へ導線を出す。
