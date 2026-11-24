import { useDeleteTemplate, useTemplates, useThemeColors } from "@nox/features";
import { LayoutTemplate } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { confirmDelete } from "../../lib/confirm";
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

/**
 * "Start from a template" — shown on a blank page only, so it's there the moment you need it and
 * gone once you start writing. Long-press one of your own templates to delete it.
 */
export function TemplateStarter({ kind, onPick }: { kind: "note" | "idea"; onPick: (t: TemplateLike) => void }) {
  const c = useThemeColors();
  const templates = useAllTemplates(kind);
  const del = useDeleteTemplate();
  return (
    <View className="mt-3">
      <View className="mb-1.5 flex-row items-center gap-1.5">
        <LayoutTemplate size={13} color={c.ink3} strokeWidth={2} />
        <Text className="text-ink-3 text-[12px] font-medium">Start from a template</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
        {templates.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onPick(t)}
            onLongPress={
              t.builtIn
                ? undefined
                : () =>
                    confirmDelete({
                      title: "Delete template?",
                      message: `“${t.name}” will be removed on all your devices. Pages made from it stay as they are.`,
                      onConfirm: () => del.mutate(t.id),
                    })
            }
            accessibilityRole="button"
            accessibilityLabel={`Use the ${t.name} template`}
            className="border-line hover:border-accent/[0.45] bg-surface h-[32px] flex-row items-center rounded-pill border px-3"
          >
            <Text className="text-ink-2 text-[13px] font-medium">{t.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
