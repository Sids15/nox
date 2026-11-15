import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, useThemeColors } from "@nox/features";
import { credentials, signInInput, signUpInput, type OAuthProvider, type SignUpInput } from "@nox/types";
import { passwordStrength } from "@nox/utils";
import { Apple, ArrowLeft, Check, Eye, EyeOff, MailCheck } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { AuthShell } from "../../components/auth-shell";
import { pressScale } from "../../components/menu";
import { Alert } from "../../lib/alert";
import { authErrorMessage } from "../../lib/auth-errors";
import { authRedirect } from "../../lib/auth-redirect";
import { startOAuth } from "../../lib/oauth";

type Mode = "signin" | "signup";

const emailValid = (v: string) => credentials.shape.email.safeParse(v).success;

/** A labelled text field: sentence-case label above (with an optional action on the right), a calm
 *  bordered input that takes the accent on focus and the critical colour on error. */
function Field({
  control,
  name,
  label,
  action,
  error,
  right,
  ...rest
}: {
  control: Control<SignUpInput>;
  name: keyof SignUpInput;
  label: string;
  action?: ReactNode;
  error?: string;
  right?: ReactNode;
} & Omit<React.ComponentProps<typeof TextInput>, "style">) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View className="mt-4">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-ink-2 text-[13.5px] font-semibold">{label}</Text>
        {action}
      </View>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <View
            className="bg-surface h-[48px] flex-row items-center rounded-[11px] px-3.5"
            style={{ borderWidth: 1, borderColor: error ? c.critical : focused ? c.accent : c.line }}
          >
            <TextInput
              className="text-ink flex-1 text-[15.5px]"
              style={{ paddingVertical: 0, outlineWidth: 0 } as object}
              value={value ?? ""}
              onChangeText={onChange}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                onBlur();
              }}
              placeholderTextColor={c.ink3}
              accessibilityLabel={label}
              {...rest}
            />
            {right}
          </View>
        )}
      />
      {error ? <Text className="text-critical mt-1.5 text-[12.5px]">{error}</Text> : null}
    </View>
  );
}

