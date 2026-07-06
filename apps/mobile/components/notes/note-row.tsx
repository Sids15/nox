import { useThemeColors } from "@nox/features";
import type { Note } from "@nox/types";
import { relativeAge } from "@nox/utils";
import { AlignLeft, Mic } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { noteTitle } from "./note-utils";

/** Type thumbnail — text (lines), voice (coral mic tile), or sketch (dashed tile). */
function Thumb({ note }: { note: Note }) {
  const c = useThemeColors();
  if (note.type === "voice") {
    return (
      <View className="bg-high/[0.13] h-[34px] w-[34px] items-center justify-center rounded-[10px]">
        <Mic size={15} color={c.high} strokeWidth={1.7} />
      </View>
    );
  }
  if (note.type === "sketch") {
    return <View className="border-line h-[34px] w-[34px] rounded-[10px] border border-dashed" />;
  }
  return (
    <View className="bg-chip h-[34px] w-[34px] items-center justify-center rounded-[10px]">
      <AlignLeft size={15} color={c.ink2} strokeWidth={1.7} />
    </View>
  );
}

function subline(note: Note): string {
  if (note.type === "sketch") return "sketch · png";
  if (note.type === "voice") return "voice note";
  const para = note.content.find((b) => b.type === "paragraph" && b.text.trim() !== "");
  return para && "text" in para ? para.text.trim() : "";
}

/** A note row for the Recent list and folder views. */
export function NoteRow({ note, onPress, selected = false }: { note: Note; onPress: () => void; selected?: boolean }) {
  const mono = note.type === "voice" || note.type === "sketch";
  const sub = subline(note);
  return (
    <Pressable onPress={onPress} className={`min-h-[58px] flex-row items-center gap-3 px-[14px] ${selected ? "bg-chip" : "hover:bg-chip"}`}>
      {selected && <View className="bg-accent absolute bottom-0 left-0 top-0 w-[2px]" />}
      <Thumb note={note} />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-ink text-[14.5px] font-medium">
          {noteTitle(note)}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            className={`mt-[3px] ${mono ? "text-ink-3 font-mono text-[10px]" : "text-ink-3 text-[11.5px]"}`}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <Text className="text-ink-3 font-mono text-[10px]">{relativeAge(note.updated_at)}</Text>
    </Pressable>
  );
}
