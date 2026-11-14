/**
 * Dictation (speech → text) on iOS and Android: not wired to a native recogniser. The system
 * keyboard's own dictation mic already types into any field, so the editor hides its button here.
 * See dictation.web.ts for the browser version.
 */
export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** Words heard so far that aren't final yet. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useDictation(_onFinal: (text: string) => void): Dictation {
  return { supported: false, listening: false, interim: "", error: null, start: () => {}, stop: () => {} };
}
