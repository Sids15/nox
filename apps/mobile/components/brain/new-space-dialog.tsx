import { useCreateSpace, useThemeColors, useThemeVars } from "@nox/features";
import { router } from "expo-router";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { SPACE_PRESETS, type SpacePreset } from "./space-presets";
import { SpaceIconPicker, SpaceMark } from "./space-mark";

/** Name a new space, pick a kind (which sets its pipeline) and a mark; opens it once made. */
export function NewSpaceDialog({ visible, onClose, initialPreset }: { visible: boolean; onClose: () => void; initialPreset?: SpacePreset }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const create = useCreateSpace();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(SPACE_PRESETS[0]!);
  const [icon, setIcon] = useState(SPACE_PRESETS[0]!.icon);

  useEffect(() => {
    if (!visible) return;
    const start = initialPreset ?? SPACE_PRESETS[0]!;
    setName("");
    setPreset(start);
    setIcon(start.icon);
  }, [visible, initialPreset]);

  const submit = () => {
    const n = name.trim() || preset.label;
    const id = create.create({ name: n.slice(0, 80), icon, stages: preset.stages });
    onClose();
    router.push(`/space/${id}`);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-6">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[420px] border p-4">
          <Text className="text-ink mb-3 text-[16px] font-semibold">New space</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder={preset.key === "youtube" ? "e.g. Tech channel" : preset.key === "project" ? "e.g. Nox launch" : "Name"}
            placeholderTextColor={c.ink3}
            maxLength={80}
            returnKeyType="done"
            className="bg-chip rounded-input text-ink mb-3 h-11 px-3 text-[15px]"
            style={{ paddingVertical: 0 }}
          />

          <Text className="text-ink-3 mb-1.5 text-[12px] font-medium">Kind</Text>
          <View className="mb-3 gap-1.5">
            {SPACE_PRESETS.map((p) => {
              const on = p.key === preset.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    setPreset(p);
                    setIcon(p.icon);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  className={`rounded-[10px] border px-3 py-2 ${on ? "border-accent bg-accent/[0.08]" : "border-line hover:bg-chip"}`}
                >
                  <View className="flex-row items-center gap-2">
                    <SpaceMark space={{ icon: p.icon }} size={22} active={on} />
                    <Text className={`text-[14px] ${on ? "text-ink font-semibold" : "text-ink"}`}>{p.label}</Text>
                  </View>
                  <Text numberOfLines={1} className="text-ink-3 mt-0.5 text-[12px]">
                    {p.stages.length ? p.stages.join(" → ") : p.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-ink-3 mb-1.5 text-[12px] font-medium">Icon</Text>
          <View className="mb-4">
            <SpaceIconPicker value={icon} onChange={setIcon} />
          </View>

          <View className="flex-row justify-end gap-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-ink-2 text-[14px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} accessibilityRole="button" className="bg-accent rounded-input px-4 py-2">
              <Text className="text-on-accent text-[14px] font-semibold">Create space</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
