import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, useThemeColors } from "@nox/features";
import { credentials, signUpInput, type SignUpInput } from "@nox/types";
import { passwordStrength } from "@nox/utils";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { Apple, ArrowLeft, Check, ChevronLeft, Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Controller, type Control } from "react-hook-form";
import { useForm } from "react-hook-form";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authErrorMessage } from "../../lib/auth-errors";
import { CORAL, CORAL_GRADIENT } from "../../lib/auth-theme";

type Mode = "signin" | "signup";

const STRENGTH_COLOR = ["transparent", CORAL, "#3FB56E", "#3FB56E"] as const;
const emailValid = (v: string) => credentials.shape.email.safeParse(v).success;
/** Where confirmation / reset links return to — useAuthDeepLink exchanges the PKCE code there. */
const authRedirect = () => Linking.createURL("/auth-callback");

/** Uppercase field label (mono, tracked) matching the section labels used across the app. */
function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-1.5 mt-4 font-mono text-[10.5px] font-semibold tracking-[0.16em]">{children}</Text>
  );
}

/** Labeled input row with a leading icon, a coral focus ring, and an optional trailing adornment. */
function AuthInput({
  control,
  name,
  icon,
  right,
  focused,
  setFocused,
  lineColor,
  inkColor,
  ...rest
}: {
  control: Control<SignUpInput>;
  name: keyof SignUpInput;
  icon: ReactNode;
  right?: ReactNode;
  focused: string | null;
  setFocused: (v: string | null) => void;
  lineColor: string;
  inkColor: string;
} & Omit<React.ComponentProps<typeof TextInput>, "style">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <View
          className="bg-chip rounded-input h-[52px] flex-row items-center gap-2.5 px-3.5"
          style={{ borderWidth: 1, borderColor: focused === name ? CORAL : lineColor }}
        >
          {icon}
          <TextInput
            className="flex-1 text-[15px]"
            style={{ paddingVertical: 0, color: inkColor }}
            value={value ?? ""}
            onChangeText={onChange}
            onFocus={() => setFocused(name)}
            onBlur={() => {
              setFocused(focused === name ? null : focused);
              onBlur();
            }}
            {...rest}
          />
          {right}
        </View>
      )}
    />
  );
}

