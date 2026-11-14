import { Text } from "react-native";

/** "DANGER ZONE" / "danger zone" → "Danger zone". */
export function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * The label over a group of rows (Settings' "Appearance", Notes' "Pinned", an editor's "Status").
 * Sentence case in the UI font — not tracked small capitals, which read as decoration (DESIGN.md).
 */
export function SectionHeading({ children, className = "" }: { children: string; className?: string }) {
  return (
    <Text accessibilityRole="header" className={`text-ink-2 mb-2 pl-0.5 text-[13px] font-semibold ${className}`}>
      {sentenceCase(children)}
    </Text>
  );
}
