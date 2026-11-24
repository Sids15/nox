import { useTemplates } from "@nox/features";
import { useMemo } from "react";
import { BUILT_IN_TEMPLATES, type TemplateLike } from "./templates";

/** Built-in starters plus the user's own templates, the page's kind first. */
export function useAllTemplates(kind?: "note" | "idea"): TemplateLike[] {
  const { data: mine = [] } = useTemplates();
  return useMemo(() => {
    const all: TemplateLike[] = [
      ...mine.map((t) => ({ id: t.id, builtIn: false, name: t.name, kind: t.kind, title: t.title, content: t.content, properties: t.properties })),
      ...BUILT_IN_TEMPLATES,
    ];
    return kind ? [...all.filter((t) => t.kind === kind), ...all.filter((t) => t.kind !== kind)] : all;
  }, [mine, kind]);
}
