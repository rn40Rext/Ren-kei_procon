---
paths:
  - "docs/**"
  - "README.md"
---

# Rules for editing documentation

## ⚠️ Editing the Markdown under `docs/spec/**` directly is prohibited

It is generated from the Word original `Ren-Kei_システム仕様書_基本設計書_v0.3.docx`, so **fixing only this copy makes it diverge from the original, and you can no longer tell which one is correct.**

This does not mean "don't touch it because the content is correct." **Specification v0.3 is not a final specification agreed on by the team; it is a document assembled by inference from existing materials** (see "この文書の位置づけ" in [docs/spec/README.md](../../docs/spec/README.md)). Objections to the content are welcome.

To change the content:

1. Update the Word original as v0.4 (a human task)
2. Re-split it by chapter and regenerate `docs/spec/`
3. Update the affected parts of `docs/design/` and `docs/status/`

**If the specification and the implementation disagree, do not unilaterally align one with the other.** Record the difference in [docs/status/gap-analysis.md](../../docs/status/gap-analysis.md) and ask a human to decide. The specification could be wrong, and the implementation could be wrong too.

## Role of each directory

| Path | Role | Editing |
| --- | --- | --- |
| `docs/spec/` | Product specification v0.3 (the current reference document) | ✗ Editing the Markdown is prohibited |
| `docs/design/` | Cross-cutting implementation design | ○ As a record of decisions |
| `docs/specs/` | Per-feature specs | ○ After getting phase approval |
| `docs/rules/` | Development rules | ○ After getting human approval |
| `docs/status/` | Implementation status and roadmap | ○ Update when the situation changes |
| `docs/api/` | Old API notes (the current design is `docs/design/api-functions.md`) | ○ |

## Always record decisions

Once you decide an undecided item (TBD), **write the decision and its rationale in the relevant document under `docs/design/`**. A decision left only in an issue comment or a chat will not reach the next person.

The list of TBDs and which issue decides each one is in chapter 4 of [docs/status/roadmap.md](../../docs/status/roadmap.md). Once decided, update the status there too.

## How to write

- **Write documents in Japanese.** This applies to the content documents under `docs/` (`docs/spec/`, `docs/design/`, `docs/status/`, `docs/specs/`); all existing ones are in Japanese. `docs/rules/**` and agent instruction files are in English instead
- Distinguish facts from inferences. If it is an inference, write "〜と考えられます"
- Mark provisional values as "暫定" (e.g. all Rule Engine thresholds are provisional values, to be finalized after interviewing instructors)
- Use relative links. Confirm the link target exists
- Do not duplicate content between the cross-cutting design and per-feature specs. **Link instead**

## Verifying links

After adding or moving a document, check that relative links are not broken.

```bash
python3 - <<'PY'
import os, re, urllib.parse
files = ['README.md', 'AGENTS.md', 'CLAUDE.md']
for d, _, fs in os.walk('docs'):
    files += [os.path.join(d, f) for f in fs if f.endswith('.md')]
for d, _, fs in os.walk('.claude'):
    files += [os.path.join(d, f) for f in fs if f.endswith('.md')]
bad = []
for f in files:
    if not os.path.exists(f): continue
    base = os.path.dirname(f)
    for m in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', open(f, encoding='utf-8').read()):
        link = m.group(1).strip()
        if link.startswith(('http://','https://','#','mailto:')) or '/issues/' in link: continue
        t = urllib.parse.unquote(link.split('#')[0])
        if t and not os.path.exists(os.path.normpath(os.path.join(base, t))):
            bad.append((f, link))
print('OK' if not bad else f'broken links: {bad}')
PY
```

## Links to GitHub issues

From inside `docs/`, use the `../../../issues/<number>` form (relative to `docs/xxx/yyy.md`). GitHub resolves it against the repository. The local link-verification script excludes this form.
