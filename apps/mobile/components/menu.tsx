import { useThemeColors } from "@nox/features";
import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";

/**
 * Shared pieces for anchored menus (see Popover) and the controls that open them, so every menu in
 * the app has the same rows, labels, dividers and press feel.
 */

/** Numbers line up in columns without switching to a monospace costume. */
export const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

/** Press feedback (Emil Kowalski): a 0.97 squeeze so the control visibly hears the tap. */
export const pressScale = ({ pressed }: { pressed: boolean }) => ({
  transform: [{ scale: pressed ? 0.97 : 1 }],
  ...(Platform.OS === "web"
    ? ({ transitionProperty: "transform, background-color", transitionDuration: "140ms" } as object)
    : null),
});

/** A row in a menu: optional leading icon, label, right-aligned hint, check when selected. */
export function MenuRow({
  label,
  hint,
  selected = false,
  disabled = false,
  onPress,
  icon,
  trailing,
  danger = false,
}: {
  /** Destructive action: label in the high/coral colour. */
  danger?: boolean;
  label: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="menuitem"
      accessibilityState={{ selected, disabled }}
      className={`min-h-[36px] flex-row items-center gap-2.5 rounded-[8px] px-2.5 ${selected ? "bg-accent/[0.1]" : "hover:bg-chip"} ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {icon}
      <Text
        numberOfLines={1}
        className={`flex-1 text-[14px] ${danger ? "text-high font-medium" : selected ? "text-accent font-semibold" : "text-ink"}`}
      >
        {label}
      </Text>
      {hint ? (
        <Text style={TABULAR} className={`text-[12px] ${selected ? "text-accent" : "text-ink-3"}`}>
          {hint}
        </Text>
      ) : null}
      {trailing ?? (selected ? <Check size={14} color={c.accent} strokeWidth={2.6} /> : <View style={{ width: 14 }} />)}
    </Pressable>
  );
}

export function MenuLabel({ children }: { children: string }) {
  return <Text className="text-ink-3 px-2.5 pb-1 pt-2 text-[12px] font-semibold">{children}</Text>;
}

export const MenuDivider = () => <View className="bg-line mx-1 my-1.5 h-px" />;
