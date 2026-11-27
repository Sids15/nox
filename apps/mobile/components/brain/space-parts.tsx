import { useCreateIdea, useCreateNote, useThemeColors } from "@nox/features";
import type { Property, Space } from "@nox/types";
import { router } from "expo-router";
import { FilePlus, Plus } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { MenuDivider, MenuLabel, pressScale } from "../menu";
import { KindIcon } from "./kind-icon";
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

/** What a template's page starts with, in a few words: its first headings. */
function preview(t: TemplateLike): string {
  const heads = t.content.flatMap((b) => (b.type === "heading" && b.text ? [b.text] : []));
  return heads.length ? heads.slice(0, 3).join(" · ") + (heads.length > 3 ? " …" : "") : t.kind === "idea" ? "An idea" : "A note";
}

/** One choice in the menu: an icon, a name, and a line saying what you get. */
function Choice({ icon, name, about, onPress }: { icon: ReactNode; name: string; about: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem" accessibilityLabel={`${name}. ${about}`} className="hover:bg-chip flex-row items-start gap-2.5 rounded-[8px] px-2.5 py-2">
      <View className="pt-[2px]">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-ink text-[14px] font-medium">
          {name}
        </Text>
        <Text numberOfLines={1} className="text-ink-3 mt-[1px] text-[12px]">
          {about}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * "New page": opens a new note or idea in this space (and stage), empty or from a template — each
 * choice says what the page starts with.
 */
export function NewInSpace({ space, stage, variant = "button" }: { space: Space; stage: string | null; variant?: "button" | "plus" | "page" }) {
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
  const icon = (kind: "note" | "idea") => <KindIcon kind={kind} color={c.ink2} size={15} />;

  return (
    <>
      <View ref={ref} collapsable={false}>
        {variant === "plus" ? (
          <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`New page in ${stage ?? "this space"}`} className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
            <Plus size={14} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        ) : variant === "page" ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="New page, empty or from a template" className="hover:bg-chip h-[28px] flex-row items-center gap-1.5 rounded-[8px] px-2">
            <FilePlus size={13} color={c.ink3} strokeWidth={2} />
            <Text className="text-ink-3 text-[13px] font-medium">New page</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="New page in this space" style={pressScale} className="bg-accent hover:opacity-90 h-[32px] flex-row items-center gap-1.5 rounded-[10px] px-3">
            <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
            <Text className="text-on-accent text-[13px] font-semibold">New page</Text>
          </Pressable>
        )}
      </View>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={290} accessibilityLabel="New page">
        <View className="p-1.5">
          <Text className="text-ink-3 px-2.5 pb-1 pt-1 text-[12px]">Opens a new page in {space.name}{stage ? ` · ${stage}` : ""}</Text>
          <Choice icon={icon("note")} name="Empty note" about="A blank page to write in" onPress={() => blank("note")} />
          <Choice icon={icon("idea")} name="Empty idea" about="Something to think through later" onPress={() => blank("idea")} />
          <MenuDivider />
          <MenuLabel>Start from a template</MenuLabel>
          {templates.map((t) => (
            <Choice key={t.id} icon={icon(t.kind === "idea" ? "idea" : "note")} name={t.name} about={preview(t)} onPress={() => fromT(t)} />
          ))}
        </View>
      </Popover>
    </>
  );
}
