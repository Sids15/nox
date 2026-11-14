import { useIdeas, useNotes, useThemeColors } from "@nox/features";
import { Plus } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { cleanTag, tagColor } from "../lib/tag-palette";
import { TagChip } from "./tag-chip";

/**
 * Edit a list of free-text tags (notes and ideas). Chips show each tag in its colour with an × to
 * remove it; "Add tag" opens an inline field that suggests tags you already use as you type. Enter,
 * comma or a suggestion adds; Backspace in an empty field removes the last tag; Esc or blur closes.
 */
export function TagEditor({
  tags,
  onChange,
  known = [],
  max = 12,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags used elsewhere, offered as suggestions (most used first). */
  known?: string[];
  max?: number;
}) {
  const c = useThemeColors();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<TextInput>(null);

  const q = cleanTag(draft);
  const suggestions = useMemo(
    () => known.filter((t) => !tags.includes(t) && (q === "" || t.includes(q)) && t !== q).slice(0, 5),
    [known, tags, q],
  );

  const add = (raw: string) => {
    const t = cleanTag(raw);
    if (t && !tags.includes(t) && tags.length < max) onChange([...tags, t]);
    setDraft("");
  };
  const onKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const k = e.nativeEvent.key;
    if (k === "Backspace" && draft === "" && tags.length) onChange(tags.slice(0, -1));
    else if (k === "Escape") {
      setDraft("");
      setAdding(false);
    }
  };

  return (
    <View>
      <View className="flex-row flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <TagChip key={t} tag={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />
        ))}
        {adding ? (
          <View className="border-accent h-[27px] flex-row items-center rounded-[7px] border px-2">
            <Text className="text-ink-3 text-[12.5px]">#</Text>
            <TextInput
              ref={input}
              autoFocus
              value={draft}
              onChangeText={(v) => {
                // A comma or space-comma commits the tag before it.
                if (/[,\n]/.test(v)) {
                  v.split(/[,\n]/).slice(0, -1).forEach(add);
                  setDraft(v.split(/[,\n]/).pop() ?? "");
                } else setDraft(v);
              }}
              onSubmitEditing={() => {
                if (q) add(draft);
                else setAdding(false);
                setTimeout(() => input.current?.focus(), 0);
              }}
              onKeyPress={onKey}
              onBlur={() => {
                if (q) add(draft);
                setAdding(false);
              }}
              submitBehavior="submit"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="tag"
              placeholderTextColor={c.ink3}
              accessibilityLabel="New tag"
              className="text-ink text-[12.5px]"
              style={{ paddingVertical: 0, outlineWidth: 0, width: Math.max(48, Math.min(160, draft.length * 8 + 20)) } as object}
            />
          </View>
        ) : (
          tags.length < max && (
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityRole="button"
              accessibilityLabel="Add tag"
              className="hover:bg-chip h-[27px] flex-row items-center gap-1 rounded-[7px] px-1.5"
            >
              <Plus size={12} color={c.ink3} strokeWidth={2.2} />
              <Text className="text-ink-3 text-[12.5px] font-medium">{tags.length ? "Add" : "Add tag"}</Text>
            </Pressable>
          )
        )}
      </View>

      {adding && (suggestions.length > 0 || (q && !tags.includes(q))) && (
        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          {q && !known.includes(q) && !tags.includes(q) && (
            // onPressIn: runs before the field's blur closes the editor.
            <Pressable onPressIn={() => add(draft)} accessibilityRole="button" className="hover:bg-chip flex-row items-center gap-1 rounded-[7px] px-1.5 py-1">
              <Text className="text-ink-3 text-[12px]">Create</Text>
              <Text style={{ color: tagColor(q) }} className="text-[12px] font-semibold">
                #{q}
              </Text>
            </Pressable>
          )}
          {suggestions.map((t) => (
            <Pressable key={t} onPressIn={() => add(t)} accessibilityRole="button" accessibilityLabel={`Add tag ${t}`} className="border-line rounded-[7px] border border-dashed px-1.5 py-0.5">
              <Text style={{ color: tagColor(t) }} className="text-[12px] font-semibold">
                #{t}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Every tag across a set of items, most used first (for suggestions and filters). */
export function tagCounts(items: { tags: string[] }[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) for (const t of it.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Tags in use across notes and ideas, most used first — the suggestion pool for both editors. */
export function useKnownTags(): string[] {
  const { data: notes = [] } = useNotes();
  const { data: ideas = [] } = useIdeas();
  return useMemo(
    () => tagCounts([...notes.filter((n) => !n.deleted), ...ideas.filter((i) => !i.deleted)]).map((t) => t.tag),
    [notes, ideas],
  );
}
