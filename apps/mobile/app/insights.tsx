import { formatMinutes, insights, spaceLabel, useFocusSessions, useSpaces, useTasks, useThemeColors } from "@nox/features";
import { todayKey } from "@nox/utils";
import { ChevronLeft } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SpaceMark } from "../components/brain/space-mark";
import { ColumnChart, RankedBars } from "../components/insights/column-chart";
import { pressScale, TABULAR } from "../components/menu";
import { goBack } from "../lib/go-back";
import { useIsDesktop } from "../lib/use-responsive";

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "+3 vs last week" in muted ink: up isn't always good, so no colour verdict. */
function delta(now: number, before: number, unit: (n: number) => string): string | null {
  if (now === 0 && before === 0) return null;
  const d = now - before;
  if (d === 0) return "Same as last week";
  return `${d > 0 ? "+" : "−"}${unit(Math.abs(d))} vs last week`;
}

/**
 * Insights: how your weeks are going — tasks finished, time focused, streaks, on-time rate and
 * where your focus goes. Read from your own tasks and focus sessions; nothing is sent anywhere.
 */
export default function InsightsScreen() {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useFocusSessions();
  const { data: spaces = [] } = useSpaces();
  const today = todayKey();
  const s = useMemo(() => insights(tasks, sessions, today), [tasks, sessions, today]);

  const tile = (label: string, value: string, sub: string | null) => (
    <View className="border-line bg-surface min-w-[150px] flex-1 rounded-[14px] border px-4 py-3" accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ""}`}>
      <Text className="text-ink-3 text-[12px] font-semibold">{label}</Text>
      <Text style={TABULAR} className="text-ink mt-1 text-[24px] font-semibold">
        {value}
      </Text>
      {sub ? <Text className="text-ink-3 mt-0.5 text-[12px]">{sub}</Text> : null}
    </View>
  );

  const card = (title: string, sub: string, body: React.ReactNode) => (
    <View className="border-line bg-surface mt-3 rounded-[14px] border px-4 py-3.5">
      <Text className="text-ink text-[15px] font-semibold">{title}</Text>
      <Text className="text-ink-3 mb-3 text-[12px]">{sub}</Text>
      {body}
    </View>
  );

  const pct = s.onTime.total > 0 ? Math.round((s.onTime.onTime / s.onTime.total) * 100) : null;

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, ...(isDesktop ? { paddingTop: 16 } : null) }}>
        <View className="px-screen" style={{ maxWidth: 860, width: "100%", alignSelf: "center" }}>
          <View className="flex-row items-center gap-2 pt-2">
            <Pressable
              onPress={() => goBack("/tasks")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={pressScale}
              className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]"
            >
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Text className="text-ink flex-1 font-serif text-[30px] font-bold tracking-[-0.01em]">Insights</Text>
          </View>
          <Text className="text-ink-3 mb-4 mt-1 text-[14px]">How your weeks are going. Worked out on your device from your tasks and focus time.</Text>

          <View className="flex-row flex-wrap gap-3">
            {tile("Done this week", String(s.thisWeek.done), delta(s.thisWeek.done, s.lastWeek.done, String))}
            {tile("Focused this week", formatMinutes(s.thisWeek.focus), delta(s.thisWeek.focus, s.lastWeek.focus, formatMinutes))}
            {tile("Streak", `${s.streak} ${s.streak === 1 ? "day" : "days"}`, s.streak > 0 ? "In a row with a task done" : "Finish a task to start one")}
            {tile("On time", pct === null ? "—" : `${pct}%`, pct === null ? "No dated tasks done in 30 days" : `${s.onTime.onTime} of ${s.onTime.total} dated tasks, 30 days`)}
          </View>
          {s.bestWeekday !== null ? (
            <Text className="text-ink-2 mt-3 text-[13px]">
              You get the most done on <Text className="text-ink font-semibold">{WEEKDAYS[s.bestWeekday]}</Text>.
            </Text>
          ) : null}

          <View className={isDesktop ? "flex-row gap-3" : ""}>
            <View className="flex-1">
              {card(
                "Tasks done",
                "Per week, last 8 weeks",
                <ColumnChart
                  empty="No tasks finished yet"
                  columns={s.weeklyDone.map((w) => ({
                    key: w.to,
                    label: short(w.from),
                    detail: `${short(w.from)} – ${short(w.to)}: ${w.count} ${w.count === 1 ? "task" : "tasks"}`,
                    value: w.count,
                  }))}
                />,
              )}
            </View>
            <View className="flex-1">
              {card(
                "Focus",
                "Minutes per day, last 14 days",
                <ColumnChart
                  empty="No focus sessions yet — start one from Focus"
                  columns={s.dailyFocus.map((d) => ({
                    key: d.day,
                    label: short(d.day),
                    detail: `${short(d.day)}: ${formatMinutes(d.minutes)}`,
                    value: d.minutes,
                  }))}
                />,
              )}
            </View>
          </View>

          {card(
            "Focus by space",
            "Last 30 days",
            s.focusBySpace.length === 0 ? (
              <Text className="text-ink-3 text-[13px]">Focus on a task in a space and its time shows here.</Text>
            ) : (
              <RankedBars
                rows={s.focusBySpace.map((r) => {
                  const space = r.spaceId ? spaces.find((x) => x.id === r.spaceId) : undefined;
                  return {
                    key: r.spaceId ?? "none",
                    label: spaceLabel(spaces, r.spaceId),
                    value: r.minutes,
                    display: formatMinutes(r.minutes),
                    mark: space ? <SpaceMark space={space} size={16} /> : null,
                  };
                })}
              />
            ),
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
