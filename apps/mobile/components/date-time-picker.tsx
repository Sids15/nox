import RNDateTimePicker from "@react-native-community/datetimepicker";

export interface NoxDateTimePickerProps {
  value: Date;
  mode: "date" | "time";
  onChange: (d: Date) => void;
  theme?: "light" | "dark";
  textColor?: string;
}

/** Native date/time picker (spinner) wrapping the community component. */
export function NoxDateTimePicker({ value, mode, onChange, theme, textColor }: NoxDateTimePickerProps) {
  return (
    <RNDateTimePicker
      value={value}
      mode={mode}
      display="spinner"
      themeVariant={theme}
      textColor={textColor}
      onChange={(_event, selected) => {
        if (selected) onChange(selected);
      }}
    />
  );
}
