import { inboxItems, usePrefs, useThemeColors } from "@nox/features";
import { addDays, todayKey } from "@nox/utils";
import { router } from "expo-router";
import { CalendarCheck, CalendarClock, ChartColumn, Inbox, LayoutGrid, Mic, Timer } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePages } from "./brain/pages";
import { MenuRow, pressScale, TABULAR } from "./menu";
import { Popover } from "./popover";
import { PlanWeekSheet } from "./tasks/plan-week-sheet";

/**
 * Phones: the pages around your tasks (Inbox, Plan my week, Focus, Review, Insights) in one header button. It shows
 * how many things wait in the Inbox, or a dot when a weekly review is due. Desktop has them in the sidebar.
 */
export function PlanMenu() {
  const c = useThemeColors();
  const pages = usePages();
  const inbox = useMemo(() => inboxItems(pages).length, [pages]);
  const lastReviewed = usePrefs((s) => s.lastReviewed);
  const reviewDue = !lastReviewed || lastReviewed <= addDays(todayKey(), -7);
  const [open, setOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const ref = useRef<View>(null);

  const go = (path: string) => {
    setOpen(false);
    router.push(path as never);
  };

  return (
    <>
      <View ref={ref} collapsable={false}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Plan: Inbox${inbox ? ` (${inbox} to sort)` : ""}, Focus, Review, Insights`}
          style={pressScale}
          className="hover:bg-chip h-[34px] flex-row items-center gap-1 rounded-[10px] px-2"
        >
          <LayoutGrid size={17} color={c.ink2} strokeWidth={2} />
          {inbox > 0 ? (
            <View className="bg-accent min-w-[18px] items-center rounded-full px-1">
              <Text style={TABULAR} className="text-on-accent text-[11px] font-bold">
                {inbox}
              </Text>
            </View>
          ) : reviewDue ? (
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} />
          ) : null}
        </Pressable>
      </View>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={230} accessibilityLabel="Plan">
        <View className="p-1.5">
          <MenuRow label="Inbox" hint={inbox ? String(inbox) : undefined} icon={<Inbox size={15} color={c.ink2} strokeWidth={2} />} onPress={() => go("/inbox")} />
          <MenuRow label="Brain dump" icon={<Mic size={15} color={c.ink2} strokeWidth={2} />} onPress={() => go("/dump")} />
          <MenuRow
            label="Plan my week"
            icon={<CalendarClock size={15} color={c.ink2} strokeWidth={2} />}
            onPress={() => {
              setOpen(false);
              setPlanning(true);
            }}
          />
          <MenuRow label="Focus" icon={<Timer size={15} color={c.ink2} strokeWidth={2} />} onPress={() => go("/focus")} />
          <MenuRow label="Weekly review" hint={reviewDue ? "Due" : undefined} icon={<CalendarCheck size={15} color={c.ink2} strokeWidth={2} />} onPress={() => go("/review")} />
          <MenuRow label="Insights" icon={<ChartColumn size={15} color={c.ink2} strokeWidth={2} />} onPress={() => go("/insights")} />
        </View>
      </Popover>
      <PlanWeekSheet visible={planning} onClose={() => setPlanning(false)} />
    </>
  );
}
