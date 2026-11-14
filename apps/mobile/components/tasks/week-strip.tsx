import { useThemeColors } from "@nox/features";
import { addDays, dayOfMonth, monthShort, weekDates, weekdayShort } from "@nox/utils";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

/** "NOV 8 – 14", or "NOV 29 – DEC 5" when the week straddles a month. */
function rangeLabel(days: string[]): string {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const tail = monthShort(first) === monthShort(last) ? `${dayOfMonth(last)}` : `${monthShort(last)} ${dayOfMonth(last)}`;
  return `${monthShort(first)} ${dayOfMonth(first)} – ${tail}`;
}

/**
 * Week navigator for the Tasks screen: the range with previous / next week arrows (and a "Today"
 * jump once you have wandered off), over the seven days (Sun→Sat) of the focused week. Tapping a day
 * changes the focus date, which re-groups the list around that day.
 *
 * Three things are told apart at a glance: the SELECTED day (accent-tinted tile), TODAY when it isn't
 * selected (accent weekday label + bright number), and days that still have open tasks (`marked`, a
 * dot under the number).
 */
export function WeekStrip({
  selected,
  today,
  onSelect,
  marked,
}: {
  selected: string;
  today: string;
  onSelect: (dateKey: string) => void;
  /** Date keys that have at least one open task. */
  marked?: ReadonlySet<string>;
}) {
  const c = useThemeColors();
  const days = weekDates(selected);

  return (
    <View>
      <View className="mb-2.5 flex-row items-center justify-between">
        <Text className="text-ink-3 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">
          {rangeLabel(days)}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {selected !== today && (
            <Pressable
              onPress={() => onSelect(today)}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
              className="bg-accent-soft rounded-pill hover:opacity-80 px-2.5 py-[5px]"
            >
              <Text className="text-accent text-[11.5px] font-semibold">Today</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onSelect(addDays(selected, -7))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            className="bg-chip rounded-pill hover:bg-elev h-[26px] w-[26px] items-center justify-center"
          >
            <ChevronLeft size={15} color={c.ink2} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => onSelect(addDays(selected, 7))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Next week"
            className="bg-chip rounded-pill hover:bg-elev h-[26px] w-[26px] items-center justify-center"
          >
            <ChevronRight size={15} color={c.ink2} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-1">
        {days.map((day) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const hasOpen = marked?.has(day) ?? false;
          return (
            <Pressable
              key={day}
              onPress={() => onSelect(day)}
              className={`flex-1 items-center gap-[6px] rounded-[12px] py-2 ${isSelected ? "bg-accent-soft" : "hover:bg-chip"}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                className={`font-mono text-[9px] tracking-[0.12em] ${isSelected || isToday ? "text-accent" : "text-ink-3"}`}
              >
                {weekdayShort(day)}
              </Text>
              <Text
                className={`text-[15.5px] ${
                  isSelected ? "text-accent font-bold" : isToday ? "text-ink font-bold" : "text-ink-2 font-semibold"
                }`}
              >
                {dayOfMonth(day)}
              </Text>
              <View
                className={`h-1 w-1 rounded-full ${hasOpen ? (isSelected || isToday ? "bg-accent" : "bg-ink-3") : "bg-transparent"}`}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
