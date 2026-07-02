import { dark } from "@nox/ui";
import { Check, Trash2 } from "lucide-react-native";
import { useRef, type ReactNode } from "react";
import { Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

function CompleteAction() {
  return (
    <View className="bg-success w-[92px] flex-row items-center justify-center">
      <Check size={18} color={dark.onAccent} strokeWidth={2.5} />
      <Text className="ml-1 font-mono text-[10px] font-bold text-white">Done</Text>
    </View>
  );
}

function DeleteAction() {
  return (
    <View className="bg-high w-[92px] flex-row items-center justify-center">
      <Trash2 size={18} color={dark.onAccent} strokeWidth={2} />
      <Text className="ml-1 font-mono text-[10px] font-bold text-white">Delete</Text>
    </View>
  );
}

/**
 * Wraps a task row with swipe actions (handoff): swipe right reveals green "Done" (complete),
 * swipe left reveals coral "Delete". Past the threshold the action fires; complete then springs
 * the row closed (it stays in place, struck through), delete removes it from the list.
 */
export function SwipeableTaskRow({
  onComplete,
  onDelete,
  children,
}: {
  onComplete: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => <CompleteAction />}
      renderRightActions={() => <DeleteAction />}
      onSwipeableOpen={(direction) => {
        if (direction === "left") {
          onComplete();
          ref.current?.close();
        } else {
          onDelete();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
