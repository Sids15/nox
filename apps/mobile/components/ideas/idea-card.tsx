import { useThemeColors } from "@nox/features";
import type { Idea } from "@nox/types";
import { relativeAge } from "@nox/utils";
import { Pressable, Text, View } from "react-native";
import { TagChip } from "../tag-chip";
import { StatusPill } from "./status-pill";

const PRIORITY_LABEL: Record<Idea["priority"], string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

/** An idea list card: priority label + status pill · title · optional description · tags + age. */
export function IdeaCard({ idea, onPress }: { idea: Idea; onPress: () => void }) {
  const c = useThemeColors();
  const priorityColor = { low: c.ink3, medium: c.medium, high: c.high, critical: c.critical }[
    idea.priority
  ];

  return (
    <Pressable onPress={onPress} className="border-line bg-surface rounded-card gap-2 border p-[14px]">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: priorityColor }} />
          <Text
            style={{ color: priorityColor }}
            className="font-mono text-[10px] font-semibold tracking-[0.1em]"
          >
            {PRIORITY_LABEL[idea.priority]}
          </Text>
        </View>
        <StatusPill status={idea.status} />
      </View>

      <Text
        className="text-ink text-[15.5px] font-semibold tracking-[-0.01em]"
        style={{ lineHeight: 20 }}
      >
        {idea.title}
      </Text>

      {(() => {
        const para = idea.content.find((b) => b.type === "paragraph" && b.text.trim() !== "");
        const preview = (para && "text" in para ? para.text : null) ?? idea.description;
        return preview ? (
          <Text numberOfLines={2} className="text-ink-2 text-[13px]" style={{ lineHeight: 19 }}>
            {preview}
          </Text>
        ) : null;
      })()}

      <View className="flex-row items-center gap-1.5">
        {idea.tags.slice(0, 3).map((t) => (
          <TagChip key={t} tag={t} />
        ))}
        <View className="flex-1" />
        <Text className="text-ink-3 font-mono text-[10.5px]">{relativeAge(idea.updated_at)}</Text>
      </View>
    </Pressable>
  );
}
