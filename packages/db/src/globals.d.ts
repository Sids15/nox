// EXPO_PUBLIC_* vars are inlined by Expo's bundler at build time. This ambient lets the
// package typecheck standalone (the app supplies the real global at runtime).
declare const process: { env: Record<string, string | undefined> };
