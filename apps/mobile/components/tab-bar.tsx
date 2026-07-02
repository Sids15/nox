import { dark } from "@nox/ui";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import {
  Library,
  Lightbulb,
  ListTodo,
  NotebookText,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Route name → icon + label. Order here is cosmetic; the actual order comes from Tabs.Screen. */
const TAB_META: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: "Ideas", Icon: Lightbulb },
  notes: { label: "Notes", Icon: NotebookText },
  tasks: { label: "Tasks", Icon: ListTodo },
  resources: { label: "Resources", Icon: Library },
};

/**
 * Floating pill tab bar (handoff): 62px tall, inset 20px sides / 32px bottom, translucent `tabbar`
 * fill + blur + 1px hairline. Active = accent, inactive = text3. Replaces the default tab bar; the
 * scene fills the full height behind it, so screens pad their own content.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 20, right: 20, bottom: Math.max(insets.bottom, 20) + 12 }}
    >
      <BlurView intensity={18} tint="dark" style={{ borderRadius: 30, overflow: "hidden" }}>
        <View
          className="border-line bg-tabbar flex-row border"
          style={{ height: 62, borderRadius: 30 }}
        >
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name];
            if (!meta) return null;
            const focused = state.index === index;
            const color = focused ? dark.accent : dark.ink3;

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
                <Text style={{ color }} className="mt-1 text-[10px] font-semibold">
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
