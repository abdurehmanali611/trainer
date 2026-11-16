This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## NativeWind v5 (`react-native-css`) — `className` only works where the polyfill wraps

This project uses nativewind `5.0.0-rc.0`, which applies `className` by hijacking Metro resolution of **React Native core modules only** (plus `@rn-primitives/*`, which spread props onto their internally imported wrapped `View`). On **native**, `className` is **silently dropped** on anything else — no error, no warning (on web it always works, so web testing hides the bug).

Rules:

- `className` is safe on: `View`, `Text`, `TextInput`, `Pressable`, `ScrollView`, `Image`, `ActivityIndicator`, `KeyboardAvoidingView`, `Animated.View`, app components built from these, and `@rn-primitives/*`.
- Use `style` (never `className`) for layout-critical props on: `SafeAreaView` (react-native-safe-area-context — dropping `className="flex-1"` here collapsed the login screen to height 0 in the APK), `expo-image`, `expo-linear-gradient`, `react-native-svg`/lucide icons (color via `color` prop — `src/components/ui/icon.tsx` maps `text-*` classes to hex fallbacks), and any newly added third-party native component.
- Symptom of getting this wrong on device: screen renders background/decorations but content is missing or unstyled, while web looks fine.
- When adding a third-party component, check whether it's in `node_modules/react-native-css/src/components/` before giving it a `className`.
