import { useThemeVars } from "@nox/features";
import { vars } from "nativewind";
import { Modal, Pressable, Text, View } from "react-native";
import type { AlertButton } from "react-native";
import { useAlertQueue } from "../lib/alert-queue";

/**
 * Renders queued `Alert.alert()` requests as themed in-app dialogs, replacing the browser's blocking
 * `window.alert`/`confirm`. Mounted once at the root. Matches the house dialog: an elevated card,
 * capped at 380px so it doesn't stretch across a desktop window, over a dimmed backdrop. The Modal is
 * its own portal, so it needs its own `vars()` wrapper to inherit the active theme.
 */
export function DialogHost() {
  const current = useAlertQueue((s) => s.queue[0]);
  const dismiss = useAlertQueue((s) => s.dismiss);
  const themeVars = useThemeVars();

  if (!current) return null;

  const press = (button: AlertButton) => {
    dismiss(current.id);
    button.onPress?.();
  };

  // Backdrop = the least destructive way out: the cancel button if there is one, otherwise the lone
  // OK of an informational alert. With several actions and no cancel, dismiss without choosing.
  const onBackdrop = () => {
    const cancel = current.buttons.find((b) => b.style === "cancel");
    if (cancel) return press(cancel);
    if (current.buttons.length === 1) return press(current.buttons[0]);
    dismiss(current.id);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onBackdrop}>
      <Pressable onPress={onBackdrop} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[380px] border p-4">
          <Text className="text-ink text-[15px] font-semibold">{current.title}</Text>
          {current.message ? (
            <Text className="text-ink-2 mt-2 text-[14px] leading-[20px]">{current.message}</Text>
          ) : null}

          <View className="mt-4 flex-row justify-end gap-2">
            {current.buttons.map((button, i) => {
              const label = button.text ?? "OK";
              if (button.style === "cancel") {
                return (
                  <Pressable key={`${label}-${i}`} onPress={() => press(button)} className="px-4 py-2">
                    <Text className="text-ink-2 text-[14px]">{label}</Text>
                  </Pressable>
                );
              }
              const destructive = button.style === "destructive";
              return (
                <Pressable
                  key={`${label}-${i}`}
                  onPress={() => press(button)}
                  className={`rounded-input px-4 py-2 ${destructive ? "bg-high" : "bg-accent"}`}
                >
                  <Text className={`text-[14px] font-semibold ${destructive ? "text-white" : "text-on-accent"}`}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
