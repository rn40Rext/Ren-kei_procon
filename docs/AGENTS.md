# AGENTS.md — Documentation

> These rules are specific to this directory, in addition to the root [../AGENTS.md](../AGENTS.md).

## ⚠️ Do not edit the Markdown under `docs/spec/**` directly

It is generated from the Word original `Ren-Kei_システム仕様書_基本設計書_v0.3.docx`, so **fixing only this copy makes it diverge from the original, and it becomes impossible to tell which one is correct.**

This does not mean "the content is correct, so do not touch it." **Specification v0.3 is not a final specification agreed on by the team; it is a document assembled by inference from existing materials** (for details, see "この文書の位置づけ" in [spec/README.md](spec/README.md)). Objections to the content are welcome.

To change the content:

1. Update the Word original as v0.4 (human work)
2. Re-split it by chapter and regenerate `docs/spec/`
3. Update the affected parts of `docs/design/` and `docs/status/`

**When the specification and the implementation disagree, do not decide on your own to align with one of them.** Record the difference in [status/gap-analysis.md](status/gap-analysis.md) and ask a human to judge. Both are possible: the specification may be wrong, and the implementation may be wrong.

## Roles of the directories

| Path | Role | Editing |
| --- | --- | --- |
| `spec/` | Product specification v0.3 (the current reference document) | **✗ Editing the Markdown is forbidden** |
| `design/` | Cross-cutting implementation design | ○ As a record of decisions |
| `specs/` | Per-feature spec (requirements → design → tasks) | ○ After the phase is approved |
| `rules/` | Development rules | ○ After human approval |
| `status/` | Implementation status and roadmap | ○ Update when the situation changes |
| `api/` | Old API notes (the current design is `design/api-functions.md`) | ○ |

`spec/` (singular) is the product specification, `specs/` (plural) is the unit of work. Be careful, they are easy to confuse.

## Always record decisions

When you decide an open question (TBD), **write the decision and the reasoning in the relevant document under `design/`**. A decision left only in an issue comment or a chat does not reach the next person to work on it.

The list of TBDs and which issue decides each is in ch. 4 of [status/roadmap.md](status/roadmap.md). Once decided, update the status there as well.

## Writing

- **Write in Japanese.** All existing documents are in Japanese too
- Distinguish facts from inference. If it is inference, write "〜と考えられます"
- **Mark provisional values as "暫定" (provisional).** Example: all Rule Engine thresholds are provisional values and will be finalized after interviews with instructors
- Do not duplicate content between the cross-cutting design (`design/`) and the per-feature specs (`specs/`). **Link instead**
- Use relative links, and confirm that the link target exists
- For GitHub issues, use the `../../../issues/<number>` form (relative to `docs/xxx/yyy.md`)

## Language policy

Documents in this directory (`docs/spec/`, `docs/design/`, `docs/status/`, `docs/specs/`) are written in **Japanese** — they record what the system is and why, and the team reads them.

`docs/rules/**` is the exception: it is an agent instruction set and is written in **English**, like `AGENTS.md`.

See the full table in [../AGENTS.md](../AGENTS.md) under "Language policy".

## Link verification

After adding or moving a document, run the following at the repository root.

```bash
python3 - <<'PY'
import os, re, urllib.parse
files = ['README.md', 'AGENTS.md', 'CLAUDE.md']
for root in ('docs', '.claude'):
    for d, _, fs in os.walk(root):
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
