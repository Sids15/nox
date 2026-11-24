import { openLinkQuery, parseRef, refBlock, useThemeColors, type Ref } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { AudioBlock } from "./audio-block";
import { AutoGrowInput } from "./auto-grow-input";
import { ImageBlock } from "./image-block";
import { LinkCard } from "./link-card";
import { LinkPicker } from "../brain/link-picker";
import { RefCard } from "../brain/ref-card";
import type { BlockEditor } from "./use-block-editor";

type KeyEvent = NativeSyntheticEvent<TextInputKeyPressEventData & { shiftKey?: boolean; preventDefault?: () => void }>;

/**
 * Renders an editable block document inside the screen's ScrollView.
 *
 * Text blocks are inline inputs: Enter in a heading starts a paragraph below it; Backspace in an
 * empty block removes it and moves the caret to the end of the block above. Paragraphs keep Enter as
 * a new line (they are multi-line by design). Media and link cards sit between them with a visible
 * remove button. Tapping the space under the document puts the caret at the end.
 */
export function BlockList({
  editor,
  firstPlaceholder = "Start writing…",
  minHeight = 240,
  self,
  spaceId,
}: {
  editor: BlockEditor;
  firstPlaceholder?: string;
  /** Height of the tappable writing area (the space under the text focuses the end). */
  minHeight?: number;
  /** The page being edited, so `[[` doesn't offer it as a link to itself. */
  self?: Ref;
  /** Notes created from the `[[` picker join this space. */
  spaceId?: string | null;
}) {
  const c = useThemeColors();
  const inputs = useRef(new Map<string, TextInput | null>());
  const { blocks, keys, focusTarget } = editor;
  // The paragraph the caret was last in: the `[[` picker shows under it while its text ends in an
  // open `[[…`. Not cleared on blur — tapping the picker blurs the input first.
  const [active, setActive] = useState<number | null>(null);

  // Move the caret where the editor asked (after an insert, a split or a delete).
  useEffect(() => {
    if (!focusTarget) return;
    const key = keys[focusTarget.index];
    const el = key ? inputs.current.get(key) : null;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.focus();
      const b = blocks[focusTarget.index];
      const len = b && "text" in b ? b.text.length : 0;
      const pos = focusTarget.at === "start" ? 0 : len;
      try {
        el.setSelection?.(pos, pos);
      } catch {
        // not all platforms support it before layout; focus alone is fine
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [focusTarget?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (i: number, b: ContentBlock) => (e: KeyEvent) => {
    const k = e.nativeEvent.key;
    if (k === "Backspace" && "text" in b && b.text === "" && blocks.length > 1) {
      e.preventDefault?.();
      editor.backspaceEmpty(i);
    } else if (Platform.OS === "web" && k === "Enter" && b.type === "heading" && !e.nativeEvent.shiftKey) {
      // Web only: on phones the heading's submit key does this through onSubmitEditing.
      e.preventDefault?.();
      editor.splitAfter(i);
    }
  };

  const textCount = blocks.filter((b) => b.type === "paragraph" || b.type === "heading").length;

  return (
    <View style={{ minHeight }}>
      <View className="gap-2.5">
        {blocks.map((block, i) => {
          const key = keys[i] ?? String(i);
          const register = (el: TextInput | null) => {
            if (el) inputs.current.set(key, el);
            else inputs.current.delete(key);
          };
          switch (block.type) {
            case "heading":
              return (
                <AutoGrowInput
                  key={key}
                  ref={register}
                  value={block.text}
                  onChangeText={(t) => editor.setText(i, t.replace(/\n/g, ""))}
                  onFocus={() => editor.setFocused(i)}
                  onKeyPress={onKey(i, block)}
                  submitBehavior={Platform.OS === "web" ? undefined : "submit"}
                  onSubmitEditing={Platform.OS === "web" ? undefined : () => editor.splitAfter(i)}
                  placeholder="Heading"
                  placeholderTextColor={c.ink3}
                  minHeight={30}
                  accessibilityLabel="Heading"
                  className="text-ink mt-2 font-serif text-[20px] font-bold leading-[28px]"
                />
              );
            case "paragraph": {
              const linkQuery = active === i ? openLinkQuery(block.text) : null;
              return (
                <View key={key} className="gap-1.5">
                <AutoGrowInput
                  ref={register}
                  value={block.text}
                  onChangeText={(t) => editor.setText(i, t)}
                  onFocus={() => {
                    editor.setFocused(i);
                    setActive(i);
                  }}
                  onKeyPress={onKey(i, block)}
                  // The first block carries the prompt; a lone empty paragraph anywhere else reads
                  // as a place to type, not as nothing.
                  placeholder={i === 0 && textCount === 1 ? firstPlaceholder : block.text === "" ? "Type here…" : ""}
                  placeholderTextColor={c.ink3}
                  minHeight={26}
                  accessibilityLabel="Text"
                  className="text-ink text-[16px] leading-[26px]"
                  style={{ textAlignVertical: "top" }}
                />
                {linkQuery !== null ? (
                  <LinkPicker
                    query={linkQuery}
                    exclude={self}
                    spaceId={spaceId}
                    onPick={(t) => {
                      setActive(null);
                      editor.linkPage(i, refBlock({ kind: t.kind, id: t.id }, t.title));
                    }}
                  />
                ) : null}
                </View>
              );
            }
            case "link": {
              const ref = parseRef(block.url);
              if (ref) return <RefCard key={key} target={ref} storedTitle={block.title} onRemove={() => editor.removeBlock(i)} />;
              return <LinkCard key={key} block={block} onRemove={() => editor.removeBlock(i)} />;
            }
            case "image":
              return <ImageBlock key={key} block={block} onRemove={() => editor.removeBlock(i)} />;
            case "audio":
              return <AudioBlock key={key} block={block} onRemove={() => editor.removeBlock(i)} />;
            default:
              return null; // sketch — dev-build only
          }
        })}
      </View>
      {/* The page below the text: tap to keep writing at the end. */}
      <Pressable
        onPress={editor.focusEnd}
        accessibilityLabel="Continue writing"
        className="flex-1"
        style={{ minHeight: 80, cursor: "text" } as object}
      />
    </View>
  );
}
