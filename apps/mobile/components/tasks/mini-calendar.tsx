import { useThemeColors } from "@nox/features";
import { toDateKey } from "@nox/utils";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function parse(key: string): [number, number] {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return [y, m - 1];
}

/**
 * A compact month calendar for picking a due date: month header with arrows, a Sun-first grid, today
 * ringed, the selected day filled with the accent, past days dimmed (still pickable — back-dating a
 * task is legitimate). Pure date keys in and out; device-local, like the rest of the task model.
 */
export function MiniCalendar({
  selected,
  today,
  onSelect,
}: {
  selected: string | null;
  today: string;
  onSelect: (dateKey: string) => void;
}) {
  const c = useThemeColors();
  const [[year, month], setView] = useState<[number, number]>(() => parse(selected ?? today));

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setView([d.getFullYear(), d.getMonth()]);
  };

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-ink text-[14px] font-semibold">
          {MONTH_NAMES[month]} {year}
        </Text>
        <View className="flex-row gap-1">
          <Pressable
            onPress={() => shift(-1)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            className="hover:bg-chip h-7 w-7 items-center justify-center rounded-full"
          >
            <ChevronLeft size={15} color={c.ink2} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => shift(1)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            className="hover:bg-chip h-7 w-7 items-center justify-center rounded-full"
          >
            <ChevronRight size={15} color={c.ink2} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row">
        {DOW.map((d, i) => (
          <Text key={i} className="text-ink-3 flex-1 text-center text-[11px] font-semibold">
            {d}
          </Text>
        ))}
      </View>

      <View className="mt-1">
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} className="flex-row">
            {cells.slice(row * 7, row * 7 + 7).map((key, i) => {
              if (!key) return <View key={i} className="h-9 flex-1" />;
              const isSel = key === selected;
              const isToday = key === today;
              const past = key < today;
              return (
                <Pressable
                  key={key}
                  onPress={() => onSelect(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key}
                  accessibilityState={{ selected: isSel }}
                  className="h-9 flex-1 items-center justify-center"
                >
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full ${
                      isSel ? "bg-accent" : isToday ? "border-accent border" : "hover:bg-chip"
                    }`}
                  >
                    <Text
                      className={`text-[13px] ${
                        isSel
                          ? "text-on-accent font-bold"
                          : isToday
                            ? "text-accent font-bold"
                            : past
                              ? "text-ink-3"
                              : "text-ink font-medium"
                      }`}
                    >
                      {Number(key.slice(8))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
