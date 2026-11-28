import type { Task } from "@nox/types";
import { parseQuickAdd } from "./parse-quick-add";

/** One task pulled out of a brain dump, ready to review before it's added. */
export interface DumpTask {
  title: string;
  date: string | null;
  time: string | null;
  minutes: number | null;
  priority: Task["priority"];
}

/** At most this many tasks from one dump. */
export const DUMP_LIMIT = 30;

// Fillers people say before the actual thing ("I need to call mum" → "call mum").
const FILLER = /^(?:(?:and|also|then|so|oh|okay|ok|um+|uh+)[,\s]+)*(?:(?:i|we)\s+(?:need|have|want|got|gotta|should|must)\s+(?:to\s+)?|(?:i'?ll|i\s+will|i'?m\s+going\s+to|i\s+gotta|remember\s+to|don'?t\s+forget\s+to|need\s+to|have\s+to)\s+)?/i;

/**
 * The separate things in a dump, typed or spoken: one per line, sentence, or "; ", and split again
 * on " and then " / ", then " / ", also ". Leading fillers ("I need to", "also") are dropped.
 */
export function splitBrainDump(text: string): string[] {
  return text
    .split(/\r?\n|[.!?;]+(?:\s+|$)/)
    .flatMap((s) => s.split(/\s*,?\s+and then\s+|\s*,\s*then\s+|\s*,\s*also\s+|\s+after that\s+/i))
    .map((s) => s.replace(/^[\s,•*-]+|[\s,]+$/g, "").replace(FILLER, "").trim())
    .filter((s) => s.length >= 2)
    .slice(0, DUMP_LIMIT);
}

/** Without AI: split the dump, then read each part like quick add ("call mum friday 6pm"). */
export function brainDumpTasks(text: string, today: string): DumpTask[] {
  return splitBrainDump(text).map((part) => {
    const p = parseQuickAdd(part, today);
    const title = (p.title || part).trim();
    return {
      title: (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 200),
      date: p.date ?? null,
      time: p.time ?? (p.tonight ? "20:00" : null),
      minutes: p.duration ?? null,
      priority: p.priority ?? "medium",
    };
  });
}
