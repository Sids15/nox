import { useThemeColors } from "@nox/features";
import { Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ProfileAvatar } from "./profile-avatar";

/**
 * Desktop window header (handoff): mono eyebrow over a 26/700 title on the left; on the right a
 * labeled "New …" accent pill with glow, any extra controls, and the profile avatar. Desktop type
 * is one step smaller than mobile (26 vs 30) and search lives in the sidebar (⌘K), not here.
 */
export function DesktopHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
  children,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <View className="px-screen flex-row items-end justify-between pt-2">
      <View>
        <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">{eyebrow}</Text>
        <Text className="text-ink mt-1.5 text-[26px] font-bold leading-[30px] tracking-[-0.02em]">{title}</Text>
      </View>
      <View className="flex-row items-center gap-2.5">
        {children}
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="bg-accent hover:opacity-90 flex-row items-center gap-2 rounded-[10px] px-4 py-[9px]"
          style={{ shadowColor: c.accent, shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
        >
          <Plus size={13} color={c.onAccent} strokeWidth={2.2} />
          <Text className="text-on-accent text-[13px] font-semibold">{actionLabel}</Text>
        </Pressable>
        <ProfileAvatar />
      </View>
    </View>
  );
}
