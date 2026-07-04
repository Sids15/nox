import { Check, RotateCcw, Trash2 } from "lucide-react-native";
import { useRef, type ReactNode } from "react";
import { Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

function CompleteAction({ completed }: { completed: boolean }) {
  return (
    <View className="bg-success w-[76px] flex-col items-center justify-center gap-1">
      {completed ? (
        <RotateCcw size={17} color="#FFFFFF" strokeWidth={2.2} />
      ) : (
        <Check size={17} color="#FFFFFF" strokeWidth={2.2} />
      )}
      <Text className="text-[10px] font-bold text-white">{completed ? "Undo" : "Done"}</Text>
    </View>
  );
}

function DeleteAction() {
  return (
    <View className="bg-high w-[76px] flex-col items-center justify-center gap-1">
      <Trash2 size={17} color="#FFFFFF" strokeWidth={1.8} />
      <Text className="text-[10px] font-bold text-white">Delete</Text>
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
  completed,
  children,
}: {
  onComplete: () => void;
  onDelete: () => void;
  /** When already complete, the green action reads "Undo" and un-completes the task. */
  completed: boolean;
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
      renderLeftActions={() => <CompleteAction completed={completed} />}
      renderRightActions={() => <DeleteAction />}
      onSwipeableOpen={(direction) => {
        // Swipe toward the coral panel deletes (removes the task); swipe toward the green panel
        // completes (strikes it through and springs back).
        if (direction === "left") {
          onDelete();
        } else {
          onComplete();
          ref.current?.close();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
