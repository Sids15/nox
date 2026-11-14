import { useThemeColors, useThemeVars } from "@nox/features";
import { Heading, Image as ImageIcon, Link2, Mic, Pilcrow, Square } from "lucide-react-native";
import { vars } from "nativewind";
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { Alert } from "../../lib/alert";
import { useIsDesktop } from "../../lib/use-responsive";
import { useVoiceRecorder, type Recording } from "../../lib/audio";

const fmt = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Floating formatting toolbar for the block editor. Aa adds a heading, ¶ a paragraph, the link
 * button opens a URL entry, the image button picks a photo, and the mic records a voice note inline
 * (the pill becomes a recording bar). Image/voice are enabled only when the screen wires them.
 */
export function BlockToolbar({
  onAddHeading,
  onAddParagraph,
  onAddLink,
  onAddImage,
  onRecordComplete,
}: {
  onAddHeading: () => void;
  onAddParagraph: () => void;
  onAddLink: (url: string) => void;
  onAddImage?: () => void;
  onRecordComplete?: (rec: Recording) => void;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const rec = useVoiceRecorder();
  const isDesktop = useIsDesktop();

  const submitLink = () => {
    if (url.trim()) onAddLink(url.trim());
    setUrl("");
    setLinkOpen(false);
  };
  const stopRec = async () => {
    const r = await rec.stop();
    if (r && onRecordComplete) onRecordComplete(r);
  };

  // start() returns false when there's no mic, no supported container, or permission was refused.
  // Without this the mic button would look like a no-op and the user would just keep tapping it.
  const startRec = async () => {
    if (await rec.start()) return;
    Alert.alert("Can't record", "Nox needs microphone access to record a voice note. Check your browser or system permissions and try again.");
  };

  return (
    <>
      {/* Full-width pill on a phone; on desktop a compact pill centred under the text column — a
          bar spanning the whole pane read as a footer, not a tool, and sat on top of the content. */}
      <View pointerEvents="box-none" className="absolute inset-x-0 items-center" style={{ bottom: isDesktop ? 20 : 24 }}>
      <View
        className="border-line bg-tabbar h-[56px] flex-row items-center rounded-[28px] border px-2"
        style={{
          width: isDesktop ? 340 : undefined,
          alignSelf: isDesktop ? "center" : "stretch",
          marginHorizontal: isDesktop ? 0 : 20,
          shadowColor: "rgb(6,6,14)",
          shadowOpacity: 0.25,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 18 },
          elevation: 12,
        }}
      >
        {rec.isRecording ? (
          <View className="flex-1 flex-row items-center justify-between px-3">
            <View className="flex-row items-center gap-2.5">
              <View className="bg-high h-2.5 w-2.5 rounded-full" />
              <Text className="text-ink text-[13px]">{fmt(rec.durationMs)}</Text>
              <Text className="text-ink-3 text-[12px]">recording…</Text>
            </View>
            <Pressable onPress={stopRec} className="bg-high flex-row items-center gap-1.5 rounded-pill px-4 py-1.5">
              <Square size={11} color="#fff" fill="#fff" />
              <Text className="text-[13px] font-semibold text-white">Stop</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1 flex-row items-center justify-around">
            <Pressable onPress={onAddHeading} hitSlop={6} accessibilityLabel="Add heading" className="hover:bg-chip rounded-[10px] px-2.5 py-2">
              <Heading size={19} color={c.ink2} strokeWidth={1.9} />
            </Pressable>
            <Pressable onPress={onAddParagraph} hitSlop={6} accessibilityLabel="Add paragraph" className="hover:bg-chip rounded-[10px] px-2.5 py-2">
              <Pilcrow size={19} color={c.ink2} strokeWidth={1.9} />
            </Pressable>
            <Pressable onPress={() => setLinkOpen(true)} hitSlop={6} accessibilityLabel="Add link" className="hover:bg-chip rounded-[10px] px-2.5 py-2">
              <Link2 size={19} color={c.ink2} strokeWidth={1.9} />
            </Pressable>
            <Pressable onPress={onAddImage} disabled={!onAddImage} hitSlop={6} accessibilityLabel="Add image" className="hover:bg-chip rounded-[10px] px-2.5 py-2">
              <ImageIcon size={19} color={onAddImage ? c.ink2 : c.ink3} strokeWidth={1.9} />
            </Pressable>
            <Pressable onPress={() => void startRec()} disabled={!onRecordComplete} hitSlop={6} accessibilityLabel="Record voice note" className="hover:bg-chip rounded-[10px] px-2.5 py-2">
              <Mic size={19} color={onRecordComplete ? c.ink2 : c.ink3} strokeWidth={1.9} />
            </Pressable>
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
