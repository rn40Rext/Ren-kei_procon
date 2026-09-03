<!-- 出典: Ren-Kei_システム仕様書_基本設計書_v0.3.docx / 章ごとに分割したもの。原本の記述は改変していない。 -->
> **Ren-Kei システム仕様書・基本設計書 v0.3** — 11. バックエンド／論理API設計
>
> [← 10. 認証・認可・Security Rules方針](10-auth-and-security-rules.md) ｜ [章一覧](README.md) ｜ [12. 主要シーケンス →](12-sequences.md)

---

# 11. バックエンド／論理API設計

Firebaseを中心とする場合、すべてをREST API化する必要はない。低リスクCRUDはSecurity Rules付きFirestore直接アクセス、権限遷移・AI・非同期処理はCloud Functions/Cloud Run等へ分離する。以下は論理インターフェース案であり、HTTP/Callable/Triggerの最終形式は要検討。

| ID | 論理処理 | 権限 | 入力 | 出力/副作用 |
| --- | --- | --- | --- | --- |
| FN-01 | finalizeBasicAnalysis | 認証必須 | videoId, metrics, eventSummary | AnalysisResults作成、GrowthRecords作成 |
| FN-02 | analyzeStyle | 認証必須 | videoId | StyleAnalysisResultsまたはjobId |
| FN-03 | publishPost | 認証必須 | videoId,title,description | Posts作成 + video公開設定をトランザクション化 |
| FN-04 | submitJoinRequest | 認証必須 | renId,message | pendingのJoinRequest作成 |
| FN-05 | updateJoinRequestStatus | 対象連管理者 | requestId, approved/rejected | 状態検証 + RenMembers作成 + 通知 |
| FN-06 | createAnnouncement | 対象連管理者 | renId,title,content | Announcements作成 + 通知 |
| FN-07 | rebuildRenStyleProfile | system/管理者 | renId | 承認済み参照Embeddingから代表ベクトル更新 |

## 11.2 Firestore直接CRUD候補

- Usersの本人プロフィール編集（role等の保護フィールド除外）
- コミュニティPosts/Comments/Likes（Rulesで所有権検証）
- Renの公開情報read
- 自分のGrowthRecords/AnalysisResults read
