import { dayOfMonth, todayKey, weekDates, weekdayShort } from "@nox/utils";
import { Pressable, Text, View } from "react-native";

/** Seven-day strip (Sun→Sat) for the week of `selected`. Tapping a day changes the focus date,
 *  which re-groups the list relative to that day. The selected day is accent-tinted with a dot. */
export function WeekStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (dateKey: string) => void;
}) {
  const days = weekDates(selected);
  const today = todayKey();

  return (
    <View className="flex-row">
      {days.map((day) => {
        const isSelected = day === selected;
        const isToday = day === today;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            className="flex-1 items-center py-1"
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              className={`font-mono text-[9px] ${isSelected ? "text-accent" : "text-ink-3"}`}
            >
              {weekdayShort(day)}
            </Text>
            <Text
              className={`mt-1 text-[15px] ${
                isSelected ? "text-accent font-bold" : "text-ink-2 font-semibold"
              }`}
            >
              {dayOfMonth(day)}
            </Text>
            <View
              className={`mt-1 h-1 w-1 rounded-full ${
                isSelected ? "bg-accent" : isToday ? "bg-ink-3" : "bg-transparent"
              }`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
