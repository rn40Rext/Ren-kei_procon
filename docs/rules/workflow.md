# Development Flow

> **Issue-driven is the default.** Hand over a single issue and the work proceeds through implementation.
> Cutting a spec (`docs/specs/`) is for **a limited set of cases only** (see section 3).

## 0. Core Principle

**Do not invent requirements.** Before writing anything, always confirm where the feature you are about to implement is defined in the product specification ([../spec/](../spec/README.md)) and the design documents ([../design/](../design/)).

> ⚠️ Note, however, that specification v0.3 is **not a final specification agreed on by the team.** It is a document assembled by inference from existing materials, and `docs/design/` specifies it further by inference. **Inference is layered across three levels — specification → design → issues — and the lower the layer, the weaker its grounding** (see "この文書の位置づけ" in [../spec/README.md](../spec/README.md)).
>
> "Reference before writing" is required not because the sources are certain, but because **with no reference at all, the gaps get filled by arbitrary interpretation.** If something looks wrong, say so.

The reason "just write something that works and back-fill the spec later" is banned is the history of this repository itself. AI scoring kept displaying "AI 87 points" while it was still a `Math.random()` mock, because the specification had detailed scoring rules but the implementation proceeded without referencing them.

**This is not about "writing three documents" — it is about "referencing before writing."** It holds for issue-driven work too.

---

## 1. Default: Issue-Driven

```
Receive an issue → read the references → implement → verify (DoD)
```

