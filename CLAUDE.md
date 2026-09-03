# CLAUDE.md

@AGENTS.md

<!--
This file is a bridge for Claude Code.
All of the substantive content lives in AGENTS.md (other agents read that too).
To add project rules, edit AGENTS.md or docs/rules/.
Keep what you write here limited to Claude Code specific features.
-->

## Claude Code specifics

### Path-scoped rules

`.claude/rules/` holds rules with a `paths:` field; they load automatically when you read a matching file.

| Rule | Applied paths |
| --- | --- |
| `.claude/rules/screens.md` | `Ren-kei_procon/src/screens/**`, `components/**`, `navigation/**` |
| `.claude/rules/firebase.md` | `firestore.rules`, `storage.rules`, `functions/**`, `src/repositories/**` |
| `.claude/rules/docs.md` | `docs/**` |

### Slash commands

The body of the procedure is in [docs/rules/workflow.md](docs/rules/workflow.md); the commands are an aid to it.

| Command | Purpose | Frequency |
| --- | --- | --- |
| `/impl <issue number>` | **The default implementation flow.** Read the issue, design documents, and rules, implement, and verify through DoD | High |
| `/spec-check <number>` | Check the implementation against the acceptance criteria | High |
| `/spec-new <feature name>` | Create requirements (only for a feature not in the specification, or when a decision spanning multiple issues is needed) | Low |
| `/spec-plan <spec number>` | Create design | Low |
| `/spec-tasks <spec number>` | Create tasks and map them to issues | Low |

**The default is issue-driven.** Because the issues carry acceptance criteria and links to design documents, there is no need to cut a separate spec under `docs/specs/` (the 3 cases where it is needed are in chapter 3 of [docs/rules/workflow.md](docs/rules/workflow.md)).

### Installed extensions

- **The official Firebase skill** (`skills-lock.json`) — up-to-date usage for Auth / Firestore / Storage / App Hosting and more. Make use of it when you touch Firebase
- **The official Expo plugin** (`Ren-kei_procon/.claude/settings.json`)
