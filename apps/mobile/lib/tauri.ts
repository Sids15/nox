/** Native builds never run inside Tauri. The `.web` sibling does the real detection. */
export function isTauri(): boolean {
  return false;
}
