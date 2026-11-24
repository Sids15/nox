import { useDeleteTemplate, useSpaces, useThemeColors } from "@nox/features";
import type { Property } from "@nox/types";
import { ChevronDown, CircleDot, Folder, LayoutTemplate, ListFilter, X } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { confirmDelete } from "../../lib/confirm";
import { MenuDivider, MenuLabel, MenuRow, pressScale } from "../menu";
import { Popover } from "../popover";
import { SpaceMark } from "./space-mark";
import { useAllTemplates } from "./use-templates";
import type { TemplateLike } from "./templates";

/** A small read-only chip summarising one set value; tapping it opens the page's details. */
export function MetaChip({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={pressScale}
      className="bg-chip hover:opacity-80 h-[26px] flex-row items-center gap-1.5 rounded-[7px] px-2"
    >
      {children}
    </Pressable>
  );
}

const fieldText = (p: Property): string | null => {
  if (p.value === null || p.value === "") return null;
  if (p.type === "checkbox") return p.value ? p.name : null;
  return `${p.name}: ${String(p.value)}`;
};

/**
 * What's set on a page, as one wrapping line of chips: folder, space, stage, tags and filled-in
 * fields. Nothing set → nothing shown, so a fresh page is just its title and the writing.
 */
export function MetaSummary({
  folderName,
  spaceId,
  stage,
  tags,
  properties,
  leading,
  onOpen,
}: {
  folderName?: string;
  spaceId: string | null;
  stage: string | null;
  tags: string[];
  properties: Property[];
  /** Chips that come first (an idea's status and priority). */
  leading?: ReactNode;
  onOpen: () => void;
}) {
  const c = useThemeColors();
  const { data: spaces = [] } = useSpaces();
  const space = spaces.find((s) => s.id === spaceId);
  const fields = properties.map(fieldText).filter((t): t is string => !!t);
  if (!leading && !folderName && !space && tags.length === 0 && fields.length === 0) return null;

  return (
    <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
      {leading}
      {space ? (
        <MetaChip onPress={onOpen} label={`Space: ${space.name}`}>
          <SpaceMark space={space} size={16} />
          <Text className="text-ink-2 text-[12px] font-medium">{space.name}</Text>
        </MetaChip>
      ) : null}
      {space && stage ? (
        <MetaChip onPress={onOpen} label={`Stage: ${stage}`}>
          <CircleDot size={12} color={c.accent} strokeWidth={2.2} />
          <Text className="text-ink-2 text-[12px] font-medium">{stage}</Text>
        </MetaChip>
      ) : null}
      {folderName ? (
        <MetaChip onPress={onOpen} label={`Folder: ${folderName}`}>
          <Folder size={12} color={c.ink3} strokeWidth={2} />
          <Text className="text-ink-2 text-[12px] font-medium">{folderName}</Text>
        </MetaChip>
      ) : null}
      {tags.slice(0, 3).map((t) => (
        <MetaChip key={t} onPress={onOpen} label={`Tag ${t}`}>
          <Text className="text-ink-2 text-[12px] font-medium">#{t}</Text>
        </MetaChip>
      ))}
      {tags.length > 3 ? (
        <MetaChip onPress={onOpen} label={`${tags.length - 3} more tags`}>
          <Text className="text-ink-3 text-[12px] font-medium">+{tags.length - 3}</Text>
        </MetaChip>
      ) : null}
      {fields.slice(0, 3).map((t) => (
        <MetaChip key={t} onPress={onOpen} label={t}>
          <Text numberOfLines={1} className="text-ink-2 max-w-[180px] text-[12px] font-medium">
            {t}
          </Text>
        </MetaChip>
      ))}
    </View>
  );
}

/** The quiet "Details" switch that shows or hides every property of the page. */
export function DetailsToggle({ open, onPress }: { open: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? "Hide details" : "Show details"}
      style={pressScale}
      className={`h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2.5 ${open ? "bg-chip" : "hover:bg-chip"}`}
    >
      <ListFilter size={13} color={c.ink2} strokeWidth={2} />
      <Text className="text-ink-2 text-[13px] font-medium">Details</Text>
      <ChevronDown size={12} color={c.ink3} strokeWidth={2.2} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
    </Pressable>
  );
}

/** "Template ▾": shown on a blank page — the starters and your own templates in one menu. */
export function TemplateMenu({ kind, onPick }: { kind: "note" | "idea"; onPick: (t: TemplateLike) => void }) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const templates = useAllTemplates(kind);
  const del = useDeleteTemplate();
  const mine = templates.filter((t) => !t.builtIn);
  const builtIn = templates.filter((t) => t.builtIn);
  const row = (t: TemplateLike) => (
    <MenuRow
      key={t.id}
      label={t.name}
      hint={t.kind === "idea" ? "Idea" : undefined}
      onPress={() => {
        setOpen(false);
        onPick(t);
      }}
      trailing={
        t.builtIn ? undefined : (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              setOpen(false);
              confirmDelete({
                title: "Delete template?",
                message: `“${t.name}” will be removed on all your devices. Pages made from it stay as they are.`,
                onConfirm: () => del.mutate(t.id),
              });
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Delete the ${t.name} template`}
            className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]"
          >
            <X size={13} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        )
      }
    />
  );
  return (
    <>
      <View ref={ref} collapsable={false}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Start from a template"
          style={pressScale}
          className={`h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2.5 ${open ? "bg-chip" : "hover:bg-chip"}`}
        >
          <LayoutTemplate size={13} color={c.ink2} strokeWidth={2} />
          <Text className="text-ink-2 text-[13px] font-medium">Template</Text>
          <ChevronDown size={12} color={c.ink3} strokeWidth={2.2} />
        </Pressable>
      </View>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240} accessibilityLabel="Templates">
        <View className="p-1.5">
          {mine.length > 0 ? (
            <>
              <MenuLabel>Yours</MenuLabel>
              {mine.map(row)}
              <MenuDivider />
            </>
          ) : null}
          <MenuLabel>Starters</MenuLabel>
          {builtIn.map(row)}
        </View>
      </Popover>
    </>
  );
}
