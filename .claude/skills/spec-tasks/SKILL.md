---
name: spec-tasks
description: 承認済みの design から tasks.md を作成し、GitHub イシューと対応付ける。スペック駆動開発のフェーズ[3]。「タスク分解する」「イシューに落とす」ときに使う。
disable-model-invocation: false
---

# spec-tasks — タスク分解とイシュー対応付け

スペック駆動開発のフェーズ [3] です。手順の全体像は `docs/rules/workflow.md` を参照。

## 前提の確認

**`requirements.md` と `design.md` が存在し、承認済みであることを確認してください。** design を飛ばしてタスク分解してはいけません。

## 進め方

### 1. 既存イシューを必ず先に検索する

**このリポジトリには既に #5〜#59 のイシューがあります。** 新規に立てる前に検索してください。

```bash
gh issue list --limit 100 --json number,title,labels,milestone --jq '.[] | "#\(.number) \(.title)"'
gh issue list --search "キーワード" --limit 20
```

エピック（`type:epic` ラベル、#5〜#12）には子イシューのチェックリストがあります。該当するエピックがあれば、その配下のイシューに対応付けます。

**重複したイシューを作らないこと。** 既存イシューの受け入れ条件に不足があれば、新規作成ではなく既存イシューの更新を提案してください。

### 2. タスクに分解する

分解の基準:

- **1 タスク = 1 コミットで完結する大きさ**
- 依存順に並べる（先に必要なものを上に）
- 各タスクに「変更するファイル」と「完了条件」を書く
- requirements の受け入れ基準が**すべてどこかのタスクでカバーされている**ことを確認する

カバーされていない受け入れ基準があれば、それは分解漏れです。

### 3. tasks.md を書く

`docs/specs/TEMPLATE/tasks.md` を雛形として `docs/specs/<NNN>-<slug>/tasks.md` を作ります。

各タスクの形式:

```markdown
- [ ] **T1** タスク名 — 対応イシュー: #13
  - 変更: `Ren-kei_procon/src/features/pose/poseLandmarker.ts`（新規）
  - 完了条件: 33点のランドマークが 10fps 以上で取得できる
  - 依存: なし
```

末尾に「受け入れ基準とタスクの対応表」を入れて、漏れがないことを示してください。

### 4. 新規イシューが必要な場合

**起票は人間の承認後です。** エージェントが勝手にイシューを作ってはいけません（`docs/rules/safety.md` 9章）。

`tasks.md` に「新規イシュー案」として、タイトル・ラベル・マイルストーン・本文の要点を書いて提示します。承認を得てから `gh issue create` を実行してください。

ラベルとマイルストーンの体系:

| 種類 | 値 |
| --- | --- |
| area | `area:ai` `area:style` `area:ren` `area:admin` `area:growth` `area:security` `area:notification` `area:infra` `area:app` |
| type | `type:epic` `type:feature` `type:bug` `type:debt` |
| その他 | `spec:v0.3` `documentation` |
| マイルストーン | `Prototype 1`〜`Prototype 4`, `MVP Community`, `MVP Ren` |

### 5. 承認を得る

タスク数・依存順・イシュー対応の要約を提示し、**承認を求めます**。承認後に「実装を始めます。T1 から進めますか？」と確認してください。

## 完了条件

`docs/rules/definition-of-done.md` の「tasks.md」の項目をすべて満たすこと。
