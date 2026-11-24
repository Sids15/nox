import { useThemeColors, useThemeVars, useUpdateIdea, useUpdateNote, useUpdateSpace } from "@nox/features";
import type { Space } from "@nox/types";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { usePages } from "./pages";

/**
 * Edit a space's pipeline: rename, reorder, add or remove stages. A stage renamed in place carries its
 * pages with it; pages in a removed stage show under "No stage" until moved.
 */
export function StageEditor({ space, visible, onClose }: { space: Space; visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const update = useUpdateSpace();
  const updateNote = useUpdateNote();
  const updateIdea = useUpdateIdea();
  const { notes, ideas } = usePages();
  // Each row remembers the stage it started as, so a rename can move its pages along.
  const [rows, setRows] = useState<{ from: string | null; name: string }[]>([]);

  useEffect(() => {
    if (visible) setRows(space.stages.map((s) => ({ from: s, name: s })));
  }, [visible, space.stages]);

  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = () => {
    const seen = new Set<string>();
    const kept = rows
      .map((r) => ({ ...r, name: r.name.trim().slice(0, 60) }))
      .filter((r) => r.name && !seen.has(r.name.toLowerCase()) && seen.add(r.name.toLowerCase()))
      .slice(0, 20);
    update.mutate({ id: space.id, patch: { stages: kept.map((r) => r.name) } });
    for (const r of kept) {
      if (!r.from || r.from === r.name) continue;
      for (const n of notes) if (n.space_id === space.id && n.stage === r.from) updateNote.mutate({ id: n.id, patch: { stage: r.name } });
      for (const i of ideas) if (i.space_id === space.id && i.stage === r.from) updateIdea.mutate({ id: i.id, patch: { stage: r.name } });
    }
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-6">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[400px] border p-4" style={{ maxHeight: "85%" }}>
          <Text className="text-ink text-[16px] font-semibold">Pipeline stages</Text>
          <Text className="text-ink-3 mb-3 mt-0.5 text-[13px]">The columns of this space's board, in order.</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            {rows.map((r, i) => (
              <View key={i} className="mb-1.5 flex-row items-center gap-1">
                <TextInput
                  value={r.name}
                  onChangeText={(t) => setRows((all) => all.map((x, j) => (j === i ? { ...x, name: t } : x)))}
                  placeholder="Stage name"
                  placeholderTextColor={c.ink3}
                  maxLength={60}
                  className="bg-chip rounded-input text-ink h-10 flex-1 px-3 text-[14px]"
                  style={{ paddingVertical: 0 }}
                />
                <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={4} accessibilityLabel="Move up" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]" style={{ opacity: i === 0 ? 0.3 : 1 }}>
                  <ArrowUp size={15} color={c.ink2} strokeWidth={2} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} disabled={i === rows.length - 1} hitSlop={4} accessibilityLabel="Move down" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]" style={{ opacity: i === rows.length - 1 ? 0.3 : 1 }}>
                  <ArrowDown size={15} color={c.ink2} strokeWidth={2} />
                </Pressable>
                <Pressable onPress={() => setRows((all) => all.filter((_, j) => j !== i))} hitSlop={4} accessibilityLabel="Remove stage" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]">
                  <X size={15} color={c.ink3} strokeWidth={2.2} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {rows.length < 20 ? (
            <Pressable onPress={() => setRows((r) => [...r, { from: null, name: "" }])} className="hover:bg-chip mt-1 flex-row items-center gap-1.5 self-start rounded-[8px] px-2 py-1.5">
              <Plus size={14} color={c.accent} strokeWidth={2.2} />
              <Text className="text-accent text-[14px] font-medium">Add stage</Text>
            </Pressable>
          ) : null}
          <View className="mt-3 flex-row justify-end gap-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-ink-2 text-[14px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={save} accessibilityRole="button" className="bg-accent rounded-input px-4 py-2">
              <Text className="text-on-accent text-[14px] font-semibold">Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