Unimplemented features are already filed as 8 epics + 36 child issues (#5–#48), and known defects and technical debt as 10 issues (#50–#59). **Each issue carries acceptance criteria, the relevant specification section, and links to the design documents.** These act as the spec in practice.

### Steps

**1. Read the issue**

```bash
gh issue view <issue-number>
```

The parent epics (`type:epic`, #5–#12) list the recommended order of child issues and their dependencies.

**2. Read the references**

Actually read the documents the issue body links to. **Do not start writing without reading the links.**

| Area | Document to read |
| --- | --- |
| Handling data | [../design/data-model.md](../design/data-model.md) |
| Permissions / Rules | [../design/security-rules.md](../design/security-rules.md) |
| AI scoring (basic motion) | [../design/ai-basic-motion.md](../design/ai-basic-motion.md) |
| Style similarity | [../design/ai-style-similarity.md](../design/ai-style-similarity.md) |
| Cloud Functions | [../design/api-functions.md](../design/api-functions.md) |
| Screens / navigation | [../design/screens.md](../design/screens.md) |
| Current defects | [../status/gap-analysis.md](../status/gap-analysis.md) |

**3. Implement**

- Coding conventions: [coding.md](coding.md)
- Prohibitions: [safety.md](safety.md) (narrowed down for the programming contest (procon))
- **If you find you need to deviate from the issue's acceptance criteria, fix the issue before proceeding with the implementation**

**4. Verify**

Check the items in [definition-of-done.md](definition-of-done.md). If any item is not met, **report that it is not met**.

With Claude Code, `/spec-check <issue-number>` cross-checks acceptance criteria against the implementation.

### With Claude Code

```
/impl 15
```

Or simply "implement #15" — same thing. It reads the issue, the design documents, and the rules before implementing, and verifies through DoD.

---

## 2. Always Record What Was Decided

Once you settle a TBD, **write the decision and its rationale into the relevant document under [../design/](../design/)**.

A decision left only in an issue comment or a chat never reaches the next person. The list of TBDs and which issue decides each one is in section 4 of [../status/roadmap.md](../status/roadmap.md). Once decided, update the state there as well.

**Never skip this step.** This one added line is worth more than creating three documents.

---

## 3. Cut a Spec Only in These 3 Cases

Creating requirements → design → tasks under `docs/specs/<NNN>-<slug>/` is for **when issues alone are not enough**.

| Case | Example |
| --- | --- |
| **A. Building a feature absent from the specification** | Things with no definition in product specification v0.3, such as "coaching requests" or "1-on-1 chat". Agreement on what to build must come first |
| **B. A decision spanning multiple issues is needed** | Cases like Prototype 1 (#13–#16), where deciding TBD-01 (the pose estimation approach) once settles all 4 issues. The decision should live in one place |
| **C. Agreement on the scope boundary is needed** | Cases where "how far to go and where to stop" is vague, and starting without deciding causes rework |

**Everything else is covered by an issue.** Work that fits in a single issue does not need a spec.

### Existing Specs

| spec | Case | Related issues |
| --- | --- | --- |
| [001-hand-height-realtime](../specs/001-hand-height-realtime/requirements.md) | B (the TBD-01 decision settles #13–#16) + C | #13 #14 #15 #16 |

**There are no specs other than this one.** At the current issue granularity, issues alone suffice in most cases.

### Steps When Cutting a Spec

Proceed in 3 phases, obtaining human approval at each transition.

```
[1] requirements ──▶ [2] design ──▶ [3] tasks ──▶ implementation (to section 1's steps)
       ↑approval          ↑approval      ↑approval
```

| Phase | What to write | Claude Code |
| --- | --- | --- |
| [1] requirements | Purpose, scope, **out of scope**, acceptance criteria (EARS notation), assumptions, TBDs | `/spec-new` |
| [2] design | Comparison of approaches and rationale for the choice, files to change, data changes, types, test strategy, risks | `/spec-plan` |
| [3] tasks | Breakdown into single-commit units, dependency order, **mapping to existing issues (#5–#59)** | `/spec-tasks` |

Templates are in [../specs/TEMPLATE/](../specs/TEMPLATE/).

**Spec files under `docs/specs/` are written in Japanese** (they are human-facing).

**Do not duplicate content that belongs to the cross-cutting design ([../design/](../design/)) — link to it.** Example: the Rule Engine state machine is in `docs/design/ai-basic-motion.md`, so reference it there and write only the differences.

---

## 4. How to Write Acceptance Criteria (EARS Notation)

In issues and in specs alike, write acceptance criteria in these forms. Vague criteria get interpreted by agents in whatever way suits them.

| Form | Format | Example |
| --- | --- | --- |
| Event-driven | **WHEN** 〈condition〉 **THEN** the system **SHALL** 〈response〉 | WHEN the wrist stays 0.05 or more above the head reference for 200ms THEN the system fires a GOOD event |
| State-driven | **WHILE** 〈state〉 **THEN** the system **SHALL** 〈response〉 | WHILE the full body is not detected THEN the system displays NOT_READY and adds no points |
| Optional feature | **WHERE** 〈feature is enabled〉 **THEN** the system **SHALL** 〈response〉 | WHERE the combo feature is enabled THEN the system adds a bonus according to the number of consecutive successes |
| Unwanted event | **IF** 〈anomaly〉 **THEN** the system **SHALL** 〈response〉 | IF camera permission is absent THEN the system displays guidance to the settings screen |
| Ubiquitous | The system **SHALL** always 〈response〉 | The system always creates practice videos with visibility=private |

Japanese is fine. **Do not use vague, unverifiable wording such as "appropriately", "nicely", or "as needed".** A criterion that cannot be verified is not an acceptance criterion.

---

## 5. Claude Code Commands

| Command | Purpose | Frequency of use |
| --- | --- | --- |
| `/impl <issue-number>` | **The default implementation flow.** Reads the issue, design documents, and rules, implements, and verifies through DoD | High |
| `/spec-check <issue-number or spec-number>` | Cross-check acceptance criteria against the implementation | High |
| `/spec-new <feature-name>` | Create requirements (only when case A/B/C in section 3 applies) | Low |
| `/spec-plan <spec-number>` | Create design | Low |
| `/spec-tasks <spec-number>` | Create tasks and map them to issues | Low |

**The commands are only aids.** If you use another agent, have it read the relevant section of this document. The steps are the same.

---

## 6. Directory Layout

```
docs/
├── spec/                        Product specification v0.3 (reference document; Markdown edits prohibited)
├── design/                      Cross-cutting implementation design ← read when implementing; record decisions here
├── status/                      Implementation status and roadmap
├── rules/                       Development rules (including this document)
└── specs/                       Feature-level specs ← create only for case A/B/C in section 3
    ├── TEMPLATE/
    └── 001-hand-height-realtime/
```
