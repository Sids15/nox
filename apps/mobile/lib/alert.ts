/**
 * Native re-export of React Native's `Alert`. The web sibling (`alert.web.ts`) exists because
 * react-native-web ships `Alert` as a silent no-op (`static alert() {}`), so every message the app
 * tries to show — validation errors, "check your email", upload failures — vanishes on web.
 *
 * Import `Alert` from here, never from "react-native", or the message won't survive the web build.
 */
export { Alert } from "react-native";
