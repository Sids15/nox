# Nox mobile app (Expo)

This app targets **Expo SDK 54**. Read the versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing native/Expo code.

- Uses **Expo Router** (file-based) — routes live in `app/`, entry is `expo-router/entry`.
- Consumes shared workspace packages under `@nox/*` (see repo root `rules.md`).
- Forced **dark** UI ("Lamplight" design system). Data access goes through the repository
  layer only — never call Supabase directly from screens.
