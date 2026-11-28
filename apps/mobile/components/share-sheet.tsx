import { ShareRepository } from "@nox/api";
import { useThemeColors, useThemeVars } from "@nox/features";
import type { Share as ShareRow, ShareKind } from "@nox/types";
import { Globe, Link2, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Share, Text, View } from "react-native";
import { webBase } from "../lib/web-base";
import { pressScale } from "./menu";

const WHAT: Record<ShareKind, string> = {
  note: "this note's text (not its pictures or recordings)",
  idea: "this idea's title, status and text (not its pictures or recordings)",
  space: "this space's name, goal and deadline, its tasks, and the titles of its notes and ideas",
};

/**
 * Share a note, idea or space as a read-only link. Anyone with the link can view it — no sign-in —
 * and nothing else in your account. "Stop sharing" ends the link at once.
 */
export function ShareSheet({ kind, targetId, title, visible, onClose }: { kind: ShareKind; targetId: string; title: string; visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [row, setRow] = useState<ShareRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const base = webBase();

  useEffect(() => {
    if (!visible) return;
    setRow(undefined);
    setError(null);
    ShareRepository.forTarget(kind, targetId)
      .then(setRow)
      .catch(() => {
        setRow(null);
        setError("Couldn't check for a link. Are you online?");
      });
  }, [visible, kind, targetId]);

  const link = row && base ? `${base}/s/${row.token}` : null;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("That didn't work. Check your connection, and that the database is up to date (migration 0018).");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    if (Platform.OS === "web" && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      await Share.share({ message: link, url: link });
    }
  };

  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[460px] border p-4">
          <View className="flex-row items-center gap-2">
            <Globe size={16} color={c.accent} strokeWidth={2} />
            <Text numberOfLines={1} className="text-ink flex-1 text-[16px] font-semibold">
              Share “{title}”
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[8px]">
              <X size={16} color={c.ink3} strokeWidth={2} />
            </Pressable>
          </View>
          <Text className="text-ink-3 mt-2 text-[13px] leading-[18px]">
            Anyone with the link can view {WHAT[kind]}. They can't edit it or see anything else in your Nox.
          </Text>

          {row === undefined ? (
            <ActivityIndicator className="mt-4" color={c.accent} />
          ) : !base ? (
            <Text className="text-ink-2 mt-4 text-[13px]">Share links open in the Nox web app. Set its address (EXPO_PUBLIC_WEB_URL), or share from Nox in your browser.</Text>
          ) : row ? (
            <>
              <View className="bg-chip mt-4 flex-row items-center gap-2 rounded-[10px] px-3 py-2">
                <Link2 size={14} color={c.ink3} strokeWidth={2} />
                <Text numberOfLines={1} selectable className="text-ink-2 flex-1 text-[13px]">
                  {link}
                </Text>
              </View>
              <View className="mt-3 flex-row gap-2">
                <Pressable onPress={() => void copy()} accessibilityRole="button" style={pressScale} className="bg-accent h-[38px] flex-1 items-center justify-center rounded-[10px]">
                  <Text className="text-on-accent text-[14px] font-semibold">{copied ? "Copied" : Platform.OS === "web" ? "Copy link" : "Share link"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void act(async () => {
                    await ShareRepository.revoke(row.id);
                    setRow(null);
                  })}
                  disabled={busy}
                  accessibilityRole="button"
                  className="hover:bg-chip h-[38px] items-center justify-center rounded-[10px] px-3"
                >
                  <Text className="text-high text-[14px] font-semibold">Stop sharing</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              onPress={() => void act(async () => setRow(await ShareRepository.create(kind, targetId)))}
              disabled={busy}
              accessibilityRole="button"
              style={(st) => ({ ...pressScale(st), opacity: busy ? 0.6 : 1 })}
              className="bg-accent mt-4 h-[40px] flex-row items-center justify-center gap-2 rounded-[10px]"
            >
              <Link2 size={15} color={c.onAccent} strokeWidth={2.2} />
              <Text className="text-on-accent text-[14px] font-semibold">Create a view-only link</Text>
            </Pressable>
          )}
          {error ? <Text className="text-high mt-2 text-[13px]">{error}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
