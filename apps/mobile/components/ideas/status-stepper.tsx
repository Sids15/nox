import { useThemeColors } from "@nox/features";
import type { Idea } from "@nox/types";
import { Check } from "lucide-react-native";
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";

const STEPS: { value: Idea["status"]; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "exploring", label: "Exploring" },
  { value: "validating", label: "Validating" },
  { value: "complete", label: "Complete" },
];

/**
 * The 4-node status pipeline (Raw → Exploring → Validating → Complete). Done nodes show an accent
 * check, the current node is a filled accent dot with a halo, future nodes are outlined. Tapping a
 * node sets that status. (A "dropped" idea has no active step.)
 */
export function StatusStepper({
  status,
  onSelect,
}: {
  status: Idea["status"];
  onSelect: (status: Idea["status"]) => void;
}) {
  const c = useThemeColors();
  const current = STEPS.findIndex((s) => s.value === status);
  const halo = `${c.accent}38`; // accent @ ~22%

  return (
    <View className="border-line bg-surface rounded-card gap-3 border p-[14px]">
      <View className="flex-row items-center">
        {STEPS.map((s, i) => {
          const done = current > -1 && i < current;
          const isCurrent = i === current;
          const reached = current > -1 && i <= current;
          return (
            <Fragment key={s.value}>
              {i > 0 && (
                <View style={{ flex: 1, height: 2, backgroundColor: reached ? c.accent : c.line }} />
              )}
              <Pressable onPress={() => onSelect(s.value)} hitSlop={8}>
                {done ? (
                  <View
                    style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: halo }}
                    className="items-center justify-center"
                  >
                    <Check size={10} color={c.accent} strokeWidth={3} />
                  </View>
                ) : isCurrent ? (
                  <View
                    style={{ width: 30, height: 30, borderRadius: 99, backgroundColor: halo }}
                    className="items-center justify-center"
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: c.accent }} />
                  </View>
                ) : (
                  <View
                    style={{ width: 22, height: 22, borderRadius: 99, borderWidth: 2, borderColor: c.line }}
                  />
                )}
              </Pressable>
            </Fragment>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between">
        {STEPS.map((s, i) => (
          <Text
            key={s.value}
            className="text-[10.5px] font-semibold"
            style={{ color: i === current ? c.accent : c.ink3 }}
          >
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
