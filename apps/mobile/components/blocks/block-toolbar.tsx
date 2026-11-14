import { useThemeColors, useThemeVars } from "@nox/features";
import { AudioLines, Heading, Image as ImageIcon, Link2, Mic, Pilcrow, Square } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { Alert } from "../../lib/alert";
import { useIsDesktop } from "../../lib/use-responsive";
import { useVoiceRecorder, type Recording } from "../../lib/audio";
import { useDictation } from "../../lib/dictation";

const fmt = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The block editor's toolbar, docked under the writing. Aa adds a heading, ¶ a paragraph, the link
 * button opens a URL entry, the image button picks a photo, and the mic records a voice note inline
 * (the pill becomes a recording bar). Image/voice are enabled only when the screen wires them.
 */
export function BlockToolbar({
  onAddHeading,
  onAddParagraph,
  onAddLink,
  onAddImage,
  onRecordComplete,
  onDictate,
}: {
  onAddHeading: () => void;
  onAddParagraph: () => void;
  onAddLink: (url: string) => void;
  onAddImage?: () => void;
  onRecordComplete?: (rec: Recording) => void;
  /** Dictated phrases, as they're recognised. The button shows only where the platform supports it. */
  onDictate?: (text: string) => void;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const rec = useVoiceRecorder();
  const isDesktop = useIsDesktop();
  // Labels only when the bar has room for them (a narrow notes pane gets icons, like a phone).
  const [barWidth, setBarWidth] = useState(0);
  const labelled = isDesktop && barWidth >= 620;
  const dictation = useDictation((t) => onDictate?.(t));
  useEffect(() => {
    if (dictation.error) Alert.alert("Dictation", dictation.error);
  }, [dictation.error]);

  const submitLink = () => {
    if (url.trim()) onAddLink(url.trim());
    setUrl("");
    setLinkOpen(false);
  };
  const cancelRec = async () => {
    await rec.stop(); // discard
  };
  const stopRec = async () => {
    const r = await rec.stop();
    if (r && onRecordComplete) onRecordComplete(r);
  };

  // start() returns false when there's no mic, no supported container, or permission was refused.
  // Without this the mic button would look like a no-op and the user would just keep tapping it.
  const startRec = async () => {
    if (dictation.listening) dictation.stop();
    if (await rec.start()) return;
    Alert.alert("Can't record", "Nox needs microphone access to record a voice note. Check your browser or system permissions and try again.");
  };

  return (
    <>
      {/* Docked under the writing, on paper with a hairline above — it never covers the text the
          way the old floating pill did. Desktop labels each tool; phones show icons only. */}
      <View className="border-line bg-bg border-t" style={{ paddingBottom: isDesktop ? 0 : 6 }}>
        <View
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          className="h-[50px] flex-row items-center px-3"
          style={{ maxWidth: 680, width: "100%", alignSelf: "center" }}
        >
          {rec.isRecording ? (
            <View className="flex-1 flex-row items-center justify-between px-2">
              <View className="flex-row items-center gap-2.5">
                <View className="bg-high h-2.5 w-2.5 rounded-full" />
                <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink text-[14px] font-semibold">
                  {fmt(rec.durationMs)}
                </Text>
                <Text className="text-ink-3 text-[13px]">Recording…</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Pressable onPress={() => void cancelRec()} accessibilityRole="button" className="hover:bg-chip rounded-[9px] px-3 py-1.5">
                  <Text className="text-ink-2 text-[13px] font-semibold">Cancel</Text>
                </Pressable>
                <Pressable onPress={stopRec} accessibilityRole="button" accessibilityLabel="Stop and save the voice note" className="bg-high flex-row items-center gap-1.5 rounded-[9px] px-3.5 py-1.5">
                  <Square size={11} color="#fff" fill="#fff" />
                  <Text className="text-[13px] font-semibold text-white">Save</Text>
                </Pressable>
              </View>
            </View>
          ) : dictation.listening ? (
            <View className="flex-1 flex-row items-center gap-3 px-2">
              <View className="bg-accent h-2.5 w-2.5 rounded-full" />
              <Text numberOfLines={1} className={`flex-1 text-[13.5px] ${dictation.interim ? "text-ink" : "text-ink-3"}`}>
                {dictation.interim || "Listening… speak and your words appear in the text"}
              </Text>
              <Pressable onPress={dictation.stop} accessibilityRole="button" className="bg-accent rounded-[9px] px-3.5 py-1.5">
                <Text className="text-on-accent text-[13px] font-semibold">Done</Text>
              </Pressable>
            </View>
          ) : (
            <View className={`flex-1 flex-row items-center ${labelled ? "gap-1" : "justify-around"}`}>
              {labelled && <Text className="text-ink-3 mr-2 pl-2 text-[12.5px] font-medium">Add</Text>}
              {[
              { key: "h", label: "Heading", Icon: Heading, onPress: onAddHeading, on: true },
              { key: "p", label: "Text", Icon: Pilcrow, onPress: onAddParagraph, on: true },
              { key: "l", label: "Link", Icon: Link2, onPress: () => setLinkOpen(true), on: true },
              { key: "i", label: "Image", Icon: ImageIcon, onPress: () => onAddImage?.(), on: !!onAddImage },
              { key: "v", label: "Voice note", Icon: Mic, onPress: () => void startRec(), on: !!onRecordComplete },
              ...(dictation.supported && onDictate
                ? [{ key: "d", label: "Dictate", Icon: AudioLines, onPress: dictation.start, on: true }]
                : []),
            ].map(({ key, label, Icon, onPress, on }) => (
                <Pressable
                  key={key}
                  onPress={onPress}
                  disabled={!on}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={key === "d" ? "Dictate" : `Add ${label.toLowerCase()}`}
                  // Hover tooltip where the label is hidden.
                  {...({ title: labelled ? undefined : label } as object)}
                  className="hover:bg-chip h-[34px] flex-row items-center gap-1.5 rounded-[9px] px-2.5"
                  style={{ opacity: on ? 1 : 0.4 }}
                >
                  <Icon size={labelled ? 15 : 18} color={c.ink2} strokeWidth={2} />
                  {labelled && <Text className="text-ink-2 text-[13px] font-medium">{label}</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      <Modal transparent visible={linkOpen} animationType="fade" onRequestClose={() => setLinkOpen(false)}>
        <Pressable onPress={() => setLinkOpen(false)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[380px] border p-4">
            <Text className="text-ink mb-3 text-[15px] font-semibold">Add link</Text>
            <TextInput
              autoFocus
              value={url}
              onChangeText={setUrl}
              onSubmitEditing={submitLink}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              placeholder="Paste a URL"
              placeholderTextColor={c.ink3}
              className="bg-chip rounded-input text-ink mb-3 h-11 px-3 text-[13px]"
              style={{ paddingVertical: 0 }}
            />
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setLinkOpen(false)} className="px-4 py-2">
                <Text className="text-ink-2 text-[14px]">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitLink} className="bg-accent rounded-input px-4 py-2">
                <Text className="text-on-accent text-[14px] font-semibold">Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
