import { addDays, dayOfMonth, formatTime12, weekdayShort } from "@nox/utils";
import { Pressable, ScrollView, Text, View } from "react-native";
import { TABULAR } from "../menu";

const TIMES = ["09:00", "12:00", "15:00", "18:00"];
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function Chip({ label, sub, on, onPress, a11y }: { label: string; sub?: string; on: boolean; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={a11y}
      className={`h-[32px] flex-row items-center gap-1 rounded-[9px] border px-2.5 ${
        on ? "bg-accent border-accent" : "border-line hover:bg-chip"
      }`}
    >
      <Text style={TABULAR} className={`text-[13px] font-semibold ${on ? "text-on-accent" : "text-ink"}`}>
        {label}
      </Text>
      {sub ? (
        <Text style={TABULAR} className={`text-[12px] ${on ? "text-on-accent" : "text-ink-3"}`}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * One-tap "when" for a new task: the day (Today, Tomorrow, the rest of the week, No date) and the
 * time (Anytime or a common slot). Anything else is a click away in the property bar's date and time
 * menus. The row scrolls sideways on a phone.
 */
export function WhenPicker({
  date,
  time,
  today,
  onDate,
  onTime,
}: {
  date: string | null;
  time: string | null;
  today: string;
  onDate: (d: string | null) => void;
  onTime: (t: string | null) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const dayLabel = (d: string, i: number) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : cap(weekdayShort(d)));
  const otherDay = date !== null && !days.includes(date);
  const otherTime = time !== null && !TIMES.includes(time.slice(0, 5));

  return (
    <View className="gap-2">
      <View className="flex-row items-center">
        <Text className="text-ink-3 w-[52px] text-[12.5px] font-medium">Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
          {days.map((d, i) => (
            <Chip
              key={d}
              label={dayLabel(d, i)}
              sub={i > 1 ? String(dayOfMonth(d)) : undefined}
              on={date === d}
              onPress={() => onDate(d)}
              a11y={i < 2 ? dayLabel(d, i) : `${dayLabel(d, i)} ${dayOfMonth(d)}`}
            />
          ))}
          {otherDay && <Chip label="Picked" sub={date!} on onPress={() => {}} a11y={`Picked date ${date}`} />}
          <Chip label="No date" on={date === null} onPress={() => onDate(null)} a11y="No date" />
        </ScrollView>
      </View>
      {date !== null && (
        <View className="flex-row items-center">
          <Text className="text-ink-3 w-[52px] text-[12.5px] font-medium">Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
            <Chip label="Anytime" on={time === null} onPress={() => onTime(null)} a11y="Anytime" />
            {TIMES.map((t) => (
              <Chip key={t} label={formatTime12(t)!} on={time?.slice(0, 5) === t} onPress={() => onTime(t)} a11y={formatTime12(t)!} />
            ))}
            {otherTime && <Chip label={formatTime12(time)!} on onPress={() => {}} a11y={`Picked time ${formatTime12(time)}`} />}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
