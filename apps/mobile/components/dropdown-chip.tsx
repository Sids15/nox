import { useThemeColors, useThemeVars } from "@nox/features";
import { ChevronDown } from "lucide-react-native";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

/**
 * A pill chip that opens a small dropdown to pick a value. Accent-tinted when a non-"all" value is
 * active. Shared by the Tasks and Ideas filter rows. The menu lives in a `Modal` (a detached view
 * host), so it carries its own `vars()` to stay themed inside the portal.
 */
export function DropdownChip<T extends string>({
  label,
  value,
  options,
  onSelect,
  showChevron = false,
  active,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
  showChevron?: boolean;
  /** Accent-tint override; defaults to "a non-'all' value is selected". */
  active?: boolean;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const isActive = active ?? value !== "all";
  const ref = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const openMenu = () => {
    ref.current?.measureInWindow((x, y, _w, h) => {
      setPos({ x, y: y + h + 6 });
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable
        ref={ref}
        onPress={openMenu}
        className={`rounded-pill flex-row items-center gap-1 border px-4 py-2 ${
          isActive ? "border-accent/[0.45] bg-accent/[0.14]" : "border-line bg-chip"
        }`}
      >
        <Text className={`text-[12.5px] font-semibold ${isActive ? "text-accent" : "text-ink-2"}`}>
          {label}
        </Text>
        {showChevron && <ChevronDown size={12} color={isActive ? c.accent : c.ink3} strokeWidth={2} />}
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View
            style={[
              {
                position: "absolute",
                left: pos.x,
                top: pos.y,
                minWidth: 160,
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
                  className={`text-[13.5px] ${
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
