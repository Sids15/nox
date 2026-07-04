import { useThemeVars } from "@nox/features";
import { vars } from "nativewind";
import { Modal, Pressable, Text, View } from "react-native";

export interface MenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** A top-right anchored overflow menu (matches the … button in the screen nav). */
export function OverflowMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
}) {
  const themeVars = useThemeVars();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1">
        <View
          className="border-line bg-elev rounded-input absolute right-5 top-16 overflow-hidden border py-1"
          style={{ minWidth: 190, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}
        >
          {items.map((it, i) => (
            <Pressable
              key={it.label}
              onPress={() => {
                onClose();
                it.onPress();
              }}
              className={`px-4 py-2.5 ${i > 0 ? "border-line border-t" : ""}`}
            >
              <Text className={`text-[14px] ${it.destructive ? "text-high" : "text-ink"}`}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
