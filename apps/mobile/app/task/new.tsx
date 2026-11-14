import { todayKey } from "@nox/utils";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sidebar } from "../../components/sidebar";
import { TaskComposer } from "../../components/tasks/task-composer";
import { goBack } from "../../lib/go-back";
import { useIsDesktop } from "../../lib/use-responsive";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * New-task screen (phones; desktop composes in the Tasks pane instead). `?date=YYYY-MM-DD` starts the
 * task on the day focused in the week strip. A static route, so it wins over /task/[id].
 */
export default function NewTaskScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const isDesktop = useIsDesktop();
  const initialDate = date && DATE_KEY.test(date) ? date : todayKey();

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">
          <TaskComposer initialDate={initialDate} onDone={() => goBack("/tasks")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
