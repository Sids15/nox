import { useThemeColors } from "@nox/features";
import { Sparkles, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { pressScale } from "../menu";

/**
 * The few pieces every AI feature shares, so they all look and behave alike: one sparkle button,
 * one tinted panel for what came back, one line for errors. AI output always lands in a panel the
 * user accepts or dismisses — never straight into their data.
 */

/** A quiet pill that starts an AI action. Shows a spinner while it runs. */
export function AiButton({
  label,
  onPress,
  busy,
  disabled,
  solid,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Filled accent, for the one primary AI action on a screen. */
  solid?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const off = disabled || busy;
  const fg = solid ? c.onAccent : c.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: !!busy, disabled: !!disabled }}
      style={pressScale}
      className={`h-[30px] flex-row items-center gap-1.5 self-start rounded-[8px] px-2.5 ${
        solid ? "bg-accent hover:opacity-90" : "bg-accent/[0.08] hover:bg-accent/[0.14]"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {busy ? <ActivityIndicator size="small" color={fg} style={{ transform: [{ scale: 0.7 }] }} /> : <Sparkles size={13} color={fg} strokeWidth={2.2} />}
      <Text className="text-[13px] font-semibold" style={{ color: fg }}>
        {busy ? "Thinking…" : label}
      </Text>
    </Pressable>
  );
}

/** The tinted box AI results appear in, with a title and a close button. */
export function AiPanel({ title, onClose, children, footer }: { title: string; onClose?: () => void; children: ReactNode; footer?: ReactNode }) {
  const c = useThemeColors();
  return (
    <View className="bg-accent/[0.06] rounded-[12px] px-3.5 py-3" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-1.5">
        <Sparkles size={13} color={c.accent} strokeWidth={2.2} />
        <Text className="text-ink flex-1 text-[14px] font-semibold">{title}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss" className="hover:bg-chip -mr-1 h-6 w-6 items-center justify-center rounded-full">
            <X size={13} color={c.ink3} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <View className="mt-2">{children}</View>
      {footer ? <View className="mt-3 flex-row flex-wrap items-center justify-end gap-2">{footer}</View> : null}
    </View>
  );
}

/** Accept / secondary buttons for a panel footer. */
export function AiAction({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={pressScale}
      className={`h-[32px] justify-center rounded-[8px] px-3 ${primary ? "bg-accent hover:opacity-90" : "hover:bg-chip"}`}
    >
      <Text className={`text-[13px] font-semibold ${primary ? "text-on-accent" : "text-ink-2"}`}>{label}</Text>
    </Pressable>
  );
}

export function AiErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <Text className="text-high mt-2 text-[13px]">{error}</Text>;
}

/** A bulleted line of AI text. */
export function AiBullet({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2 py-0.5">
      <Text className="text-ink-3 text-[14px] leading-[21px]">•</Text>
      <Text className="text-ink-2 flex-1 text-[14px] leading-[21px]">{children}</Text>
    </View>
  );
}
