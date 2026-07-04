import { useThemeColors } from "@nox/features";
import type { Note } from "@nox/types";
import { relativeAge } from "@nox/utils";
import { FileText } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { noteTitle, notePreview } from "./note-utils";

/** Half-width pinned-note card (two per row on Notes Home). */
export function PinnedNoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className="border-line bg-surface rounded-card flex-1 gap-[7px] border p-[13px]"
    >
      <FileText size={15} color={c.accent} strokeWidth={1.7} />
      <Text numberOfLines={1} className="text-ink text-[13.5px] font-semibold">
        {noteTitle(note)}
      </Text>
      <Text numberOfLines={2} className="text-ink-2 text-[11.5px]" style={{ lineHeight: 16 }}>
        {notePreview(note)}
      </Text>
      <Text className="text-ink-3 font-mono text-[10px]">{relativeAge(note.updated_at)}</Text>
    </Pressable>
  );
}
