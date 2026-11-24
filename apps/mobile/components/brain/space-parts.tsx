import {
  useCreateIdea,
  useCreateNote,
  useCreateResource,
  useCreateTask,
  useThemeColors,
  useToggleTask,
  type Ref,
} from "@nox/features";
import type { Property, Space } from "@nox/types";
import { domainFrom } from "@nox/utils";
import { router } from "expo-router";
import { Circle, CircleCheck, FileText, Lightbulb, Link2, Plus } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { plural } from "../../lib/confirm";
import { toHttpUrl } from "../../lib/open-external";
import { MenuDivider, MenuLabel, MenuRow, pressScale } from "../menu";
import { Popover } from "../popover";
import { KindIcon } from "./kind-icon";
import { openRef, usePages, type Page } from "./pages";
import { useAllTemplates } from "./use-templates";
import { fromTemplate, type TemplateLike } from "./templates";

/** A note or idea in a space, with what its board card and table row show. */
export interface SpacePage extends Page {
  stage: string | null;
  properties: Property[];
  tags: string[];
}

/** "+ New": a blank note or idea, or one from a template, filed in this space (and stage). */
export function NewInSpace({ space, stage, variant = "button" }: { space: Space; stage: string | null; variant?: "button" | "plus" | "link" }) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const createNote = useCreateNote();
  const createIdea = useCreateIdea();
  const templates = useAllTemplates();
  const where = { space_id: space.id, stage };

  const blank = (kind: "note" | "idea") => {
    setOpen(false);
    if (kind === "note") {
      const id = createNote.create({ title: null, type: "text", content: [{ type: "paragraph", text: "" }], folder_id: null, tags: [], ...where });
      router.push(`/note/${id}`);
    } else {
      const id = createIdea.create({ title: "Untitled idea", description: null, content: [], priority: "medium", status: "raw", tags: [], ...where });
      router.push(`/idea/${id}`);
    }
  };
  const fromT = (t: TemplateLike) => {
    setOpen(false);
    const made = fromTemplate(t);
    if (t.kind === "idea") {
      const id = createIdea.create({ title: made.title || "Untitled idea", description: null, content: made.content, priority: "medium", status: "raw", tags: [], properties: made.properties, ...where });
      router.push(`/idea/${id}`);
    } else {
      const id = createNote.create({ title: made.title, type: "text", content: made.content, folder_id: null, tags: [], properties: made.properties, ...where });
      router.push(`/note/${id}`);
    }
  };

  return (
    <>
      <View ref={ref} collapsable={false}>
        {variant === "plus" ? (
          <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Add a page to ${stage ?? "this space"}`} className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
            <Plus size={14} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        ) : variant === "link" ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" className="hover:bg-chip -ml-1.5 rounded-[8px] px-1.5 py-1">
            <Text className="text-accent text-[14px] font-semibold">Add a page</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="New in this space" style={pressScale} className="bg-accent hover:opacity-90 h-[32px] flex-row items-center gap-1.5 rounded-[10px] px-3">
            <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
            <Text className="text-on-accent text-[13px] font-semibold">New</Text>
          </Pressable>
        )}
      </View>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240} accessibilityLabel="New in this space">
        <View className="p-1.5">
          <MenuRow label="Blank note" icon={<FileText size={15} color={c.ink2} strokeWidth={2} />} onPress={() => blank("note")} />
          <MenuRow label="Blank idea" icon={<Lightbulb size={15} color={c.ink2} strokeWidth={2} />} onPress={() => blank("idea")} />
          <MenuDivider />
          <MenuLabel>From a template</MenuLabel>
          {templates.map((t) => (
            <MenuRow key={t.id} label={t.name} hint={t.kind === "idea" ? "Idea" : "Note"} onPress={() => fromT(t)} />
          ))}
        </View>
      </Popover>
    </>
  );
}

/** An empty space: three clear first steps instead of four empty tabs. */
export function GettingStarted({ space, onStages, onHelp }: { space: Space; onStages: () => void; onHelp: () => void }) {
  const c = useThemeColors();
  const step = (n: number, title: string, body: string, action: ReactNode) => (
    <View className="border-line flex-row gap-3 border-b py-3.5">
      <View className="bg-accent/[0.12] h-6 w-6 items-center justify-center rounded-full">
        <Text className="text-accent text-[12px] font-bold">{n}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-ink text-[15px] font-semibold">{title}</Text>
        <Text className="text-ink-3 mt-0.5 text-[13px] leading-[19px]">{body}</Text>
        <View className="mt-2 flex-row">{action}</View>
      </View>
    </View>
  );
  const link = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" className="hover:bg-chip -ml-1.5 rounded-[8px] px-1.5 py-1">
      <Text className="text-accent text-[14px] font-semibold">{label}</Text>
    </Pressable>
  );
  return (
    <View className="px-screen">
      <View className="bg-surface border-line rounded-card border px-4 pt-1">
        {step(1, "Add your first page", "A note or an idea, blank or from a template like Video idea or PRD.", <NewInSpace space={space} stage={space.stages[0] ?? null} variant="link" />)}
        {step(
          2,
          space.stages.length ? "Check your pipeline" : "Want a board?",
          space.stages.length ? `Pages move through ${space.stages.join(" → ")}. Rename or reorder the stages to match how you work.` : "Add stages and this space gets a board to move work through.",
          link(space.stages.length ? "Edit stages" : "Add stages", onStages),
        )}
        {step(3, "Bring things in", "Any note, idea, task or saved link can join this space from its Details or menu. Type [[ in a page to link it to another.", link("How Spaces work", onHelp))}
      </View>
      <Text className="text-ink-3 mt-2 text-center text-[12px]" style={{ color: c.ink3 }}>
        This goes away once the space has something in it.
      </Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text className="text-ink-3 px-screen py-6 text-center text-[14px] leading-[20px]">{children}</Text>;
}

export function TaskList({ spaceId, tasks }: { spaceId: string; tasks: ReturnType<typeof usePages>["tasks"] }) {
  const c = useThemeColors();
  const toggle = useToggleTask();
  const createTask = useCreateTask();
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = tasks.filter((t) => t.status !== "complete");
  const done = tasks.filter((t) => t.status === "complete");
  const add = () => {
    const title = draft.trim().slice(0, 200);
    if (!title) return;
    createTask.create({ title, notes: null, due_date: null, due_time: null, reminder_times: [], priority: "medium", repeat: "none", repeat_config: null, space_id: spaceId });
    setDraft("");
  };
  const row = (t: (typeof tasks)[number]) => {
    const complete = t.status === "complete";
    return (
      <View key={t.id} className="border-line flex-row items-center gap-2.5 border-b px-1 py-2.5">
        <Pressable onPress={() => toggle.mutate({ id: t.id, status: complete ? "pending" : "complete" })} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: complete }} accessibilityLabel={t.title}>
          {complete ? <CircleCheck size={20} color={c.accent} strokeWidth={2} /> : <Circle size={20} color={c.ink3} strokeWidth={2} />}
        </Pressable>
        <Pressable onPress={() => openRef({ kind: "task", id: t.id } as Ref)} className="flex-1" accessibilityRole="link">
          <Text numberOfLines={2} className={`text-[15px] ${complete ? "text-ink-3 line-through" : "text-ink"}`}>
            {t.title}
          </Text>
          {t.due_date ? <Text className="text-ink-3 mt-0.5 text-[12px]">Due {t.due_date}</Text> : null}
        </Pressable>
      </View>
    );
  };
  return (
    <View className="px-screen">
      <View className="bg-surface border-line mb-2 h-[44px] flex-row items-center gap-2.5 rounded-[12px] border px-3">
        <Plus size={16} color={c.ink3} strokeWidth={2} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder="Add a task to this space" placeholderTextColor={c.ink3} returnKeyType="done" maxLength={200} className="text-ink flex-1 text-[15px]" style={{ paddingVertical: 0 }} />
      </View>
      {open.length === 0 && done.length === 0 ? <Empty>No tasks in this space yet.</Empty> : open.map(row)}
      {done.length > 0 ? (
        <Pressable onPress={() => setShowDone((v) => !v)} className="mt-2 px-1 py-2">
          <Text className="text-ink-3 text-[13px] font-medium">{showDone ? "Hide" : "Show"} {plural(done.length, "completed task")}</Text>
        </Pressable>
      ) : null}
      {showDone ? done.map(row) : null}
    </View>
  );
}

export function ResourceList({ spaceId, resources }: { spaceId: string; resources: ReturnType<typeof usePages>["resources"] }) {
  const c = useThemeColors();
  const create = useCreateResource();
  const [draft, setDraft] = useState("");
  const add = () => {
    const url = toHttpUrl(draft);
    if (!url) return;
    create.create({ type: "link", url, title: null, domain: domainFrom(url), thumbnail_url: null, duration: null, body: null, tag_ids: [], space_id: spaceId });
    setDraft("");
  };
  return (
    <View className="px-screen">
      <View className="bg-surface border-line mb-2 h-[44px] flex-row items-center gap-2.5 rounded-[12px] border px-3">
        <Link2 size={16} color={c.ink3} strokeWidth={2} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder="Paste a link to save it here" placeholderTextColor={c.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" className="text-ink flex-1 text-[15px]" style={{ paddingVertical: 0 }} />
      </View>
      {resources.length === 0 ? (
        <Empty>No resources here yet. Paste a link above, or set a resource's space from its menu.</Empty>
      ) : (
        resources.map((r) => (
          <Pressable key={r.id} onPress={() => openRef({ kind: "resource", id: r.id }, r)} accessibilityRole="link" className="hover:bg-chip border-line flex-row items-center gap-3 border-b px-1 py-3">
            <KindIcon kind="resource" color={c.ink3} />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-ink text-[15px]">
                {r.title || r.domain || r.url}
              </Text>
              {r.domain ? <Text className="text-ink-3 mt-0.5 text-[12px]">{r.domain}</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}
