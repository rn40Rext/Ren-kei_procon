---
name: spec-plan
description: 承認済みの requirements から design.md を作成する。スペック駆動開発のフェーズ[2]。「設計する」「planを書く」「どう実装するか決める」ときに使う。
disable-model-invocation: false
---

# spec-plan — design の作成

スペック駆動開発のフェーズ [2] です。手順の全体像は `docs/rules/workflow.md` を参照。

## 前提の確認

**`requirements.md` が存在し、承認済みであることを確認してください。** 無い場合は `/spec-new` へ案内します。requirements を飛ばして design を書いてはいけません。

## 進め方

### 1. 横断設計を読む

**この spec に関係する既存の設計文書を先に読みます。** 重複した設計を書かないためです。

| 領域 | 読む文書 |
| --- | --- |
| データを扱う | `docs/design/data-model.md`（Firestore パス・フィールド定義・インデックス） |
| 権限・Rules に触る | `docs/design/security-rules.md` |
| AI 採点（基本動作） | `docs/design/ai-basic-motion.md`（正規化式・状態機械・閾値） |
| スタイル類似度 | `docs/design/ai-style-similarity.md` |
| Cloud Functions | `docs/design/api-functions.md`（FN-01〜07） |
| 画面・遷移 | `docs/design/screens.md` |
| 全体構成 | `docs/design/architecture.md` |

### 2. 現状のコードを読む

変更対象のファイルを実際に読んでください。`docs/status/gap-analysis.md` に既知の不具合（B-1〜B-11）があります。**触る範囲に既知の不具合が含まれるなら、design に対処方針を書きます。**

### 3. design.md を書く

`docs/specs/TEMPLATE/design.md` を雛形として `docs/specs/<NNN>-<slug>/design.md` を作ります。

必須条件:

- **方式の選択肢を比較し、選んだ理由を書く。** 単一案だけ書かない。「なぜ他を選ばなかったか」が後から効きます
- **変更するファイルを列挙する**（新規 / 変更 / 削除）
- **横断設計と重複させない。リンクする。** 例: Rule Engine の状態機械は `docs/design/ai-basic-motion.md` にあるので参照し、差分だけ書く
- データ変更は `docs/design/data-model.md` と整合させる。矛盾するなら**先に横断設計を直す**
- 型・関数シグネチャを書く（実装時の迷いを減らす）
- テスト方針を書く
- リスク（失敗しうる点と対処）を書く

### 4. 規約との整合を確認する

`docs/rules/coding.md` に反する設計になっていないか確認してください。特に:

- 画面から Firestore を直接呼んでいないか（`repositories/` 経由か）
- `useNavigation<any>()` を使う設計になっていないか
- コレクション名が小文字始まりの複数形か
- カウンタに `increment()` を使っていないか
- スコアをクライアントから書く設計になっていないか（**禁止**）

### 5. 横断設計を更新する

この spec で TBD を決めた場合、**`docs/design/` 側にも決定内容と理由を記録します**。`docs/status/roadmap.md` の 4 章の状態も更新してください。

これを省くと、決定が spec ディレクトリに埋もれて次の担当者に届きません。

### 6. 承認を得る

方式・変更ファイル・リスクを要約して提示し、**承認を求めます**。承認後に「次は `/spec-tasks <NNN>` でタスク分解に進めます」と案内してください。

## 完了条件

`docs/rules/definition-of-done.md` の「design.md」の項目をすべて満たすこと。
