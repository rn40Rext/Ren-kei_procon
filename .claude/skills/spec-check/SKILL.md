---
name: spec-check
description: 実装がイシューの受け入れ条件と Definition of Done を満たしているか検査する。「受け入れ条件を確認して」「DoDを確認する」「完了できるか見て」「実装とspecの差分を見る」ときに使う。
disable-model-invocation: false
---

# spec-check — 受け入れ条件と実装の突き合わせ

**イシュー番号でも spec 番号でも使えます。** 既定はイシュー駆動なので、通常はイシュー番号を渡してください。手順の全体像は `docs/rules/workflow.md` を参照。

## この検査の目的

「実装したつもり」と「実際に spec を満たしている」の差を見つけます。

このリポジトリでは、仕様書に詳細な AI 判定ルールがあったのに実装は `Math.random()` のモックのまま「AI 87点」と表示され続けていました。**画面が動いていることは、spec を満たしている証拠になりません。**

## 進め方

### 1. 受け入れ条件を読む

- **イシュー番号を渡された場合**: `gh issue view <番号>` の受け入れ条件チェックリストを使います
- **spec 番号を渡された場合**: `docs/specs/<NNN>-<slug>/requirements.md` の受け入れ基準と `tasks.md` を使います

### 2. 受け入れ条件を 1 つずつ検証する

**「実装した」という記述を信用せず、実際のコードを読んで確認します。**

各受け入れ基準について、次のいずれかで判定してください。

| 判定 | 条件 |
| --- | --- |
| ✅ 満たしている | 該当コードを特定でき、動作を確認した（テスト実行 / 実機 / Emulator） |
| ⚠️ コードはあるが未検証 | 実装はあるが実行して確かめていない |
| ❌ 満たしていない | 該当コードが無い、モックのまま、条件を満たさない |
| ➖ 検証不能 | 実機が必要など、この場では確かめられない（**理由を書く**） |

「たぶん満たしている」は ⚠️ か ❌ です。✅ にしないでください。

### 3. モックと本実装を区別する

以下は特に注意して確認します。

- ランダム値・固定値を返していないか（`Math.random()`, ハードコードされた戻り値）
- TODO / FIXME コメントが残っていないか
- 空実装の関数が呼ばれていないか
- スタブ画面（`<Text>` 1行のみ）のままでないか
- `console.log` でのデバッグ出力が残っていないか

### 4. Definition of Done を検査する

`docs/rules/definition-of-done.md` の「実装の DoD」を実行して確認します。

```bash
cd Ren-kei_procon && npx tsc --noEmit          # 必須
cd functions && npm run build                   # Functions を変更した場合
```

該当する場合の追加条件（Rules テスト、インデックス追加、設計文書の更新など）も表と照合してください。

### 5. 規約違反を検出する

`docs/rules/coding.md` に反する箇所を探します。

リポジトリルートで実行します。

```bash
grep -rn "useNavigation<any>" Ren-kei_procon/src/          # 型回避
grep -rn "increment(" Ren-kei_procon/src/                   # カウンタ
grep -rn "Math.random" Ren-kei_procon/src/                  # モック
grep -rn "from 'firebase/firestore'" Ren-kei_procon/src/screens/   # 画面から直呼び
grep -rn "collection(db, 'Users'" Ren-kei_procon/src/       # 大文字コレクション
grep -rn "as any\|@ts-ignore" Ren-kei_procon/src/           # 型回避
```

### 6. 安全境界の確認

`docs/rules/safety.md` に触れる変更が入っていないか確認します。特に:

```bash
git diff main -- firestore.rules storage.rules              # Rules の変更
git diff main --stat -- docs/spec/                          # 基準文書の編集（あってはならない）
git status --short                                           # 意図しないファイル
```

`docs/spec/` に変更があれば**それ自体が違反**です。報告してください。

### 7. 報告する

次の形式で報告します。**満たしていない項目を隠さないこと。**

```markdown
## spec-check: 001-hand-height-realtime

### 受け入れ基準（7件）
- ✅ AC-1: WHEN 手首が... → src/features/rules/handHeight.ts:42 で実装。ユニットテスト通過
- ⚠️ AC-2: WHILE 全身が... → 実装はあるが実機未確認
- ❌ AC-3: WHEN 200ms継続... → holdDurationMs が未実装（常に即時発火）
- ➖ AC-4: 10fps以上 → 実機が必要なため未計測

### Definition of Done
- ✅ npx tsc --noEmit 通過
- ❌ Rule Engine のユニットテスト未作成
- ❌ TBD-01 の結論を docs/design/ai-basic-motion.md に未記録

### 規約違反
- src/screens/CameraScreen.tsx:17 で useNavigation<any>() を使用

### 結論
**完了の条件を満たしていません。** AC-3 の holdDurationMs 実装と、
Rule Engine のユニットテスト、TBD-01 の記録が必要です。
```

**結論を明示してください。** 満たしていないなら「満たしていません」と書きます。未達項目があるのに「概ね完了」と書いてはいけません。
