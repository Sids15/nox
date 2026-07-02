import { dark } from "@nox/ui";
import { Pressable, Text, View } from "react-native";

/** Segmented control (handoff): chip track, 4px padding, active segment raised on `elev` with a
 *  soft shadow. The active label can be tinted (e.g. priority colors). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="bg-chip rounded-input flex-row p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 items-center rounded-[9px] py-2 ${active ? "bg-elev" : ""}`}
            style={
              active
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 3,
                  }
                : undefined
            }
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              className={`text-[13px] ${active ? "font-bold" : "font-semibold"}`}
              style={{ color: active ? (o.color ?? dark.ink) : dark.ink3 }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
