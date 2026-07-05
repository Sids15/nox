/** Client-side password strength for the sign-up meter (never a substitute for server rules). */

export interface PasswordStrength {
  /** 0 = empty, 1 = weak, 2 = good, 3 = strong. */
  score: 0 | 1 | 2 | 3;
  label: string;
}

/**
 * A coarse 0–3 score: +1 for length ≥ 8, +1 for mixing letters and digits, +1 for a symbol or
 * length ≥ 12. Drives the three-segment meter on the create-account screen.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  const score = Math.min(3, s) as 0 | 1 | 2 | 3;
  return { score, label: ["", "Weak", "Good", "Strong"][score]! };
}
