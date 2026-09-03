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

**Currently `Camera` / `Result` / `Request` / `UserProfile` / `Chat` are called via `navigate()` even though they are not registered.** Fix them as well when you touch them.

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

The actual current version is `expo ^54`. `Ren-kei_procon/AGENTS.md` is written assuming v57 and is unsettled ([#55](../../../../issues/55)). Before writing camera, video, or image-picker APIs, check the target version at <https://docs.expo.dev/versions/>.
