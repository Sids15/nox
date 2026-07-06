import { useAuth, useThemeColors } from "@nox/features";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Eye, EyeOff, Lock } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authErrorMessage } from "../../lib/auth-errors";
import { CORAL, CORAL_GRADIENT } from "../../lib/auth-theme";

const MIN_LENGTH = 8;

/** Uppercase field label (mono, tracked) — matches the login screen. */
function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-1.5 mt-4 font-mono text-[10.5px] font-semibold tracking-[0.16em]">{children}</Text>
  );
}

/**
 * Set-a-new-password screen, reached only with an active password-recovery session (the reset link
 * was exchanged by useAuthDeepLink, which raised the `recovery` flag). Submitting updates the
 * password, clears recovery, and drops the user into the app.
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

  const field = (name: string, value: string, onChange: (v: string) => void, placeholder: string, right?: ReactNode) => (
    <View
      className="bg-chip rounded-input h-[52px] flex-row items-center gap-2.5 px-3.5"
      style={{ borderWidth: 1, borderColor: focused === name ? CORAL : c.line }}
    >
      <Lock size={17} color={c.ink3} strokeWidth={1.8} />
      <TextInput
        className="flex-1 text-[15px]"
        style={{ paddingVertical: 0, color: c.ink }}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(name)}
        onBlur={() => setFocused((f) => (f === name ? null : f))}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
      />
      {right}
    </View>
  );

  return (
    <SafeAreaView className="bg-bg flex-1">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 28, maxWidth: 460, width: "100%", alignSelf: "center" }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-ink text-[30px] font-bold tracking-[-0.02em]">Set a new password</Text>
          <Text className="text-ink-2 mt-2 text-[14.5px] leading-[21px]">
            Choose a new password for your account. You'll be signed in once it's saved.
          </Text>

          <FieldLabel>NEW PASSWORD</FieldLabel>
          {field(
            "password",
            password,
            setPassword,
            "••••••••",
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
              {show ? <EyeOff size={18} color={c.ink3} strokeWidth={1.8} /> : <Eye size={18} color={c.ink3} strokeWidth={1.8} />}
            </Pressable>,
          )}
          {password.length > 0 && !longEnough ? (
            <Text className="text-ink-3 mt-1.5 text-[12.5px]">At least {MIN_LENGTH} characters.</Text>
          ) : null}

          <FieldLabel>CONFIRM PASSWORD</FieldLabel>
          {field("confirm", confirm, setConfirm, "••••••••")}
          {confirm.length > 0 && !matches ? (
            <Text className="mt-1.5 text-[12.5px]" style={{ color: CORAL }}>Passwords don't match.</Text>
          ) : null}

          {error ? <Text className="text-critical mt-3 text-[13px]">{error}</Text> : null}

          <Pressable disabled={!valid || busy} onPress={onSubmit} className={`mt-6 ${!valid || busy ? "opacity-50" : ""}`}>
            <LinearGradient
              colors={CORAL_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 14, paddingVertical: 16, alignItems: "center", shadowColor: CORAL, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}
            >
              <Text className="text-[15.5px] font-bold text-white">{busy ? "Saving…" : "Save password"}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onCancel} hitSlop={8} className="mt-6 self-center">
            <Text className="text-ink-2 text-[14px] font-semibold">Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
