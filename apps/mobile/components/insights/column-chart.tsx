import { useThemeColors } from "@nox/features";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TABULAR } from "../menu";

export interface Column {
  key: string;
  /** Under the column (only the first and last are shown, to stay quiet). */
  label: string;
  /** What hovering/tapping it says, e.g. "Nov 22 – 28: 5 tasks". */
  detail: string;
  value: number;
}

const HEIGHT = 120;
const MAX_BAR = 24;

/**
 * One series of columns (counts over time): one hue, 4px rounded tops on a hairline baseline, a 2px
 * gap between neighbours. The line above names the hovered or tapped column (the latest by default),
 * so no number sits on every bar; "Table" lists them all.
 */
export function ColumnChart({ columns, empty }: { columns: Column[]; empty: string }) {
  const c = useThemeColors();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...columns.map((col) => col.value));
  const shown = columns[active ?? columns.length - 1];
  const allZero = columns.every((col) => col.value === 0);

  if (table) {
    return (
      <View>
        <Toggle table onPress={() => setTable(false)} />
        {columns.map((col) => (
          <View key={col.key} className="border-line flex-row border-b py-1.5">
            <Text className="text-ink-2 flex-1 text-[13px]">{col.detail.split(": ")[0]}</Text>
            <Text style={TABULAR} className="text-ink text-[13px] font-medium">
              {col.value}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center">
        <Text style={TABULAR} className="text-ink-2 flex-1 text-[13px]" accessibilityLiveRegion="polite">
          {allZero ? empty : shown?.detail}
        </Text>
        <Toggle table={false} onPress={() => setTable(true)} />
      </View>
      <View style={{ height: HEIGHT }} className="flex-row items-end">
        {columns.map((col, i) => {
          const h = col.value === 0 ? 0 : Math.max(3, (col.value / max) * HEIGHT);
          const on = i === (active ?? columns.length - 1);
          return (
            <Pressable
              key={col.key}
              onPress={() => setActive(i)}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(null)}
              accessibilityRole="button"
              accessibilityLabel={col.detail}
              // The whole slot is the hit target, bigger than the bar.
              style={{ flex: 1, height: HEIGHT, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 1 }}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: MAX_BAR,
                  height: h,
                  backgroundColor: c.accent,
                  opacity: on ? 1 : 0.55,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="bg-line h-px" />
      <View className="mt-1 flex-row justify-between">
        <Text className="text-ink-3 text-[11px]">{columns[0]?.label}</Text>
        <Text className="text-ink-3 text-[11px]">{columns[columns.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

function Toggle({ table, onPress }: { table: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6} className="hover:bg-chip rounded-[6px] px-1.5 py-0.5">
      <Text className="text-ink-3 text-[12px] font-medium">{table ? "Chart" : "Table"}</Text>
    </Pressable>
  );
}

/** Ranked horizontal bars for a magnitude by name (one hue): the name and value in ink, the bar beside. */
export function RankedBars({ rows }: { rows: { key: string; label: string; value: number; display: string; mark?: React.ReactNode }[] }) {
  const c = useThemeColors();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View className="gap-2.5">
      {rows.map((r) => (
        <View key={r.key} accessibilityLabel={`${r.label}: ${r.display}`}>
          <View className="mb-1 flex-row items-center gap-1.5">
            {r.mark}
            <Text numberOfLines={1} className="text-ink flex-1 text-[13px]">
              {r.label}
            </Text>
            <Text style={TABULAR} className="text-ink-2 text-[13px] font-medium">
              {r.display}
            </Text>
          </View>
          <View className="bg-chip h-[8px] overflow-hidden rounded-full">
            <View style={{ width: `${(r.value / max) * 100}%`, height: "100%", backgroundColor: c.accent, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
