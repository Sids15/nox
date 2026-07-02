import { Pressable, Text, View } from "react-native";

export type StatusFilter = "all" | "active" | "completed";
export type PriorityFilter = "all" | "high" | "medium" | "low";
export type TimeFilter = "all" | "timed" | "allday";

export interface TaskFilters {
  status: StatusFilter;
  priority: PriorityFilter;
  time: TimeFilter;
}

export const DEFAULT_FILTERS: TaskFilters = { status: "all", priority: "all", time: "all" };

// Cycle order + display label per filter. Index 0 is the neutral ("all") state.
const STATUS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Status" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];
const PRIORITY: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "Priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const TIME: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "Time" },
  { value: "timed", label: "Timed" },
  { value: "allday", label: "All-day" },
];

function next<T extends { value: string }>(options: T[], current: string): T {
  const i = options.findIndex((o) => o.value === current);
  return options[(i + 1) % options.length]!;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-pill border px-3.5 py-2 ${
        active ? "border-accent-line bg-accent-soft" : "border-line bg-chip"
      }`}
    >
      <Text className={`text-[12.5px] font-semibold ${active ? "text-accent" : "text-ink-2"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Status / Priority / Time filters. Each chip cycles through its options on tap; a non-neutral
 *  value tints the chip with the accent. Filtering itself happens in the Tasks screen. */
export function FilterChips({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
}) {
  const status = STATUS.find((o) => o.value === filters.status)!;
  const priority = PRIORITY.find((o) => o.value === filters.priority)!;
  const time = TIME.find((o) => o.value === filters.time)!;

  return (
    <View className="flex-row gap-2">
      <Chip
        label={status.label}
        active={filters.status !== "all"}
        onPress={() => onChange({ ...filters, status: next(STATUS, filters.status).value })}
      />
      <Chip
        label={priority.label}
        active={filters.priority !== "all"}
        onPress={() => onChange({ ...filters, priority: next(PRIORITY, filters.priority).value })}
      />
      <Chip
        label={time.label}
        active={filters.time !== "all"}
        onPress={() => onChange({ ...filters, time: next(TIME, filters.time).value })}
      />
    </View>
  );
}
