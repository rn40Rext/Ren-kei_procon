---
name: spec-check
description: Inspect whether the implementation satisfies an issue's acceptance criteria and the Definition of Done. Use when the user says "check the acceptance criteria", "verify the DoD", "can this be closed?", or "show the gap between the implementation and the spec".
disable-model-invocation: false
---

# spec-check — Matching acceptance criteria against the implementation

**Works with either an issue number or a spec number.** The default is issue-driven, so normally pass an issue number. For the overall procedure, see `docs/rules/workflow.md`.

## Purpose of this inspection

Find the gap between "believed to be implemented" and "actually satisfies the spec".

In this repository, the specification had detailed AI judgment rules, yet the implementation stayed a `Math.random()` mock while continuing to display "AI 87 points". **A screen that works is not evidence that the spec is satisfied.**

## Procedure

### 1. Read the acceptance criteria

- **If given an issue number**: use the acceptance criteria checklist from `gh issue view <issue-number>`
- **If given a spec number**: use the acceptance criteria in `docs/specs/<NNN>-<slug>/requirements.md` together with `tasks.md`

### 2. Verify the acceptance criteria one by one

**Do not trust the claim that it was implemented — read the actual code and confirm.**

For each acceptance criterion, judge it as one of the following.

| Judgment | Condition |
| --- | --- |
| ✅ Satisfied | You located the code and confirmed the behavior (test run / physical device / Emulator) |
| ⚠️ Code exists but unverified | The implementation is there but you have not run it to confirm |
| ❌ Not satisfied | No corresponding code, still a mock, or does not meet the condition |
| ➖ Cannot verify | Needs a physical device etc., so it cannot be confirmed here (**write the reason**) |

"Probably satisfied" is ⚠️ or ❌. Do not make it ✅.

### 3. Distinguish mocks from real implementations

Check the following with particular care.

- Does it return random or fixed values (`Math.random()`, hardcoded return values)?
- Are TODO / FIXME comments left behind?
- Are empty-implementation functions being called?
- Is a stub screen (only a single `<Text>`) still in place?
- Is `console.log` debug output left behind?

### 4. Inspect the Definition of Done

Run and confirm the "Implementation DoD" items in `docs/rules/definition-of-done.md`.

```bash
cd Ren-kei_procon && npx tsc --noEmit          # Required
cd functions && npm run build                   # If you changed Functions
```

Also check the additional conditions that apply (Rules tests, index additions, design document updates, etc.) against the table.

### 5. Detect convention violations

Look for places that violate `docs/rules/coding.md`.

Run these at the repository root.

```bash
grep -rn "useNavigation<any>" Ren-kei_procon/src/          # Type evasion
grep -rn "increment(" Ren-kei_procon/src/                   # Counters
grep -rn "Math.random" Ren-kei_procon/src/                  # Mocks
grep -rn "from 'firebase/firestore'" Ren-kei_procon/src/screens/   # Direct SDK calls from screens
grep -rn "collection(db, 'Users'" Ren-kei_procon/src/       # Capitalized collection
grep -rn "as any\|@ts-ignore" Ren-kei_procon/src/           # Type evasion
```

### 6. Check the safety boundary

Confirm that no change touching `docs/rules/safety.md` has been introduced. In particular:

```bash
git diff main -- firestore.rules storage.rules              # Rules changes
git diff main --stat -- docs/spec/                          # Edits to the reference document (must not happen)
git status --short                                           # Unintended files
```

If there is any change under `docs/spec/`, **that is itself a violation**. Report it.

### 7. Report

Report in the following format. **Do not hide items that are not satisfied.**

```markdown
## spec-check: 001-hand-height-realtime

### Acceptance criteria (7 items)
- ✅ AC-1: WHEN the wrist... → implemented at src/features/rules/handHeight.ts:42. Unit test passes
- ⚠️ AC-2: WHILE the whole body... → implementation exists but unverified on a device
- ❌ AC-3: WHEN held for 200ms... → holdDurationMs is not implemented (always fires immediately)
- ➖ AC-4: 10fps or more → not measured, needs a physical device

### Definition of Done
- ✅ npx tsc --noEmit passes
- ❌ Rule Engine unit tests not written
- ❌ The conclusion of TBD-01 not recorded in docs/design/ai-basic-motion.md

### Convention violations
- src/screens/CameraScreen.tsx:17 uses useNavigation<any>()

### Conclusion
**The completion criteria are not satisfied.** The holdDurationMs implementation for AC-3,
the Rule Engine unit tests, and the record of TBD-01 are required.
```

**State the conclusion explicitly.** If it is not satisfied, write "not satisfied". Do not write "mostly done" when there are unmet items.
