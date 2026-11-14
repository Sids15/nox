import { useThemeColors } from "@nox/features";
import type { Idea } from "@nox/types";
import { relativeAge } from "@nox/utils";
import { Flag, Image as ImageIcon, Link2, Mic } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { TagChip } from "../tag-chip";
import { StatusPill } from "./status-pill";

const PRIORITY_LABEL: Record<Idea["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** An idea list card: priority label + status pill · title · optional description · tags + age. */
export function IdeaCard({
  idea,
  onPress,
  selected = false,
  showStatus = true,
}: {
  idea: Idea;
  onPress: () => void;
  selected?: boolean;
  /** Off where the surrounding column or section already names the status. */
  showStatus?: boolean;
}) {
  const c = useThemeColors();
  const priorityColor = { low: c.ink3, medium: c.medium, high: c.high, critical: c.critical }[
    idea.priority
  ];

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-card gap-2 border p-[14px] ${selected ? "border-accent/[0.6] bg-elev" : "border-line bg-surface hover:border-accent/[0.4]"}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Flag size={12} color={priorityColor} strokeWidth={2.2} fill={idea.priority === "low" ? "transparent" : priorityColor} />
          <Text style={{ color: priorityColor }} className="text-[12px] font-semibold">
            {PRIORITY_LABEL[idea.priority]}
          </Text>
        </View>
        {showStatus && <StatusPill status={idea.status} />}
      </View>

      <Text
        className="text-ink font-serif text-[17px] font-bold"
        style={{ lineHeight: 22 }}
      >
        {idea.title}
      </Text>

      {(() => {
        const para = (idea.content ?? []).find((b) => b.type === "paragraph" && b.text.trim() !== "");
        const preview = (para && "text" in para ? para.text : null) ?? idea.description;
        return preview ? (
          <Text numberOfLines={2} className="text-ink-2 text-[13px]" style={{ lineHeight: 19 }}>
            {preview}
          </Text>
        ) : null;
      })()}

      <View className="flex-row items-end gap-2">
        {/* Tags wrap within their own box so the age never gets pushed off the card. */}
        <View className="min-w-0 flex-1 flex-row flex-wrap gap-1.5">
          {idea.tags.slice(0, 3).map((t) => (
            <TagChip key={t} tag={t} size="sm" />
          ))}
        </View>
        {(() => {
          const has = (t: string) => (idea.content ?? []).some((b) => b.type === t);
          return (
            <View className="flex-row items-center gap-1.5">
              {has("audio") && <Mic size={12} color={c.ink3} strokeWidth={2} />}
              {has("image") && <ImageIcon size={12} color={c.ink3} strokeWidth={2} />}
              {has("link") && <Link2 size={12} color={c.ink3} strokeWidth={2} />}
              <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink-3 text-[11.5px]">
                {relativeAge(idea.updated_at)}
              </Text>
            </View>
          );
        })()}
      </View>
    </Pressable>
  );
}
