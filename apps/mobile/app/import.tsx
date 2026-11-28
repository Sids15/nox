import {
  parseImport,
  useCreateSpace,
  useCreateTask,
  useSpaces,
  useThemeColors,
  useToggleTask,
  type ImportFormat,
  type ImportedTask,
} from "@nox/features";
import { router } from "expo-router";
import { ChevronLeft, FileUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SpaceMark } from "../components/brain/space-mark";
import { pressScale, TABULAR } from "../components/menu";
import { plural } from "../lib/confirm";
import { goBack } from "../lib/go-back";
import { canPickTextFile, pickTextFile } from "../lib/pick-text-file";
import { useIsDesktop } from "../lib/use-responsive";

const SOURCES: { key: ImportFormat; label: string; how: string }[] = [
  { key: "todoist", label: "Todoist", how: "In Todoist, open a project → ⋯ → Export as a template → Download as CSV. One file per project." },
  { key: "ticktick", label: "TickTick", how: "In TickTick on the web: Settings → Account → Generate backup. You get one CSV with every list." },
  { key: "notion", label: "Notion", how: "Open the database → ⋯ → Export → Markdown & CSV. Unzip it and pick the .csv file." },
  { key: "text", label: "A list", how: "Apple Reminders: open a list → Share → Copy, then paste it here. Markdown checklists and plain lines work too." },
];
const FORMAT_NAME: Record<ImportFormat, string> = { todoist: "Todoist", ticktick: "TickTick", notion: "Notion", text: "a list" };

type Destination = { kind: "none" } | { kind: "space"; id: string } | { kind: "per-list" };

/**
 * Bring your tasks over from Todoist, TickTick, Notion or any list. The file is read on this device;
 * you see what will come in, choose where it goes, then import.
 */
