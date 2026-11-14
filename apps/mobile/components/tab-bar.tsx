import { usePrefs, useThemeColors } from "@nox/features";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import {
  Bookmark,
  FileText,
  Lightbulb,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAlpha } from "../lib/color";

/** Route name → icon + label. Order here is cosmetic; the actual order comes from Tabs.Screen. */
const TAB_META: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: "Ideas", Icon: Lightbulb },
  notes: { label: "Notes", Icon: FileText },
  tasks: { label: "Tasks", Icon: SquareCheckBig },
  resources: { label: "Resources", Icon: Bookmark },
};

/**
 * Floating pill tab bar (handoff): 62px tall, inset 20px sides / 32px bottom, translucent `tabbar`
 * fill + blur + 1px hairline. Active = accent, inactive = text3. Replaces the default tab bar; the
 * scene fills the full height behind it, so screens pad their own content.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const theme = usePrefs((st) => st.theme);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        bottom: Math.max(insets.bottom, 20) + 12,
        // Rounded like the bar itself, or the web draws the shadow as a square behind it.
        borderRadius: 31,
        shadowColor: "#1B2131",
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }}
    >
      <BlurView intensity={18} tint={theme === "dark" ? "dark" : "light"} style={{ borderRadius: 31, overflow: "hidden" }}>
        <View
          className="border-line flex-row border"
          // Nearly opaque: at 86% the list underneath showed through and collided with the labels.
          style={{ height: 62, borderRadius: 31, backgroundColor: withAlpha(c.surface, 0.97) }}
        >
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name];
            if (!meta) return null;
            const focused = state.index === index;
            const color = focused ? c.accent : c.ink3;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={meta.label}
                className="flex-1 items-center justify-center"
              >
                <meta.Icon size={21} color={color} strokeWidth={1.7} />
                <Text style={{ color }} className="mt-[3px] text-[10px] font-semibold">
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}
