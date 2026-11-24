import { matchTargets, refKindLabel, useCreateNote, useThemeColors, type LinkTarget, type Ref } from "@nox/features";
import { CornerDownRight, Plus } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { KindIcon } from "./kind-icon";
import { usePages } from "./pages";

/**
 * The list that opens under a paragraph while you type `[[…`: matching notes, ideas, tasks and
 * resources, plus "New note" with what you typed. Choosing one links it; it never navigates away.
 */
export function LinkPicker({
  query,
  exclude,
  spaceId,
  onPick,
}: {
  query: string;
  /** The page being edited: you don't link a page to itself. */
  exclude?: Ref;
  /** New notes made from here join the current page's space. */
  spaceId?: string | null;
  onPick: (target: LinkTarget) => void;
}) {
  const c = useThemeColors();
  const { pages } = usePages();
  const createNote = useCreateNote();
  const matches = useMemo(
    () => matchTargets(query, pages.filter((p) => !(exclude && p.kind === exclude.kind && p.id === exclude.id)), 7),
    [query, pages, exclude],
  );
  const name = query.trim();
  const exact = matches.some((m) => m.title.toLowerCase() === name.toLowerCase());

  return (
    <View className="border-line bg-elev rounded-[12px] border p-1.5" accessibilityRole="menu" accessibilityLabel="Link to a page">
      <Text className="text-ink-3 px-2 pb-1 pt-0.5 text-[12px] font-medium">
        {name ? `Link to “${name}”` : "Link to a page — keep typing to search"}
      </Text>
      {matches.map((m) => (
        <Pressable
          key={`${m.kind}:${m.id}`}
          onPress={() => onPick(m)}
          accessibilityRole="menuitem"
          className="hover:bg-chip min-h-[36px] flex-row items-center gap-2.5 rounded-[8px] px-2"
        >
          <KindIcon kind={m.kind} color={c.ink2} />
          <Text numberOfLines={1} className="text-ink flex-1 text-[14px]">
            {m.title}
          </Text>
          <Text className="text-ink-3 text-[12px]">{refKindLabel(m.kind)}</Text>
        </Pressable>
      ))}
      {name && !exact ? (
        <Pressable
          onPress={() => {
            const id = createNote.create({
              title: name.slice(0, 200),
              type: "text",
              content: [{ type: "paragraph", text: "" }],
              folder_id: null,
              tags: [],
              ...(spaceId ? { space_id: spaceId } : {}),
            });
            onPick({ kind: "note", id, title: name, updated_at: new Date().toISOString() });
          }}
          accessibilityRole="menuitem"
          className="hover:bg-chip min-h-[36px] flex-row items-center gap-2.5 rounded-[8px] px-2"
        >
          <Plus size={15} color={c.accent} strokeWidth={2.2} />
          <Text numberOfLines={1} className="text-accent flex-1 text-[14px] font-medium">
            New note “{name}”
          </Text>
          <CornerDownRight size={13} color={c.ink3} strokeWidth={2} />
        </Pressable>
      ) : null}
      {matches.length === 0 && !name ? <Text className="text-ink-3 px-2 py-2 text-[13px]">No pages yet.</Text> : null}
    </View>
  );
}
