import { Pressable, Text, View } from "react-native";
import { DropdownChip } from "../dropdown-chip";

export type IdeaStatusFilter = "all" | "raw" | "exploring" | "validating" | "complete";
export type IdeaPriorityFilter = "all" | "low" | "medium" | "high" | "critical";

export interface IdeaFiltersState {
  status: IdeaStatusFilter;
  priority: IdeaPriorityFilter;
}

export const DEFAULT_IDEA_FILTERS: IdeaFiltersState = { status: "all", priority: "all" };

const STATUS_OPTS: { value: IdeaStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "raw", label: "Raw" },
  { value: "exploring", label: "Exploring" },
  { value: "validating", label: "Validating" },
  { value: "complete", label: "Complete" },
];
const PRIORITY_OPTS: { value: IdeaPriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

/** Ideas filter row (handoff): an "All" reset chip + Status / Priority dropdowns. */
export function IdeaFilters({
  filters,
  onChange,
}: {
  filters: IdeaFiltersState;
  onChange: (next: IdeaFiltersState) => void;
}) {
  const allActive = filters.status === "all" && filters.priority === "all";

  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={() => onChange(DEFAULT_IDEA_FILTERS)}
        className={`rounded-pill border px-4 py-2 ${
          allActive ? "bg-accent border-transparent" : "border-line bg-chip"
        }`}
      >
        <Text
          className={`text-[12.5px] font-semibold ${allActive ? "text-on-accent" : "text-ink-2"}`}
        >
          All
        </Text>
      </Pressable>
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
    </View>
  );
}
