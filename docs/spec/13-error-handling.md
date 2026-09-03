<!-- 出典: Ren-Kei_システム仕様書_基本設計書_v0.3.docx / 章ごとに分割したもの。原本の記述は改変していない。 -->
> **Ren-Kei システム仕様書・基本設計書 v0.3** — 13. エラー・例外設計
>
> [← 12. 主要シーケンス](12-sequences.md) ｜ [章一覧](README.md) ｜ [14. 非機能要件・セキュリティ・プライバシー →](14-non-functional.md)

---

# 13. エラー・例外設計

| コード | 条件 | ユーザー/システム動作 |
| --- | --- | --- |
| CAMERA_PERMISSION_DENIED | カメラ権限がない | 設定画面への案内を表示 |
| PERSON_NOT_DETECTED | 人物を十分検出できない | 全身が映る位置へ誘導 |
| LOW_LANDMARK_CONFIDENCE | 主要関節の信頼度が低い | 照明/距離/遮蔽を改善するメッセージ |
| MULTIPLE_PERSONS_DETECTED | 複数人検出 | MVPでは1人だけ映すよう案内 |
| VIDEO_UPLOAD_FAILED | 動画アップロード失敗 | 再試行。重複Videos作成を防ぐ |
| ANALYSIS_FAILED | 解析処理失敗 | failed状態を保存し再解析導線 |
| STYLE_MODEL_UNAVAILABLE | スタイルモデル利用不可 | 基本動作結果は保持し、スタイル診断のみ再試行 |
| UNAUTHORIZED | 未認証 | ログインへ誘導 |
| FORBIDDEN | 権限不足 | 対象操作を拒否 |
| JOIN_REQUEST_ALREADY_PENDING | 同一連へのpending申請あり | 既存申請を表示 |
| INVALID_STATUS_TRANSITION | 不正な状態遷移 | 更新拒否・ログ記録 |
| POST_VIDEO_NOT_PUBLICABLE | 動画所有権/解析状態不正 | 投稿を拒否 |
