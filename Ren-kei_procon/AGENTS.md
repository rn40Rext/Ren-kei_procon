# AGENTS.md — Expo app

> These rules are specific to this directory, in addition to the root [../AGENTS.md](../AGENTS.md).

## ⚠️ Expo changes

**Read the official docs for the target version before writing code.** Your memory and the samples on the web are for older versions.

<https://docs.expo.dev/versions/>

### The version is not settled

| Source | Version |
| --- | --- |
| Actual value in `package.json` | `expo ^54.0.36` |
| Previous statement in this document | Assumed v57 (instructed reading `https://docs.expo.dev/versions/v57.0.0/`) |

**Which one is correct has not been decided** ([#55](../../issues/55)). Check `package.json`, then refer to the docs for that version. Get human approval before raising the version.

Areas especially prone to breaking changes:

- `expo-camera` (e.g. `Camera` → `CameraView`)
- `expo-av` split into `expo-video` / `expo-audio`
- `expo-image-picker` (deprecation of `MediaTypeOptions`)
- `expo-file-system` API reorganization

## Commands

```bash
npm install
npx expo start          # ⚠ package.json has no scripts (#54)
npx tsc --noEmit        # Type check. Required before committing
```

`i` for iOS Simulator, `a` for Android Emulator, `w` for Web.

## Directory responsibilities

```
src/
├── screens/          Screens. UI and user interaction only
├── components/       Reusable UI parts
├── navigation/       React Navigation definitions
├── config/           Firebase initialization ★this one is correct
├── features/         Domain logic (pose / rules / scoring / style)
├── repositories/     Consolidated Firestore / Storage access
├── types/            Firestore entity types
├── hooks/            useAuth and others
└── theme/            colors.ts
```

`features/` `repositories/` `types/` `hooks/` `theme/` **do not exist yet**. The design calls for creating them ([../docs/design/architecture.md](../docs/design/architecture.md) ch. 4).

## Rules to follow especially in this directory

Full text: [../docs/rules/coding.md](../docs/rules/coding.md). Key points:

- **Do not use `useNavigation<any>()`.** Because of that type escape, navigation to unregistered screens could not be detected at compile time and crashed at runtime ([#51](../../issues/51))
- **Do not call `firebase/firestore` directly from screens.** Go through `src/repositories/`
- **Do not reference `auth.currentUser` directly from screens.** Use `useAuth()`
- **Do not define colors per screen.** Consolidate them in `src/theme/colors.ts` (currently scattered across 3 files)
- **Do not import `lucide-react`.** Use `lucide-react-native`
- When you add a screen, update both `RootStackParamList` and `AppNavigator`

## Known defects

These concern this directory. If they fall within the scope you are touching, either fix them as well or decide to delegate them to a separate issue.

| # | Description |
| --- | --- |
| [#51](../../issues/51) | `Camera` / `Result` / `Request` / `UserProfile` / `Chat` are `navigate()`-ed to even though they are not registered in the navigator. **Navigating crashes** |
| [#53](../../issues/53) | `onAuthStateChanged` is subscribed twice, in `App.tsx` and `AppNavigator.tsx` |
| [#54](../../issues/54) | `package.json` has no `scripts` and no `main` |
| [#55](../../issues/55) | Invalid dependencies in the root `package.json`, Expo version mismatch, `lucide-react` present alongside |
| [#56](../../issues/56) | `firebase/firebaseConfig.ts` and `src/config/firebaseConfig.ts` are duplicated |
| [#58](../../issues/58) | AI scoring is a `Math.random()` mock, yet "AI 87 points" is displayed |

## Mapping to screen IDs

Each screen corresponds to a U-xx / R-xx in the specification. The mapping table and the intended navigation structure are in [../docs/design/screens.md](../docs/design/screens.md).

**Ask a human before adding a screen that is not in the specification.** `ChatScreen` / `UserProfileScreen` (one-on-one chat) already exist as implementations outside the specification, and how to handle them has not been decided.
