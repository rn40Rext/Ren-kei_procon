# CLAUDE.md

@AGENTS.md

<!--
このファイルは Claude Code 用のブリッジです。
実質の内容はすべて AGENTS.md にあります（他のエージェントもそれを読みます）。
プロジェクトのルールを追記するときは AGENTS.md または docs/rules/ を編集してください。
ここに書くのは Claude Code 固有の機能に関する記述だけにしてください。
-->

## Claude Code 固有

### パス限定ルール

`.claude/rules/` に `paths:` 付きのルールがあり、該当ファイルを読むと自動でロードされます。

| ルール | 適用パス |
| --- | --- |
| `.claude/rules/screens.md` | `Ren-kei_procon/src/screens/**`, `components/**`, `navigation/**` |
| `.claude/rules/firebase.md` | `firestore.rules`, `storage.rules`, `functions/**`, `src/repositories/**` |
| `.claude/rules/docs.md` | `docs/**` |

### スラッシュコマンド

スペック駆動開発の各フェーズに対応します。手順の本体は [docs/rules/workflow.md](docs/rules/workflow.md) にあり、コマンドはその補助です。

| コマンド | フェーズ |
| --- | --- |
| `/spec-new <機能名>` | requirements の作成 |
| `/spec-plan <spec番号>` | design の作成 |
| `/spec-tasks <spec番号>` | tasks の作成とイシュー対応付け |
| `/spec-check <spec番号>` | 実装が spec を満たしているかの検査 |

### 導入済みの拡張

- **Firebase 公式スキル**（`skills-lock.json`）— Auth / Firestore / Storage / App Hosting 等の最新の使い方。Firebase を触るときは活用してください
- **Expo 公式プラグイン**（`Ren-kei_procon/.claude/settings.json`）
