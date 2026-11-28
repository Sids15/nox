import { AiRepository } from "@nox/api";
import {
  formatMinutes,
  spaceLabel,
  useDeleteTask,
  useFocusSessions,
  usePrefs,
  useSpaces,
  useTasks,
  useThemeColors,
  useToggleTask,
  useUpdateTask,
  weekReview,
} from "@nox/features";
import type { Task } from "@nox/types";
import { addDays, capitalize, formatTime12, relativeDayLabel, todayKey } from "@nox/utils";
import { router } from "expo-router";
import { CalendarClock, Check, ChevronDown, ChevronLeft, CircleCheck } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AiButton, AiPanel } from "../components/ai/ai-ui";
import { dataFor } from "../components/ai/brief-card";
import { SpaceMark } from "../components/brain/space-mark";
import { pressScale, TABULAR } from "../components/menu";
import { plural } from "../lib/confirm";
import { goBack } from "../lib/go-back";
import { useAiCall, useAiEnabled } from "../lib/use-ai";
import { useIsDesktop } from "../lib/use-responsive";

/** The week's summary, once per day per device: reopening the Review doesn't spend another request. */
const summaries = new Map<string, string>();

/**
 * The weekly Review, a five-minute routine: see what got done, decide what to do with what slipped,
 * look at the week ahead and where your focus went, then mark it reviewed.
 */
