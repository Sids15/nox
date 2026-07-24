/**
 * Native has no `<iframe>`; inline embedding would need react-native-webview. Until that's added,
 * native routes trusted videos to the external browser (handled in the caller), so this renders
 * nothing. The `.web` sibling is the real player.
 */
export function VideoPlayer(_props: { embedUrl: string | null; title?: string; onClose: () => void }) {
  return null;
}
