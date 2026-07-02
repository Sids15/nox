import { useDeleteTask, useTasks, useToggleTask } from "@nox/features";
import { dark } from "@nox/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Task Detail — minimal for now (back · complete · delete). The full handoff screen (schedule,
 * reminders, repeat, priority segmented control, notes) lands in the next slice.
 */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: tasks = [] } = useTasks();
  const task = tasks.find((t) => t.id === id);
  const toggle = useToggleTask();
  const del = useDeleteTask();

  const goBack = () => router.back();

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="px-screen flex-1 pt-2">
        <Pressable
          onPress={goBack}
          hitSlop={8}
          accessibilityLabel="Go back"
          className="bg-chip rounded-pill -ml-1 h-9 w-9 items-center justify-center"
        >
          <ChevronLeft size={22} color={dark.ink} strokeWidth={1.7} />
        </Pressable>

        {!task ? (
          <Text className="text-ink-2 mt-8 text-[15px]">Task not found.</Text>
        ) : (
          <>
            <View className="mt-6 flex-row items-start">
              <Pressable
                onPress={() =>
                  toggle.mutate({
                    id: task.id,
                    status: task.status === "complete" ? "pending" : "complete",
                  })
                }
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: task.status === "complete" }}
                className="mt-1"
              >
                {task.status === "complete" ? (
                  <View className="bg-accent h-[26px] w-[26px] items-center justify-center rounded-full">
                    <Check size={16} color={dark.onAccent} strokeWidth={2.5} />
                  </View>
                ) : (
                  <View className="border-ink-3 h-[26px] w-[26px] rounded-full border-[1.5px]" />
                )}
              </Pressable>
              <Text
                className={`ml-3 flex-1 text-[22px] font-bold ${
                  task.status === "complete" ? "text-ink-3 line-through" : "text-ink"
                }`}
              >
                {task.title}
              </Text>
            </View>

            {task.notes ? (
              <Text className="text-ink-2 mt-6 text-[15px] leading-6">{task.notes}</Text>
            ) : null}

            <Pressable
              onPress={() => {
                del.mutate(task.id);
                goBack();
              }}
              className="bg-high-soft rounded-input mt-10 items-center py-3"
            >
              <Text className="text-high font-semibold">Delete task</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