export default function ReviewScreen() {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useFocusSessions();
  const { data: spaces = [] } = useSpaces();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const toggle = useToggleTask();
  const lastReviewed = usePrefs((s) => s.lastReviewed);
  const setLastReviewed = usePrefs((s) => s.setLastReviewed);
  const aiOn = useAiEnabled();
  const brief = useAiCall(AiRepository.brief);
  const today = todayKey();
  const r = useMemo(() => weekReview(tasks, sessions, today), [tasks, sessions, today]);
  const [showDone, setShowDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(() => summaries.get(today) ?? null);

  const range = `${new Date(`${r.from}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(`${r.to}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const reviewedThisWeek = lastReviewed !== null && lastReviewed >= r.from;

  const summarise = async () => {
    const res = await brief.run("weekly", today, { ...dataFor("weekly", tasks, today), focus_minutes_this_week: r.focusMinutes });
    if (res?.text) {
      summaries.set(today, res.text);
      setSummary(res.text);
    }
  };

  const section = (title: string, count: number | null, body: React.ReactNode, hint?: string) => (
    <View className="mt-7">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-ink text-[17px] font-semibold">{title}</Text>
        {count !== null ? (
          <Text style={TABULAR} className="text-ink-3 text-[14px] font-medium">
            {count}
          </Text>
        ) : null}
      </View>
      {hint ? <Text className="text-ink-3 mt-0.5 text-[13px]">{hint}</Text> : null}
      <View className="mt-2">{body}</View>
    </View>
  );

  const move = (t: Task, due_date: string | null) => update.mutate({ id: t.id, patch: { due_date, ...(due_date === null ? { due_time: null } : {}) } });
  const action = (label: string, onPress: () => void, danger = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      style={pressScale}
      className={`h-[28px] items-center justify-center rounded-[8px] px-2.5 ${danger ? "hover:bg-chip" : "bg-chip hover:opacity-80"}`}
    >
      <Text className={`text-[13px] font-medium ${danger ? "text-high" : "text-ink-2"}`}>{label}</Text>
    </Pressable>
  );

  const taskLine = (t: Task, right?: React.ReactNode) => {
    const space = t.space_id ? spaces.find((s) => s.id === t.space_id) : undefined;
    return (
      <Pressable onPress={() => router.push(`/task/${t.id}`)} accessibilityRole="link" className="min-w-0 flex-1 flex-row items-center gap-2">
        <Text numberOfLines={1} className={`min-w-0 flex-shrink text-[15px] ${t.status === "complete" ? "text-ink-3 line-through" : "text-ink"}`}>
          {t.title}
        </Text>
        {space ? <SpaceMark space={space} size={16} /> : null}
        <View className="flex-1" />
        {right}
      </Pressable>
    );
  };

  // The week ahead, grouped by day.
  const ahead = new Map<string, Task[]>();
  for (const t of r.upcoming) ahead.set(t.due_date!, [...(ahead.get(t.due_date!) ?? []), t]);

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, ...(isDesktop ? { paddingTop: 16 } : null) }}>
        <View className="px-screen" style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
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
            <Text className="text-ink flex-1 font-serif text-[30px] font-bold tracking-[-0.01em]">Weekly review</Text>
          </View>
          <Text style={TABULAR} className="text-ink-3 mt-1 text-[14px]">
            {range} · {reviewedThisWeek ? "reviewed" : "about 5 minutes"}
          </Text>

          {/* 1. The win */}
          {section(
            "Done",
            r.done.length,
            r.done.length === 0 ? (
              <Text className="text-ink-3 text-[14px]">Nothing finished in the last 7 days.</Text>
            ) : (
              <>
                <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" className="flex-row items-center gap-1.5 py-1">
                  <ChevronDown size={14} color={c.ink3} strokeWidth={2.2} style={{ transform: [{ rotate: showDone ? "0deg" : "-90deg" }] }} />
                  <Text className="text-ink-2 text-[14px] font-medium">
                    {plural(r.done.length, "task")} finished{r.focusMinutes > 0 ? ` · ${formatMinutes(r.focusMinutes)} focused` : ""}
                  </Text>
                </Pressable>
                {showDone
                  ? r.done.map((t) => (
                      <View key={t.id} className="flex-row items-center gap-2.5 py-1.5">
                        <CircleCheck size={16} color={c.accent} strokeWidth={2} />
                        {taskLine(t)}
                      </View>
                    ))
                  : null}
              </>
            ),
          )}

          {/* 2. What slipped: decide, one tap each */}
          {section(
            "Slipped",
            r.slipped.length,
            r.slipped.length === 0 ? (
              <Text className="text-ink-3 text-[14px]">Nothing overdue. Nice.</Text>
            ) : (
              r.slipped.map((t) => (
                <View key={t.id} className="border-line border-b py-2.5">
                  {taskLine(
                    t,
                    <Text style={TABULAR} className="text-high text-[12px] font-medium">
                      {capitalize(relativeDayLabel(t.due_date!, today))}
                    </Text>,
                  )}
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {action("Tomorrow", () => move(t, addDays(today, 1)))}
                    {action("Next week", () => move(t, addDays(today, 7)))}
                    {action("No date", () => move(t, null))}
                    {action("Done", () => toggle.mutate({ id: t.id, status: "complete" }))}
                    {action("Drop", () => del.mutate(t.id), true)}
                  </View>
                </View>
              ))
            ),
            r.slipped.length > 0 ? "Give each a new day, take the date off, or let it go." : undefined,
          )}

          {/* 3. The week ahead */}
          {section(
            "Next 7 days",
            r.upcoming.length,
            r.upcoming.length === 0 ? (
              <Text className="text-ink-3 text-[14px]">Nothing planned yet. Add tasks with a day and they show here.</Text>
            ) : (
              [...ahead.entries()].map(([day, list]) => (
                <View key={day} className="mb-2">
                  <Text className="text-ink-3 mb-0.5 text-[12px] font-semibold">{capitalize(relativeDayLabel(day, today))}</Text>
                  {list.map((t) => (
                    <View key={t.id} className="flex-row items-center py-1">
                      {taskLine(
                        t,
                        t.due_time ? (
                          <Text style={TABULAR} className="text-ink-3 text-[12px]">
                            {formatTime12(t.due_time)}
                          </Text>
                        ) : null,
                      )}
                    </View>
                  ))}
                </View>
              ))
            ),
          )}

          {/* 4. Where the week went */}
          {r.bySpace.length > 0
            ? section(
                "By space",
                null,
                r.bySpace.map((row) => {
                  const space = row.spaceId ? spaces.find((s) => s.id === row.spaceId) : undefined;
                  return (
                    <View key={row.spaceId ?? "none"} className="flex-row items-center gap-2 py-1.5">
                      {space ? <SpaceMark space={space} size={18} /> : <View style={{ width: 18 }} />}
                      <Text numberOfLines={1} className="text-ink flex-1 text-[14px]">
                        {spaceLabel(spaces, row.spaceId)}
                      </Text>
                      <Text style={TABULAR} className="text-ink-3 text-[13px]">
                        {plural(row.done, "done")}
                        {row.minutes > 0 ? ` · ${formatMinutes(row.minutes)}` : ""}
                      </Text>
                    </View>
                  );
                }),
              )
            : null}

          {/* 5. A few lines from Nox AI, on request */}
          {aiOn ? (
            <View className="mt-7">
              {summary ? (
                <AiPanel title="Your week" onClose={() => setSummary(null)}>
                  {summary
                    .split("\n")
                    .map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim())
                    .filter(Boolean)
                    .map((l, i) => (
                      <View key={i} className="flex-row gap-2 py-0.5">
                        <Text className="text-ink-3 text-[14px] leading-[21px]">•</Text>
                        <Text className="text-ink-2 flex-1 text-[14px] leading-[21px]">{l}</Text>
                      </View>
                    ))}
                </AiPanel>
              ) : (
                <View className="flex-row flex-wrap items-center gap-2">
                  <AiButton label="Summarise my week" onPress={() => void summarise()} busy={brief.busy} />
                  {brief.error ? <Text className="text-high flex-1 text-[13px]">{brief.error}</Text> : null}
                </View>
              )}
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setLastReviewed(today);
              goBack("/tasks");
            }}
            accessibilityRole="button"
            style={pressScale}
            className="bg-accent mt-8 h-[46px] flex-row items-center justify-center gap-2 rounded-[12px]"
          >
            {reviewedThisWeek ? <Check size={16} color={c.onAccent} strokeWidth={2.4} /> : <CalendarClock size={16} color={c.onAccent} strokeWidth={2.2} />}
            <Text className="text-on-accent text-[15px] font-semibold">{reviewedThisWeek ? "Reviewed — back to Tasks" : "Finish review"}</Text>
          </Pressable>
          <Text className="text-ink-3 mt-2 text-center text-[12px]">You'll get a nudge in the sidebar when a week has passed.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
