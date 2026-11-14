import { Text, View } from "react-native";

// Handoff tag palette — tags are user-defined, so detail chips get a deterministic color by name.
const TAG_PALETTE = ["#4C7FE0", "#2F9D72", "#A66BD9", "#C98A2B", "#D2604A", "#4AB3C4"];

function tagColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

/** `#tag` chip. Neutral on list cards; palette-tinted on the detail screen. */
export function TagChip({ tag, tinted = false }: { tag: string; tinted?: boolean }) {
  const label = tag.startsWith("#") ? tag : `#${tag}`;

  if (tinted) {
    const color = tagColor(tag);
    return (
      <View style={{ backgroundColor: `${color}22`, borderRadius: 7 }} className="px-2.5 py-1.5">
        <Text style={{ color }} className="text-[11px] font-medium">
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-chip rounded-[6px] px-2 py-1">
      <Text className="text-ink-2 text-[10.5px] font-medium">{label}</Text>
    </View>
  );
}
