import { useCreateNote, useThemeColors } from "@nox/features";
import type { Property, Space } from "@nox/types";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable } from "react-native";
import { type Page } from "./pages";

/** A note or idea in a space, with what its board card and table row show. */
export interface SpacePage extends Page {
  stage: string | null;
  properties: Property[];
  tags: string[];
}

/**
 * The small + on a board column: a new note in that stage, opened straight away. (Templates are
 * inside the note itself, under "Template".)
 */
export function NewInSpace({ space, stage }: { space: Space; stage: string | null }) {
  const c = useThemeColors();
  const createNote = useCreateNote();
  const add = () => {
    const id = createNote.create({ title: null, type: "text", content: [{ type: "paragraph", text: "" }], folder_id: null, tags: [], space_id: space.id, stage });
    router.push(`/note/${id}`);
  };
  return (
    <Pressable onPress={add} hitSlop={6} accessibilityRole="button" accessibilityLabel={`New note in ${stage ?? space.name}`} className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
      <Plus size={14} color={c.ink3} strokeWidth={2.2} />
    </Pressable>
  );
}