function SocialButton({ label, icon, busy, dim, onPress }: { label: string; icon: ReactNode; busy: boolean; dim: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={dim || busy}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
      style={(s) => [pressScale(s), { opacity: dim ? 0.5 : 1 }]}
      className="bg-surface border-line hover:bg-elev h-[48px] flex-row items-center justify-center gap-2.5 rounded-[11px] border"
    >
      {busy ? (
        <ActivityIndicator color={c.ink} />
      ) : (
        <>
          {icon}
          <Text className="text-ink text-[15px] font-semibold">Continue with {label}</Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Sign in / create an account. Social sign-in leads (one tap), email below the divider. Logic is
 * unchanged from before the Ink & Paper redesign: react-hook-form + the shared Zod schema, password
 * reset by email, PKCE OAuth, and a "check your email" state when confirmation is required.
 */
export default function LoginScreen() {
  const { signInWithPassword, signUp, sendPasswordReset } = useAuth();
  const c = useThemeColors();
  const [mode, setMode] = useState<Mode>("signin");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [socialBusy, setSocialBusy] = useState<OAuthProvider | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    clearErrors,
  } = useForm<SignUpInput>({
    // Sign-in and sign-up validate differently (a new password needs 8+ characters; an existing one
    // just needs typing). The resolver reads the current mode, so switching tabs switches rules.
    resolver: (values, ctx, opts) =>
      (modeRef.current === "signin" ? zodResolver(signInInput) : zodResolver(signUpInput))(values, ctx, opts as never) as never,
    defaultValues: { email: "", password: "", name: "" },
  });

  const email = watch("email") ?? "";
  const strength = passwordStrength(watch("password") ?? "");
  const strengthColor = [c.line, c.critical, c.medium, c.success][strength.score];

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
      Alert.alert("Enter your email", "Type your account email above, then choose Forgot password.");
      return;
    }
    try {
      await sendPasswordReset({ email }, authRedirect());
      Alert.alert("Check your email", `We sent a password reset link to ${email}.`);
    } catch (e) {
      Alert.alert("Couldn't send reset", authErrorMessage(e));
    }
  };

  // Which provider is mid-flight, so neither can be double-fired (a second consent window would
  // invalidate the first one's PKCE verifier).
  const social = async (provider: OAuthProvider, label: string) => {
    if (socialBusy) return;
    setServerError(null);
    setSocialBusy(provider);
    try {
      const signedIn = await startOAuth(provider);
      // Desktop hands off to the system browser and returns via the nox:// deep link, so there is no
      // session yet — leaving the spinner up would strand the user.
      if (!signedIn) setSocialBusy(null);
    } catch (e) {
      setSocialBusy(null);
      Alert.alert(`Couldn't sign in with ${label}`, authErrorMessage(e));
    }
  };

  const switchMode = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
    setServerError(null);
    clearErrors();
  };

  if (sentTo) {
    return (
      <AuthShell>
        <View className="bg-accent/[0.12] mb-6 h-14 w-14 items-center justify-center rounded-[14px]">
          <MailCheck size={26} color={c.accent} strokeWidth={1.9} />
        </View>
        <Text className="text-ink font-serif text-[30px] font-bold leading-[37px] tracking-[-0.01em]">Check your email</Text>
        <Text className="text-ink-2 mt-3 text-[15.5px] leading-[23px]">
          We sent a confirmation link to <Text className="text-ink font-semibold">{sentTo}</Text>. Open it on this device to
          finish setting up.
        </Text>
        <Pressable
          onPress={() => {
            setSentTo(null);
            switchMode("signin");
          }}
          hitSlop={8}
          accessibilityRole="button"
          className="mt-8 flex-row items-center gap-1.5 self-start"
        >
          <ArrowLeft size={16} color={c.accent} strokeWidth={2.2} />
          <Text className="text-accent text-[14.5px] font-semibold">Back to sign in</Text>
        </Pressable>
      </AuthShell>
    );
  }

  const signin = mode === "signin";

  return (
    <AuthShell>
      <Text className="text-ink font-serif text-[32px] font-bold leading-[39px] tracking-[-0.01em]">
        {signin ? "Welcome back" : "Create your account"}
      </Text>
      <Text className="text-ink-2 mt-2 text-[15.5px] leading-[23px]">
        {signin ? "Sign in to pick up where you left off." : "Free, and it syncs between your phone and your computer."}
      </Text>

      {/* Social first: one tap. */}
      <View className="mt-7 gap-2.5">
        <SocialButton
          label="Apple"
          icon={<Apple size={18} color={c.ink} fill={c.ink} />}
          busy={socialBusy === "apple"}
          dim={socialBusy !== null && socialBusy !== "apple"}
          onPress={() => void social("apple", "Apple")}
        />
        <SocialButton
          label="Google"
          icon={
            <Text className="text-[17px] font-bold" style={{ color: "#4285F4" }}>
              G
            </Text>
          }
          busy={socialBusy === "google"}
          dim={socialBusy !== null && socialBusy !== "google"}
          onPress={() => void social("google", "Google")}
        />
      </View>

      <View className="my-6 flex-row items-center gap-3">
        <View className="bg-line h-px flex-1" />
        <Text className="text-ink-3 text-[12.5px] font-medium">or with email</Text>
        <View className="bg-line h-px flex-1" />
      </View>

      {!signin && <Field control={control} name="name" label="Name" placeholder="Your name" autoCapitalize="words" autoComplete="name" />}

      <Field
        control={control}
        name="email"
        label="Email"
        error={errors.email?.message}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        right={emailValid(email) ? <Check size={17} color={c.success} strokeWidth={2.4} /> : undefined}
      />

      <Field
        control={control}
        name="password"
        label="Password"
        error={errors.password?.message}
        action={
          signin ? (
            <Pressable onPress={() => void onForgot()} hitSlop={6} accessibilityRole="button">
              <Text className="text-accent text-[13px] font-semibold">Forgot password?</Text>
            </Pressable>
          ) : undefined
        }
        placeholder={signin ? "Your password" : "At least 8 characters"}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoComplete={signin ? "current-password" : "new-password"}
        onSubmitEditing={() => void onSubmit()}
        right={
          <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPw ? "Hide password" : "Show password"}>
            {showPw ? <EyeOff size={18} color={c.ink3} strokeWidth={1.9} /> : <Eye size={18} color={c.ink3} strokeWidth={1.9} />}
          </Pressable>
        }
      />

      {!signin && strength.score > 0 && (
        <View className="mt-2.5 flex-row items-center gap-2.5" accessibilityLabel={`Password strength: ${strength.label}`}>
          <View className="flex-1 flex-row gap-1.5">
            {[1, 2, 3].map((i) => (
              <View key={i} className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: i <= strength.score ? strengthColor : c.line }} />
            ))}
          </View>
          <Text style={{ color: strengthColor }} className="text-[12px] font-semibold">
            {strength.label}
          </Text>
        </View>
      )}

      {serverError ? (
        <View className="bg-critical/[0.08] mt-4 rounded-[10px] px-3.5 py-2.5">
          <Text className="text-critical text-[13.5px]">{serverError}</Text>
        </View>
      ) : null}

      <Pressable
        disabled={isSubmitting}
        onPress={() => void onSubmit()}
        accessibilityRole="button"
        style={pressScale}
        className={`bg-accent hover:opacity-90 mt-6 h-[50px] items-center justify-center rounded-[12px] ${isSubmitting ? "opacity-70" : ""}`}
      >
        {isSubmitting ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text className="text-on-accent text-[15.5px] font-semibold">{signin ? "Sign in" : "Create account"}</Text>
        )}
      </Pressable>

      {!signin && (
        <Text className="text-ink-3 mt-3 text-[12.5px] leading-[18px]">
          By creating an account you agree to the Terms and the Privacy Policy.
        </Text>
      )}

      <View className="mt-8 flex-row flex-wrap items-center gap-1.5">
        <Text className="text-ink-2 text-[14.5px]">{signin ? "New to Nox?" : "Already have an account?"}</Text>
        <Pressable onPress={() => switchMode(signin ? "signup" : "signin")} hitSlop={8} accessibilityRole="button">
          <Text className="text-accent text-[14.5px] font-semibold">{signin ? "Create an account" : "Sign in"}</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
