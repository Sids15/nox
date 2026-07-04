import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { Text, TextInput, View } from "react-native";
import { AudioBlock } from "./audio-block";
import { ImageBlock } from "./image-block";
import { LinkCard } from "./link-card";

/** Renders an editable block document. Text blocks are inline TextInputs; media/link blocks render
 *  their cards (long-press to remove). Placed inside the screen's ScrollView. */
export function BlockList({
  blocks,
  setText,
  removeBlock,
  firstPlaceholder = "Start writing…",
}: {
  blocks: ContentBlock[];
  setText: (i: number, text: string) => void;
  removeBlock: (i: number) => void;
  firstPlaceholder?: string;
}) {
  const c = useThemeColors();
  return (
    <View className="gap-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <TextInput
                key={i}
                value={block.text}
                onChangeText={(t) => setText(i, t)}
                multiline
                placeholder="Heading"
                placeholderTextColor={c.ink3}
                className="text-ink text-[17px] font-bold tracking-[-0.01em]"
              />
            );
          case "paragraph":
            return (
              <TextInput
                key={i}
                value={block.text}
                onChangeText={(t) => setText(i, t)}
                multiline
                placeholder={i === 0 ? firstPlaceholder : ""}
                placeholderTextColor={c.ink3}
                className="text-ink text-[15px] leading-[25px]"
                style={{ textAlignVertical: "top" }}
              />
            );
          case "link":
            return <LinkCard key={i} block={block} onRemove={() => removeBlock(i)} />;
          case "image":
            return <ImageBlock key={i} block={block} onRemove={() => removeBlock(i)} />;
          case "audio":
            return <AudioBlock key={i} block={block} onRemove={() => removeBlock(i)} />;
          default:
            return null; // sketch — dev-build only
        }
      })}
    </View>
  );
}
