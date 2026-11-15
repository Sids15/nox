import { useThemeColors, useThemeVars } from "@nox/features";
import { ChevronDown } from "lucide-react-native";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, Text, View } from "react-native";

const MENU_WIDTH = 190;

/**
 * A pill chip (or, with `minimal`, plain text) that opens a small dropdown to pick a value.
 * Accent-tinted when a non-"all" value is active. The menu clamps within the screen so it never
 * runs off the edge, and carries its own `vars()` so it stays themed inside the Modal portal.
 */
export function DropdownChip<T extends string>({
  label,
  value,
  options,
  onSelect,
  showChevron = false,
  active,
  minimal = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
  showChevron?: boolean;
  /** Accent-tint override; defaults to "a non-'all' value is selected". */
  active?: boolean;
  /** Render as plain text + chevron (no pill), for use as an inline row value. */
  minimal?: boolean;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const isActive = active ?? value !== "all";
  const ref = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const openMenu = () => {
    ref.current?.measureInWindow((x, y, w, h) => {
      const winW = Dimensions.get("window").width;
      // Right-align to the trigger when it sits in the right half; always keep on-screen.
      const preferred = x + w > winW / 2 ? x + w - MENU_WIDTH : x;
      const left = Math.max(12, Math.min(preferred, winW - MENU_WIDTH - 12));
      setPos({ left, top: y + h + 6 });
      setOpen(true);
    });
  };

  return (
    <>
      {minimal ? (
        <Pressable ref={ref} onPress={openMenu} hitSlop={6} className="flex-row items-center gap-1">
          <Text className="text-ink text-[15px] font-semibold">{label}</Text>
          <ChevronDown size={14} color={c.ink3} strokeWidth={2} />
        </Pressable>
      ) : (
        <Pressable
          ref={ref}
          onPress={openMenu}
          className={`rounded-pill flex-row items-center gap-1 border px-4 py-2 ${
            isActive ? "border-accent/[0.45] bg-accent/[0.14]" : "border-line bg-chip"
          }`}
        >
          <Text className={`text-[13px] font-semibold ${isActive ? "text-accent" : "text-ink-2"}`}>
            {label}
          </Text>
          {showChevron && <ChevronDown size={12} color={isActive ? c.accent : c.ink3} strokeWidth={2} />}
        </Pressable>
      )}

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View
            style={[
              {
                position: "absolute",
                left: pos.left,
                top: pos.top,
                width: MENU_WIDTH,
                shadowColor: "#000",
                shadowOpacity: 0.4,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 12 },
                elevation: 12,
              },
              vars(themeVars),
            ]}
            className="border-line bg-elev rounded-input overflow-hidden border py-1"
          >
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className="px-4 py-2.5"
              >
                <Text
                  className={`text-[14px] ${
                    o.value === value ? "text-accent font-semibold" : "text-ink"
                  }`}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