export default function ImportScreen() {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const { data: allSpaces = [] } = useSpaces();
  const spaces = allSpaces.filter((s) => !s.archived);
  const createTask = useCreateTask();
  const toggle = useToggleTask();
  const createSpace = useCreateSpace();

  const [source, setSource] = useState<ImportFormat>("todoist");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withDone, setWithDone] = useState(false);
  const [dest, setDest] = useState<Destination>({ kind: "none" });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finished, setFinished] = useState<number | null>(null);

  // Read with the chosen app's reader; a text list is the fallback for anything else.
  const result = useMemo(() => (text.trim() ? parseImport(text, source) : null), [text, source]);
  const open = result?.tasks.filter((t) => !t.done) ?? [];
  const doneCount = (result?.tasks.length ?? 0) - open.length;
  const toImport: ImportedTask[] = result ? (withDone ? result.tasks : open) : [];
  const lists = [...new Set(toImport.map((t) => t.list).filter((l): l is string => !!l))];

  const choose = async () => {
    setError(null);
    try {
      const f = await pickTextFile();
      if (!f) return;
      setFileName(f.name);
      setText(f.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const run = async () => {
    if (toImport.length === 0 || progress) return;
    setError(null);
    setProgress({ done: 0, total: toImport.length });
    try {
      // Spaces first, saved before the tasks that point at them.
      const listSpace = new Map<string, string>();
      if (dest.kind === "per-list") {
        for (const name of lists) {
          const existing = spaces.find((s) => s.name.toLowerCase() === name.toLowerCase());
          listSpace.set(name, existing ? existing.id : await createSpace.createAsync({ name: name.slice(0, 80), icon: "", stages: [] }));
        }
      }
      let n = 0;
      for (const t of toImport) {
        const space_id = dest.kind === "space" ? dest.id : dest.kind === "per-list" && t.list ? (listSpace.get(t.list) ?? null) : null;
        const saved = await createTask.mutateAsync({
          title: t.title,
          notes: t.notes,
          due_date: t.due_date,
          due_time: t.due_time,
          reminder_times: [],
          priority: t.priority,
          repeat: "none",
          repeat_config: null,
          ...(space_id ? { space_id } : {}),
        });
        if (t.done) await toggle.mutateAsync({ id: saved.id, status: "complete" });
        n++;
        if (n % 5 === 0 || n === toImport.length) setProgress({ done: n, total: toImport.length });
      }
      setFinished(n);
      setText("");
      setFileName(null);
    } catch (e) {
      setError(`Stopped partway: ${e instanceof Error ? e.message : "something went wrong"}. What was imported stays.`);
    } finally {
      setProgress(null);
    }
  };

  const pill = (on: boolean, label: string, onPress: () => void, mark?: React.ReactNode) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      className={`h-[34px] flex-row items-center gap-1.5 rounded-pill border px-3 ${on ? "border-accent bg-accent/[0.08]" : "border-line hover:bg-chip"}`}
    >
      {mark}
      <Text numberOfLines={1} className={`max-w-[200px] text-[13px] font-medium ${on ? "text-accent" : "text-ink-2"}`}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120, ...(isDesktop ? { paddingTop: 16 } : null) }}>
        <View className="px-screen" style={{ maxWidth: 680, width: "100%", alignSelf: "center" }}>
          <View className="flex-row items-center gap-2 pt-2">
            <Pressable onPress={() => goBack("/settings")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back" style={pressScale} className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]">
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Text className="text-ink flex-1 font-serif text-[30px] font-bold tracking-[-0.01em]">Import tasks</Text>
          </View>
          <Text className="text-ink-3 mt-1 text-[14px] leading-[20px]">Bring your tasks over. The file is read on this device; you see what comes in before anything is saved.</Text>

          {finished !== null ? (
            <View className="bg-accent/[0.08] mt-5 rounded-[12px] px-4 py-3">
              <Text className="text-ink text-[15px] font-semibold">Imported {plural(finished, "task")}.</Text>
              <Pressable onPress={() => router.navigate("/(tabs)/tasks" as never)} accessibilityRole="link" className="mt-1">
                <Text className="text-accent text-[14px] font-semibold">Open Tasks →</Text>
              </Pressable>
            </View>
          ) : null}

          <Text className="text-ink-3 mb-1.5 mt-6 text-[12px] font-semibold">From</Text>
          <View className="flex-row flex-wrap gap-1.5">{SOURCES.map((s) => pill(source === s.key, s.label, () => setSource(s.key)))}</View>
          <Text className="text-ink-2 mt-2 text-[13px] leading-[19px]">{SOURCES.find((s) => s.key === source)!.how}</Text>

          <View className="mt-4 flex-row flex-wrap items-center gap-2">
            {canPickTextFile ? (
              <Pressable onPress={() => void choose()} accessibilityRole="button" style={pressScale} className="bg-chip hover:opacity-80 h-[38px] flex-row items-center gap-2 rounded-[10px] px-3.5">
                <FileUp size={15} color={c.ink2} strokeWidth={2} />
                <Text className="text-ink-2 text-[14px] font-semibold">Choose file</Text>
              </Pressable>
            ) : null}
            {fileName ? <Text numberOfLines={1} className="text-ink-3 flex-1 text-[13px]">{fileName}</Text> : null}
          </View>
          <TextInput
            value={fileName ? "" : text}
            onChangeText={(v) => {
              setFileName(null);
              setText(v);
            }}
            editable={!fileName}
            multiline
            placeholder={fileName ? "File loaded." : canPickTextFile ? "…or paste the export here" : "Paste the export or the list here"}
            placeholderTextColor={c.ink3}
            accessibilityLabel="Paste an export"
            className="bg-surface border-line text-ink mt-2 rounded-[12px] border px-3 text-[14px]"
            style={{ minHeight: 110, maxHeight: 220, paddingVertical: 10, textAlignVertical: "top" }}
          />
          {error ? <Text className="text-high mt-2 text-[13px]">{error}</Text> : null}

          {result ? (
            <View className="mt-6">
              <Text className="text-ink text-[17px] font-semibold">
                {plural(open.length, "open task")}
                {doneCount ? <Text className="text-ink-3 text-[14px] font-medium">{`  ·  ${doneCount} done`}</Text> : null}
              </Text>
              <Text className="text-ink-3 mt-0.5 text-[13px]">
                Read as {FORMAT_NAME[result.format]}
                {result.skipped ? ` · ${plural(result.skipped, "row")} skipped (sections, notes, empty)` : ""}
                {result.tasks.length === 0 ? ". Nothing looked like a task — is the right app picked above?" : ""}
              </Text>

              {toImport.length > 0 ? (
                <View className="border-line bg-surface mt-3 rounded-[12px] border px-3 py-1">
                  {toImport.slice(0, 6).map((t, i) => (
                    <View key={i} className={`flex-row items-center gap-2 py-2 ${i > 0 ? "border-line border-t" : ""}`}>
                      <Text numberOfLines={1} className={`flex-1 text-[14px] ${t.done ? "text-ink-3 line-through" : "text-ink"}`}>
                        {t.title}
                      </Text>
                      {t.list ? <Text numberOfLines={1} className="text-ink-3 max-w-[120px] text-[12px]">{t.list}</Text> : null}
                      {t.due_date ? (
                        <Text style={TABULAR} className="text-ink-3 text-[12px]">
                          {t.due_date}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                  {toImport.length > 6 ? <Text className="text-ink-3 py-2 text-[12px]">and {toImport.length - 6} more</Text> : null}
                </View>
              ) : null}

              {doneCount > 0 ? (
                <View className="mt-3 flex-row items-center">
                  <Text className="text-ink-2 flex-1 text-[14px]">Also bring finished tasks</Text>
                  <Switch value={withDone} onValueChange={setWithDone} accessibilityLabel="Also bring finished tasks" />
                </View>
              ) : null}

              <Text className="text-ink-3 mb-1.5 mt-5 text-[12px] font-semibold">Put them in</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {pill(dest.kind === "none", "No space", () => setDest({ kind: "none" }))}
                {lists.length > 0 ? pill(dest.kind === "per-list", `A space per list (${lists.length})`, () => setDest({ kind: "per-list" })) : null}
                {spaces.map((s) => pill(dest.kind === "space" && dest.id === s.id, s.name, () => setDest({ kind: "space", id: s.id }), <SpaceMark space={s} size={18} />))}
              </View>
              {dest.kind === "per-list" ? (
                <Text className="text-ink-3 mt-2 text-[12px]">
                  {lists.slice(0, 5).join(", ")}
                  {lists.length > 5 ? "…" : ""} — a space with the same name is reused.
                </Text>
              ) : null}

              <Pressable
                onPress={() => void run()}
                disabled={toImport.length === 0 || !!progress}
                accessibilityRole="button"
                style={(st) => ({ ...pressScale(st), opacity: toImport.length && !progress ? 1 : 0.5 })}
                className="bg-accent mt-6 h-[46px] items-center justify-center rounded-[12px]"
              >
                <Text className="text-on-accent text-[15px] font-semibold">
                  {progress ? `Importing ${progress.done} of ${progress.total}…` : `Import ${plural(toImport.length, "task")}`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
