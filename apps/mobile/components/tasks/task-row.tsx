import { dark } from "@nox/ui";
import type { Task } from "@nox/types";
import { formatTime12, relativeDayLabel } from "@nox/utils";
import { Check, RotateCcw } from "lucide-react-native";
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
}: {
  task: Task;
  onToggle: () => void;
  onPress: () => void;
  /** Overdue rows show the relative due day + time in the coral overdue color. */
  overdue?: boolean;
}) {
  const complete = task.status === "complete";
  const time = formatTime12(task.due_time);
  const reminders = task.reminder_times.length;
  const carried = task.status === "carried_over";

  return (
    <Pressable onPress={onPress} className="bg-surface flex-row items-center px-4 py-3">
      <Pressable onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: complete }}>
        {complete ? (
          <View className="bg-accent h-[22px] w-[22px] items-center justify-center rounded-full">
            <Check size={14} color={dark.onAccent} strokeWidth={2.5} />
          </View>
        ) : (
          <View className="border-ink-3 h-[22px] w-[22px] rounded-full border-[1.5px]" />
        )}
      </Pressable>

      <View className="ml-3 flex-1">
        <Text
          numberOfLines={1}
          className={complete ? "text-ink-3 text-[15px] line-through" : "text-ink text-[15px]"}
        >
          {task.title}
        </Text>

        {(time || reminders > 0 || carried || overdue) && (
          <View className="mt-1 flex-row items-center">
            {carried && (
              <View className="bg-medium-soft mr-2 flex-row items-center rounded-[6px] px-1.5 py-0.5">
                <RotateCcw size={9} color={dark.medium} strokeWidth={2} />
                <Text className="text-medium ml-1 font-mono text-[9px] font-bold">CARRIED OVER</Text>
              </View>
            )}
            <Text className={`font-mono text-[11px] ${overdue ? "text-high" : "text-ink-3"}`}>
              {overdue ? `${relativeDayLabel(task.due_date ?? "")}${time ? " · " + time : ""}` : time}
            </Text>
            {reminders > 0 && (
              <Text className="text-ink-3 ml-2 font-mono text-[11px]">×{reminders}</Text>
            )}
          </View>
        )}
      </View>

      {!complete && <View className={`ml-3 h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />}
    </Pressable>
  );
}
