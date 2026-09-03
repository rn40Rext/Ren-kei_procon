# Definition of Done

> These are the conditions to satisfy before claiming "done". **If any item is not satisfied, report that it is not satisfied.** Do not close with "probably fine" or "it should work".

## Reporting rules

| Situation | How to report |
| --- | --- |
| All items satisfied | State "done" explicitly. Do not be vague about it |
| Some items not satisfied | **State which items are not satisfied.** If there was verification you could not run, write the reason too |
| A test failed | Paste the fact of the failure and its output. Do not hide it behind "some of the tests passed" |
| Verification was skipped | Write that you skipped it. If you cannot check on a device, write "not verified on a device" |

## 0. Which one to use

| Work | Section to use |
| --- | --- |
| **Implemented an issue (default)** | Section 2, "Implementation DoD" |
| Opening a PR | Section 3, "PR DoD" |
| Wrote a spec (matches A/B/C in chapter 3 of [workflow.md](workflow.md)) | Section 1 → Section 2 |

**The default is issue-driven.** If you did not write a spec, skip section 1.

## 1. DoD for the spec phase (only if you wrote a spec)

### requirements.md

- [ ] The purpose is written in terms of user value
- [ ] **Out-of-scope items are stated explicitly**
- [ ] Acceptance criteria are written in EARS notation (see [workflow.md](workflow.md))
- [ ] All acceptance criteria are **verifiable** (no "appropriately" or "nicely")
- [ ] There is a link to the relevant part of the product specification (`docs/spec/`)
- [ ] Undecided items (TBD) are listed, with who decides them and when
- [ ] Human approval obtained

### design.md

- [ ] The candidate approaches are compared, with the reason for the chosen one
- [ ] The files to change are listed
- [ ] Data changes are consistent with [docs/design/data-model.md](../design/data-model.md)
- [ ] Content that duplicates the cross-cutting design is linked rather than written out
- [ ] The testing approach is written
- [ ] Human approval obtained

### tasks.md

- [ ] Each task is sized to be completed in one commit
- [ ] They are ordered by dependency
- [ ] They are mapped to the existing GitHub issues (#5 to #59)
- [ ] Human approval obtained

## 2. Implementation DoD

### Required (every time)

- [ ] `cd Ren-kei_procon && npx tsc --noEmit` passes
- [ ] No newly added `any` / `as any` / `@ts-ignore` (if you added one, write the reason in a comment)
- [ ] All acceptance criteria of the corresponding issue are satisfied
- [ ] Working-note comments (`// 💡 追加` and the like) are deleted
- [ ] Checked with `git status` that no unintended files are included

### When applicable

| Change | Additional conditions |
| --- | --- |
| Changed the Security Rules | **If you relaxed them, wrote in the PR body what you relaxed and how** (relaxing them during development is allowed; [safety.md](safety.md) chapter 2) / if you tightened them, the Rules Unit Test passes |
| Changed the Firestore schema | Updated `docs/design/data-model.md` / added the required composite indexes to `firestore.indexes.json` |
| Added or changed a Cloud Function | `cd functions && npm run build` passes / verified the behavior in the Emulator |
| Added a screen | Added its type to `RootStackParamList` and registered it in `AppNavigator` / verified the navigation on a device or the Simulator |
| Added a rule to the Rule Engine | Added boundary-value, noise, and missing-data unit tests (specification 15.1) |
| Decided an undecided item (TBD) | **Recorded the decision and its rationale in the relevant document under `docs/design/`** |
| Verified the behavior on a device | Reported the device and OS you used |
| Had written a spec | Satisfied all acceptance criteria in `requirements.md` / filled in the checks in `tasks.md` |

### Do not skip recording decisions

Once you decide a TBD, **always leave it in a document**. A decision left only in an issue comment or a chat will not reach the next person. Where to record it is organized in chapter 4 of [docs/status/roadmap.md](../status/roadmap.md).

## 3. PR DoD

- [ ] The title describes the change
- [ ] The body contains `Closes #<issue>` (when applicable)
- [ ] The body states **the verification you ran and its results** (e.g. "type checking passed", "verified in the Emulator")
- [ ] Any DoD items you could not satisfy are stated explicitly in the body
- [ ] The aspects you want reviewed are written
- [ ] No secrets are included (checked `git diff`)

## 4. "Done" reports you must not make

| ✗ | What is wrong with it |
| --- | --- |
| "Implemented it" (type checking not run) | There is no guarantee it works |
| "The tests passed" (concealing some failures) | It is not true |
| "Implemented AI scoring" (still a mock) | Presenting a mock as the real thing ([safety.md](safety.md) chapter 1) |
| "Configured the Security Rules" (still `if true`) | It provides no protection |
| "Decided the TBD" (not recorded in a document) | The decision is lost |
| "It should work" | If you did not verify it, write that you did not |
