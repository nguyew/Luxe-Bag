# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

LuxeBag is an Expo/React Native handbag-browsing app. It is a plain JavaScript project (no TypeScript) running **Expo SDK 54** (`expo ~54.0.36`) with React 19 and React Native 0.81.5. The New Architecture is enabled in `app.json` (`newArchEnabled: true`).

> **Expo caveat:** SDK APIs change frequently. Before relying on memory for any Expo/EAS/React Native API, check the versioned docs at `https://docs.expo.dev/versions/v54.0.0/` or the Expo LLM corrections index at `https://docs.expo.dev/llms.txt`.

## Common commands

The project uses npm (lockfile is `package-lock.json`). Use `npx`, not `bunx`.

```bash
# Start the Metro dev server
npx expo start

# Platform-specific entry points
npx expo start --android
npx expo start --ios
npx expo start --web

# Clear Metro/cache after changing .env or native config
npx expo start -c

# Install SDK-compatible packages
npx expo install <package>

# Diagnose dependency/config issues
npx expo-doctor

# Fix incompatible package versions
npx expo install --fix

# Build a local development client after adding native modules
npx expo run:android
npx expo run:ios
```

There are **no test, lint, or typecheck scripts configured** in this repo yet. `package.json` only defines `start`, `android`, `ios`, and `web`. Running `npx expo lint` or `npx tsc --noEmit` will fail until ESLint/TypeScript is set up.

## High-level architecture

### Entry point and navigation

- `index.js` registers the root component with `expo/registerRootComponent`.
- `App.js` wraps the app in `NavigationContainer` and renders `AppNavigator`.
- Navigation uses **React Navigation** (`@react-navigation/native-stack` + `@react-navigation/bottom-tabs`), **not** Expo Router.
  - `src/navigation/AppNavigator.js` owns a native-stack navigator.
  - The root stack contains `MainTabs` (a bottom-tab navigator with a custom floating tab bar) and the modal screens `Search` and `Detail`.
  - Tab screens: `Home`, `Favorites`, `Cart`, `Profile`.

> Note: `AGENTS.md` mentions Expo Router and a `src/app/` directory, but those do not reflect the current codebase. Keep screens in `src/screens/` and navigator config in `src/navigation/AppNavigator.js`.

### Screens

- `HomeScreen.js` — main catalog. Fetches handbags from MockAPI, renders brand filter chips, and displays a custom 2-up / wide card grid using `FlatList`.
- `DetailScreen.js` — handbag detail (currently a placeholder).
- `FavoritesScreen.js` — saved favorites (placeholder).
- `CartScreen.js` — shopping bag (placeholder).
- `ProfileScreen.js` — account (placeholder).
- `SearchScreen.js` — search modal reached from the home header.

### Data and state

- `src/services/api.js` — HTTP layer for MockAPI (`mockapi.io`). Reads `EXPO_PUBLIC_API_URL` from the environment. Endpoints: `getHandbags()`, `getHandbagById(id)`.
- `src/services/favoriteService.js` — persists favorites in `@react-native-async-storage/async-storage` with a write queue and pub/sub (`subscribeFavorites`).
- `src/hooks/useFavorites.js` — React hook that subscribes to favorites and exposes `isFavorite`, `toggleFavorite`, etc.
- `src/utils/format.js` — price and discount formatting helpers.

### UI components

- `src/components/HandbagCard.js` — shared product card used by the home grid. Supports square and wide layouts, image fallback, favorite toggle, gender badge, and discount pill.

### Styling

All styles are inline `StyleSheet.create()` objects in each file. The app uses a warm neutral palette (`#F3F1F1` background, `#1A1A1A` text, `#1E1E1E` tab bar).

## Environment variables

The backend URL is read from `EXPO_PUBLIC_API_URL` in a root `.env` file:

```env
EXPO_PUBLIC_API_URL=https://<your-project>.mockapi.io/api/v1
```

Do not include the trailing `/handbags` path; `api.js` normalizes it. After editing `.env`, restart Metro with `npx expo start -c`.

## Native code

`ios/` and `android/` do not exist and are ignored in `.gitignore`. This project uses Continuous Native Generation: configure native behavior in `app.json` and config plugins instead of editing native directories. If you add a library with native code, you must run a development build (`npx expo run:ios|android` or EAS) rather than using Expo Go.

EAS is not configured yet (no `eas.json`).
