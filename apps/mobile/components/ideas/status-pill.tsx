import type { Idea } from "@nox/types";
import { Text, View } from "react-native";

const LABEL: Record<Idea["status"], string> = {
  raw: "Raw",
  exploring: "Exploring",
  validating: "Validating",
  complete: "Complete",
  dropped: "Dropped",
};

// Tinted per status (semantic soft companions from the preset).
const STYLE: Record<Idea["status"], { bg: string; text: string }> = {
  raw: { bg: "bg-chip", text: "text-ink-2" },
  exploring: { bg: "bg-info-soft", text: "text-info" },
  validating: { bg: "bg-success-soft", text: "text-success" },
  complete: { bg: "bg-accent-soft", text: "text-accent" },
  dropped: { bg: "bg-chip", text: "text-ink-3" },
};

export function StatusPill({ status }: { status: Idea["status"] }) {
  const s = STYLE[status];
  return (
    <View className={`rounded-pill px-[9px] py-1 ${s.bg}`}>
      <Text className={`text-[11px] font-semibold ${s.text}`}>{LABEL[status]}</Text>
    </View>
  );
}
