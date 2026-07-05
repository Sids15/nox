import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, useThemeColors } from "@nox/features";
import { credentials, type Credentials } from "@nox/types";
import { ArrowLeft, MailCheck } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authErrorMessage } from "../../lib/auth-errors";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const { signInWithPassword, signUp } = useAuth();
  const c = useThemeColors();
  const [mode, setMode] = useState<Mode>("signin");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (mode === "signin") {
        await signInWithPassword(values);
        // A real session fires the auth listener, which redirects — no manual nav needed.
      } else {
        const session = await signUp(values);
        // No session means "Confirm email" is on; prompt the user to verify.
        if (!session) setSentTo(values.email);
      }
    } catch (e) {
      setServerError(authErrorMessage(e));
    }
  });

  // Post-signup confirmation state.
  if (sentTo) {
    return (
      <SafeAreaView className="bg-bg flex-1">
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-accent/[0.14] mb-6 h-16 w-16 items-center justify-center rounded-full">
            <MailCheck size={28} color={c.accent} strokeWidth={1.8} />
          </View>
          <Text className="text-ink text-[22px] font-bold tracking-[-0.02em]">Check your email</Text>
          <Text className="text-ink-2 mt-2 text-center text-[14.5px] leading-[21px]">
            We sent a confirmation link to{"\n"}
            <Text className="text-ink font-semibold">{sentTo}</Text>. Tap it to finish setting up.
          </Text>
          <Pressable
            onPress={() => {
              setSentTo(null);
              setMode("signin");
            }}
            hitSlop={8}
            className="mt-8 flex-row items-center gap-1.5"
          >
            <ArrowLeft size={15} color={c.ink2} strokeWidth={2} />
            <Text className="text-ink-2 text-[14px] font-semibold">Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="flex-1 justify-center px-7">
        {/* Brand lockup */}
        <Text className="text-ink-3 mb-2 font-mono text-[11px] font-semibold tracking-[0.2em]">
          PERSONAL · NOW
        </Text>
        <Text className="text-ink text-[40px] font-bold leading-[42px] tracking-[-0.03em]">Nox</Text>
        <Text className="text-ink-2 mt-3 text-[15px] leading-[22px]">
          {mode === "signin" ? "Welcome back." : "Ideas, notes, and tasks — in one place."}
        </Text>

        {/* Form */}
        <View className="mt-9 gap-3">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-chip rounded-input text-ink h-12 px-4 text-[15px]"
                style={{ paddingVertical: 0 }}
                placeholder="Email"
                placeholderTextColor={c.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />
          {errors.email ? <Text className="text-critical -mt-1 text-[12.5px]">{errors.email.message}</Text> : null}

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-chip rounded-input text-ink h-12 px-4 text-[15px]"
                style={{ paddingVertical: 0 }}
                placeholder="Password"
                placeholderTextColor={c.ink3}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />
          {errors.password ? (
            <Text className="text-critical -mt-1 text-[12.5px]">{errors.password.message}</Text>
          ) : null}

          {serverError ? <Text className="text-critical text-[13px]">{serverError}</Text> : null}
        </View>

        {/* Primary CTA */}
        <Pressable
          disabled={isSubmitting}
          onPress={onSubmit}
          className={`bg-accent rounded-input mt-6 items-center py-[15px] ${isSubmitting ? "opacity-60" : ""}`}
          style={{ shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
        >
          <Text className="text-on-accent text-[15px] font-bold">
            {isSubmitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Text>
        </Pressable>

        {/* Mode toggle */}
        <View className="mt-5 flex-row items-center justify-center gap-1.5">
          <Text className="text-ink-3 text-[13.5px]">
            {mode === "signin" ? "New to Nox?" : "Have an account?"}
          </Text>
          <Pressable
            onPress={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setServerError(null);
            }}
            hitSlop={8}
          >
            <Text className="text-accent text-[13.5px] font-semibold">
              {mode === "signin" ? "Create account" : "Sign in"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
