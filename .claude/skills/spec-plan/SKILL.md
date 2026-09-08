---
name: spec-plan
description: Create design.md from approved requirements. Phase [2] of spec-driven development. Use when the user says "design this", "write the plan", or "decide how to implement it".
disable-model-invocation: false
---

# spec-plan — Writing the design

This is phase [2] of spec-driven development. For the overall procedure, see `docs/rules/workflow.md`.

## Checking the prerequisites

**Confirm that `requirements.md` exists and has been approved.** If it does not, point the user to `/spec-new`. Do not write a design while skipping requirements.

## Procedure

Note: documents you create under `docs/specs/` are **written in Japanese**, following the Japanese templates in `docs/specs/TEMPLATE/` (they are human-facing).

### 1. Read the cross-cutting design

**Read the existing design documents related to this spec first.** This is so you do not write a duplicate design.

| Area | Document to read |
| --- | --- |
| Handling data | `docs/design/data-model.md` (Firestore paths, field definitions, indexes) |
| Touching permissions / Rules | `docs/design/security-rules.md` |
| AI scoring (basic motion) | `docs/design/ai-basic-motion.md` (normalization formulas, state machine, thresholds) |
| Style similarity | `docs/design/ai-style-similarity.md` |
| Cloud Functions | `docs/design/api-functions.md` (FN-01〜07) |
| Screens / navigation | `docs/design/screens.md` |
| Overall structure | `docs/design/architecture.md` |

### 2. Read the current code

Actually read the files you are going to change. `docs/status/gap-analysis.md` lists known defects (B-1〜B-11). **If a known defect falls inside the area you touch, write how you will handle it in the design.**

### 3. Write design.md

Use `docs/specs/TEMPLATE/design.md` as the template to create `docs/specs/<NNN>-<slug>/design.md`.

Mandatory conditions:

- **Compare the candidate approaches and write why you chose the one you chose.** Do not write only a single option. "Why the others were not chosen" pays off later
- **List the files you will change** (new / modified / deleted)
- **Do not duplicate the cross-cutting design. Link to it.** Example: the Rule Engine state machine is in `docs/design/ai-basic-motion.md`, so reference it and write only the differences
- Keep data changes consistent with `docs/design/data-model.md`. If they contradict it, **fix the cross-cutting design first**
- Write the types and function signatures (this reduces hesitation during implementation)
- Write the test approach
- Write the risks (what could fail and how you will handle it)

### 4. Check consistency with the conventions

Check that the design does not violate `docs/rules/coding.md`. In particular:

- Does a screen call Firestore directly (rather than going through `repositories/`)?
- Does the design use `useNavigation<any>()`?
- Are collection names lowercase-initial plurals?
- Does it use `increment()` for counters?
- Does it have the client writing scores (**prohibited**)?

### 5. Update the cross-cutting design

If you decided a TBD in this spec, **record the decision and the reasoning on the `docs/design/` side as well**. Also update the status in chapter 4 of `docs/status/roadmap.md`.

Skip this and the decision stays buried in the spec directory and never reaches the next person.

### 6. Get approval

Summarize the approach, the changed files, and the risks, and **ask for approval**. After approval, tell the user "next, proceed to task breakdown with `/spec-tasks <NNN>`".

## Completion criteria

Satisfy every item under "design.md" in `docs/rules/definition-of-done.md`.
