import { useThemeColors, useUpdateIdea, useUpdateNote } from "@nox/features";
import type { Property, Space } from "@nox/types";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent } from "react-native";
import { useIsDesktop } from "../../lib/use-responsive";
import { TABULAR } from "../menu";
import { KindIcon } from "./kind-icon";
import { openRef } from "./pages";
import { withAlpha } from "../../lib/color";
import { NewInSpace, type SpacePage } from "./space-parts";

const NO_STAGE = "\u0000none";
/** Column widths: share the page so every stage is on screen, never narrower than MIN (then scroll). */
const MIN_COLUMN = 180;
const MAX_COLUMN = 320;
const PHONE_COLUMN = 264;
const GAP = 10;
const PAD = 20;

/** A field's value as short text for a card, or null when empty. */
export function fieldValue(p: Property): string | null {
  if (p.value === null || p.value === "") return null;
  if (p.type === "checkbox") return p.value ? `✓ ${p.name}` : null;
  if (p.type === "url") return p.name;
  return String(p.value);
}

/**
 * The pipeline board: a column per stage. Drag a card to another column (mouse or finger), or use
 * ‹ › on it. Cards show the page's fields and tags, like a Notion board.
 */
export function SpaceBoard({ space, pages }: { space: Space; pages: SpacePage[] }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const updateNote = useUpdateNote();
  const updateIdea = useUpdateIdea();
  // The app accent, like every other board and list — the space's own colour stays on its mark.
  const tint = c.accent;
  const columns = space.stages;
  const orphans = pages.filter((p) => !p.stage || !columns.includes(p.stage));
  const [boardWidth, setBoardWidth] = useState(0);
  const count = columns.length + (orphans.length > 0 ? 1 : 0);
  const fitted = Math.floor((boardWidth - PAD * 2 - GAP * Math.max(0, count - 1)) / Math.max(1, count));
  // Desktop and iPad: every stage on one screen. Phones: swipe across fixed-width columns.
  const COLUMN = isDesktop && boardWidth > 0 ? Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, fitted)) : PHONE_COLUMN;

  const setStage = (p: SpacePage, stage: string | null) => {
    if (p.stage === stage) return;
    if (p.kind === "note") updateNote.mutate({ id: p.id, patch: { stage } });
    else updateIdea.mutate({ id: p.id, patch: { stage } });
  };

  // ── Drag between columns: measure the columns when a drag starts, drop on the one under the pointer.
  const colRefs = useRef(new Map<string, View | null>());
  const rects = useRef<{ key: string; x: number; w: number }[]>([]);
  const gesture = useRef<{ page: SpacePage; x0: number; y0: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<{ page: SpacePage; x: number; y: number; over: string | null } | null>(null);
  const columnAt = (x: number) => rects.current.find((r) => x >= r.x && x <= r.x + r.w)?.key ?? null;

  const dragHandlers = (page: SpacePage) => ({
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => !gesture.current?.moved,
    onResponderGrant: (e: GestureResponderEvent) => {
      gesture.current = { page, x0: e.nativeEvent.pageX, y0: e.nativeEvent.pageY, moved: false };
      rects.current = [];
      colRefs.current.forEach((el, key) => el?.measureInWindow((x, _y, w) => rects.current.push({ key, x, w })));
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (!g) return;
      const { pageX: x, pageY: y } = e.nativeEvent;
      if (!g.moved && Math.hypot(x - g.x0, y - g.y0) < 6) return;
      g.moved = true;
      setDrag({ page: g.page, x, y, over: columnAt(x) });
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const g = gesture.current;
      gesture.current = null;
      setDrag(null);
      if (!g) return;
      if (!g.moved) return openRef(g.page);
      const over = columnAt(e.nativeEvent.pageX);
      if (over && over !== NO_STAGE) setStage(g.page, over);
    },
    onResponderTerminate: () => {
      gesture.current = null;
      setDrag(null);
    },
  });

  // Touch screens get ‹ › on each card to move it along; with a mouse you drag.
  const touch = Platform.OS !== "web" || (typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);

  const card = (p: SpacePage, index: number) => {
    const values = p.properties.map((f) => fieldValue(f)).filter((v): v is string => !!v).slice(0, 2);
    const dragging = drag?.page.id === p.id;
    return (
      <View
        key={`${p.kind}:${p.id}`}
        {...dragHandlers(p)}
        accessibilityRole="button"
        accessibilityLabel={`${p.title}. Drag to another stage, or tap to open.`}
        className="bg-surface border-line hover:border-ink-3 rounded-[10px] border px-3 py-2.5"
        style={[
          { opacity: dragging ? 0.35 : 1, shadowColor: "#1B2131", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
          Platform.OS === "web" ? ({ cursor: "grab", userSelect: "none" } as object) : null,
        ]}
      >
        <View className="flex-row items-start gap-2">
          <View className="pt-[3px]">
            <KindIcon kind={p.kind} color={c.ink3} size={13} />
          </View>
          <Text numberOfLines={3} className="text-ink flex-1 text-[14px] font-medium leading-[20px]">
            {p.title}
          </Text>
        </View>
        {values.length > 0 || p.tags.length > 0 ? (
          <View className="ml-[21px] mt-1.5 flex-row flex-wrap gap-1">
            {values.map((v) => (
              <View key={v} className="bg-chip rounded-[5px] px-1.5 py-[1px]">
                <Text numberOfLines={1} className="text-ink-2 max-w-[180px] text-[12px]">
                  {v}
                </Text>
              </View>
            ))}
            {p.tags.slice(0, 2).map((t) => (
              <Text key={t} className="text-ink-3 text-[12px]">
                #{t}
              </Text>
            ))}
          </View>
        ) : null}
        {touch && index >= 0 ? (
          <View className="-mb-1 mt-1 flex-row justify-end">
            <Pressable onPress={() => setStage(p, index <= 0 ? null : columns[index - 1]!)} disabled={index === 0} hitSlop={6} accessibilityRole="button" accessibilityLabel="Move to the previous stage" className="h-7 w-7 items-center justify-center" style={{ opacity: index === 0 ? 0.25 : 0.8 }}>
              <ChevronLeft size={14} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Pressable onPress={() => setStage(p, columns[index + 1]!)} disabled={index >= columns.length - 1} hitSlop={6} accessibilityRole="button" accessibilityLabel="Move to the next stage" className="h-7 w-7 items-center justify-center" style={{ opacity: index >= columns.length - 1 ? 0.25 : 0.8 }}>
              <ChevronRight size={14} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  /** A Notion-style column: a coloured stage label, its count, the cards, and a quiet "+ New". */
  const column = (key: string, label: string, items: SpacePage[], index: number) => {
    const over = drag?.over === key && key !== NO_STAGE;
    const strength = index < 0 ? 0 : (index + 1) / Math.max(1, columns.length);
    const labelBg = index < 0 ? withAlpha(c.ink3, 0.14) : withAlpha(tint, 0.08 + 0.1 * strength);
    return (
      <View
        key={key}
        ref={(el) => {
          colRefs.current.set(key, el);
        }}
        collapsable={false}
        className="rounded-[12px] p-1.5"
        style={{ width: COLUMN, backgroundColor: over ? withAlpha(tint, 0.08) : "transparent", borderWidth: 1, borderColor: over ? withAlpha(tint, 0.5) : "transparent" }}
      >
        <View className="mb-2 flex-row items-center gap-2 px-1">
          <View className="rounded-[6px] px-2 py-[3px]" style={{ backgroundColor: labelBg }}>
            <Text numberOfLines={1} className="text-[13px] font-semibold" style={{ color: index < 0 ? c.ink2 : tint }}>
              {label}
            </Text>
          </View>
          <Text style={TABULAR} className="text-ink-3 flex-1 text-[13px]">
            {items.length}
          </Text>
          {key !== NO_STAGE ? <NewInSpace space={space} stage={label} variant="plus" /> : null}
        </View>
        <View className="gap-1.5">
          {items.map((p) => card(p, index))}
          {items.length === 0 && drag ? (
            <View className="items-center rounded-[10px] py-4" style={{ borderWidth: 1, borderStyle: "dashed", borderColor: over ? tint : c.line }}>
              <Text className="text-ink-3 text-[12px]">Drop here</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        scrollEnabled={!drag}
        showsHorizontalScrollIndicator={isDesktop}
        contentContainerStyle={{ gap: GAP, paddingHorizontal: PAD, paddingBottom: 12, alignItems: "flex-start" }}
      >
        {orphans.length > 0 ? column(NO_STAGE, "No stage", orphans, -1) : null}
        {columns.map((s, i) => column(s, s, pages.filter((p) => p.stage === s), i))}
      </ScrollView>
      {/* The card under the pointer while dragging (web: window coordinates map straight to fixed). */}
      {drag && Platform.OS === "web" ? (
        <View
          pointerEvents="none"
          className="bg-surface border-accent rounded-[12px] border px-3 py-2.5"
          style={{
            position: "fixed" as "absolute",
            left: drag.x - COLUMN / 2 + 10,
            top: drag.y - 22,
            width: COLUMN - 20,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            transform: [{ rotate: "-1.5deg" }],
          }}
        >
          <Text numberOfLines={2} className="text-ink text-[14px] font-medium">
            {drag.page.title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
