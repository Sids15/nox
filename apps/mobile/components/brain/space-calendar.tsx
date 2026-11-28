import { useThemeColors } from "@nox/features";
import type { Property, Space } from "@nox/types";
import { capitalize, relativeDayLabel, toDateKey, todayKey } from "@nox/utils";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useIsDesktop } from "../../lib/use-responsive";
import { TABULAR } from "../menu";
import { KindIcon } from "./kind-icon";
import { openRef, usePages, type Page } from "./pages";
import { useQuickAdd } from "./use-quick-add";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

interface Dated {
  page: Page;
  date: string;
  done: boolean;
}

/** A page's date on the calendar: its first filled-in date field (e.g. "Publish date"). */
function pageDate(props: Property[]): string | null {
  for (const p of props)
    if (
      p.type === "date" &&
      typeof p.value === "string" &&
      DAY_KEY.test(p.value)
    )
      return p.value;
  return null;
}

/**
 * A month of this space: tasks on their due day, notes and ideas on their date field (a video's
 * publish date, a PRD's target date). Tap a day to see what's on it.
 */
export function SpaceCalendar({ space }: { space: Space }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const today = todayKey();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [picked, setPicked] = useState<string>(today);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<"task" | "idea">("task");
  const quickAdd = useQuickAdd();
  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    setDraft("");
    void quickAdd(raw, kind, { spaceId: space.id, date: picked });
  };

  const byDay = useMemo(() => {
    const m = new Map<string, Dated[]>();
    const put = (d: Dated) => m.set(d.date, [...(m.get(d.date) ?? []), d]);
    for (const t of pages.tasks) {
      if (
        t.space_id !== space.id ||
        t.deleted ||
        !t.due_date ||
        (t.repeat !== "none" && t.origin_task_id === null)
      )
        continue;
      const page = pages.find({ kind: "task", id: t.id });
      if (page) put({ page, date: t.due_date, done: t.status === "complete" });
    }
    for (const n of pages.notes) {
      const date =
        n.space_id === space.id && !n.is_archived
          ? pageDate(n.properties)
          : null;
      const page = date ? pages.find({ kind: "note", id: n.id }) : undefined;
      if (date && page) put({ page, date, done: false });
    }
    for (const i of pages.ideas) {
      const date =
        i.space_id === space.id && !i.is_archived && i.status !== "dropped"
          ? pageDate(i.properties)
          : null;
      const page = date ? pages.find({ kind: "idea", id: i.id }) : undefined;
      if (date && page) put({ page, date, done: false });
    }
    return m;
  }, [pages, space.id]);

  // The month's grid: whole weeks, Sunday first, with the edges of the months around it.
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(y, mo - 1, 1);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) =>
    toDateKey(new Date(y, mo - 1, 1 - first.getDay() + i)),
  );
  const shift = (n: number) =>
    setMonth(toDateKey(new Date(y, mo - 1 + n, 1)).slice(0, 7));
  const label = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const dayItems = byDay.get(picked) ?? [];
  const cellH = isDesktop ? 92 : 50;

  return (
    <View>
      <View className="mb-2 flex-row items-center gap-1">
        <Text className="text-ink flex-1 text-[16px] font-semibold">
          {label}
        </Text>
        <Pressable
          onPress={() => {
            setMonth(today.slice(0, 7));
            setPicked(today);
          }}
          accessibilityRole="button"
          className="hover:bg-chip rounded-[8px] px-2.5 py-1"
        >
          <Text className="text-ink-2 text-[13px] font-medium">Today</Text>
        </Pressable>
        <Pressable
          onPress={() => shift(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]"
        >
          <ChevronLeft size={16} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          onPress={() => shift(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]"
        >
          <ChevronRight size={16} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View className="border-line overflow-hidden rounded-[12px] border">
        <View className="bg-surface border-line flex-row border-b">
          {WEEK.map((d) => (
            <Text
              key={d}
              className="text-ink-3 flex-1 py-1.5 text-center text-[11px] font-semibold"
            >
              {isDesktop ? d : d[0]}
            </Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, w) => (
          <View
            key={w}
            className={`flex-row ${w > 0 ? "border-line border-t" : ""}`}
          >
            {cells.slice(w * 7, w * 7 + 7).map((key, i) => {
              const items = byDay.get(key) ?? [];
              const inMonth = key.startsWith(month);
              const on = key === picked;
              const isToday = key === today;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPicked(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${key}, ${items.length} items`}
                  className={`flex-1 p-1 ${i > 0 ? "border-line border-l" : ""} ${on ? "bg-accent/[0.08]" : "hover:bg-chip"}`}
                  style={{ height: cellH, opacity: inMonth ? 1 : 0.45 }}
                >
                  <View
                    className={`h-[20px] w-[20px] items-center justify-center rounded-full ${isToday ? "bg-accent" : ""}`}
                  >
                    <Text
                      style={TABULAR}
                      className={`text-[11px] font-semibold ${isToday ? "text-on-accent" : "text-ink-2"}`}
                    >
                      {Number(key.slice(8))}
                    </Text>
                  </View>
                  {isDesktop ? (
                    <View className="mt-0.5 gap-[2px]">
                      {items.slice(0, 3).map((d) => (
                        <Text
                          key={`${d.page.kind}:${d.page.id}`}
                          numberOfLines={1}
                          className={`text-[11px] ${d.done ? "text-ink-3 line-through" : "text-ink-2"}`}
                        >
                          {d.page.title}
                        </Text>
                      ))}
                      {items.length > 3 ? (
                        <Text className="text-ink-3 text-[11px]">
                          +{items.length - 3} more
                        </Text>
                      ) : null}
                    </View>
                  ) : items.length > 0 ? (
                    <View className="mt-1 flex-row justify-center gap-[3px]">
                      {items.slice(0, 3).map((d) => (
                        <View
                          key={`${d.page.kind}:${d.page.id}`}
                          className="h-[5px] w-[5px] rounded-full"
                          style={{
                            backgroundColor: d.done ? c.ink3 : c.accent,
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* The picked day, and adding straight onto it. */}
      <Text className="text-ink-3 mb-1 mt-4 text-[12px] font-semibold">
        {capitalize(relativeDayLabel(picked, today))}
      </Text>
      <View className="bg-surface border-line mb-1 flex-row items-center gap-1 rounded-[10px] border py-1 pl-3 pr-1">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={`Add ${kind === "task" ? "a task" : "an idea"} on ${relativeDayLabel(picked, today)}…`}
          placeholderTextColor={c.ink3}
          returnKeyType="done"
          maxLength={200}
          accessibilityLabel="Add on this day"
          className="text-ink flex-1 text-[14px]"
          style={{ paddingVertical: 6 }}
        />
        {(["task", "idea"] as const).map((k) => (
          <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="radio" accessibilityState={{ checked: kind === k }} className={`h-[28px] flex-row items-center gap-1 rounded-[8px] px-2 ${kind === k ? "bg-accent/[0.12]" : "hover:bg-chip"}`}>
            <KindIcon kind={k} color={kind === k ? c.accent : c.ink3} size={13} />
            {isDesktop ? <Text className={`text-[13px] font-medium ${kind === k ? "text-accent" : "text-ink-3"}`}>{k === "task" ? "Task" : "Idea"}</Text> : null}
          </Pressable>
        ))}
      </View>
      {dayItems.length === 0 ? (
        <Text className="text-ink-3 mt-1 text-[13px]">Nothing on this day yet. Plan when things happen here: a filming day, a publish date, a deadline.</Text>
      ) : (
        dayItems.map((d) => (
          <Pressable
            key={`${d.page.kind}:${d.page.id}`}
            onPress={() => openRef(d.page)}
            accessibilityRole="link"
            className="hover:bg-chip -mx-2 flex-row items-center gap-2.5 rounded-[8px] px-2 py-2"
          >
            <KindIcon kind={d.page.kind} color={c.ink3} size={14} />
            <Text
              numberOfLines={1}
              className={`flex-1 text-[14px] ${d.done ? "text-ink-3 line-through" : "text-ink"}`}
            >
              {d.page.title}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
