import { useThemeColors } from "@nox/features";
import { FileSymlink, Heading, Image as ImageIcon, Link2, Pilcrow, type LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

export type SlashCommand = "heading" | "text" | "page" | "image" | "link";

const COMMANDS: { key: SlashCommand; label: string; hint: string; Icon: LucideIcon; words: string }[] = [
  { key: "heading", label: "Heading", hint: "A section title", Icon: Heading, words: "heading title h2 section" },
  { key: "text", label: "Text", hint: "A new paragraph", Icon: Pilcrow, words: "text paragraph plain" },
  { key: "page", label: "Link to page", hint: "Another note, idea, task or resource", Icon: FileSymlink, words: "page link mention ref wiki" },
  { key: "link", label: "Web link", hint: "A saved URL card", Icon: Link2, words: "web url bookmark link" },
  { key: "image", label: "Image", hint: "A photo or picture", Icon: ImageIcon, words: "image photo picture img" },
];

/** The `/` menu under a paragraph (Notion-style): what you can add, filtered by what's typed. */
export function SlashMenu({ query, onPick, hasImage }: { query: string; onPick: (c: SlashCommand) => void; hasImage: boolean }) {
  const c = useThemeColors();
  const q = query.toLowerCase();
  const items = COMMANDS.filter((x) => (x.key !== "image" || hasImage) && (!q || x.label.toLowerCase().startsWith(q) || x.words.split(" ").some((w) => w.startsWith(q))));
  if (items.length === 0) return null;
  return (
    <View className="border-line bg-elev self-start rounded-[12px] border p-1.5" style={{ width: 280, maxWidth: "100%" }} accessibilityRole="menu" accessibilityLabel="Add a block">
      <Text className="text-ink-3 px-2 pb-1 pt-0.5 text-[12px] font-medium">Add a block</Text>
      {items.map(({ key, label, hint, Icon }) => (
        <Pressable key={key} onPress={() => onPick(key)} accessibilityRole="menuitem" className="hover:bg-chip min-h-[40px] flex-row items-center gap-2.5 rounded-[8px] px-2">
          <View className="border-line bg-surface h-7 w-7 items-center justify-center rounded-[7px] border">
            <Icon size={14} color={c.ink2} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-[14px] font-medium">{label}</Text>
            <Text numberOfLines={1} className="text-ink-3 text-[11px]">
              {hint}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
