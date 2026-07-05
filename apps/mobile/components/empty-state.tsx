import { useThemeColors } from "@nox/features";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

/**
 * Centered empty / error state: an icon in a soft accent circle, a title + subtitle, and an optional
 * accent CTA. Used for first-run ("no data yet"), no-results, and load-error cases.
 */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = useThemeColors();
  return (
    <View className="items-center px-8 pt-16">
      <View className="bg-accent/[0.12] mb-4 h-16 w-16 items-center justify-center rounded-full">
        <Icon size={26} color={c.accent} strokeWidth={1.7} />
      </View>
      <Text className="text-ink text-center text-[16.5px] font-semibold tracking-[-0.01em]">{title}</Text>
      {subtitle ? (
        <Text className="text-ink-3 mt-1.5 max-w-[280px] text-center text-[13.5px] leading-[20px]">{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          className="bg-accent rounded-pill mt-5 px-5 py-2.5"
          style={{ shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}
        >
          <Text className="text-on-accent text-[14px] font-semibold">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
