import { useThemeColors } from "@nox/features";
import type { Task } from "@nox/types";
import { capitalize, formatTime12, relativeDayLabel, todayKey } from "@nox/utils";
import { AlignLeft, Bell, Check, Repeat, RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { pressScale, TABULAR } from "../menu";

/**
 * One task in a list, in the flat style of Things and Todoist: no card around it, a hairline between
 * rows, the checkbox ringed in the priority colour (coral high, amber medium, neutral low), the title,
 * and one quiet line of details — when it is due, whether it repeats, its reminders, whether it has
 * notes. Opaque (page background) so the swipe-action panels behind it stay hidden until dragged.
 *
 * `timeGutter` puts the due time in a fixed left column instead of the details line, for the day's
 * "Scheduled" section, so the times read down the edge like an agenda.
 */
export function TaskRow({
  task,
  onToggle,
  onPress,
  overdue = false,
  selected = false,
  showDate = false,
  timeGutter = false,
}: {
  task: Task;
  onToggle: () => void;
  onPress: () => void;
  /** Coral date, for the Overdue section. */
  overdue?: boolean;
  /** Desktop master-detail: the row open in the editor pane. */
  selected?: boolean;
  /** Include the due day in the details (rows outside the focused day). */
  showDate?: boolean;
  timeGutter?: boolean;
}) {
  const c = useThemeColors();
  const complete = task.status === "complete";
  const time = formatTime12(task.due_time);
  const reminders = task.reminder_times.length;
  const carried = task.status === "carried_over";
  const recurring = task.repeat !== "none" || task.origin_task_id !== null;
  const ring = { high: c.high, medium: c.medium, low: c.ink3 }[task.priority];

  const day = task.due_date && (showDate || overdue) ? capitalize(relativeDayLabel(task.due_date, todayKey())) : null;
  const when = [day, timeGutter ? null : time].filter(Boolean).join(" · ");
  const hasMeta = !complete && (when || recurring || reminders > 0 || carried || task.notes);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${when ? `, ${when}` : ""}`}
      className={`min-h-[54px] flex-row items-center pr-3 ${selected ? "bg-accent/[0.1] rounded-[10px]" : "bg-bg hover:bg-surface"}`}
    >

      {timeGutter && (
        <Text
          style={TABULAR}
          className={`w-[68px] pl-1 text-[13px] font-semibold ${complete ? "text-ink-3" : "text-ink-2"}`}
          numberOfLines={1}
        >
          {time ?? ""}
        </Text>
      )}

      <Pressable
        onPress={onToggle}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: complete }}
        accessibilityLabel={`${complete ? "Mark not done" : "Mark done"}: ${task.title}, ${task.priority} priority`}
        style={pressScale}
        className={timeGutter ? "" : "ml-1"}
      >
        {complete ? (
          <View className="bg-accent h-[21px] w-[21px] items-center justify-center rounded-full">
            <Check size={11} color={c.onAccent} strokeWidth={3} />
          </View>
        ) : (
          <View
            className="h-[21px] w-[21px] rounded-full"
            style={{
              borderWidth: task.priority === "low" ? 1.5 : 2,
              borderColor: ring,
              backgroundColor: task.priority === "low" ? "transparent" : `${ring}1a`,
            }}
          />
        )}
      </Pressable>

      <View className="ml-3 flex-1 py-[9px]">
        <Text
          numberOfLines={2}
          className={`text-[15px] tracking-[-0.01em] ${complete ? "text-ink-3 line-through" : "text-ink font-medium"}`}
        >
          {task.title}
        </Text>

        {hasMeta && (
          <View className="mt-[3px] flex-row flex-wrap items-center gap-x-2.5 gap-y-1">
            {carried && (
              <View className="bg-medium/[0.13] flex-row items-center gap-1 rounded-[5px] px-1.5 py-[2px]">
                <RotateCcw size={9} color={c.medium} strokeWidth={2.2} />
                <Text className="text-medium text-[11px] font-semibold">Carried over</Text>
              </View>
            )}
            {when ? (
              <Text style={TABULAR} className={`text-[12px] font-medium ${overdue ? "text-high" : "text-ink-3"}`}>
                {when}
              </Text>
            ) : null}
            {recurring && <Repeat size={11} color={c.ink3} strokeWidth={2} />}
            {reminders > 0 && (
              <View className="flex-row items-center gap-0.5">
                <Bell size={11} color={c.ink3} strokeWidth={2} />
                {reminders > 1 && (
                  <Text style={TABULAR} className="text-ink-3 text-[12px]">
                    {reminders}
                  </Text>
                )}
              </View>
            )}
            {task.notes ? <AlignLeft size={11} color={c.ink3} strokeWidth={2} /> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
