import { dark } from "@nox/ui";
import { Plus } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";

/**
 * Inline quick-add at the bottom of the day group. Collapsed it's a "+ Add task" ghost row; tapping
 * (or the FAB) activates an inline input. Submitting creates the task and keeps the field open for
 * rapid entry; blurring an empty field collapses it.
 */
export function QuickAddRow({
  active,
  value,
  onChangeText,
  onActivate,
  onSubmit,
  onCancel,
}: {
  active: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onActivate: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  if (!active) {
    return (
      <Pressable onPress={onActivate} className="flex-row items-center px-4 py-3">
        <Plus size={18} color={dark.ink3} strokeWidth={2} />
        <Text className="text-ink-3 ml-3 text-[15px]">Add task</Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center px-4 py-3">
      <View className="border-ink-3 h-[22px] w-[22px] rounded-full border-[1.5px]" />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onBlur={onCancel}
        submitBehavior="submit"
        placeholder="Task title"
        placeholderTextColor={dark.ink3}
        returnKeyType="done"
        className="text-ink ml-3 flex-1 text-[15px]"
      />
    </View>
  );
}
