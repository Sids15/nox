import { AiRepository } from "@nox/api";
import { brainDumpTasks, useCreateTask, useSpaces, useThemeColors, type DumpTask } from "@nox/features";
import { capitalize, formatTime12, relativeDayLabel, todayKey } from "@nox/utils";
import { ChevronLeft, Circle, CircleCheck, Mic, Square, Wand2, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AutoGrowInput } from "../components/blocks/auto-grow-input";
import { SpaceMark } from "../components/brain/space-mark";
import { pressScale, TABULAR } from "../components/menu";
import { plural } from "../lib/confirm";
import { useDictation } from "../lib/dictation";
import { goBack } from "../lib/go-back";
import { useAiCall, useAiEnabled } from "../lib/use-ai";
import { useIsDesktop } from "../lib/use-responsive";

type Row = DumpTask & { key: string; keep: boolean };

/**
 * Brain dump: say (or type) everything on your mind in one go, and Nox turns it into separate tasks
 * with their days and times. You check the list, untick what you don't want, then add them.
 * With Nox AI on, one request reads it; without, it's split by sentence and read like quick add.
 */
export default function BrainDumpScreen() {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const aiOn = useAiEnabled();
  const extract = useAiCall(AiRepository.extractItems);
  const createTask = useCreateTask();
  const { data: allSpaces = [] } = useSpaces();
  const spaces = allSpaces.filter((s) => !s.archived);
  const today = todayKey();

  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const dictation = useDictation((heard) => setText((t) => (t.trim() ? `${t.trim()} ${heard}` : heard)));

  const toRows = (tasks: DumpTask[]): Row[] => tasks.map((t, i) => ({ ...t, key: `${i}:${t.title}`, keep: true }));

  const read = async () => {
    const t = text.trim();
    if (!t) return;
    if (dictation.listening) dictation.stop();
    setNote(null);
    if (aiOn) {
      const res = await extract.run(t.slice(0, 6000), today, []);
      if (res && res.tasks.length > 0) {
        setRows(
          toRows(
            res.tasks.map((d) => ({
              title: d.title,
              date: d.date ?? null,
              time: d.date && d.time ? d.time : null,
              minutes: d.duration_minutes ?? null,
              priority: d.priority ?? "medium",
            })),
          ),
        );
        return;
      }
      if (!res) setNote("Nox AI couldn't read it, so it was split by sentence instead.");
    }
    setRows(toRows(brainDumpTasks(t, today)));
  };

  const kept = rows?.filter((r) => r.keep && r.title.trim()) ?? [];
  const add = () => {
    for (const r of kept) {
      createTask.create({
        title: r.title.trim().slice(0, 200),
        notes: null,
        due_date: r.date,
        due_time: r.date ? r.time : null,
        ...(r.minutes ? { duration_minutes: r.minutes } : {}),
        reminder_times: [],
        priority: r.priority,
        repeat: "none",
        repeat_config: null,
        ...(spaceId ? { space_id: spaceId } : {}),
        // No day and no space yet: it waits in the Inbox to be sorted.
        ...(!spaceId && !r.date ? { inbox: true } : {}),
      });
    }
    goBack("/tasks");
  };

  const patchRow = (key: string, p: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...p } : r)) ?? null);

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120, ...(isDesktop ? { paddingTop: 16 } : null) }}>
        <View className="px-screen" style={{ maxWidth: 680, width: "100%", alignSelf: "center" }}>
          <View className="flex-row items-center gap-2 pt-2">
            <Pressable onPress={() => goBack("/tasks")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back" style={pressScale} className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]">
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Text className="text-ink flex-1 font-serif text-[30px] font-bold tracking-[-0.01em]">Brain dump</Text>
          </View>
          <Text className="text-ink-3 mt-1 text-[14px] leading-[20px]">
            Say or type everything on your mind — “call mum tomorrow at 6, renew the passport, and book the dentist next week”. Nox turns it into tasks.
            {!dictation.supported ? " On a phone, use your keyboard's mic." : ""}
          </Text>

          {rows === null ? (
            <>
              <View className="bg-surface border-line mt-4 rounded-[14px] border px-3 py-3">
                <AutoGrowInput
                  value={dictation.interim ? `${text}${text ? " " : ""}${dictation.interim}` : text}
                  onChangeText={setText}
                  autoFocus={!dictation.supported}
                  placeholder="Everything you need to do…"
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="Brain dump"
                  maxLength={6000}
                  minHeight={140}
                  className="text-ink text-[16px]"
                  style={{ lineHeight: 24 }}
                />
              </View>
              {dictation.error ? <Text className="text-high mt-2 text-[13px]">{dictation.error}</Text> : null}
              <View className="mt-3 flex-row items-center gap-2">
                {dictation.supported ? (
                  <Pressable
                    onPress={dictation.listening ? dictation.stop : dictation.start}
                    accessibilityRole="button"
                    accessibilityLabel={dictation.listening ? "Stop listening" : "Start talking"}
                    style={pressScale}
                    className={`h-[44px] flex-row items-center gap-2 rounded-[12px] px-4 ${dictation.listening ? "bg-high" : "bg-chip hover:opacity-80"}`}
                  >
                    {dictation.listening ? <Square size={14} color="#fff" strokeWidth={2.4} /> : <Mic size={16} color={c.ink2} strokeWidth={2} />}
                    <Text className={`text-[15px] font-semibold ${dictation.listening ? "text-white" : "text-ink-2"}`}>{dictation.listening ? "Stop" : "Talk"}</Text>
                  </Pressable>
                ) : null}
                <View className="flex-1" />
                <Pressable
                  onPress={() => void read()}
                  disabled={!text.trim() || extract.busy}
                  accessibilityRole="button"
                  style={(st) => ({ ...pressScale(st), opacity: text.trim() && !extract.busy ? 1 : 0.5 })}
                  className="bg-accent h-[44px] flex-row items-center gap-2 rounded-[12px] px-4"
                >
                  <Wand2 size={16} color={c.onAccent} strokeWidth={2} />
                  <Text className="text-on-accent text-[15px] font-semibold">{extract.busy ? "Reading…" : "Make tasks"}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View className="mt-5 flex-row items-center">
                <Text className="text-ink flex-1 text-[17px] font-semibold">{rows.length === 0 ? "No tasks found" : plural(rows.length, "task")}</Text>
                <Pressable onPress={() => setRows(null)} accessibilityRole="button" className="hover:bg-chip rounded-[8px] px-2 py-1">
                  <Text className="text-ink-2 text-[13px] font-medium">Edit the text</Text>
                </Pressable>
              </View>
              {note ? <Text className="text-ink-3 mt-1 text-[13px]">{note}</Text> : null}
              <View className="border-line bg-surface mt-2 rounded-[12px] border">
                {rows.map((r, i) => (
                  <View key={r.key} className={`flex-row items-center gap-2.5 px-3 py-2 ${i > 0 ? "border-line border-t" : ""}`}>
                    <Pressable onPress={() => patchRow(r.key, { keep: !r.keep })} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: r.keep }} accessibilityLabel={`Add “${r.title}”`}>
                      {r.keep ? <CircleCheck size={18} color={c.accent} strokeWidth={2} /> : <Circle size={18} color={c.ink3} strokeWidth={2} />}
                    </Pressable>
                    <TextInput
                      value={r.title}
                      onChangeText={(v) => patchRow(r.key, { title: v })}
                      maxLength={200}
                      accessibilityLabel="Task title"
                      className={`flex-1 text-[15px] ${r.keep ? "text-ink" : "text-ink-3 line-through"}`}
                      style={{ paddingVertical: 4 }}
                    />
                    {r.date ? (
                      <Pressable onPress={() => patchRow(r.key, { date: null, time: null })} accessibilityRole="button" accessibilityLabel="Remove the day" className="bg-chip flex-row items-center gap-1 rounded-[6px] px-1.5 py-0.5">
                        <Text style={TABULAR} className="text-ink-2 text-[12px]">
                          {capitalize(relativeDayLabel(r.date, today))}
                          {r.time ? ` ${formatTime12(r.time)}` : ""}
                        </Text>
                        <X size={11} color={c.ink3} strokeWidth={2.4} />
                      </Pressable>
                    ) : null}
                    {r.priority === "high" ? <Text className="text-high text-[12px] font-semibold">!</Text> : null}
                  </View>
                ))}
              </View>

              {spaces.length > 0 ? (
                <>
                  <Text className="text-ink-3 mb-1.5 mt-5 text-[12px] font-semibold">Space</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {[{ id: null as string | null, name: "No space" }, ...spaces].map((s) => {
                      const on = spaceId === s.id;
                      return (
                        <Pressable key={s.id ?? "none"} onPress={() => setSpaceId(s.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} className={`h-[34px] flex-row items-center gap-1.5 rounded-pill border px-3 ${on ? "border-accent bg-accent/[0.08]" : "border-line hover:bg-chip"}`}>
                          {"icon" in s ? <SpaceMark space={s} size={18} /> : null}
                          <Text numberOfLines={1} className={`max-w-[180px] text-[13px] font-medium ${on ? "text-accent" : "text-ink-2"}`}>
                            {s.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <Text className="text-ink-3 mt-3 text-[12px]">Tasks with no day and no space wait in your Inbox.</Text>

              <Pressable
                onPress={add}
                disabled={kept.length === 0}
                accessibilityRole="button"
                style={(st) => ({ ...pressScale(st), opacity: kept.length ? 1 : 0.5 })}
                className="bg-accent mt-5 h-[46px] items-center justify-center rounded-[12px]"
              >
                <Text className="text-on-accent text-[15px] font-semibold">Add {plural(kept.length, "task")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
