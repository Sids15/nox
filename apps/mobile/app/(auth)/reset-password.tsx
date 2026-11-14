import { useAuth, useThemeColors } from "@nox/features";
import { router } from "expo-router";
import { Check, Eye, EyeOff } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { AuthShell } from "../../components/auth-shell";
import { pressScale } from "../../components/menu";
import { authErrorMessage } from "../../lib/auth-errors";

const MIN_LENGTH = 8;

/**
 * Set-a-new-password screen, reached only with an active password-recovery session (the reset link
 * was exchanged by useAuthDeepLink, which raised the `recovery` flag). Saving updates the password,
 * clears recovery and opens the app; Cancel signs the recovery session out.
 */
export default function ResetPasswordScreen() {
  const { updatePassword, setRecovery, signOut } = useAuth();
  const c = useThemeColors();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && confirm === password;
  const valid = longEnough && matches;

  const onSubmit = async () => {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      await updatePassword(password);
      setRecovery(false);
      router.replace("/(tabs)/tasks");
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  const onCancel = async () => {
    try {
      await signOut();
    } finally {
      setRecovery(false);
      router.replace("/(auth)/login");
    }
  };

  const field = (name: string, label: string, value: string, onChange: (v: string) => void, bad: boolean, right?: ReactNode) => (
    <View className="mt-4">
      <Text className="text-ink-2 mb-1.5 text-[13.5px] font-semibold">{label}</Text>
      <View
        className="bg-surface h-[48px] flex-row items-center rounded-[11px] px-3.5"
        style={{ borderWidth: 1, borderColor: bad ? c.critical : focused === name ? c.accent : c.line }}
      >
        <TextInput
          className="text-ink flex-1 text-[15.5px]"
          style={{ paddingVertical: 0, outlineWidth: 0 } as object}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(name)}
          onBlur={() => setFocused((f) => (f === name ? null : f))}
          onSubmitEditing={() => void onSubmit()}
          placeholderTextColor={c.ink3}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          accessibilityLabel={label}
        />
        {right}
      </View>
    </View>
  );

  return (
    <AuthShell>
      <Text className="text-ink font-serif text-[32px] font-bold leading-[39px] tracking-[-0.01em]">Set a new password</Text>
      <Text className="text-ink-2 mt-2 text-[15.5px] leading-[23px]">You'll be signed in as soon as it's saved.</Text>

      <View className="mt-3">
        {field(
          "password",
          "New password",
          password,
          setPassword,
          false,
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} color={c.ink3} strokeWidth={1.9} /> : <Eye size={18} color={c.ink3} strokeWidth={1.9} />}
          </Pressable>,
        )}
        <View className="mt-2 flex-row items-center gap-1.5">
          <Check size={13} color={longEnough ? c.success : c.ink3} strokeWidth={2.6} />
          <Text className={`text-[12.5px] ${longEnough ? "text-success" : "text-ink-3"}`}>At least {MIN_LENGTH} characters</Text>
        </View>

        {field("confirm", "Confirm password", confirm, setConfirm, confirm.length > 0 && !matches)}
        {confirm.length > 0 && !matches ? <Text className="text-critical mt-1.5 text-[12.5px]">Passwords don't match.</Text> : null}
      </View>

      {error ? (
        <View className="bg-critical/[0.08] mt-4 rounded-[10px] px-3.5 py-2.5">
          <Text className="text-critical text-[13.5px]">{error}</Text>
        </View>
      ) : null}

      <Pressable
        disabled={!valid || busy}
        onPress={() => void onSubmit()}
        accessibilityRole="button"
        style={pressScale}
        className={`mt-6 h-[50px] items-center justify-center rounded-[12px] ${valid ? "bg-accent hover:opacity-90" : "bg-chip"}`}
      >
        {busy ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text className={`text-[15.5px] font-semibold ${valid ? "text-on-accent" : "text-ink-3"}`}>Save password</Text>
        )}
      </Pressable>

      <Pressable onPress={() => void onCancel()} hitSlop={8} accessibilityRole="button" className="mt-6 self-start">
        <Text className="text-ink-2 text-[14.5px] font-semibold">Cancel and sign out</Text>
      </Pressable>
    </AuthShell>
  );
}
