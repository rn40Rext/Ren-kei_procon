---
name: spec-tasks
description: Create tasks.md from an approved design and map it to GitHub issues. Phase [3] of spec-driven development. Use when the user says "break this into tasks", "turn this into issues", or "do the task breakdown".
disable-model-invocation: false
---

# spec-tasks — Task breakdown and issue mapping

This is phase [3] of spec-driven development. For the overall procedure, see `docs/rules/workflow.md`.

## Checking the prerequisites

**Confirm that `requirements.md` and `design.md` exist and have been approved.** Do not break work into tasks while skipping the design.

## Procedure

Note: documents you create under `docs/specs/` are **written in Japanese**, following the Japanese templates in `docs/specs/TEMPLATE/` (they are human-facing).

### 1. Always search the existing issues first

**This repository already has issues #5〜#59.** Search before opening a new one.

```bash
gh issue list --limit 100 --json number,title,labels,milestone --jq '.[] | "#\(.number) \(.title)"'
gh issue list --search "keyword" --limit 20
```

Epics (the `type:epic` label, #5〜#12) have a checklist of child issues. If a matching epic exists, map to the issues under it.

**Do not create duplicate issues.** If an existing issue's acceptance criteria are incomplete, propose updating that issue instead of creating a new one.

### 2. Break the work into tasks

Criteria for the breakdown:

- **1 task = a size that completes in 1 commit**
- Order them by dependency (whatever is needed first goes on top)
- Write "files to change" and "completion criteria" for each task
- Confirm that **every acceptance criterion in requirements is covered by some task**

An acceptance criterion that is not covered means the breakdown is incomplete.

### 3. Write tasks.md

Use `docs/specs/TEMPLATE/tasks.md` as the template to create `docs/specs/<NNN>-<slug>/tasks.md`.

The format of each task:

```markdown
- [ ] **T1** タスク名 — 対応イシュー: #13
  - 変更: `Ren-kei_procon/src/features/pose/poseLandmarker.ts`（新規）
  - 完了条件: 33点のランドマークが 10fps 以上で取得できる
  - 依存: なし
```

Put a "mapping table of acceptance criteria to tasks" at the end to show nothing is missing.

### 4. When a new issue is needed

Creating issues is in the "allowed, but report it" list (`docs/rules/safety.md` chapter 2), so you do not need to wait for approval — but **report what you are about to create**. Get explicit approval when you would open more than 10 issues at once, or close someone else's issue.

Write the proposal in `tasks.md` as "新規イシュー案" with the title, labels, milestone, and the key points of the body, and present it. Run `gh issue create` only after you have approval.

The label and milestone system:

| Kind | Values |
| --- | --- |
| area | `area:ai` `area:style` `area:ren` `area:admin` `area:growth` `area:security` `area:notification` `area:infra` `area:app` |
| type | `type:epic` `type:feature` `type:bug` `type:debt` |
| Other | `spec:v0.3` `documentation` |
| Milestone | `Prototype 1`〜`Prototype 4`, `MVP Community`, `MVP Ren` |

### 5. Get approval

Present a summary of the task count, the dependency order, and the issue mapping, and **ask for approval**. After approval, confirm with the user: "Starting implementation. Shall I proceed from T1?"

## Completion criteria

Satisfy every item under "tasks.md" in `docs/rules/definition-of-done.md`.
