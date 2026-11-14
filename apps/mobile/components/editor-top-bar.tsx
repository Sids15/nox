import { useThemeColors } from "@nox/features";
import { ChevronLeft, MoreHorizontal } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { MenuDivider, MenuRow, pressScale } from "./menu";
import { Popover } from "./popover";

export interface EditorMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  /** Draw a divider above this item (e.g. to set a destructive action apart). */
  divided?: boolean;
  /** Leave the menu open (the item swaps in a sub-view through `menuView`). */
  keepOpen?: boolean;
  onPress: () => void;
}

/**
 * The bar above every editor (task, idea, note): "‹ Ideas" back on the left, an optional context
 * label beside it (the note's folder), and a ⋯ menu anchored to its button on the right. One shape
 * for all three so moving between them feels like one app.
 */
export function EditorTopBar({
  backLabel,
  onBack,
  context,
  menu,
  /** Swap the menu's contents for a sub-view (e.g. a folder list); return to the items with `null`. */
  menuView,
  onMenuClose,
  closeRef,
}: {
  backLabel: string;
  onBack: () => void;
  context?: string;
  menu: EditorMenuItem[];
  menuView?: ReactNode;
  onMenuClose?: () => void;
  /** Lets the owner close the menu after a sub-view choice. */
  closeRef?: { current: (() => void) | null };
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const close = () => {
    setOpen(false);
    onMenuClose?.();
  };
  if (closeRef) closeRef.current = close;

  return (
    <View className="px-screen flex-row items-center justify-between pt-2">
      <View className="flex-1 flex-row items-center gap-2">
        <Pressable
          onPress={onBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Back to ${backLabel.toLowerCase()}`}
          style={pressScale}
          className="hover:bg-chip -ml-2 h-[34px] flex-row items-center gap-0.5 rounded-[10px] pl-1 pr-2.5"
        >
          <ChevronLeft size={19} color={c.ink2} strokeWidth={2.2} />
          <Text className="text-ink-2 text-[14px] font-semibold">{backLabel}</Text>
        </Pressable>
        {context ? (
          <Text numberOfLines={1} className="text-ink-3 flex-1 text-[13px]">
            / {context}
          </Text>
        ) : null}
      </View>

      <View ref={ref} collapsable={false}>
        <Pressable
          onPress={() => setOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={pressScale}
          className={`h-[34px] w-[34px] items-center justify-center rounded-[10px] ${open ? "bg-chip" : "hover:bg-chip"}`}
        >
          <MoreHorizontal size={19} color={c.ink2} strokeWidth={2} />
        </Pressable>
      </View>

      <Popover anchorRef={ref} open={open} onClose={close} width={240} accessibilityLabel="Options">
        {menuView ?? (
          <View className="p-1.5">
            {menu.map((item) => (
              <View key={item.label}>
                {item.divided && <MenuDivider />}
                <MenuRow
                  label={item.label}
                  icon={item.icon}
                  danger={item.danger}
                  trailing={<View />}
                  onPress={() => {
                    if (!item.keepOpen) close();
                    item.onPress();
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </Popover>
    </View>
  );
}
