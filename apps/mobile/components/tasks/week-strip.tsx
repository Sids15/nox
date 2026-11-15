import { useThemeColors } from "@nox/features";
import { addDays, dayOfMonth, monthShort, weekDates } from "@nox/utils";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { pressScale, TABULAR } from "../menu";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const monthOf = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1]!;

/** "8 – 14 November", or "29 November – 5 December" when the week straddles a month. */
function rangeLabel(days: string[]): string {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return monthShort(first) === monthShort(last)
    ? `${dayOfMonth(first)} – ${dayOfMonth(last)} ${monthOf(last)}`
    : `${dayOfMonth(first)} ${monthOf(first)} – ${dayOfMonth(last)} ${monthOf(last)}`;
}

/**
 * The week navigator above the Tasks list: the week's range with previous / next arrows (and "Today"
 * once you've moved away), over the seven days. Three states read at a glance — the selected day is
 * a filled accent tile, today (when not selected) has an accent number, and days with something
 * still open carry a dot.
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
      <View className="mb-2 flex-row items-center justify-between">
        <Text style={TABULAR} className="text-ink-2 pl-0.5 text-[13px] font-semibold">
          {rangeLabel(days)}
        </Text>
        <View className="flex-row items-center gap-1">
          {selected !== today && (
            <Pressable
              onPress={() => onSelect(today)}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
              style={pressScale}
              className="hover:bg-chip mr-1 h-[28px] justify-center rounded-[8px] px-2.5"
            >
              <Text className="text-accent text-[13px] font-semibold">Today</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onSelect(addDays(selected, -7))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            style={pressScale}
            className="hover:bg-chip h-[28px] w-[28px] items-center justify-center rounded-[8px]"
          >
            <ChevronLeft size={16} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => onSelect(addDays(selected, 7))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Next week"
            style={pressScale}
            className="hover:bg-chip h-[28px] w-[28px] items-center justify-center rounded-[8px]"
          >
            <ChevronRight size={16} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-1">
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const hasOpen = marked?.has(day) ?? false;
          return (
            <Pressable
              key={day}
              onPress={() => onSelect(day)}
              style={pressScale}
              className={`h-[58px] flex-1 items-center justify-center gap-1 rounded-[12px] ${isSelected ? "bg-accent" : "hover:bg-chip"}`}
              accessibilityRole="button"
              accessibilityLabel={`${DOW_NAME[i]} ${dayOfMonth(day)}${isToday ? ", today" : ""}${hasOpen ? ", has open tasks" : ""}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text className={`text-[11px] font-semibold ${isSelected ? "text-on-accent/80" : "text-ink-3"}`}>{DOW[i]}</Text>
              <Text
                style={TABULAR}
                className={`text-[16px] font-bold ${isSelected ? "text-on-accent" : isToday ? "text-accent" : "text-ink"}`}
              >
                {dayOfMonth(day)}
              </Text>
              <View
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: hasOpen ? (isSelected ? c.onAccent : isToday ? c.accent : c.ink3) : "transparent" }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
