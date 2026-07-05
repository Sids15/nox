import { useWindowDimensions } from "react-native";

/** Desktop = a wide viewport (Windows/web window). Drives the sidebar + multi-column layouts. */
export function useIsDesktop(): boolean {
  return useWindowDimensions().width >= 900;
}
