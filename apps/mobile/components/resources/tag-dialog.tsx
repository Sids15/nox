import { useThemeColors, useThemeVars } from "@nox/features";
import type { Tag } from "@nox/types";
import { Check, Trash2 } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { TAG_PALETTE } from "../../lib/tag-palette";
import { pressScale } from "../menu";

/** The tag swatches: the original six plus four more, so a dozen tags don't all repeat colours. */
export const TAG_COLORS = [...TAG_PALETTE, "#8A4F7D", "#5B7A4A", "#B5653A", "#6B6F82"];

/**
 * Create or edit a resource tag: its name and its colour, with a live preview of the chip. Editing
 * also offers Delete, which says how many resources wear the tag (they keep everything else).
 */
export function TagDialog({
  visible,
  tag,
  usage = 0,
  defaultColor,
  existingNames,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  /** null = a new tag. */
  tag: Tag | null;
  usage?: number;
  defaultColor: string;
  /** Lower-cased names already taken (excluding this tag), to stop duplicates. */
  existingNames: string[];
  onSave: (name: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [name, setName] = useState("");
  const [color, setColor] = useState(defaultColor);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(tag?.name ?? "");
    setColor(tag?.color ?? defaultColor);
    setConfirming(false);
  }, [visible, tag?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = name.trim().slice(0, 40);
  const duplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  const canSave = !!trimmed && !duplicate;
  const save = () => {
    if (!canSave) return;
    onSave(trimmed, color);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={vars(themeVars)} className="flex-1 items-center justify-center px-6">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
        <View
          className="border-line bg-elev w-full max-w-[380px] rounded-[16px] border p-5"
          style={{ shadowColor: "#1B2131", shadowOpacity: 0.22, shadowRadius: 36, shadowOffset: { width: 0, height: 16 }, elevation: 18 }}
        >
          <Text className="text-ink font-serif text-[20px] font-bold">{tag ? "Edit tag" : "New tag"}</Text>

          {confirming ? (
            <>
              <Text className="text-ink-2 mt-3 text-[14px] leading-[21px]">
                {usage > 0
                  ? `“${tag?.name}” is on ${usage} resource${usage === 1 ? "" : "s"}. They stay; only the tag comes off.`
                  : `“${tag?.name}” isn't on any resources.`}
              </Text>
              <View className="mt-5 flex-row justify-end gap-2">
                <Pressable onPress={() => setConfirming(false)} style={pressScale} className="hover:bg-chip h-10 justify-center rounded-[10px] px-4">
                  <Text className="text-ink-2 text-[14px] font-semibold">Keep it</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onDelete?.();
                    onClose();
                  }}
                  style={pressScale}
                  className="bg-high h-10 justify-center rounded-[10px] px-4"
                >
                  <Text className="text-[14px] font-semibold text-white">Delete tag</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View className="border-line bg-surface mt-4 h-[44px] flex-row items-center rounded-[11px] border px-3">
                <View className="mr-2.5 h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <TextInput
                  autoFocus
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={save}
                  maxLength={40}
                  placeholder="Tag name, e.g. read later"
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="Tag name"
                  className="text-ink flex-1 text-[14.5px]"
                  style={{ paddingVertical: 0, outlineWidth: 0 } as object}
                />
              </View>
              {duplicate && <Text className="text-high mt-1.5 text-[12.5px]">You already have a tag with that name.</Text>}

              <Text className="text-ink-2 mb-2 mt-4 text-[13px] font-semibold">Colour</Text>
              <View className="flex-row flex-wrap gap-2">
                {TAG_COLORS.map((col) => (
                  <Pressable
                    key={col}
                    onPress={() => setColor(col)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: color === col }}
                    accessibilityLabel={`Colour ${col}`}
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: col, borderWidth: color === col ? 2 : 0, borderColor: c.ink }}
                  >
                    {color === col && <Check size={14} color="#fff" strokeWidth={3} />}
                  </Pressable>
                ))}
              </View>

              <View className="mt-4 flex-row items-center">
                <Text className="text-ink-3 mr-2 text-[12.5px]">Preview</Text>
                <View className="rounded-pill px-3 py-[5px]" style={{ backgroundColor: `${color}1f` }}>
                  <Text style={{ color }} className="text-[12.5px] font-semibold">
                    {trimmed || "tag"}
                  </Text>
                </View>
              </View>

              <View className="mt-5 flex-row items-center gap-2">
                {tag && onDelete && (
                  <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" className="hover:bg-chip -ml-2 h-10 flex-row items-center gap-1.5 rounded-[10px] px-2.5">
                    <Trash2 size={14} color={c.high} strokeWidth={2} />
                    <Text className="text-high text-[13.5px] font-semibold">Delete</Text>
                  </Pressable>
                )}
                <View className="flex-1" />
                <Pressable onPress={onClose} style={pressScale} className="hover:bg-chip h-10 justify-center rounded-[10px] px-4">
                  <Text className="text-ink-2 text-[14px] font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={!canSave}
                  style={pressScale}
                  className={`bg-accent h-10 justify-center rounded-[10px] px-4 ${canSave ? "hover:opacity-90" : "opacity-40"}`}
                >
                  <Text className="text-on-accent text-[14px] font-semibold">{tag ? "Save" : "Create"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
