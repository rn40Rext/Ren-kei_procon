<!-- 出典: Ren-Kei_システム仕様書_基本設計書_v0.3.docx / 章ごとに分割したもの。原本の記述は改変していない。 -->
> **Ren-Kei システム仕様書・基本設計書 v0.3** — 10. 認証・認可・Security Rules方針
>
> [← 9. データ設計](09-data-design.md) ｜ [章一覧](README.md) ｜ [11. バックエンド／論理API設計 →](11-backend-api.md)

---

# 10. 認証・認可・Security Rules方針

## 10.1 認証

【資料由来】Authenticationによるログインを前提とする。Firebase AuthenticationのuidとUsers.uidを一致させ、データ所有者判定の基準とする。

## 10.2 CRUD権限

| データ | read | create | update | delete |
| --- | --- | --- | --- | --- |
| Users | ログインユーザー | 本人 | 本人 | 本人 |
| Videos | 本人 + AI/system（private時）／公開投稿経由はpublic | 本人 | 本人またはsystemの限定項目 | 本人 |
| Posts | 誰でも | ログインユーザー | 投稿者 | 投稿者 |
| Comments | ログインユーザー | ログインユーザー | コメント本人 | コメント本人 |
| GrowthRecords | 本人 | AI/system | AI/system | 本人（またはsystemのみも検討） |
| Ren | 誰でも | 正当な連管理者作成フロー | 対象連管理者 | 対象連管理者 |
| JoinRequests | 本人 + 対象連管理者 | 本人 | 本人/対象連管理者（許可遷移を分離） | 本人/対象連管理者（運用要検討） |
| RenMembers | 本人 + 対象連管理者 | system/対象連管理者 | 対象連管理者 | 対象連管理者 |
| Announcements | 誰でも/所属者のみは要件次第 | 対象連管理者 | 対象連管理者 | 対象連管理者 |
| RenActivities | 誰でも/所属者のみは要件次第 | 対象連管理者 | 対象連管理者 | 対象連管理者 |
| AnalysisResults | 本人 | AI/system | AI/system | 本人/system |
| StyleAnalysisResults | 本人 | AI/system | AI/system | 本人/system |

## 10.3 Security Rules上の重要制約

- Postsの公開とVideosの本人限定readが衝突するため、Videos.visibility等で非公開練習動画と公開投稿動画を分離する。
- Commentsの更新/削除権限は「Postの投稿者」ではなく「コメント自身のuserId」で判定する。
- Renの更新はrole == ren_adminだけで許可せず、対象renIdに対する管理者関係を確認する。
- JoinRequestsは申請者がpending→approvedへ変更できないよう、変更前後のstatusをRules/Backendで検証する。
- GrowthRecords/AnalysisResultsのスコア本体はクライアントから任意編集できない。
- role値を一般クライアントが自己昇格できないようUsers.roleの更新権限を制限する。
