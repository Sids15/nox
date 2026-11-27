import { useCreateSpace, useThemeColors, useThemeVars } from "@nox/features";
import { router } from "expo-router";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { SpaceIconPicker } from "./space-mark";

/** A new space: a name and an icon. Everything else (a board, stages) is optional, later. */
export function NewSpaceDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const create = useCreateSpace();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("layers");

  useEffect(() => {
    if (!visible) return;
    setName("");
    setIcon("layers");
  }, [visible]);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    const id = create.create({ name: n.slice(0, 80), icon, stages: [] });
    onClose();
    router.push(`/space/${id}`);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-6">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[400px] border p-4">
          <Text className="text-ink text-[16px] font-semibold">New space</Text>
          <Text className="text-ink-3 mb-3 mt-0.5 text-[13px]">A place for one project, channel or part of your life.</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder="e.g. Kagai Explains, Nox launch, College"
            placeholderTextColor={c.ink3}
            maxLength={80}
            returnKeyType="done"
            className="bg-chip rounded-input text-ink mb-4 h-11 px-3 text-[15px]"
            style={{ paddingVertical: 0 }}
          />
          <Text className="text-ink-3 mb-1.5 text-[12px] font-medium">Icon</Text>
          <View className="mb-4">
            <SpaceIconPicker value={icon} onChange={setIcon} />
          </View>
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-ink-2 text-[14px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={!name.trim()} accessibilityRole="button" className="bg-accent rounded-input px-4 py-2" style={{ opacity: name.trim() ? 1 : 0.5 }}>
              <Text className="text-on-accent text-[14px] font-semibold">Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
