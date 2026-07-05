import { useAuth, useThemeColors, useThemeVars } from "@nox/features";
import { credentials } from "@nox/types";
import { displayNameFrom, initialsFrom, monthShort, toDateKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { vars } from "nativewind";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authErrorMessage } from "../lib/auth-errors";
import { CORAL, CORAL_BORDER, CORAL_SOFT } from "../lib/auth-theme";

/** Coral field label used inside the account modals. */
function ModalLabel({ children }: { children: string }) {
  return (
    <Text style={{ color: CORAL }} className="mb-1.5 font-mono text-[10px] font-semibold tracking-[0.16em]">{children}</Text>
  );
}

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
  const { session, updatePassword, updateEmail } = useAuth();

  const email = session?.user?.email ?? "";
  const name = displayNameFrom(email);
  const joined = memberSince(session?.user?.created_at);

  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-screen flex-row items-center gap-3 pt-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Go back"
            className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center"
          >
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink text-2xl font-bold tracking-[-0.02em]">Account</Text>
        </View>

        {/* Profile header (centered) */}
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

        {/* Security */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">SECURITY</Text>
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

      <ChangePasswordModal visible={pwOpen} onClose={() => setPwOpen(false)} onSubmit={updatePassword} themeVars={themeVars} />
      <ChangeEmailModal visible={emailOpen} currentEmail={email} onClose={() => setEmailOpen(false)} onSubmit={updateEmail} themeVars={themeVars} />
    </SafeAreaView>
  );
}

/** Elevated coral-outlined modal card shared by both actions. */
function ModalCard({ children, themeVars, onClose }: { children: React.ReactNode; themeVars: Record<string, string>; onClose: () => void }) {
  return (
    <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-7">
      <Pressable
        onPress={() => {}}
        className="bg-elev w-full rounded-[20px] border p-5"
        style={{ borderColor: "rgba(232,103,76,0.32)", shadowColor: CORAL, shadowOpacity: 0.28, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 16 }}
      >
        {children}
      </Pressable>
    </Pressable>
  );
}

/** Coral-bordered text field with a leading icon and optional trailing adornment. */
function CoralField({
  icon,
  right,
  inkColor,
  placeholderColor,
  ...rest
}: {
  icon: React.ReactNode;
  right?: React.ReactNode;
  inkColor: string;
  placeholderColor: string;
} & Omit<React.ComponentProps<typeof TextInput>, "style">) {
  return (
    <View className="bg-chip rounded-input h-[50px] flex-row items-center gap-2.5 px-3.5" style={{ borderWidth: 1, borderColor: CORAL_BORDER }}>
      {icon}
      <TextInput className="flex-1 text-[15px]" style={{ paddingVertical: 0, color: inkColor }} placeholderTextColor={placeholderColor} {...rest} />
      {right}
    </View>
  );
}

function ModalButtons({ onCancel, onConfirm, confirmLabel, busy }: { onCancel: () => void; onConfirm: () => void; confirmLabel: string; busy: boolean }) {
  return (
    <View className="mt-5 flex-row gap-3">
      <Pressable onPress={onCancel} className="border-line flex-1 items-center rounded-[13px] border py-[13px]">
        <Text className="text-ink-2 text-[14.5px] font-semibold">Cancel</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={busy}
        className={`flex-1 items-center rounded-[13px] py-[13px] ${busy ? "opacity-60" : ""}`}
        style={{ backgroundColor: CORAL, shadowColor: CORAL, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <Text className="text-[14.5px] font-bold text-white">{busy ? "…" : confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

function ChangePasswordModal({
  visible,
  onClose,
  onSubmit,
  themeVars,
}: {
  visible: boolean;
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

  const save = async () => {
    setError(null);
    if (!longEnough) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pw !== confirm) {
      setError("Passwords don't match.");
      return;
    }
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

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <ModalCard themeVars={themeVars} onClose={close}>
        <Text className="text-ink mb-4 text-[18px] font-bold tracking-[-0.01em]">Change password</Text>

        <ModalLabel>NEW PASSWORD</ModalLabel>
        <CoralField
          autoFocus
          icon={<Lock size={16} color={c.ink3} strokeWidth={1.8} />}
          right={eye}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          secureTextEntry={!show}
          autoCapitalize="none"
          inkColor={c.ink}
          placeholderColor={c.ink3}
        />
        <View className="mb-3.5 mt-2 flex-row items-center gap-1.5">
          <Check size={12} color={longEnough ? c.success : c.ink3} strokeWidth={2.6} />
          <Text style={{ color: longEnough ? c.success : c.ink3 }} className="text-[11.5px]">at least 8 characters</Text>
        </View>

        <ModalLabel>CONFIRM PASSWORD</ModalLabel>
        <CoralField
          icon={<Lock size={16} color={c.ink3} strokeWidth={1.8} />}
          right={eye}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry={!show}
          autoCapitalize="none"
          inkColor={c.ink}
          placeholderColor={c.ink3}
        />
        {error ? (
          <Text style={{ color: CORAL }} className="mt-2 text-[12.5px]">{error}</Text>
        ) : mismatch ? (
          <Text style={{ color: CORAL }} className="mt-2 text-[12.5px]">Passwords don't match</Text>
        ) : null}

        <ModalButtons onCancel={close} onConfirm={save} confirmLabel="Save" busy={busy} />
      </ModalCard>
    </Modal>
  );
}

function ChangeEmailModal({
  visible,
  currentEmail,
  onClose,
  onSubmit,
  themeVars,
}: {
  visible: boolean;
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

  const save = async () => {
    setError(null);
    if (!credentials.shape.email.safeParse(email.trim()).success) {
      setError("Enter a valid email address.");
      return;
    }
    if (email.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError("That's already your email.");
      return;
    }
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

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <ModalCard themeVars={themeVars} onClose={close}>
        <Text className="text-ink mb-4 text-[18px] font-bold tracking-[-0.01em]">Change email</Text>

        <ModalLabel>CURRENT</ModalLabel>
        <View className="bg-chip rounded-input mb-3.5 h-[46px] justify-center px-3.5">
          <Text className="text-ink-3 text-[14px]">{currentEmail || "—"}</Text>
        </View>

        <ModalLabel>NEW EMAIL</ModalLabel>
        <CoralField
          autoFocus
          icon={<Mail size={16} color={c.ink3} strokeWidth={1.8} />}
          value={email}
          onChangeText={setEmail}
          placeholder="new@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inkColor={c.ink}
          placeholderColor={c.ink3}
        />
        {error ? <Text style={{ color: CORAL }} className="mt-2 text-[12.5px]">{error}</Text> : null}

        <View className="mt-3.5 flex-row items-start gap-2.5 rounded-[12px] p-3" style={{ backgroundColor: CORAL_SOFT }}>
          <AlertCircle size={15} color={CORAL} strokeWidth={2} style={{ marginTop: 1 }} />
          <Text className="text-ink-2 flex-1 text-[12px] leading-[17px]">
            We'll send a confirmation link to the new address. Your email updates once you tap it.
          </Text>
        </View>

        <ModalButtons onCancel={close} onConfirm={save} confirmLabel="Send link" busy={busy} />
      </ModalCard>
    </Modal>
  );
}
