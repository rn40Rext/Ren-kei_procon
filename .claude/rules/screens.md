---
paths:
  - "Ren-kei_procon/src/screens/**"
  - "Ren-kei_procon/src/components/**"
  - "Ren-kei_procon/src/navigation/**"
  - "Ren-kei_procon/App.tsx"
---

# Rules for editing screens and navigation

**Read [docs/rules/coding.md](../../docs/rules/coding.md) before editing.** The following is an excerpt from it.

## Do not use `any` to bypass types

```ts
// ✗ Prohibited
const navigation = useNavigation<any>();

// ✓
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
```

Because `any` bypassed type checking, navigation to an unregistered screen was not caught at compile time and crashed at runtime ([#51](../../../../issues/51)).

## When you add a screen, always update 3 places

1. Add the type to `RootStackParamList` (with parameters)
2. Register it in `AppNavigator` as a `Stack.Screen`
3. Confirm the type checks at the `navigate()` call site

All screens that are `navigate()`d are registered now ([#51](../../../../issues/51) is resolved). `Camera` takes `{ danceType, scorePart, baseBpm? }`, `Result` takes `{ analysisId, videoId }`, `Community` optionally takes `{ shareVideoId }`.

## Real-time analysis screens (U-02 / U-03)

- `CameraScreen` only orchestrates: the pose/rule logic lives in `src/features/pose/`, `src/features/rules/` and `src/features/analysis/useLiveAnalysis.ts`. Do not put judgement logic in the screen.
- `PoseCameraView.web.tsx` (DOM `<video>` + `<canvas>`) is the Web implementation; `PoseCameraView.tsx` is the native fallback. Metro picks the platform file. Keep both exporting the same props.
- Per-frame state goes in refs; React state is published at ~10Hz (`useLiveAnalysis`). Do not `setState` on every frame.
- LIVE SCORE (Game Score) and the 0–100 Analysis Score must stay visually distinct (D-04).

## Do not call Firestore directly

```ts
// ✗ Calling the SDK directly from a screen (existing code does this, but it violates the convention)
import { collection, addDoc } from 'firebase/firestore';

// ✓ Go through the repositories layer
import { createPost } from '../repositories/posts';
```

Likewise avoid referencing `auth.currentUser` directly; use `useAuth()`.

## Do not define colors per screen

Consolidate them in `src/theme/colors.ts`. The traditional Awa Odori colors (indigo `#001E43` / vermilion `#E60012` / gold `#D4AF37`) are the reference.

## Check the mapping to screen IDs

Each screen corresponds to a U-xx / R-xx in the specification. The mapping table to implementation files is in [docs/design/screens.md](../../docs/design/screens.md). **If you add a screen that is not in the specification, check with a human.**

## Expo APIs change between versions

The actual current version is `expo ^54` (`Ren-kei_procon/AGENTS.md`). Before writing camera, video, or image-picker APIs, check the target version at <https://docs.expo.dev/versions/>.
