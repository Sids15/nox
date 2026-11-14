import { useThemeColors } from "@nox/features";
import { priorityLevels, type Idea } from "@nox/types";
import { capitalize, relativeFromNow, shortDate } from "@nox/utils";
import { ChevronDown, Flag, Plus, X } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { MenuRow, pressScale } from "../menu";
import { Popover } from "../popover";

type Stage = "raw" | "exploring" | "validating" | "complete";
const STAGES: { key: Stage; hint: string }[] = [
  { key: "raw", hint: "Just caught" },
  { key: "exploring", hint: "Thinking it through" },
  { key: "validating", hint: "Testing it" },
  { key: "complete", hint: "Done or shipped" },
];

/** One line of the properties list: a fixed label column, then the value. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-h-[38px] flex-row items-center">
      <Text className="text-ink-3 w-[92px] text-[13.5px]">{label}</Text>
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">{children}</View>
    </View>
  );
}

/** A value that opens a menu: quiet until hovered, like Notion's and Linear's property fields. */
function Trigger({
  innerRef,
  onPress,
  open,
  label,
  children,
}: {
  innerRef: React.RefObject<View | null>;
  onPress: () => void;
  open: boolean;
  label: string;
  children: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <View ref={innerRef} collapsable={false}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={pressScale}
        className={`-ml-2 h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${open ? "bg-chip" : "hover:bg-chip"}`}
      >
        {children}
        <ChevronDown size={13} color={c.ink3} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/**
 * The idea's properties as a compact list under the title — Status, Priority, Tags, then the dates —
 * replacing the full-width stepper card and segmented control that pushed the writing off the screen.
 */
export function IdeaProperties({
  idea,
  onStatus,
  onPriority,
  onTags,
}: {
  idea: Idea;
  onStatus: (s: Stage) => void;
  onPriority: (p: Idea["priority"]) => void;
  onTags: (tags: string[]) => void;
}) {
  const c = useThemeColors();
  const statusRef = useRef<View>(null);
  const priorityRef = useRef<View>(null);
  const [menu, setMenu] = useState<"status" | "priority" | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const stageTint: Record<Stage, string> = { raw: c.ink3, exploring: c.info, validating: c.success, complete: c.accent };
  const priorityColor: Record<Idea["priority"], string> = { low: c.ink3, medium: c.medium, high: c.high, critical: c.critical };
  const stage = (STAGES.some((s) => s.key === idea.status) ? idea.status : "raw") as Stage;
  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  const commitTag = () => {
    const name = draft.trim().replace(/^#/, "").toLowerCase().slice(0, 32);
    if (name && !idea.tags.includes(name)) onTags([...idea.tags, name]);
    setDraft("");
  };

  return (
    <View className="mt-4">
      <Row label="Status">
        <Trigger innerRef={statusRef} open={menu === "status"} onPress={() => setMenu("status")} label={`Status: ${capitalize(stage)}`}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: stageTint[stage] }} />
          <Text className="text-ink text-[14px] font-medium">{capitalize(stage)}</Text>
          {/* Where it sits in the pipeline, at a glance. */}
          <View className="ml-1 flex-row gap-[3px]" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {STAGES.map((s, i) => (
              <View key={s.key} className="h-[4px] w-[12px] rounded-full" style={{ backgroundColor: i <= stageIndex ? stageTint[stage] : c.line }} />
            ))}
          </View>
        </Trigger>
      </Row>

      <Row label="Priority">
        <Trigger innerRef={priorityRef} open={menu === "priority"} onPress={() => setMenu("priority")} label={`Priority: ${capitalize(idea.priority)}`}>
          <Flag
            size={13}
            color={priorityColor[idea.priority]}
            fill={idea.priority === "low" ? "transparent" : priorityColor[idea.priority]}
            strokeWidth={2.2}
          />
          <Text className="text-ink text-[14px] font-medium">{capitalize(idea.priority)}</Text>
        </Trigger>
      </Row>

      <Row label="Tags">
        {idea.tags.map((t) => (
          <Pressable
            key={t}
            onPress={() => onTags(idea.tags.filter((x) => x !== t))}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${t}`}
            className="bg-chip group flex-row items-center gap-1 rounded-[7px] py-1 pl-2 pr-1.5"
          >
            <Text className="text-ink-2 text-[12.5px] font-medium">#{t}</Text>
            <X size={11} color={c.ink3} strokeWidth={2.4} />
          </Pressable>
        ))}
        {adding ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commitTag}
            onBlur={() => {
              commitTag();
              setAdding(false);
            }}
            placeholder="tag name"
            placeholderTextColor={c.ink3}
            submitBehavior="submit"
            autoCapitalize="none"
            accessibilityLabel="New tag"
            className="text-ink border-accent h-[26px] min-w-[90px] rounded-[7px] border px-2 text-[12.5px]"
            style={{ paddingVertical: 0, outlineWidth: 0 } as object}
          />
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel="Add tag"
            className="hover:bg-chip flex-row items-center gap-1 rounded-[7px] px-1.5 py-1"
          >
            <Plus size={12} color={c.ink3} strokeWidth={2.2} />
            <Text className="text-ink-3 text-[12.5px] font-medium">{idea.tags.length ? "Add" : "Add a tag"}</Text>
          </Pressable>
        )}
      </Row>

      <Row label="Created">
        <Text className="text-ink-2 text-[13.5px]">
          {shortDate(idea.created_at)} <Text className="text-ink-3">· updated {relativeFromNow(idea.updated_at)}</Text>
        </Text>
      </Row>

      <Popover anchorRef={statusRef} open={menu === "status"} onClose={() => setMenu(null)} width={300} accessibilityLabel="Status">
        <View className="p-1.5">
          {STAGES.map((s) => (
            <MenuRow
              key={s.key}
              label={capitalize(s.key)}
              hint={s.hint}
              selected={stage === s.key}
              icon={<View className="h-2 w-2 rounded-full" style={{ backgroundColor: stageTint[s.key] }} />}
              onPress={() => {
                setMenu(null);
                if (s.key !== stage) onStatus(s.key);
              }}
            />
          ))}
        </View>
      </Popover>

      <Popover anchorRef={priorityRef} open={menu === "priority"} onClose={() => setMenu(null)} width={210} accessibilityLabel="Priority">
        <View className="p-1.5">
          {[...priorityLevels].reverse().map((p) => (
            <MenuRow
              key={p}
              label={capitalize(p)}
              selected={idea.priority === p}
              icon={<Flag size={13} color={priorityColor[p]} fill={p === "low" ? "transparent" : priorityColor[p]} strokeWidth={2.2} />}
              onPress={() => {
                setMenu(null);
                if (p !== idea.priority) onPriority(p);
              }}
            />
          ))}
        </View>
      </Popover>
    </View>
  );
}
