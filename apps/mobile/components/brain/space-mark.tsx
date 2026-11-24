import type { Space } from "@nox/types";
import { Text, View } from "react-native";
import { TAG_PALETTE } from "../../lib/tag-palette";

/** A space's colour: the one it was given, else one picked steadily from its id. */
export function spaceColor(space: Pick<Space, "id" | "color">): string {
  if (space.color) return space.color;
  let h = 0;
  for (let i = 0; i < space.id.length; i++) h = (h * 31 + space.id.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

/** A space's mark: its emoji, or its initial on its colour. */
export function SpaceMark({ space, size = 22 }: { space: Pick<Space, "id" | "name" | "icon" | "color">; size?: number }) {
  const color = spaceColor(space);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: `${color}26`, alignItems: "center", justifyContent: "center" }}
    >
      {space.icon ? (
        <Text style={{ fontSize: size * 0.62, lineHeight: size * 0.8 }}>{space.icon}</Text>
      ) : (
        <Text style={{ color, fontSize: size * 0.5, fontWeight: "700", lineHeight: size * 0.7 }}>{(space.name.trim()[0] ?? "·").toUpperCase()}</Text>
      )}
    </View>
  );
}
