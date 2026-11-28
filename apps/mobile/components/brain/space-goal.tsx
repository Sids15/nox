import { useThemeColors, useUpdateSpace } from "@nox/features";
import type { Space } from "@nox/types";
import { todayKey } from "@nox/utils";
import { Flag, Plus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { TABULAR } from "../menu";
import { Popover } from "../popover";
import { MiniCalendar } from "../tasks/mini-calendar";

const dayNumber = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** "Dec 15 · 17 days left", "Due today", "3 days late" — and whether it's late. */
export function deadlineLabel(due: string, today: string = todayKey()): { text: string; late: boolean } {
  const left = dayNumber(due) - dayNumber(today);
  const date = new Date(`${due}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (left === 0) return { text: `${date} · due today`, late: false };
  if (left < 0) return { text: `${date} · ${-left} ${left === -1 ? "day" : "days"} late`, late: true };
  return { text: `${date} · ${left} ${left === 1 ? "day" : "days"} left`, late: false };
}

/** A thin bar: how many of a space's tasks are done. Nothing when it has no tasks. */
export function SpaceProgress({ done, total, compact = false }: { done: number; total: number; compact?: boolean }) {
  const c = useThemeColors();
  if (total === 0) return null;
  return (
    <View className="flex-row items-center gap-2.5">
      <View
        className="bg-chip h-[6px] flex-1 overflow-hidden rounded-full"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
        accessibilityLabel="Tasks done"
      >
        <View style={{ width: `${(done / total) * 100}%`, height: "100%", backgroundColor: c.accent, borderRadius: 99 }} />
      </View>
      <Text style={TABULAR} className="text-ink-3 text-[12px] font-medium">
        {compact ? `${done}/${total}` : `${done} of ${total} tasks done`}
      </Text>
    </View>
  );
}

/**
 * Under a space's name: what it's for and when it should be done, plus its progress. Tap to set or
 * change them; with neither set, a quiet "Add a goal" link.
 */
export function SpaceGoal({ space, done, total }: { space: Space; done: number; total: number }) {
  const c = useThemeColors();
  const update = useUpdateSpace();
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(space.description ?? "");
  const anchor = useRef<View>(null);
  useEffect(() => setGoal(space.description ?? ""), [space.id, space.description]);

  const saveGoal = () => {
    const g = goal.trim().slice(0, 200) || null;
    if (g !== (space.description ?? null)) update.mutate({ id: space.id, patch: { description: g } });
  };
  const setDue = (due_date: string | null) => update.mutate({ id: space.id, patch: { due_date } });

  const has = !!space.description || !!space.due_date;
  const due = space.due_date ? deadlineLabel(space.due_date, today) : null;

  return (
    <View className="gap-2">
      <View ref={anchor} collapsable={false} className="self-start" style={{ maxWidth: "100%" }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={has ? "Change the goal and deadline" : "Add a goal and deadline"}
          className="hover:bg-chip -mx-1.5 flex-row items-center gap-1.5 rounded-[8px] px-1.5 py-1"
        >
          {has ? (
            <>
              <Flag size={13} color={due?.late ? c.high : c.ink3} strokeWidth={2.2} />
              {space.description ? (
                <Text numberOfLines={1} className="text-ink-2 flex-shrink text-[14px]">
                  {space.description}
                </Text>
              ) : null}
              {space.description && due ? <Text className="text-ink-3 text-[14px]">·</Text> : null}
              {due ? (
                <Text style={TABULAR} numberOfLines={1} className={`text-[13px] font-medium ${due.late ? "text-high" : "text-ink-3"}`}>
                  {due.text}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Plus size={13} color={c.ink3} strokeWidth={2.2} />
              <Text className="text-ink-3 text-[13px] font-medium">Add a goal</Text>
            </>
          )}
        </Pressable>
      </View>
      <SpaceProgress done={done} total={total} />

      <Popover
        anchorRef={anchor}
        open={open}
        onClose={() => {
          saveGoal();
          setOpen(false);
        }}
        width={300}
        accessibilityLabel="Goal and deadline"
      >
        <View className="p-3">
          <Text className="text-ink-3 mb-1 text-[12px] font-semibold">Goal</Text>
          <TextInput
            autoFocus={!space.description}
            value={goal}
            onChangeText={setGoal}
            onBlur={saveGoal}
            onSubmitEditing={saveGoal}
            placeholder="What's this space for? e.g. Ship v1.2"
            placeholderTextColor={c.ink3}
            maxLength={200}
            returnKeyType="done"
            className="bg-chip text-ink rounded-[8px] px-2.5 text-[14px]"
            style={{ paddingVertical: 8 }}
          />
          <View className="mb-1 mt-3 flex-row items-center">
            <Text className="text-ink-3 flex-1 text-[12px] font-semibold">Deadline</Text>
            {space.due_date ? (
              <Pressable onPress={() => setDue(null)} accessibilityRole="button" hitSlop={6}>
                <Text className="text-ink-3 text-[12px] font-medium">Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <MiniCalendar selected={space.due_date} today={today} onSelect={(d) => setDue(d === space.due_date ? null : d)} />
        </View>
      </Popover>
    </View>
  );
}
