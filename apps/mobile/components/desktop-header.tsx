import { useThemeColors } from "@nox/features";
import { Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { pressScale } from "./menu";

/**
 * Desktop page header: the serif page title with a plain count line under it on the left, the "New …" accent pill (plus
 * any extra controls) on the right — all inside the page's centered canvas so title and actions
 * share edges with the content. Identity lives in the sidebar, so no avatar here.
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
    <View className="px-screen flex-row items-start justify-between pt-2">
      <View>
        <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">{title}</Text>
        <Text className="text-ink-3 mt-0.5 text-[13.5px] font-medium">{eyebrow}</Text>
      </View>
      <View className="flex-row items-center gap-2.5">
        {children}
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={pressScale}
          className="bg-accent hover:opacity-90 h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-3.5"
        >
          <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
          <Text className="text-on-accent text-[13.5px] font-semibold">{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
