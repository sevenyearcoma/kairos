# Kairos Mobile

This is the native Expo / React Native version of Kairos. It is not a Capacitor shell and it is not the Astro app inside a webview. The app UI is built with React Native primitives.

## Run

From the repository root:

```bash
npm run expo
```

Or from this `mobile` folder:

```bash
npm install
npm run start
```

Open the project in Expo Go or a development build for native testing.
Metro is pinned to port `8084` because `8081` is commonly already in use.

Do not use `npx run expo`; that command asks Node to run a file named `expo`.
The root command is `npm run expo`.

For browser preview only:

```bash
npm run expo:web
```

The browser preview uses `react-native-web` to render the same React Native components. It is useful for quick visual checks, but the target app remains native.

## Implemented

- Native Stitch-inspired shell and four screens: capture, today, calendar, focus.
- Persistent task and energy state with AsyncStorage.
- Native microphone recording through `expo-audio`.
- Secure Google token storage through `expo-secure-store`.
- Google auth scaffolding through `expo-auth-session`.
- Google Calendar and Google Tasks fetch helpers.

## Google Auth Setup

Copy `.env.example` to `.env.local` and fill the client IDs:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

Calendar sync currently pulls upcoming calendar events. Tasks sync pulls open tasks from the default Google Tasks list and places them in today.
