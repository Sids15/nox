import { View } from "react-native";
import { DropdownChip } from "../dropdown-chip";

export type StatusFilter = "all" | "active" | "completed";
export type PriorityFilter = "all" | "high" | "medium" | "low";
export type TimeFilter = "all" | "timed" | "allday";

export interface TaskFilters {
  status: StatusFilter;
  priority: PriorityFilter;
  time: TimeFilter;
}

export const DEFAULT_FILTERS: TaskFilters = { status: "all", priority: "all", time: "all" };

const STATUS_OPTS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];
const PRIORITY_OPTS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const TIME_OPTS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "timed", label: "Timed" },
  { value: "allday", label: "All-day" },
];

/** Status / Priority / Time filters — each chip keeps its category label and turns accent when a
 *  non-default value is active. Filtering itself happens in the Tasks screen. */
export function FilterChips({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
}) {
  return (
    <View className="flex-row gap-2">
      <DropdownChip
        label="Status"
        value={filters.status}
        options={STATUS_OPTS}
        onSelect={(status) => onChange({ ...filters, status })}
        showChevron
      />
      <DropdownChip
        label="Priority"
        value={filters.priority}
        options={PRIORITY_OPTS}
        onSelect={(priority) => onChange({ ...filters, priority })}
        showChevron
      />
      <DropdownChip
        label="Time"
        value={filters.time}
        options={TIME_OPTS}
        onSelect={(time) => onChange({ ...filters, time })}
        showChevron
      />
    </View>
  );
}
