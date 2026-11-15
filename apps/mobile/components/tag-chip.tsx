import { X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { tagColor } from "../lib/tag-palette";

/**
 * A `#tag`, tinted with the tag's own colour (stable by name) on every surface. `size="sm"` for list
 * rows and cards; with `onRemove` it shows an × that removes it.
 */
export function TagChip({ tag, size = "md", onRemove }: { tag: string; size?: "sm" | "md"; onRemove?: () => void }) {
  const color = tagColor(tag);
  const label = tag.startsWith("#") ? tag : `#${tag}`;
  const body = (
    <>
      <Text style={{ color }} className={size === "sm" ? "text-[11px] font-semibold" : "text-[13px] font-semibold"}>
        {label}
      </Text>
      {onRemove && <X size={11} color={color} strokeWidth={2.6} />}
    </>
  );
  const cls = `flex-row items-center gap-1 ${size === "sm" ? "rounded-[6px] px-1.5 py-0.5" : "rounded-[7px] px-2 py-1"}`;
  if (onRemove)
    return (
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove tag ${tag}`} style={{ backgroundColor: `${color}1f` }} className={cls}>
        {body}
      </Pressable>
    );
  return (
    <View style={{ backgroundColor: `${color}1f` }} className={cls}>
      {body}
    </View>
  );
}
