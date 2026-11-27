import { useCreateIdea, useCreateNote, useThemeColors } from "@nox/features";
import type { Property, Space } from "@nox/types";
import { router } from "expo-router";
import { FileText, Lightbulb, Plus } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MenuDivider, MenuLabel, MenuRow, pressScale } from "../menu";
import { Popover } from "../popover";
import { type Page } from "./pages";
import { useAllTemplates } from "./use-templates";
import { fromTemplate, type TemplateLike } from "./templates";

/** A note or idea in a space, with what its board card and table row show. */
export interface SpacePage extends Page {
  stage: string | null;
  properties: Property[];
  tags: string[];
}

/** "+ New": a blank note or idea, or one from a template, filed in this space (and stage). */
export function NewInSpace({ space, stage, variant = "button" }: { space: Space; stage: string | null; variant?: "button" | "plus" | "link" | "row" }) {
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
        ) : variant === "row" ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`New page in ${stage ?? "this space"}`} className="hover:bg-chip flex-row items-center gap-1.5 rounded-[8px] px-2 py-1.5">
            <Plus size={14} color={c.ink3} strokeWidth={2} />
            <Text className="text-ink-3 text-[13px]">New</Text>
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
