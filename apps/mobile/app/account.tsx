import { useAuth, useThemeColors, useThemeVars } from "@nox/features";
import { credentials } from "@nox/types";
import { displayNameFrom, initialsFrom, monthShort, toDateKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Mail, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Alert } from "../lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sidebar } from "../components/sidebar";
import { authErrorMessage } from "../lib/auth-errors";
import { CORAL, CORAL_BORDER, CORAL_SOFT } from "../lib/auth-theme";
import { useIsDesktop } from "../lib/use-responsive";

function memberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const m = monthShort(toDateKey(d));
  return `${m[0]!.toUpperCase()}${m.slice(1)} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AccountScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const isDesktop = useIsDesktop();
  const { session, updatePassword, updateEmail } = useAuth();

  const email = session?.user?.email ?? "";
  const name = displayNameFrom(email);
  const joined = memberSince(session?.user?.created_at);

  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const back = (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      accessibilityLabel="Go back"
      className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center"
    >
      <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
    </Pressable>
  );

  // ————— Desktop: the handoff's Account window — sidebar + centered 620px column, accent-toned.
  const desktopBody = (
    <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingTop: 34, maxWidth: 620, width: "100%", alignSelf: "center", paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
      {/* Header: back circle + SETTINGS context over the title */}
      <View className="flex-row items-center gap-3.5">
        {back}
        <View>
          <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.16em]">SETTINGS</Text>
          <Text className="text-ink mt-0.5 text-[22px] font-bold tracking-[-0.02em]">Account</Text>
        </View>
      </View>

      {/* Horizontal profile card */}
      <View className="border-line bg-surface rounded-card mt-6 flex-row items-center gap-4 border p-4">
        <View className="bg-accent/[0.18] h-14 w-14 items-center justify-center rounded-full">
          <Text className="text-accent text-[18px] font-bold">{initialsFrom(email)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-ink text-[17px] font-bold tracking-[-0.01em]">{name}</Text>
          <Text className="text-ink-3 mt-0.5 text-[13px]">{email || "not signed in"}</Text>
        </View>
        {joined ? (
          <View className="bg-chip rounded-pill px-3 py-1.5">
            <Text className="text-ink-3 font-mono text-[9.5px] font-semibold tracking-[0.12em]">MEMBER SINCE {joined.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {/* Security */}
      <Text className="text-ink-3 mb-2 mt-7 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">SECURITY</Text>
      <View className="border-line bg-surface rounded-card overflow-hidden border">
        <View className="border-line flex-row items-center gap-3 border-b px-4 py-[15px]">
          <Lock size={16} color={c.ink3} strokeWidth={1.8} />
          <View className="flex-1">
            <Text className="text-ink text-[14.5px] font-medium">Password</Text>
            <Text className="text-ink-3 mt-1 font-mono text-[11px] tracking-[0.14em]">••••••••••</Text>
          </View>
          <Pressable onPress={() => setPwOpen(true)} className="bg-chip border-line rounded-[9px] border px-3 py-[7px]">
            <Text className="text-ink-2 text-[12.5px] font-semibold">Change…</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center gap-3 px-4 py-[15px]">
          <Mail size={16} color={c.ink3} strokeWidth={1.8} />
          <View className="flex-1">
            <Text className="text-ink text-[14.5px] font-medium">Email</Text>
            <Text className="text-ink-3 mt-1 font-mono text-[11px]">{email || "—"}</Text>
          </View>
          <Pressable onPress={() => setEmailOpen(true)} className="bg-chip border-line rounded-[9px] border px-3 py-[7px]">
            <Text className="text-ink-2 text-[12.5px] font-semibold">Change…</Text>
          </Pressable>
        </View>
      </View>

      <Text className="text-ink-3 mt-5 text-center font-mono text-[10px] tracking-[0.04em]">
        account deletion ships in a later build
      </Text>
    </ScrollView>
  );

  // ————— Mobile: the approved coral treatment (centered profile, tappable rows).
  const mobileBody = (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, maxWidth: 680, width: "100%", alignSelf: "center" }} showsVerticalScrollIndicator={false}>
      <View className="px-screen flex-row items-center gap-3 pt-2">
        {back}
        <Text className="text-ink text-2xl font-bold tracking-[-0.02em]">Account</Text>
      </View>

      <View className="mt-6 items-center">
        <View className="h-[76px] w-[76px] items-center justify-center rounded-full" style={{ backgroundColor: CORAL_SOFT }}>
          <Text style={{ color: CORAL }} className="text-[24px] font-bold">{initialsFrom(email)}</Text>
        </View>
        <Text className="text-ink mt-3 text-[19px] font-bold tracking-[-0.01em]">{name}</Text>
        <Text className="text-ink-3 mt-0.5 text-[13px]">{email || "not signed in"}</Text>
        {joined ? (
          <View className="bg-chip rounded-pill mt-2.5 px-3 py-1.5">
            <Text className="text-ink-3 font-mono text-[9.5px] font-semibold tracking-[0.12em]">MEMBER SINCE {joined.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {/* pl-[22px] not pl-0.5: px-screen's 20px is overridden by the pl-* that follows it, and the
          card below is mx-[20px] — matches the SCHEDULE/PRIORITY labels in task-editor. */}
      <Text className="px-screen text-ink-3 mb-2 mt-7 pl-[22px] font-mono text-[10px] font-semibold tracking-[0.14em]">SECURITY</Text>
      <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
        <Pressable onPress={() => setPwOpen(true)} className="border-line flex-row items-center gap-3 border-b px-[14px] py-[14px]">
          <Lock size={17} color={c.ink3} strokeWidth={1.8} />
          <Text className="text-ink flex-1 text-[14.5px]">Change password</Text>
          <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={() => setEmailOpen(true)} className="flex-row items-center gap-3 px-[14px] py-[14px]">
          <Mail size={17} color={c.ink3} strokeWidth={1.8} />
          <View className="flex-1">
            <Text className="text-ink text-[14.5px]">Change email</Text>
            {email ? <Text className="text-ink-3 mt-0.5 text-[12px]">{email}</Text> : null}
          </View>
          <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
        </Pressable>
      </View>

      <Text className="text-ink-3 mt-4 text-center font-mono text-[10px] tracking-[0.04em]">
        account deletion ships in a later build
      </Text>
    </ScrollView>
  );

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">{isDesktop ? desktopBody : mobileBody}</View>
      </View>

      <ChangePasswordModal visible={pwOpen} desktop={isDesktop} onClose={() => setPwOpen(false)} onSubmit={updatePassword} themeVars={themeVars} />
      <ChangeEmailModal visible={emailOpen} desktop={isDesktop} currentEmail={email} onClose={() => setEmailOpen(false)} onSubmit={updateEmail} themeVars={themeVars} />
    </SafeAreaView>
  );
}

/* ————— Modals. Desktop = the handoff dialogs (400px, bg fill, line border, accent tone, ✕ close);
   mobile = the approved coral cards. Coral stays the error color on both. ————— */

function ModalCard({
  children,
  desktop,
  themeVars,
  onClose,
  title,
}: {
  children: ReactNode;
  desktop: boolean;
  themeVars: Record<string, string>;
  onClose: () => void;
  title: string;
}) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center px-7" >
      <View className="absolute inset-0" style={{ backgroundColor: "rgba(6,6,12,0.55)" }} pointerEvents="none" />
      <Pressable
        onPress={() => {}}
        className={desktop ? "bg-bg border-line rounded-[16px] border p-5" : "bg-elev w-full rounded-[20px] border p-5"}
        style={
          desktop
            ? { width: 400, maxWidth: "100%", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 60, shadowOffset: { width: 0, height: 24 }, elevation: 20 }
            : { borderColor: "rgba(232,103,76,0.32)", shadowColor: CORAL, shadowOpacity: 0.28, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 16 }
        }
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-ink text-[18px] font-bold tracking-[-0.01em]">{title}</Text>
          {desktop && (
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={17} color={c.ink3} strokeWidth={2} />
            </Pressable>
          )}
        </View>
        {children}
      </Pressable>
    </Pressable>
  );
}

function FieldLabel({ children, desktop }: { children: string; desktop: boolean }) {
  return (
    <Text
      style={desktop ? undefined : { color: CORAL }}
      className={`mb-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] ${desktop ? "text-ink-3" : ""}`}
    >
      {children}
    </Text>
  );
}

/** Dialog text field: accent focus ring on desktop, coral on mobile; coral always signals errors. */
function ModalField({
  icon,
  right,
  desktop,
  error = false,
  inkColor,
  placeholderColor,
  lineColor,
  accentColor,
  ...rest
}: {
  icon: ReactNode;
  right?: ReactNode;
  desktop: boolean;
  error?: boolean;
  inkColor: string;
  placeholderColor: string;
  lineColor: string;
  accentColor: string;
} & Omit<React.ComponentProps<typeof TextInput>, "style">) {
  const [focused, setFocused] = useState(false);
  const border = error ? "#D2604A" : desktop ? (focused ? accentColor : lineColor) : CORAL_BORDER;
  return (
    <View
      className="bg-chip rounded-[11px] h-[46px] flex-row items-center gap-2.5 px-3.5"
      style={{ borderWidth: 1, borderColor: border }}
    >
      {icon}
      <TextInput
        className="flex-1 text-[15px]"
        style={{ paddingVertical: 0, color: inkColor }}
        placeholderTextColor={placeholderColor}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {right}
    </View>
  );
}

function ModalButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  busy,
  valid,
  desktop,
  accentColor,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy: boolean;
  valid: boolean;
  desktop: boolean;
  accentColor: string;
}) {
  const bg = desktop ? accentColor : CORAL;
  return (
    <View className="mt-5 flex-row gap-3">
      <Pressable onPress={onCancel} className="bg-chip border-line flex-1 items-center rounded-[13px] border py-[13px]">
        <Text className="text-ink-2 text-[14.5px] font-semibold">Cancel</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={busy || !valid}
        className="flex-1 items-center rounded-[13px] py-[13px]"
        style={{
          backgroundColor: bg,
          opacity: busy || !valid ? 0.45 : 1,
          shadowColor: bg,
          shadowOpacity: valid ? 0.4 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: valid ? 6 : 0,
        }}
      >
        <Text className="text-[14.5px] font-bold text-white">{busy ? "…" : confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

function ChangePasswordModal({
  visible,
  desktop,
  onClose,
  onSubmit,
  themeVars,
}: {
  visible: boolean;
  desktop: boolean;
  onClose: () => void;
  onSubmit: (pw: string) => Promise<void>;
  themeVars: Record<string, string>;
}) {
  const c = useThemeColors();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPw("");
    setConfirm("");
    setShow(false);
    setError(null);
    setBusy(false);
    onClose();
  };

  const longEnough = pw.length >= 8;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const valid = longEnough && confirm.length > 0 && pw === confirm;

  const save = async () => {
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      await onSubmit(pw);
      close();
      Alert.alert("Password updated", "Use your new password next time you sign in.");
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  const eye = (
    <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
      {show ? <EyeOff size={17} color={c.ink3} strokeWidth={1.8} /> : <Eye size={17} color={c.ink3} strokeWidth={1.8} />}
    </Pressable>
  );

  const fieldProps = { desktop, inkColor: c.ink, placeholderColor: c.ink3, lineColor: c.line, accentColor: c.accent };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <ModalCard desktop={desktop} themeVars={themeVars} onClose={close} title="Change password">
        <FieldLabel desktop={desktop}>NEW PASSWORD</FieldLabel>
        <ModalField
          {...fieldProps}
          autoFocus
          icon={<Lock size={16} color={c.ink3} strokeWidth={1.8} />}
          right={eye}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          secureTextEntry={!show}
          autoCapitalize="none"
        />
        <View className="mb-3.5 mt-2 flex-row items-center gap-1.5">
          <Check size={12} color={longEnough ? c.success : c.ink3} strokeWidth={2.6} />
          <Text style={{ color: longEnough ? c.success : c.ink3 }} className="font-mono text-[10.5px]">at least 8 characters</Text>
        </View>

        <FieldLabel desktop={desktop}>CONFIRM PASSWORD</FieldLabel>
        <ModalField
          {...fieldProps}
          error={mismatch}
          icon={<Lock size={16} color={c.ink3} strokeWidth={1.8} />}
          right={eye}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry={!show}
          autoCapitalize="none"
        />
        {error ? (
          <Text style={{ color: "#D2604A" }} className="mt-2 text-[12px] font-semibold">{error}</Text>
        ) : mismatch ? (
          <Text style={{ color: "#D2604A" }} className="mt-2 text-[12px] font-semibold">Passwords don't match</Text>
        ) : null}

        <ModalButtons onCancel={close} onConfirm={save} confirmLabel="Save" busy={busy} valid={valid} desktop={desktop} accentColor={c.accent} />
      </ModalCard>
    </Modal>
  );
}

function ChangeEmailModal({
  visible,
  desktop,
  currentEmail,
  onClose,
  onSubmit,
  themeVars,
}: {
  visible: boolean;
  desktop: boolean;
  currentEmail: string;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
  themeVars: Record<string, string>;
}) {
  const c = useThemeColors();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setEmail("");
    setError(null);
    setBusy(false);
    onClose();
  };

  const valid =
    credentials.shape.email.safeParse(email.trim()).success &&
    email.trim().toLowerCase() !== currentEmail.toLowerCase();

  const save = async () => {
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      await onSubmit(email.trim());
      close();
      Alert.alert("Confirm your new email", `We sent a confirmation link to ${email.trim()}.`);
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  // Hex + alpha so the tint follows the user's switchable accent (8% bg / 22% border per handoff).
  const noteBg = desktop ? `${c.accent}14` : CORAL_SOFT;
  const noteBorder = desktop ? `${c.accent}38` : "transparent";

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <ModalCard desktop={desktop} themeVars={themeVars} onClose={close} title="Change email">
        <View className="bg-chip mb-3.5 h-[42px] flex-row items-center gap-2.5 rounded-[11px] px-3.5">
          <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.16em]">CURRENT</Text>
          <Text className="text-ink-2 font-mono text-[12.5px]">{currentEmail || "—"}</Text>
        </View>

        <FieldLabel desktop={desktop}>NEW EMAIL</FieldLabel>
        <ModalField
          desktop={desktop}
          inkColor={c.ink}
          placeholderColor={c.ink3}
          lineColor={c.line}
          accentColor={c.accent}
          autoFocus
          icon={<Mail size={16} color={c.ink3} strokeWidth={1.8} />}
          value={email}
          onChangeText={setEmail}
          placeholder="new@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {error ? <Text style={{ color: "#D2604A" }} className="mt-2 text-[12px] font-semibold">{error}</Text> : null}

        <View className="mt-3.5 flex-row items-start gap-2.5 rounded-[12px] p-3" style={{ backgroundColor: noteBg, borderWidth: 1, borderColor: noteBorder }}>
          <AlertCircle size={15} color={desktop ? c.accent : CORAL} strokeWidth={2} style={{ marginTop: 1 }} />
          <Text className="text-ink-2 flex-1 text-[12px] leading-[17px]">
            We'll send a confirmation link to the new address. Your email updates once you tap it.
          </Text>
        </View>

        <ModalButtons onCancel={close} onConfirm={save} confirmLabel="Send link" busy={busy} valid={valid} desktop={desktop} accentColor={c.accent} />
      </ModalCard>
    </Modal>
  );
}
