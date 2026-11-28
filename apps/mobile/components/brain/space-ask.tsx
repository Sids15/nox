import { AiRepository } from "@nox/api";
import { useThemeColors, useThemeVars } from "@nox/features";
import type { Space } from "@nox/types";
import { todayKey } from "@nox/utils";
import { Sparkles, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { rankContext, type AskItem } from "../../lib/ask-context";
import { useAiCall } from "../../lib/use-ai";
import { noteTitle } from "../notes/note-utils";
import { KindIcon } from "./kind-icon";
import { openRef, usePages } from "./pages";

/** Questions people actually ask about a project, one tap each. */
const STARTERS = ["What's left to do?", "Summarise this space", "Suggest 5 new ideas like my past ones"];
/** How much of the space goes out with a question: open tasks first, then the pages that fit best. */
const MAX_TASKS = 20;
const MAX_ITEMS = 40;
const MAX_CHARS = 400;

/**
 * Ask Nox about one space: the question goes out with only this space's tasks, notes, ideas and links
 * (cut short), so the answer is about this project and the request stays small.
 */
export function SpaceAsk({ space, visible, onClose }: { space: Space; visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const pages = usePages();
  const ask = useAiCall(AiRepository.ask);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!visible) return;
    setQ("");
    ask.reset();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const context = (question: string): AskItem[] => {
    const text = (blocks: { type: string; text?: string }[]) => blocks.map((b) => b.text ?? "").join("\n");
    const tasks: AskItem[] = pages.tasks
      .filter((t) => t.space_id === space.id && !t.deleted && !(t.repeat !== "none" && t.origin_task_id === null))
      .sort((a, b) => Number(a.status === "complete") - Number(b.status === "complete") || (a.due_date ?? "9").localeCompare(b.due_date ?? "9"))
      .slice(0, MAX_TASKS)
      .map((t) => ({
        id: t.id,
        kind: "task",
        title: t.title,
        text: `${t.status === "complete" ? "Done" : "Open"}${t.due_date ? `, due ${t.due_date}` : ""}. ${t.notes ?? ""}`.slice(0, MAX_CHARS),
      }));
    const rest: AskItem[] = [
      ...pages.notes.filter((n) => n.space_id === space.id && !n.is_archived).map((n) => ({ id: n.id, kind: "note" as const, title: noteTitle(n), text: `${n.stage ? `Stage: ${n.stage}. ` : ""}${text(n.content)}`, at: n.updated_at })),
      ...pages.ideas
        .filter((i) => i.space_id === space.id && !i.is_archived && i.status !== "dropped")
        .map((i) => ({ id: i.id, kind: "idea" as const, title: i.title, text: `${i.stage ? `Stage: ${i.stage}. ` : ""}${text(i.content)}`, at: i.updated_at })),
      ...pages.resources
        .filter((r) => r.space_id === space.id && !r.is_archived)
        .map((r) => ({ id: r.id, kind: "resource" as const, title: r.title ?? r.url ?? "Link", text: [r.domain, r.url, r.body].filter(Boolean).join(" "), at: r.updated_at })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(({ at: _at, ...item }) => item);
    const room = MAX_ITEMS - tasks.length;
    // The best matches for the question, topped up with the most recent pages when few words match.
    const ranked = rankContext(question, rest, room, MAX_CHARS);
    const picked = new Set(ranked.map((r) => r.id));
    const recent = rest.filter((r) => !picked.has(r.id)).slice(0, room - ranked.length).map((r) => ({ ...r, text: r.text.replace(/\s+/g, " ").slice(0, MAX_CHARS) }));
    return [...tasks, ...ranked, ...recent];
  };

  const run = (question: string) => {
    const qq = question.trim();
    if (!qq || ask.busy) return;
    setQ(qq);
    void ask.run(`${qq} (About my space “${space.name}”.)`, todayKey(), context(qq));
  };

  const find = (id: string) => pages.find({ kind: "note", id }) ?? pages.find({ kind: "idea", id }) ?? pages.find({ kind: "task", id }) ?? pages.find({ kind: "resource", id });

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-6">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[520px] border p-4" style={{ maxHeight: "80%" }}>
          <View className="mb-3 flex-row items-center gap-2">
            <Sparkles size={16} color={c.accent} strokeWidth={2} />
            <Text className="text-ink flex-1 text-[16px] font-semibold">Ask about {space.name}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[8px]">
              <X size={16} color={c.ink3} strokeWidth={2} />
            </Pressable>
          </View>
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => run(q)}
            placeholder="What's left before launch?"
            placeholderTextColor={c.ink3}
            returnKeyType="send"
            maxLength={300}
            className="bg-chip rounded-input text-ink h-11 px-3 text-[15px]"
            style={{ paddingVertical: 0 }}
          />
          {!ask.busy && !ask.result && !ask.error ? (
            <View className="mt-3 flex-row flex-wrap gap-1.5">
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => run(s)} accessibilityRole="button" className="border-line hover:bg-chip rounded-pill border px-3 py-1.5">
                  <Text className="text-ink-2 text-[13px]">{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <ScrollView className="mt-3" style={{ flexGrow: 0 }}>
            {ask.busy ? (
              <View className="flex-row items-center gap-2 py-1">
                <ActivityIndicator size="small" color={c.accent} style={{ transform: [{ scale: 0.7 }] }} />
                <Text className="text-ink-3 text-[13px]">Reading this space…</Text>
              </View>
            ) : ask.error ? (
              <Text className="text-high text-[13px]">{ask.error}</Text>
            ) : ask.result ? (
              <>
                <Text selectable className="text-ink-2 text-[14px] leading-[21px]">
                  {ask.result.answer}
                </Text>
                {ask.result.sources.length > 0 ? (
                  <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                    {ask.result.sources
                      .map(find)
                      .filter((p): p is NonNullable<ReturnType<typeof find>> => !!p)
                      .map((p) => (
                        <Pressable
                          key={`${p.kind}:${p.id}`}
                          onPress={() => {
                            onClose();
                            openRef(p, p.kind === "resource" ? pages.resource(p.id) : undefined);
                          }}
                          accessibilityRole="button"
                          className="border-line bg-surface hover:bg-chip flex-row items-center gap-1.5 rounded-[8px] border px-2 py-1"
                        >
                          <KindIcon kind={p.kind} color={c.ink2} size={12} />
                          <Text numberOfLines={1} className="text-ink max-w-[200px] text-[12px] font-medium">
                            {p.title}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
