import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

export type StatusFilter = "all" | "active" | "completed";
export type PriorityFilter = "all" | "high" | "medium" | "low";
export type TimeFilter = "all" | "timed" | "allday";

export interface TaskFilters {
  status: StatusFilter;
  priority: PriorityFilter;
  time: TimeFilter;
}

export const DEFAULT_FILTERS: TaskFilters = { status: "all", priority: "all", time: "all" };

// Dropdown options per filter. "all" is the neutral reset.
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

/** A filter chip that keeps its category label (Status/Priority/Time) and opens a small dropdown to
 *  pick a value. The chip turns accent when a non-default value is active — matching the handoff. */
function Chip<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  const active = value !== "all";
  const ref = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const openMenu = () => {
    ref.current?.measureInWindow((x, y, _w, h) => {
      setPos({ x, y: y + h + 6 });
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable
        ref={ref}
        onPress={openMenu}
        className={`rounded-pill border px-4 py-2 ${
          active ? "border-accent/[0.45] bg-accent/[0.14]" : "border-line bg-chip"
        }`}
      >
        <Text className={`text-[12.5px] font-semibold ${active ? "text-accent" : "text-ink-2"}`}>
          {label}
        </Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              minWidth: 150,
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            }}
            className="border-line bg-elev rounded-input overflow-hidden border py-1"
          >
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className="px-4 py-2.5"
              >
                <Text
                  className={`text-[13.5px] ${
                    o.value === value ? "text-accent font-semibold" : "text-ink"
                  }`}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Status / Priority / Time filters. Filtering itself happens in the Tasks screen. */
export function FilterChips({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
}) {
  return (
    <View className="flex-row gap-2">
      <Chip
        label="Status"
        value={filters.status}
        options={STATUS_OPTS}
        onSelect={(status) => onChange({ ...filters, status })}
      />
      <Chip
        label="Priority"
        value={filters.priority}
        options={PRIORITY_OPTS}
        onSelect={(priority) => onChange({ ...filters, priority })}
      />
      <Chip
        label="Time"
        value={filters.time}
        options={TIME_OPTS}
        onSelect={(time) => onChange({ ...filters, time })}
      />
    </View>
  );
}
