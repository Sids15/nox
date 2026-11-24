import { useThemeColors } from "@nox/features";
import type { Space } from "@nox/types";
import {
  BookOpen,
  Briefcase,
  Camera,
  Clapperboard,
  Code,
  Dumbbell,
  FileText,
  Gamepad2,
  GraduationCap,
  Heart,
  House,
  Layers,
  Lightbulb,
  Megaphone,
  Mic,
  Music,
  Palette,
  Plane,
  Rocket,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

/** The icons a space can have: the same line icons as the rest of the app. Stored by key. */
export const SPACE_ICONS: Record<string, LucideIcon> = {
  clapperboard: Clapperboard,
  rocket: Rocket,
  "file-text": FileText,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  lightbulb: Lightbulb,
  "gamepad-2": Gamepad2,
  "book-open": BookOpen,
  house: House,
  dumbbell: Dumbbell,
  plane: Plane,
  wallet: Wallet,
  mic: Mic,
  camera: Camera,
  music: Music,
  code: Code,
  palette: Palette,
  megaphone: Megaphone,
  heart: Heart,
  layers: Layers,
};
export const SPACE_ICON_KEYS = Object.keys(SPACE_ICONS);

/** Spaces made before icons were line icons stored an emoji; each maps to its icon. */
const FROM_EMOJI: Record<string, string> = {
  "🎬": "clapperboard",
  "🚀": "rocket",
  "📝": "file-text",
  "💼": "briefcase",
  "🎓": "graduation-cap",
  "💡": "lightbulb",
  "🎮": "gamepad-2",
  "📚": "book-open",
  "🏠": "house",
  "💪": "dumbbell",
  "✈️": "plane",
  "💰": "wallet",
};

/** A space's icon, whatever was stored (an icon key, an old emoji, or nothing). */
export function spaceIcon(space: Pick<Space, "icon">): LucideIcon {
  const key = SPACE_ICONS[space.icon] ? space.icon : FROM_EMOJI[space.icon];
  return (key && SPACE_ICONS[key]) || Layers;
}

/** A space's mark: its line icon in a quiet rounded square, like the app's other icon tiles. */
export function SpaceMark({ space, size = 22, active = false }: { space: Pick<Space, "icon">; size?: number; active?: boolean }) {
  const c = useThemeColors();
  const Icon = spaceIcon(space);
  return (
    <View
      className={active ? "bg-accent/[0.12]" : "bg-chip"}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), alignItems: "center", justifyContent: "center" }}
    >
      <Icon size={Math.round(size * 0.56)} color={active ? c.accent : c.ink2} strokeWidth={2} />
    </View>
  );
}

/** A grid of the space icons to choose from. */
export function SpaceIconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const c = useThemeColors();
  const current = SPACE_ICONS[value] ? value : (FROM_EMOJI[value] ?? "");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {SPACE_ICON_KEYS.map((key) => {
        const Icon = SPACE_ICONS[key]!;
        const on = key === current;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={key.replace(/-\d$/, "").replace(/-/g, " ")}
            className={`h-9 w-9 items-center justify-center rounded-[9px] ${on ? "bg-accent/[0.14]" : "hover:bg-chip"}`}
          >
            <Icon size={17} color={on ? c.accent : c.ink2} strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}
