import { inboxItems, useThemeColors } from "@nox/features";
import { router } from "expo-router";
import { Inbox } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { usePages } from "./brain/pages";
import { pressScale, TABULAR } from "./menu";

/** Phones: the Inbox in a header, with how many things wait. Hidden when there's nothing to sort. */
export function InboxButton() {
  const c = useThemeColors();
  const pages = usePages();
  const n = useMemo(() => inboxItems(pages).length, [pages]);
  if (n === 0) return null;
  return (
    <Pressable
      onPress={() => router.push("/inbox")}
      accessibilityRole="button"
      accessibilityLabel={`Inbox, ${n} to sort`}
      style={pressScale}
      className="hover:bg-chip h-[34px] flex-row items-center gap-1 rounded-[10px] px-2"
    >
      <Inbox size={17} color={c.ink2} strokeWidth={2} />
      <View className="bg-accent min-w-[18px] items-center rounded-full px-1">
        <Text style={TABULAR} className="text-on-accent text-[11px] font-bold">
          {n}
        </Text>
      </View>
    </Pressable>
  );
}
