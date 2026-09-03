---
paths:
  - "firestore.rules"
  - "storage.rules"
  - "firestore.indexes.json"
  - "functions/**"
  - "Ren-kei_procon/src/repositories/**"
  - "Ren-kei_procon/src/config/**"
---

# Rules for working with Firebase

**Read [docs/rules/safety.md](../../docs/rules/safety.md) and [docs/design/data-model.md](../../docs/design/data-model.md) before editing.**

## When you relax Security Rules

**Relaxing them during development is fine** (operating policy for the procon project; see chapter 0 of [../../docs/rules/safety.md](../../docs/rules/safety.md)). But observe these two points.

1. **Write "what you relaxed and how" in the PR body**
2. **Restore it before public release** ([#40](../../../../issues/40))

If the Emulator is available, prefer the Emulator. Relaxed rules get left behind. In fact, `storage.rules` is still `allow read, write: if true` ([#50](../../../../issues/50)).

### Procedure for tightening rules

1. Cross-check against the CRUD permission table in [../../docs/design/security-rules.md](../../docs/design/security-rules.md) (actual Rules code is provided there)
2. Make Rules Unit Tests pass on the Emulator ([#42](../../../../issues/42))
3. `firebase deploy --only firestore:rules,storage` — **this is a production deploy, so get confirmation**

## Do not get the basis for permission checks wrong

| Check | Correct basis | Do not do this |
| --- | --- | --- |
| Owner | `request.auth.uid` | Trust the `userId` sent by the client |
| ren (連) admin | `ren/{renId}/members/{uid}.role == 'admin'` | Check only `users.role == 'ren_admin'` |
| Editing/deleting a comment | The comment's own `userId` | The post's `userId` |
| State transition | The combination of source and destination state | Look only at the destination state |

If you check for ren admin using only `users.role`, **an admin of ren A can modify ren B's data**. Verify at all 3 layers: Rules, Functions, and UI.

## Scores must eventually be computed on the server

The goal is for writes to `analysisResults` / `growthRecords` to be denied to all clients in Rules, with only Cloud Functions (the Admin SDK does not go through Rules) writing them. The client sends aggregate values, and `totalScore` is computed on the server.

**At the Prototype stage, client-side computation is acceptable.** But move it before public release ([#35](../../../../issues/35)). If you do not move it, users can rewrite their own scores.

## Firestore naming and structure

The reference is [docs/design/data-model.md](../../docs/design/data-model.md) (**this too is a proposal, not a settled specification**). Key points:

- Collection names: English, plural, starting lowercase (`users`, `videos`, `joinRequests`)
- Field names: lowerCamelCase / use `serverTimestamp()` for timestamps
- Enum values: lower snake case (`pending`, `ren_admin`)
- **The existing `Users/{uid}` (capitalized) violates the convention. Do not use it in new code**

## Do not use increment() for counters

Cloud Functions triggers are delivered at-least-once, so `increment()` drifts on duplicate execution. **And you cannot tell that it has drifted.** Recount every time with an aggregation query (`count()`).

For likes, use the uid as the document ID, like `posts/{postId}/likes/{uid}`, and guarantee one per person in Rules.

## Cloud Functions

- Use v2 Callable (`onCall`). Auth information is passed automatically and you do not need to implement CORS yourself
- Put the codes from chapter 13 of the specification in `HttpsError`. **Resolve display text with a dictionary on the client side**
- Go through the shared `requireAuth()` / `requireRenAdmin()` guards
- Do permission transitions and score finalization in a transaction
- Definitions are in [docs/design/api-functions.md](../../docs/design/api-functions.md) (FN-01 to FN-07)

## Indexes

`firestore.indexes.json` is currently empty. When you write a new query, add the composite indexes it needs. The required list is in chapter 4 of [docs/design/data-model.md](../../docs/design/data-model.md).

## Secrets

- The apiKey and similar values in `firebaseConfig` are **public identifiers**. Having them in the source is not a vulnerability (protection is the responsibility of Rules)
- **Never commit** service account keys (`*-firebase-adminsdk-*.json`)
- Use Firebase Secret Manager for Functions secrets
