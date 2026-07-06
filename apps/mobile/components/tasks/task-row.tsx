import { useThemeColors } from "@nox/features";
import type { Task } from "@nox/types";
import { formatTime12, relativeDayLabel } from "@nox/utils";
import { Bell, Check, Repeat, RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-ink-3",
};

/** A single task row: completion circle · title (+ meta) · priority dot. Opaque background so the
 *  swipe-action panels behind it stay hidden until the row is dragged. */
export function TaskRow({
  task,
  onToggle,
  onPress,
  overdue = false,
  selected = false,
}: {
  task: Task;
  onToggle: () => void;
  onPress: () => void;
  /** Overdue rows show the relative due day + time in the coral overdue color. */
  overdue?: boolean;
  /** Desktop master-detail: the row currently open in the editor pane (accent rail + raised fill). */
  selected?: boolean;
}) {
  const c = useThemeColors();
  const complete = task.status === "complete";
  const time = formatTime12(task.due_time);
  const reminders = task.reminder_times.length;
  const carried = task.status === "carried_over";
  const recurring = task.repeat !== "none" || task.origin_task_id !== null;

  return (
    <Pressable onPress={onPress} className={`min-h-[58px] flex-row items-center px-[14px] ${selected ? "bg-elev" : "bg-surface hover:bg-elev"}`}>
      {selected && <View className="bg-accent absolute bottom-0 left-0 top-0 w-[2px]" />}
      <Pressable onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: complete }}>
        {complete ? (
          <View className="bg-accent h-[22px] w-[22px] items-center justify-center rounded-full">
            <Check size={11} color={c.onAccent} strokeWidth={3} />
          </View>
        ) : (
          <View className="border-ink-3 h-[22px] w-[22px] rounded-full border-[1.5px]" />
        )}
      </Pressable>

      <View className="ml-3 flex-1">
        <Text
          numberOfLines={1}
          className={
            complete
              ? "text-ink-3 text-[15px] font-medium tracking-[-0.01em] line-through"
              : "text-ink text-[15px] font-medium tracking-[-0.01em]"
          }
        >
          {task.title}
        </Text>

        {!complete && (carried || time || reminders > 0 || overdue || recurring) && (
          <View className="mt-[3px] flex-row items-center">
            {carried && (
              <View className="bg-medium/[0.13] mr-2 flex-row items-center rounded-[6px] px-2 py-1">
                <RotateCcw size={9} color={c.medium} strokeWidth={2} />
                <Text className="text-medium ml-1 font-mono text-[10px] font-medium">CARRIED OVER</Text>
              </View>
            )}
            {recurring && <Repeat size={11} color={c.ink3} strokeWidth={2} style={{ marginRight: 6 }} />}
            <Text className={`font-mono text-[11px] font-medium ${overdue ? "text-high" : "text-ink-2"}`}>
              {overdue ? `${relativeDayLabel(task.due_date ?? "")}${time ? " · " + time : ""}` : time}
            </Text>
            {reminders > 0 && (
              <View className="ml-2 flex-row items-center">
                <Bell size={11} color={c.ink3} strokeWidth={2} />
                <Text className="text-ink-3 ml-1 font-mono text-[11px] font-medium">×{reminders}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {!complete && <View className={`ml-3 h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />}
    </Pressable>
  );
}
