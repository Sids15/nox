import { AiRepository } from "@nox/api";
import { useCreateTask, useThemeColors } from "@nox/features";
import type { AiNoteAssist, AiNoteMode, ContentBlock } from "@nox/types";
import { todayKey } from "@nox/utils";
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAiCall, useAiEnabled } from "../../lib/use-ai";
import type { BlockEditor } from "../blocks/use-block-editor";
import { isText } from "../blocks/clean-blocks";
import { AiAction, AiButton, AiPanel } from "./ai-ui";

/** The words of a document, headings and paragraphs in order, for sending to the AI. */
export function docText(blocks: ContentBlock[]): string {
  return blocks
    .filter(isText)
    .map((b) => (b.type === "heading" ? `## ${b.text}` : b.text))
    .filter((t) => t.trim())
    .join("\n\n");
}

/** Text back into blocks: "## " lines become headings, blank lines split paragraphs. */
function textToBlocks(text: string): ContentBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): ContentBlock => (/^#{1,3} /.test(p) ? { type: "heading", level: 2, text: p.replace(/^#{1,3} /, "") } : { type: "paragraph", text: p }));
}

const MODES: { mode: AiNoteMode; label: string; needs: number }[] = [
  { mode: "summarize", label: "Summarize", needs: 40 },
  { mode: "tidy", label: "Tidy up", needs: 20 },
  { mode: "continue", label: "Keep writing", needs: 10 },
  { mode: "title_tags", label: "Title & tags", needs: 20 },
  { mode: "actions", label: "Find to-dos", needs: 20 },
];

/**
 * Nox AI for a note or an idea: one row of actions under the properties, and a panel for what comes
 * back. Every result is a proposal — Summary/Keep writing add to the document, Tidy up replaces its
 * text (media stays, and Undo puts the old version back), Title & tags fills those in, Find to-dos
 * creates the tasks you keep ticked.
 */
