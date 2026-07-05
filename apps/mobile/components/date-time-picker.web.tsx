import { View } from "react-native";

export interface NoxDateTimePickerProps {
  value: Date;
  mode: "date" | "time";
  onChange: (d: Date) => void;
  theme?: "light" | "dark";
  textColor?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Web date/time picker — a native HTML input (rendered via ReactDOM in the web bundle). */
export function NoxDateTimePicker({ value, mode, onChange, textColor }: NoxDateTimePickerProps) {
  const asString =
    mode === "date"
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : `${pad(value.getHours())}:${pad(value.getMinutes())}`;

  return (
    <View style={{ alignItems: "center", paddingVertical: 12 }}>
      <input
        type={mode === "date" ? "date" : "time"}
        value={asString}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          const next = new Date(value);
          if (mode === "date") {
            const [y, m, d] = v.split("-").map(Number) as [number, number, number];
            next.setFullYear(y, m - 1, d);
          } else {
            const [h, min] = v.split(":").map(Number) as [number, number];
            next.setHours(h, min, 0, 0);
          }
          onChange(next);
        }}
        style={{
          fontSize: 18,
          padding: 12,
          background: "transparent",
          color: textColor ?? "#fff",
          border: "none",
          colorScheme: "dark",
        }}
      />
    </View>
  );
}
