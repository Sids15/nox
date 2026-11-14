import { useThemeColors } from "@nox/features";
import type { Note } from "@nox/types";
import { Folder, Image as ImageIcon, Link2, Mic, Pin } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { TagChip } from "../tag-chip";
import { noteBody, noteMedia, noteTitle, noteWhen } from "./note-utils";

/**
 * A note in a list: the title, two lines of what it says, then when it was edited, its folder (when
 * the list spans folders), its first tags, and small markers for a voice note, picture or link.
 * No icon tile — every note had the same one, so it said nothing.
 */
export function NoteRow({
  note,
  onPress,
  selected = false,
  folderName,
}: {
  note: Note;
  onPress: () => void;
  selected?: boolean;
  /** Shown when the list mixes folders (All notes, search). */
  folderName?: string;
}) {
  const c = useThemeColors();
  const body = noteBody(note);
  const media = noteMedia(note);
  const untitled = !note.title?.trim() && !body && noteTitle(note) === "Untitled note";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-[10px] px-3 py-2.5 ${selected ? "bg-accent/[0.1]" : "hover:bg-surface"}`}
    >
      <View className="flex-row items-center gap-1.5">
        {note.is_pinned && <Pin size={12} color={c.accent} fill={c.accent} strokeWidth={2} />}
        <Text numberOfLines={1} className={`flex-1 text-[15px] font-semibold ${untitled ? "text-ink-3" : "text-ink"}`}>
          {noteTitle(note)}
        </Text>
      </View>
      {body ? (
        <Text numberOfLines={2} className="text-ink-2 mt-0.5 text-[13px]" style={{ lineHeight: 18 }}>
          {body}
        </Text>
      ) : null}
      <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="text-ink-3 text-[12px]">{noteWhen(note.updated_at)}</Text>
        {folderName && (
          <View className="flex-row items-center gap-1">
            <Folder size={11} color={c.ink3} strokeWidth={2} />
            <Text numberOfLines={1} className="text-ink-3 text-[12px]">
              {folderName}
            </Text>
          </View>
        )}
        {(media.voice || media.image || media.link) && (
          <View className="flex-row items-center gap-1.5">
            {media.voice && <Mic size={12} color={c.ink3} strokeWidth={2} />}
            {media.image && <ImageIcon size={12} color={c.ink3} strokeWidth={2} />}
            {media.link && <Link2 size={12} color={c.ink3} strokeWidth={2} />}
          </View>
        )}
        {note.tags.slice(0, 2).map((t) => (
          <TagChip key={t} tag={t} size="sm" />
        ))}
        {note.tags.length > 2 && <Text className="text-ink-3 text-[11.5px]">+{note.tags.length - 2}</Text>}
      </View>
    </Pressable>
  );
}
