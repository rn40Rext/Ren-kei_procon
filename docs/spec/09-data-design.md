<!-- 出典: Ren-Kei_システム仕様書_基本設計書_v0.3.docx / 章ごとに分割したもの。原本の記述は改変していない。 -->
> **Ren-Kei システム仕様書・基本設計書 v0.3** — 9. データ設計
>
> [← 8. AI機能② 連スタイル類似度判定](08-ai-style-similarity.md) ｜ [章一覧](README.md) ｜ [10. 認証・認可・Security Rules方針 →](10-auth-and-security-rules.md)

---

# 9. データ設計

## 9.1 現行ER（資料由来）

| Entity | 現行フィールド |
| --- | --- |
| Users | uid(PK), name, mail, icon, profile, createdAt, nickname, danceStyle, ren, role |
| Videos | videoId(PK), userId, storageUrl, score, createdAt |
| Posts | postId(PK), userId, videoId, title, description, createdAt |
| Comments | commentId(PK), postId, userId, text, createdAt |
| GrowthRecord | recordId(PK), userId, score, date |
| Ren | renId(PK), name, description, location |
| JoinRequests | requestId(PK), userId, renId, status |

| 不整合 | 最新UIとAI仕様をそのまま実装するには、現行ERだけでは「項目別解析結果」「いいね」「複数連メンバー管理」「お知らせ」「活動予定」「通知」「連スタイルEmbedding」等を表現できない。以下を追加推奨とする。 |
| --- | --- |

**図 4**

> 画像本体はMarkdownへ埋め込まず、Word文書内の図を参照する。

*図9-1 推奨論理ER（追加推奨Entityを含む）*

## 9.2 Core Entity詳細

### Users

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| uid | string | 必須/PK | Firebase Auth uid |
| name | string | 必須 | 氏名または表示名方針は要検討 |
| mail | string | 必須 | 認証メール。Auth側との二重管理方針を決定 |
| icon | string? | 任意 | 画像URL/Storage path |
| profile | string? | 任意 | 自己紹介 |
| nickname | string? | 任意 | 表示名 |
| danceStyle | string? | 任意 | 男踊り/女踊り等。型は要検討 |
| role | string | 必須 | user / ren_admin 等 |
| createdAt | Timestamp | 必須 | 作成日時 |

### Videos

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| videoId | string | 必須/PK | 動画ID |
| userId | string | 必須/FK | 所有ユーザー |
| storageUrl | string | 必須 | Cloud Storage参照 |
| visibility | string | 追加推奨 | private / public |
| analysisStatus | string | 追加推奨 | uploaded / analyzing / completed / failed |
| score | number? | 現行 | 互換用。将来はAnalysisResults.totalScoreを正とする |
| createdAt | Timestamp | 必須 | 作成日時 |

### Posts

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| postId | string | 必須/PK | 投稿ID |
| userId | string | 必須/FK | 投稿者 |
| videoId | string | 必須/FK | 公開対象動画 |
| title | string | 必須 | タイトル |
| description | string? | 任意 | 本文 |
| createdAt | Timestamp | 必須 | 作成日時 |

### Comments

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| commentId | string | 必須/PK | コメントID |
| postId | string | 必須/FK | 対象投稿 |
| userId | string | 必須/FK | コメント投稿者 |
| type | string | 追加推奨 | normal / instructor |
| text | string | 必須 | 本文 |
| createdAt | Timestamp | 必須 | 作成日時 |

### Ren

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| renId | string | 必須/PK | 連ID |
| name | string | 必須 | 連名 |
| description | string? | 任意 | 紹介 |
| location | string? | 任意 | 主な活動地域 |
| iconUrl | string? | 追加推奨 | 連アイコン |
| beginnerFriendly | boolean? | 追加推奨 | 初心者歓迎 |
| activityInfo | string? | 追加推奨 | 活動概要 |
| createdAt | Timestamp | 追加推奨 | 作成日時 |
| updatedAt | Timestamp | 追加推奨 | 更新日時 |

### JoinRequests

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| requestId | string | 必須/PK | 申請ID |
| userId | string | 必須/FK | 申請者 |
| renId | string | 必須/FK | 対象連 |
| message | string? | 追加推奨 | 任意メッセージ |
| status | string | 必須 | pending / approved / rejected / cancelled |
| createdAt | Timestamp | 追加推奨 | 申請日時 |
| updatedAt | Timestamp | 追加推奨 | 更新日時 |

