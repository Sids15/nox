/** Capitalize the first character. Safe on empty strings (returns them unchanged). */
export const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
