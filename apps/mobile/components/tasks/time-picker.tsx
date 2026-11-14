import { useThemeColors } from "@nox/features";
import { formatTime12, parseTypedTime } from "@nox/utils";
import { Check, Clock } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";

const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

const QUICK: { label: string; value: string }[] = [
  { label: "Morning", value: "09:00" },
  { label: "Midday", value: "12:00" },
  { label: "Afternoon", value: "15:00" },
  { label: "Evening", value: "18:00" },
  { label: "Night", value: "21:00" },
];

/** Every 15 minutes of the day. */
const SLOTS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});
const SLOT_H = 34;

/**
 * A time picker in the shape of the date panel: quick choices on the left (All day, Morning 9 AM …
 * Night 9 PM), and on the right a box to type any time into above a scrolling list of every quarter
 * hour — Google Calendar's time dropdown — with the current choice highlighted and scrolled into view.
 * Stacks on phones.
 */
export function TimePicker({
  value,
  onChange,
  compact,
  allowNone = true,
  noneLabel = "All day",
}: {
  value: string | null;
  /** Called with the chosen "HH:MM" (or null for no time). */
  onChange: (time: string | null) => void;
  compact: boolean;
  /** Offer the no-time choice (off for a reminder, which always has a time). */
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const c = useThemeColors();
  const [typed, setTyped] = useState("");
  const [focused, setFocused] = useState(false);
  const listRef = useRef<ScrollView>(null);
  const parsed = parseTypedTime(typed);
  const invalid = typed.trim().length > 0 && parsed === null;

  // Scroll the chosen time (or 9 AM) to the second row of the list.
  useEffect(() => {
    const target = value ?? "09:00";
    const idx = SLOTS.findIndex((s) => s >= target);
    const t = setTimeout(() => listRef.current?.scrollTo({ y: Math.max(0, (idx - 1) * SLOT_H), animated: false }), 0);
    return () => clearTimeout(t);
  }, [value]);

  const applyTyped = () => {
    if (parsed) {
      onChange(parsed);
      setTyped("");
    }
  };

  const quick = (
    <View style={compact ? undefined : { width: 180 }} className={compact ? "flex-row flex-wrap gap-1.5" : ""}>
      {allowNone &&
        (compact ? (
          <QuickPill label={noneLabel} selected={value === null} onPress={() => onChange(null)} />
        ) : (
          <QuickRow label={noneLabel} hint="" selected={value === null} onPress={() => onChange(null)} />
        ))}
      {QUICK.map((q) =>
        compact ? (
          <QuickPill key={q.value} label={formatTime12(q.value)!} selected={value === q.value} onPress={() => onChange(q.value)} />
        ) : (
          <QuickRow key={q.value} label={q.label} hint={formatTime12(q.value)!} selected={value === q.value} onPress={() => onChange(q.value)} />
        ),
      )}
    </View>
  );

  const list = (
    <View className="flex-1">
      {/* Type any time */}
      <View
        className="bg-chip h-[36px] flex-row items-center gap-2 rounded-[9px] border px-2.5"
        style={{ borderColor: invalid ? c.high : focused ? c.accent : "transparent" }}
      >
        <Clock size={13} color={c.ink3} strokeWidth={2} />
        <TextInput
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={applyTyped}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={value ? `${formatTime12(value)} — type to change` : "Type a time, e.g. 6:30pm"}
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Type a time"
          className="text-ink flex-1 text-[13px]"
          style={{ paddingVertical: 0, outlineWidth: 0 } as object}
        />
        {parsed && (
          <Pressable onPress={applyTyped} hitSlop={6} className="bg-accent rounded-[6px] px-2 py-1">
            <Text className="text-on-accent text-[11.5px] font-bold">Set {formatTime12(parsed)}</Text>
          </Pressable>
        )}
      </View>
      {invalid && <Text className="text-high mt-1 text-[11px]">Try “6pm”, “18:30” or “9:15am”.</Text>}

      {/* Every quarter hour */}
      <ScrollView
        ref={listRef}
        className="mt-2 rounded-[9px]"
        style={{ height: compact ? SLOT_H * 4.5 : SLOT_H * 5.5 }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        {SLOTS.map((s) => {
          const on = value === s;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={formatTime12(s)!}
              style={{ height: SLOT_H }}
              className={`flex-row items-center justify-between px-3 ${on ? "bg-accent/[0.14]" : "hover:bg-chip"}`}
            >
              <Text
                style={TABULAR}
                className={`text-[13px] ${on ? "text-accent font-semibold" : s.endsWith(":00") ? "text-ink font-medium" : "text-ink-3"}`}
              >
                {formatTime12(s)}
              </Text>
              {on && <Check size={13} color={c.accent} strokeWidth={2.6} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return compact ? (
    <View className="gap-3">
      {quick}
      {list}
    </View>
  ) : (
    <View className="flex-row gap-3">
      {quick}
      <View className="bg-line w-px" />
      <View className="flex-1">{list}</View>
    </View>
  );
}

function QuickRow({ label, hint, selected, onPress }: { label: string; hint: string; selected: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`min-h-[36px] flex-row items-center gap-2 rounded-[8px] px-2.5 ${selected ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
    >
      <Text className={`flex-1 text-[13.5px] ${selected ? "text-accent font-semibold" : "text-ink"}`}>{label}</Text>
      {hint ? (
        <Text style={TABULAR} className={`text-[12px] ${selected ? "text-accent" : "text-ink-3"}`}>
          {hint}
        </Text>
      ) : null}
      {selected ? <Check size={14} color={c.accent} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

function QuickPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-pill px-3 py-[6px] ${selected ? "bg-accent" : "bg-chip hover:bg-elev"}`}
    >
      <Text className={`text-[12.5px] font-semibold ${selected ? "text-on-accent" : "text-ink-2"}`}>{label}</Text>
    </Pressable>
  );
}
