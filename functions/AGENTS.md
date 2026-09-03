# AGENTS.md — Cloud Functions

> These rules are specific to this directory, in addition to the root [../AGENTS.md](../AGENTS.md).

## Current state

**Nothing is implemented yet.** `src/index.ts` contains only Firebase's template comments, and not a single function is defined.

The design is in [../docs/design/api-functions.md](../docs/design/api-functions.md) (FN-01 to FN-07). Groundwork is [#46](../../issues/46).

## Commands

```bash
npm install
npm run build           # tsc
npm run lint            # eslint
npm run serve           # build + Emulator
npm run deploy          # ⚠ Production. Get approval first
npm run logs
```

`predeploy` in `firebase.json` runs `lint` and `build`. **You cannot deploy unless the build passes.**

The Node version is specified as **24** in `engines` in `package.json`.

## Rules to follow in this directory

### Use v2 Callable (`onCall`)

Use `onCall`, not `onRequest` (HTTP). Credentials are passed automatically as `request.auth`, and you do not have to implement CORS and authentication yourself.

### Go through the shared guards

```ts
import { requireAuth, requireRenAdmin } from './lib/guards';

const uid = requireAuth(request);
await requireRenAdmin(uid, renId);   // Functions that require ren admin permission
```

**Do not determine ren (連) admin status from `users.role` alone.** Verify `ren/{renId}/members/{uid}.role == 'admin'`. Omitting this lets the admin of ren A modify the data of ren B.

### Compute scores on the server

The target shape: accept aggregate values from the client (per-rule success counts, hold ratios, measured values) and **compute `totalScore` on the server side**. Never accept `totalScore` itself from the client.

Writes to `analysisResults` / `growthRecords` are fully denied to clients in the Security Rules. The Admin SDK does not go through the Rules, so Functions can write to them.

**Client-side computation is acceptable at the Prototype stage** ([../docs/rules/safety.md](../docs/rules/safety.md) ch. 3), but move it before public release ([#35](../../issues/35)). If you do not, users can rewrite their own scores.

### Do permission transitions in transactions

Processes that **must not end up in a state where only one half succeeded** — such as updating `joinRequests.status` and creating `members` — must be transactions.

For state transitions, verify the combination of source and destination state (approval from anything other than `pending` is `INVALID_STATUS_TRANSITION`).

### Recount counters with aggregation queries

Do not use `increment()`. **Triggers are delivered at-least-once, so duplicate executions make counters drift, and you cannot notice that they have drifted.** Recount every time with `count()`.

### Return errors as codes

```ts
throw new HttpsError('permission-denied', 'FORBIDDEN');
```

Put the codes from ch. 13 of the specification (`UNAUTHORIZED` / `FORBIDDEN` / `ANALYSIS_FAILED` / `JOIN_REQUEST_ALREADY_PENDING` / `INVALID_STATUS_TRANSITION` / `POST_VIDEO_NOT_PUBLICABLE`, etc.) in `message`.

**Display wording is resolved by a dictionary on the client side.** If the server holds the wording, every wording change requires a deploy.

### Idempotency

To keep client retries from creating duplicate documents, accept a `clientRequestId` and use it to determine whether the request was already processed.

## Directory structure (planned)

```
src/
├── index.ts                    Exports of each function only
├── analysis/                   FN-01 finalizeBasicAnalysis, FN-02 analyzeStyle
├── community/                  FN-03 publishPost
├── ren/                        FN-04 to FN-06
├── style/                      FN-07 rebuildRenStyleProfile
├── triggers/                   Counter sync, notification generation, Storage object deletion
└── lib/                        errors.ts / guards.ts / types.ts
```

## Open questions

| ID | Description |
| --- | --- |
| TBD-12 | Division of roles between Firebase Functions and Cloud Run (where to put Motion Encoder inference) |
| N-4 | Region. Firestore is in `nam5` (US), users are in Japan. Placing it in `asia-northeast1` increases Functions ↔ Firestore round trips |

Once decided, record it in [../docs/design/api-functions.md](../docs/design/api-functions.md) and [../docs/status/roadmap.md](../docs/status/roadmap.md).

## Secrets

- **Do not place or commit** service account keys **in this directory**
- Use Firebase Secret Manager for secrets
- Keep `setGlobalOptions({ maxInstances: 10 })` for cost control
