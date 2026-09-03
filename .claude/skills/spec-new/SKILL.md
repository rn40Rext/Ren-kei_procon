---
name: spec-new
description: Create a new feature-level spec (requirements.md). Phase [1] of spec-driven development. Use when the user says "create a spec", "write requirements", or "start a new feature".
disable-model-invocation: false
---

# spec-new — Writing requirements

> ⚠️ **The default is issue-driven. Consider `/impl <issue-number>` first.**
> Issues #5〜#59 already contain acceptance criteria and links to design documents, and those are the de facto spec.

## Use this command in only 3 cases

| Case | Example |
| --- | --- |
| A. Building a feature absent from the specification | Things with no definition in v0.3, such as "coaching request" or "1-on-1 chat" |
| B. A decision spanning multiple issues is needed | Prototype 1 (#13〜#16) — deciding TBD-01 once settles 4 issues |
| C. The scope boundary needs agreement | When starting without deciding would cause rework |

**If none of these apply, do not use this command — implement the issue with `/impl`.** If you cannot judge whether one applies, confirm with the user.

For the overall procedure, see `docs/rules/workflow.md`.

## Procedure

Note: documents you create under `docs/specs/` are **written in Japanese**, following the Japanese templates in `docs/specs/TEMPLATE/` (they are human-facing).

### 1. Check the existing specification and design

**Do this first.** For the feature passed as the argument, investigate the following.

| Where to look | What to check |
| --- | --- |
| `docs/spec/04-functions-and-usecases.md` | Whether a matching feature ID exists (AUTH / USER / PRACTICE / STYLE / COMM / REN / HIST / NOTI) |
| `docs/spec/05-screens-user.md` / `06-screens-ren-admin.md` | The related screen IDs (U-xx / R-xx) |
| `docs/spec/09-data-design.md` | The entities used |
| `docs/status/gap-analysis.md` | The current implementation status |
| `docs/status/roadmap.md` | Priority, other features it depends on, related TBDs |
| GitHub issues (`gh issue list`) | **Whether any of the existing issues #5〜#59 already covers it** |

**If the feature is absent from the specification, stop here and confirm with the user.** Do not invent requirements. Ask something like: "This does not appear to be in the specification — should we turn it into a requirement in v0.4, or fold it into an existing U-xx?"

Also note that specification v0.3 itself was inferred from existing materials and is not an agreed final specification (see "この文書の位置づけ" in `docs/spec/README.md`). **If you find contradictions or gaps in the specification's text, report those too.**

### 2. Decide the number and slug

Look at the existing directories under `docs/specs/` and take the next sequential number (`001`, `002`, ...). The slug uses lowercase letters and hyphens (e.g. `002-ren-join-request`).

### 3. Check the granularity

One spec covers **one coherent piece of value**. A granularity larger than a single issue and smaller than a single epic is the easiest to work with.

If the granularity feels too large or too small, **present a split proposal to the user and confirm**.

### 4. Write requirements.md

Use `docs/specs/TEMPLATE/requirements.md` as the template to create `docs/specs/<NNN>-<slug>/requirements.md`.

Mandatory conditions when writing:

- **State what is out of scope explicitly.** Without this, the agent's search area grows too wide
- **Write acceptance criteria in EARS notation** (see the table in `docs/rules/workflow.md`)
  - WHEN 〈condition〉THEN the system SHALL 〈response〉
  - WHILE 〈state〉/ WHERE 〈feature enabled〉/ IF 〈error〉
- **Do not use "appropriately", "nicely", or "as needed".** A criterion that cannot be verified is not an acceptance criterion
- Include links to the relevant chapter of the product specification
- List the open items (TBD-xx) and write when and by whom each will be decided
- Map to existing issues where they exist

### 5. Fill in the gaps through dialogue

**Do not decide unclear points on your own — ask the user.** In particular:

- When the specification allows multiple interpretations
- When an open item (TBD) determines whether this spec succeeds or fails
- When the scope boundary requires a judgment call

### 6. Get approval

Once written, present the key points (purpose, scope, out of scope, number of acceptance criteria) and **ask for approval**. Do not proceed to design or implementation before approval.

After approval, tell the user "next, proceed to design with `/spec-plan <NNN>`".

## Completion criteria

Satisfy every item under "requirements.md" in `docs/rules/definition-of-done.md`.
