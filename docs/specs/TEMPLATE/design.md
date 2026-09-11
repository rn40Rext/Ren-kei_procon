# <NNN>-<feature-slug> — design

> フェーズ [2]。`requirements.md` の承認後に書く。書き方は [../../rules/workflow.md](../../rules/workflow.md) を参照。
> **承認状態: 未承認**

## 1. 方式の選択

**選択肢を比較し、選んだ理由を書く。** 単一案だけ書かない。

| 案 | 概要 | 利点 | 懸念 |
| --- | --- | --- | --- |
| A | | | |
| B | | | |

**採用: 案 X** — 理由をここに書く。

却下した案について「なぜ選ばなかったか」も 1 行で残す。後から方針を再検討するときに効く。

## 2. 参照する横断設計

**重複した設計を書かず、リンクする。**

| 領域 | 参照先 | この spec での差分 |
| --- | --- | --- |
| データモデル | [../../design/data-model.md](../../design/data-model.md) | 例: `videos` に `xxx` を追加 |
| Rule Engine | [../../design/ai-basic-motion.md](../../design/ai-basic-motion.md) | 例: 差分なし。設計どおり実装する |

## 3. 変更するファイル

| 種別 | パス | 内容 |
| --- | --- | --- |
| 新規 | `Ren-kei_procon/src/features/xxx/yyy.ts` | |
| 変更 | `Ren-kei_procon/src/screens/ZzzScreen.tsx` | |
| 削除 | | |

## 4. 型・インターフェース

主要な型定義と関数シグネチャを書く。実装時の迷いを減らすため。

```ts
export type Xxx = {
  // ...
};

export function doSomething(input: Xxx): Promise<Yyy>;
```

## 5. データ変更

Firestore / Storage の変更。[../../design/data-model.md](../../design/data-model.md) と整合させる。**矛盾する場合は先に横断設計を直す。**

| 対象 | 変更 |
| --- | --- |
| コレクション | |
| フィールド | |
| インデックス | |
| Security Rules | |

Rules を緩める変更が含まれる場合は、**ここに明記して承認時に確認する**（[../../rules/safety.md](../../rules/safety.md) 2章）。

## 6. テスト方針

| 対象 | 方法 |
| --- | --- |
| | ユニットテスト（フィクスチャの置き場も書く） |
| | Emulator |
| | 実機確認（確認する端末・OS） |

受け入れ基準（`requirements.md` の AC-x）と検証方法の対応を示す。

## 7. リスク

失敗しうる点と対処。

| リスク | 影響 | 対処 |
| --- | --- | --- |
| | | |

## 8. 既知の不具合への対処

`docs/status/gap-analysis.md` の B-1〜B-11 のうち、この spec で触る範囲に含まれるもの。

| # | 内容 | この spec での扱い |
| --- | --- | --- |
| | | 併せて直す / 別イシューに委ねる（理由） |

## 9. この spec で決めた事項

TBD を決めたら書く。**`docs/design/` 側にも同じ内容を記録し、`docs/status/roadmap.md` の 4 章の状態も更新する。**

| ID | 決定内容 | 理由 | 記録先 |
| --- | --- | --- | --- |
| TBD-xx | | | `docs/design/xxx.md` の N 章 |
