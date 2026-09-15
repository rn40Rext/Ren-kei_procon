# 投稿 API（初期検討メモ）

> ⚠️ **これは 2026 年 7 月の初期検討メモです。現行の設計ではありません。**
>
> - 現在の API 定義は [../design/api-functions.md](../design/api-functions.md)（FN-01〜FN-09）を参照してください
> - 投稿は Cloud Functions の `publishPost`（FN-03）が担当します。下記の項目名・レスポンスとは一致しません
> - 経緯の記録として残しています（[#59](../../../issues/59)）

【リクエスト】

videoFile

title

description

userId

----------------

【レスポンス】

success

postId

videoId
