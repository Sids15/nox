import { Linking } from "react-native";

/** Normalises a bare domain to an absolute https URL so `example.com` opens instead of failing. */
function normalize(url: string): string {
  return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
}

/** Open a URL in the user's browser. Native uses the OS handler. */
export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(normalize(url));
}