## 9.3 追加推奨Entity

### AnalysisResults

| フィールド | 型 | 説明 |
| --- | --- | --- |
| analysisId | string | PK |
| videoId | string | Videos FK |
| userId | string | Users FK |
| totalScore | number | 0〜100 |
| gameScore | number | 練習中累積ポイント |
| handHeightScore | number? | 項目別 |
| hipHeightScore | number? | 項目別 |
| stopScore | number? | 項目別 |
| rhythmScore | number? | 項目別 |
| rawMetrics | map | 根拠数値 |
| goodCount/greatCount/missCount | number | イベント回数 |
| maxCombo | number? | 最大コンボ |
| feedback | array/map | 改善コメント |
| analysisVersion | string | ルール版 |
| createdAt | Timestamp | 作成日時 |

### GrowthRecords

| フィールド | 型 | 説明 |
| --- | --- | --- |
| recordId | string | PK |
| userId | string | Users FK |
| analysisId | string | AnalysisResults FK |
| score | number | 比較用総合点 |
| date | Timestamp | 記録日時 |

### Likes

| フィールド | 型 | 説明 |
| --- | --- | --- |
| postId | string | Posts FK |
| userId | string | Users FK |
| createdAt | Timestamp | 作成日時 |

### RenMembers

| フィールド | 型 | 説明 |
| --- | --- | --- |
| renId | string | Ren FK |
| userId | string | Users FK |
| role | string | member / admin |
| status | string | active等 |
| joinedAt | Timestamp | 加入日時 |

### Announcements

| フィールド | 型 | 説明 |
| --- | --- | --- |
| announcementId | string | PK |
| renId | string | Ren FK |
| title | string | タイトル |
| content | string | 本文 |
| createdBy | string | 管理者uid |
| createdAt | Timestamp | 作成日時 |

### RenActivities

| フィールド | 型 | 説明 |
| --- | --- | --- |
| activityId | string | PK |
| renId | string | Ren FK |
| title | string | 活動名 |
| description | string? | 説明 |
| startAt | Timestamp | 開始 |
| endAt | Timestamp? | 終了 |
| location | string? | 場所 |

### Notifications

| フィールド | 型 | 説明 |
| --- | --- | --- |
| notificationId | string | PK |
| userId | string | 通知先 |
| type | string | comment/join_result/announcement等 |
| referenceId | string? | 参照先ID |
| title | string | タイトル |
| body | string | 本文 |
| read | boolean | 既読 |
| createdAt | Timestamp | 作成日時 |

### RenStyleReferences

| フィールド | 型 | 説明 |
| --- | --- | --- |
| referenceId | string | PK |
| renId | string | Ren FK |
| userId | string? | 熟練者uid（任意） |
| videoId | string | 参照動画 |
| embeddingVersion | string | モデル版 |
| embeddingRef | string/map | Embedding保存先 |
| approved | boolean | 代表データ採用可否 |
| createdAt | Timestamp | 作成日時 |

### RenStyleProfiles

| フィールド | 型 | 説明 |
| --- | --- | --- |
| renId | string | Ren FK/PK候補 |
| embeddingVersion | string | モデル版 |
| embeddingRef | string/map | 代表Embedding |
| sampleCount | number | サンプル数 |
| updatedAt | Timestamp | 更新日時 |

### StyleAnalysisResults

| フィールド | 型 | 説明 |
| --- | --- | --- |
| styleAnalysisId | string | PK |
| userId | string | Users FK |
| videoId | string | Videos FK |
| modelVersion | string | モデル版 |
| results | array | renId + similarityの上位結果 |
| createdAt | Timestamp | 作成日時 |

## 9.4 状態遷移

### JoinRequests.status

| 現在 | 操作主体 | 操作 | 遷移先 |
| --- | --- | --- | --- |
| pending | 申請者 | 取消 | cancelled |
| pending | 対象連管理者 | 承認 | approved |
| pending | 対象連管理者 | 却下 | rejected |
| approved/rejected/cancelled | 通常ユーザー | 状態変更 | 原則不可（再申請は新規Request） |

### Videos.analysisStatus

| 状態 | 意味 | 次状態 |
| --- | --- | --- |
| uploaded | 動画保存済み、未解析 | analyzing |
| analyzing | 解析中 | completed / failed |
| completed | 解析結果確定 | 終端 |
| failed | 解析失敗 | 再解析でanalyzingへ戻すことを許可するか要検討 |
