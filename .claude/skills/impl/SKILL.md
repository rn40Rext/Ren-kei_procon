---
name: impl
description: Take a single GitHub issue and implement it. The default implementation flow. Use when the user says "implement #15", "do this issue", "work on this issue", or pastes an issue link.
---

# impl — Issue-driven implementation

**This is the default implementation flow for this repository.** Take an issue number or URL and carry it through to implementation.

Issues #5〜#59 already contain acceptance criteria, the relevant section of the specification, and links to design documents, so **they are the de facto spec**. There is no need to cut a separate spec under `docs/specs/` (if you do need one, see chapter 3 of `docs/rules/workflow.md`).

## Steps

### 1. Read the issue

```bash
gh issue view <issue-number>
```

If a parent epic (`type:epic`, #5〜#12) is referenced, read that too and check the **recommended order of work and the dependencies**. If another issue it depends on is unfinished, **point that out first** (do not widen the scope of work on your own).

### 2. Actually read the linked documents

**Do not start writing without reading the links.** The issue body is a summary; the basis for judgment is in the design documents.

| Area | Document to read |
| --- | --- |
| Handling data | `docs/design/data-model.md` (Firestore paths, fields, indexes) |
| Permissions / Rules | `docs/design/security-rules.md` |
| AI scoring (basic motion) | `docs/design/ai-basic-motion.md` (normalization formulas, state machine, thresholds) |
| Style similarity | `docs/design/ai-style-similarity.md` |
| Cloud Functions | `docs/design/api-functions.md` (FN-01〜07) |
| Screens / navigation | `docs/design/screens.md` |

If the issue names the relevant chapter of the specification (`docs/spec/`), read that as well. **If you are about to build a feature that has no definition in the specification, stop and confirm with the user.**

### 3. Read the current code

Actually read what you are going to change. If a known defect from `docs/status/gap-analysis.md` (B-1〜B-11) falls inside the area you touch, **decide whether to fix it as well or leave it to a separate issue, and report that decision**.

### 4. Implement

- Coding conventions: `docs/rules/coding.md`
- Prohibitions: `docs/rules/safety.md` (narrowed down for the contest; it also states what may be relaxed during development)
- **If existing code violates the conventions, the conventions win.** Do not imitate the existing code

If you find you need to deviate from the issue's acceptance criteria, **fix the issue before proceeding with the implementation** (confirm with the user before `gh issue edit`).

### 5. Record TBDs once decided

When you decide an open item, **write the decision and the reasoning into the relevant document under `docs/design/`**. Also update the status in chapter 4 of `docs/status/roadmap.md`.

A decision that lives only in an issue comment or in chat will not reach the next person. **Do not skip this.**

### 6. Verify

Check the items in `docs/rules/definition-of-done.md`. At minimum:

```bash
cd Ren-kei_procon && npx tsc --noEmit
cd functions && npm run build          # If you changed Functions
```

Match the issue's acceptance criteria one by one. For a detailed inspection, use `/spec-check <issue-number>`.

### 7. Report

Include the following in your report.

- What you implemented (changed files)
- **Which acceptance criteria you satisfied / did not satisfy**
- The verification you ran and its results
- What you could not verify (needs a physical device, etc.) and why
- TBDs you decided and where you recorded them

**Do not hide items that are not satisfied.** Do not close with "probably works" or "mostly done". If a test fails, state that it failed and paste the output.

## About commits

Commit **only when the user asks**. If you are on `main`, create a branch first.

Commit messages may be in Japanese. If there is a related issue, include `Closes #<issue-number>`.
