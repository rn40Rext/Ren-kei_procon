# Coding conventions

> These are the conventions to follow when implementing. **Where existing code violates a convention, the convention wins** (do not imitate existing code). We fix it incrementally.

## 1. Baseline: the app itself lives in `Ren-kei_procon/`

```
Ren-kei_procon/            ← repository root (Firebase config and documentation)
└── Ren-kei_procon/        ← ★ the Expo app itself. Run npm install / expo start here
```

The `package.json` at the root is not the app's (invalid dependency entries remain there and are scheduled for cleanup → [#55](../../../issues/55)). **When adding a dependency for the app, edit `Ren-kei_procon/package.json`.**

## 2. TypeScript

| Rule | Reason |
| --- | --- |
| Keep `strict: true` | Enabled in `tsconfig.json`. Do not relax it |
| **Do not use `useNavigation<any>()`** | Use `NativeStackNavigationProp<RootStackParamList, 'ScreenName'>`. Because `any` evaded type checking, navigation to an unregistered screen could not be detected at compile time and crashed at runtime ([#51](../../../issues/51)) |
| Do not reach for `as any` / `@ts-ignore` casually | If you use one, write the reason in a comment |
| When you add a new screen, add its type to `RootStackParamList` | Define it with its parameters |
| Make `npx tsc --noEmit` pass before committing | [definition-of-done.md](definition-of-done.md) |

## 3. Directories and responsibilities

```
Ren-kei_procon/src/
├── screens/          Screen components. UI and user interaction only
├── components/       Reusable UI parts
├── navigation/       React Navigation definitions
├── config/           Firebase initialization ★ this is the correct one (the duplicate under firebase/ is scheduled for deletion, #56)
├── features/         Domain logic
│   ├── pose/         Pose-estimation wrapper and coordinate normalization
│   ├── rules/        Rule Engine (RULE-01 to 07)
│   ├── scoring/      Game Score / Analysis Score
│   └── style/        Style-similarity API calls
├── repositories/     Consolidated Firestore / Storage access
├── types/            Type definitions for Firestore entities
├── hooks/            Shared hooks such as useAuth
└── theme/            colors.ts and the like
```

### Do not call Firestore directly from a screen

```ts
// ✗ current implementation (CommunityScreen.tsx and others)
import { collection, addDoc } from 'firebase/firestore';
await addDoc(collection(db, 'videos'), { ... });

// ✓ route through the repositories layer
import { createPost } from '../repositories/posts';
await createPost({ videoId, title, tags });
```

Reason: when the data model or the Security Rules change, the impact hits screens directly. Today `CommunityScreen.tsx` / `MypageScreen.tsx` / `ChatScreen.tsx` call the SDK directly, so the data migration in [#57](../../../issues/57) requires touching every screen.

### Do not read `auth.currentUser` directly from a screen

Go through the `useAuth()` hook. Today `HomeScreen` / `CommunityScreen` / `MypageScreen` reference it directly, so they do not follow changes in authentication state.

## 4. Firestore

[docs/design/data-model.md](../design/data-model.md) is the reference for naming conventions and the field definitions of every collection. Only the key points here:

| Target | Convention | Example |
| --- | --- | --- |
| Collection name | English, plural, starting lowercase | `users`, `videos`, `joinRequests` |
| Field name | lowerCamelCase | `createdAt`, `totalScore` |
| Date and time | Write it with `serverTimestamp()`. Do not use the client clock | `createdAt: serverTimestamp()` |
| Enum value | lower snake case | `pending`, `ren_admin` |
| Document ID | Auto ID; a natural key when the owner is uniquely determined | `users/{uid}`, `posts/{postId}/likes/{uid}` |

> The existing `Users/{uid}` (starting uppercase) violates the convention. [#39](../../../issues/39) migrates it to `users`. **Do not use `Users` in new code.**

### Do not use `increment()` for counters

```ts
// ✗ the same user can add to it without limit
await updateDoc(doc(db, 'videos', id), { likes: increment(1) });

// ✓ use the uid as the document ID so Rules guarantee one per person,
//   and recompute the counter from an aggregation query in a Cloud Functions trigger
await setDoc(doc(db, 'posts', postId, 'likes', uid), { userId: uid, createdAt: serverTimestamp() });
```

Cloud Functions triggers are delivered at-least-once, so `increment()` drifts on duplicate execution. Worse, **you cannot tell that it drifted.**

## 5. Styling

| Rule | Detail |
| --- | --- |
| Consolidate colors in `src/theme/colors.ts` | Today `HomeScreen` / `MypageScreen` / `LoginScreen` each define their own `COLORS` |
| Use the traditional Awa Odori colors | indigo `#001E43` / vermilion `#E60012` / gold `#D4AF37` (the definitions in `HomeScreen` are the reference) |
| Use `StyleSheet.create()` | Avoid heavy use of inline styles |
| Icons come from `lucide-react-native` | Do not use `lucide-react` (for the web). Scheduled for removal → [#55](../../../issues/55) |

## 6. Expo

**Expo's APIs change per SDK version. Check the official documentation for the target version before writing code.**

- What the app actually uses now: `expo ^54.0.36`
- `Ren-kei_procon/AGENTS.md` is written assuming v57 → **which one is correct is undecided** ([#55](../../../issues/55))
- Documentation: <https://docs.expo.dev/versions/>

Read that version's documentation, not your memory or a sample snippet.

## 7. Error handling

Error codes follow the scheme in chapter 13 of the specification ([docs/spec/13-error-handling.md](../spec/13-error-handling.md)).

- Client-side detection errors: `CAMERA_PERMISSION_DENIED`, `PERSON_NOT_DETECTED`, `LOW_LANDMARK_CONFIDENCE`, `MULTIPLE_PERSONS_DETECTED`
- Server-side: `UNAUTHORIZED`, `FORBIDDEN`, `ANALYSIS_FAILED`, `JOIN_REQUEST_ALREADY_PENDING`, `INVALID_STATUS_TRANSITION`, `POST_VIDEO_NOT_PUBLICABLE`

**Displayed wording is resolved by a dictionary on the client.** Have the server return only the code (because we do not want to deploy every time the wording changes).

Avoid uninformative messages like `Alert.alert("エラー", "失敗しました")`; write what the user should do next.

## 8. Comments and language

| Target | Language |
| --- | --- |
| Agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/**`, `.claude/skills/**`, `docs/rules/**`) | English |
| Human-facing documents (`README.md`, `docs/README.md`, `docs/spec/**`, `docs/design/**`, `docs/status/**`, `docs/specs/**`) | Japanese |
| Source code comments | Japanese (matches the existing codebase) |
| Identifiers (variables, functions, types) | English |
| User-facing UI strings | Japanese |
| Commit messages, PR descriptions, issue bodies | Japanese |

The full policy is in [../../AGENTS.md](../../AGENTS.md) under "Language policy".

Comments **explain why**. The what can be read from the code.

```ts
// ✗ 手首の Y 座標を取得する
// ✓ 画像座標は下方向が正なので、頭より上にある手首は差が正になる
```

Delete working-note comments left in existing code, such as `// 💡 追加` and `// ⚠️ Firebaseのパスが2種類あったため`, before committing.

## 9. Testing

| Target | Method |
| --- | --- |
| Rule Engine | Unit tests that feed fixed landmark sequences from JSON fixtures (`src/features/rules/__fixtures__/`). Make them runnable in CI without a device |
| Security Rules | `@firebase/rules-unit-testing` + Emulator ([#42](../../../issues/42)) |
| Cloud Functions | Emulator |

Always include boundary-value, noise, and missing-data cases (specification 15.1).

## 10. When you create a new file

1. Follow the directory responsibilities in chapter 3 above
2. Follow the structure of similar existing files (but do not imitate convention violations)
3. If there is a design in `docs/design/`, follow it
4. When in doubt, check with a human