export default function LoginScreen() {
  const { signInWithPassword, signUp, sendPasswordReset } = useAuth();
  const c = useThemeColors();
  const [mode, setMode] = useState<Mode>("signin");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpInput),
    defaultValues: { email: "", password: "", name: "" },
  });

  const email = watch("email") ?? "";
  const strength = passwordStrength(watch("password") ?? "");

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (mode === "signin") {
        await signInWithPassword({ email: values.email, password: values.password });
      } else {
        const session = await signUp(values, authRedirect());
        if (!session) setSentTo(values.email); // "Confirm email" is on → verify by email
      }
    } catch (e) {
      setServerError(authErrorMessage(e));
    }
  });

  const onForgot = async () => {
    if (!emailValid(email)) {
      Alert.alert("Enter your email", "Type your account email above, then tap Forgot password.");
      return;
    }
    try {
      await sendPasswordReset({ email }, authRedirect());
      Alert.alert("Check your email", `We sent a password reset link to ${email}.`);
    } catch (e) {
      Alert.alert("Couldn't send reset", authErrorMessage(e));
    }
  };

  const social = (provider: string) =>
    Alert.alert(`${provider} sign-in`, "Social sign-in is coming soon — use email for now.");

  const switchMode = (next: Mode) => {
    setMode(next);
    setServerError(null);
  };

  const inputProps = { control, focused, setFocused, lineColor: c.line, inkColor: c.ink };

  // Post-signup confirmation state.
  if (sentTo) {
    return (
      <SafeAreaView className="bg-bg flex-1">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${CORAL}24` }}>
            <MailCheck size={28} color={CORAL} strokeWidth={1.8} />
          </View>
          <Text className="text-ink text-[22px] font-bold tracking-[-0.02em]">Check your email</Text>
          <Text className="text-ink-2 mt-2 text-center text-[14.5px] leading-[21px]">
            We sent a confirmation link to{"\n"}
            <Text className="text-ink font-semibold">{sentTo}</Text>. Tap it to finish setting up.
          </Text>
          <Pressable
            onPress={() => {
              setSentTo(null);
              switchMode("signin");
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
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 28, maxWidth: 460, width: "100%", alignSelf: "center" }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {mode === "signup" && (
            <Pressable
              onPress={() => switchMode("signin")}
              hitSlop={8}
              accessibilityLabel="Back"
              className="bg-chip rounded-pill mb-5 h-[34px] w-[34px] items-center justify-center"
            >
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
          )}

          {/* Heading */}
          {mode === "signin" ? (
            <>
              <View className="flex-row items-end gap-2">
                <Image
                  source={require("../../assets/nox-logo.png")}
                  style={{ width: 96, height: 56 }}
                  resizeMode="contain"
                  accessibilityLabel="Nox"
                />
                <Text style={{ color: CORAL, marginBottom: 6 }} className="text-[30px] font-bold">.</Text>
              </View>
              <Text className="text-ink-2 mt-3 text-[15px] leading-[22px]">
                Ideas, notes, tasks and resources —{"\n"}one quiet place, on every device.
              </Text>
            </>
          ) : (
            <>
              <Text className="text-ink text-[30px] font-bold tracking-[-0.02em]">Create your account</Text>
              <Text className="text-ink-2 mt-2 text-[14.5px] leading-[21px]">
                Syncs instantly between iPhone and Windows.
              </Text>
            </>
          )}

          {/* Fields */}
          {mode === "signup" && (
            <>
              <FieldLabel>NAME</FieldLabel>
              <AuthInput {...inputProps} name="name" icon={<User size={17} color={c.ink3} strokeWidth={1.8} />} placeholder="Your name" placeholderTextColor={c.ink3} autoCapitalize="words" autoComplete="name" />
            </>
          )}

          <FieldLabel>EMAIL</FieldLabel>
          <AuthInput
            {...inputProps}
            name="email"
            icon={<Mail size={17} color={c.ink3} strokeWidth={1.8} />}
            placeholder="you@nox.app"
            placeholderTextColor={c.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            right={emailValid(email) ? <Check size={17} color={c.success} strokeWidth={2.4} /> : undefined}
          />
          {errors.email ? <Text className="text-critical mt-1 text-[12.5px]">{errors.email.message}</Text> : null}

          <FieldLabel>PASSWORD</FieldLabel>
          <AuthInput
            {...inputProps}
            name="password"
            icon={<Lock size={17} color={c.ink3} strokeWidth={1.8} />}
            placeholder="••••••••"
            placeholderTextColor={c.ink3}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            right={
              <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={8}>
                {showPw ? <EyeOff size={18} color={c.ink3} strokeWidth={1.8} /> : <Eye size={18} color={c.ink3} strokeWidth={1.8} />}
              </Pressable>
            }
          />
          {errors.password ? <Text className="text-critical mt-1 text-[12.5px]">{errors.password.message}</Text> : null}

          {/* Password strength (sign-up) */}
          {mode === "signup" && strength.score > 0 && (
            <View className="mt-2.5 flex-row items-center gap-2.5">
              <View className="flex-1 flex-row gap-1.5">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < strength.score ? STRENGTH_COLOR[strength.score] : c.line }} />
                ))}
              </View>
              <Text style={{ color: STRENGTH_COLOR[strength.score] }} className="text-[11px] font-semibold lowercase">{strength.label}</Text>
            </View>
          )}

          {/* Forgot password (sign-in) */}
          {mode === "signin" && (
            <Pressable onPress={onForgot} hitSlop={6} className="mt-2.5 self-end">
              <Text style={{ color: CORAL }} className="text-[13px] font-semibold">Forgot password?</Text>
            </Pressable>
          )}

          {serverError ? <Text className="text-critical mt-3 text-[13px]">{serverError}</Text> : null}

          {/* Primary CTA */}
          <Pressable disabled={isSubmitting} onPress={onSubmit} className={`mt-6 ${isSubmitting ? "opacity-70" : ""}`}>
            <LinearGradient
              colors={CORAL_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 14, paddingVertical: 16, alignItems: "center", shadowColor: CORAL, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}
            >
              <Text className="text-[15.5px] font-bold text-white">
                {isSubmitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Text>
            </LinearGradient>
          </Pressable>

          {mode === "signup" && (
            <Text className="text-ink-3 mt-3 text-center text-[11.5px] leading-[17px]">
              By continuing you agree to the <Text className="text-ink-2 font-semibold">Terms</Text> and{" "}
              <Text className="text-ink-2 font-semibold">Privacy Policy</Text>.
            </Text>
          )}

          {/* OR + social (sign-in) */}
          {mode === "signin" && (
            <>
              <View className="my-6 flex-row items-center gap-3">
                <View className="bg-line h-px flex-1" />
                <Text className="text-ink-3 font-mono text-[10.5px] font-semibold tracking-[0.16em]">OR</Text>
                <View className="bg-line h-px flex-1" />
              </View>
              <View className="flex-row gap-3">
                <Pressable onPress={() => social("Apple")} className="bg-surface border-line h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-[14px] border">
                  <Apple size={18} color={c.ink} fill={c.ink} />
                  <Text className="text-ink text-[14.5px] font-semibold">Apple</Text>
                </Pressable>
                <Pressable onPress={() => social("Google")} className="bg-surface border-line h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-[14px] border">
                  <Text className="text-[16px] font-bold" style={{ color: "#4285F4" }}>G</Text>
                  <Text className="text-ink text-[14.5px] font-semibold">Google</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Mode toggle */}
          <View className="mt-8 flex-row items-center justify-center gap-1.5">
            <Text className="text-ink-3 text-[13.5px]">{mode === "signin" ? "New here?" : "Already have an account?"}</Text>
            <Pressable onPress={() => switchMode(mode === "signin" ? "signup" : "signin")} hitSlop={8}>
              <Text style={{ color: CORAL }} className="text-[13.5px] font-semibold">
                {mode === "signin" ? "Create an account" : "Sign in"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