export function DocAssist({
  docId,
  editor,
  title,
  onTitle,
  tags,
  onTags,
  knownTags,
  modes,
  children,
}: {
  /** Which actions to offer (default: all). */
  modes?: AiNoteMode[];
  /** Extra AI buttons to show in the same row (the idea coach). */
  children?: React.ReactNode;
  docId: string;
  editor: BlockEditor;
  title: string;
  onTitle: (t: string) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
  knownTags: string[];
}) {
  const c = useThemeColors();
  const aiOn = useAiEnabled();
  const call = useAiCall(AiRepository.noteAssist);
  const createTask = useCreateTask();
  const [mode, setMode] = useState<AiNoteMode | null>(null);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [undo, setUndo] = useState<ContentBlock[] | null>(null);

  // A different note: forget the last result.
  useEffect(() => {
    call.reset();
    setMode(null);
    setUndo(null);
    setDropped(new Set());
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!aiOn) return null;

  const text = docText(editor.blocks);
  const run = (m: AiNoteMode) => {
    setMode(m);
    setUndo(null);
    setDropped(new Set());
    void call.run(m, { title, text, today: todayKey(), knownTags });
  };
  const close = () => {
    call.reset();
    setMode(null);
    setDropped(new Set());
  };
  const r: AiNoteAssist | null = call.result;

  let panel: React.ReactNode = null;
  if (r && mode) {
    if (mode === "summarize" || mode === "continue" || mode === "tidy") {
      const body = r.text?.trim();
      panel = (
        <AiPanel
          title={mode === "summarize" ? "Summary" : mode === "tidy" ? "Tidied version" : "A next paragraph"}
          onClose={close}
          footer={
            body ? (
              <AiAction
                primary
                label={mode === "summarize" ? "Add to top" : mode === "tidy" ? "Replace the text" : "Add to note"}
                onPress={() => {
                  const before = editor.blocks;
                  const media = before.filter((b) => !isText(b));
                  if (mode === "summarize") editor.replaceAll([{ type: "heading", level: 2, text: "Summary" }, ...textToBlocks(body), ...before]);
                  else if (mode === "tidy") editor.replaceAll([...textToBlocks(body), ...media]);
                  else editor.replaceAll([...before, ...textToBlocks(body)]);
                  setUndo(before);
                  close();
                }}
              />
            ) : null
          }
        >
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            <Text className="text-ink-2 text-[14px] leading-[21px]">{body || "Nothing came back — try again."}</Text>
            {mode === "tidy" && editor.blocks.some((b) => !isText(b)) ? (
              <Text className="text-ink-3 mt-2 text-[12px]">Pictures, voice notes and links stay, moved below the text.</Text>
            ) : null}
          </ScrollView>
        </AiPanel>
      );
    } else if (mode === "title_tags") {
      const newTags = r.tags.filter((t) => !tags.includes(t));
      panel = (
        <AiPanel
          title="Title & tags"
          onClose={close}
          footer={
            <AiAction
              primary
              label="Use these"
              onPress={() => {
                if (r.title) onTitle(r.title);
                if (newTags.length) onTags([...tags, ...newTags].slice(0, 20));
                close();
              }}
            />
          }
        >
          {r.title ? <Text className="text-ink text-[15px] font-semibold">{r.title}</Text> : null}
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {newTags.length ? (
              newTags.map((t) => (
                <View key={t} className="bg-chip rounded-pill px-2.5 py-[3px]">
                  <Text className="text-ink-2 text-[13px] font-medium">#{t}</Text>
                </View>
              ))
            ) : (
              <Text className="text-ink-3 text-[13px]">No new tags to add.</Text>
            )}
          </View>
        </AiPanel>
      );
    } else if (mode === "actions") {
      const kept = r.tasks.filter((_, i) => !dropped.has(i));
      panel = (
        <AiPanel
          title={r.tasks.length ? "To-dos in this note" : "No to-dos found"}
          onClose={close}
          footer={
            kept.length ? (
              <AiAction
                primary
                label={`Add ${kept.length} task${kept.length === 1 ? "" : "s"}`}
                onPress={() => {
                  for (const t of kept)
                    createTask.create({
                      title: t.title,
                      notes: t.notes ?? (title ? `From “${title.slice(0, 120)}”` : null),
                      due_date: t.date ?? null,
                      due_time: t.date ? (t.time ?? null) : null,
                      ...(t.date && t.time && t.duration_minutes ? { duration_minutes: t.duration_minutes } : {}),
                      reminder_times: [],
                      priority: t.priority ?? "medium",
                      repeat: "none",
                      repeat_config: null,
                    });
                  close();
                }}
              />
            ) : null
          }
        >
          {r.tasks.map((t, i) => {
            const on = !dropped.has(i);
            return (
              <Pressable
                key={i}
                onPress={() =>
                  setDropped((d) => {
                    const n = new Set(d);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className="flex-row items-center gap-2.5 py-1"
              >
                <View
                  className="h-[18px] w-[18px] items-center justify-center rounded-[5px]"
                  style={{ borderWidth: on ? 0 : 1.5, borderColor: c.ink3, backgroundColor: on ? c.accent : "transparent" }}
                >
                  {on && <Check size={12} color={c.onAccent} strokeWidth={3} />}
                </View>
                <Text className={`flex-1 text-[14px] ${on ? "text-ink" : "text-ink-3 line-through"}`}>{t.title}</Text>
                {t.date ? <Text className="text-ink-3 text-[12px]">{t.date === todayKey() ? "Today" : t.date}</Text> : null}
              </Pressable>
            );
          })}
        </AiPanel>
      );
    }
  }

  const available = MODES.filter((m) => text.length >= m.needs && (!modes || modes.includes(m.mode)));

  return (
    <View className="mt-3 gap-2">
      {panel}
      {!panel && (
        <View className="flex-row flex-wrap items-center gap-1.5">
          {children}
          {available.length === 0 && !children ? (
            <Text className="text-ink-3 text-[12px]">Write a little and Nox AI can summarize, tidy or pull out to-dos.</Text>
          ) : (
            available.map((m) => (
              <AiButton key={m.mode} label={m.label} onPress={() => run(m.mode)} busy={call.busy && mode === m.mode} disabled={call.busy && mode !== m.mode} />
            ))
          )}
        </View>
      )}
      {call.error ? <Text className="text-high text-[13px]">{call.error}</Text> : null}
      {undo && (
        <Pressable
          onPress={() => {
            editor.replaceAll(undo);
            setUndo(null);
          }}
          accessibilityRole="button"
          className="self-start"
        >
          <Text className="text-ink-3 text-[12px]">
            Changed by Nox AI · <Text className="text-ink-2 font-semibold underline">Undo</Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
}
