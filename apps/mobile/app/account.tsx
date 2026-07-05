import { useAuth, useThemeColors, useThemeVars } from "@nox/features";
import { credentials } from "@nox/types";
import { displayNameFrom, initialsFrom, monthShort, toDateKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react-native";
import { vars } from "nativewind";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authErrorMessage } from "../lib/auth-errors";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-2 mt-6 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">
      {children}
    </Text>
  );
}

function memberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const m = monthShort(toDateKey(d));
  return `${m[0]!.toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
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

        {/* Profile header */}
        <View className="mx-[20px] border-line bg-surface rounded-card mt-4 flex-row items-center gap-[13px] border p-[14px]">
          <View className="bg-accent/[0.18] h-12 w-12 items-center justify-center rounded-full">
            <Text className="text-accent text-[16px] font-bold">{initialsFrom(email)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-ink text-[16px] font-semibold">{name}</Text>
            <Text className="text-ink-3 mt-0.5 text-[12.5px]">{email || "not signed in"}</Text>
            {joined ? <Text className="text-ink-3 mt-1 font-mono text-[10px]">MEMBER SINCE {joined.toUpperCase()}</Text> : null}
          </View>
        </View>

        {/* Security */}
        <View className="px-screen">
          <SectionLabel>SECURITY</SectionLabel>
        </View>
        <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
          <Pressable onPress={() => setPwOpen(true)} className="border-line flex-row items-center gap-3 border-b px-[14px] py-[13px]">
            <KeyRound size={17} color={c.ink3} strokeWidth={1.8} />
            <Text className="text-ink flex-1 text-[14.5px]">Change password</Text>
            <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
          </Pressable>
          <Pressable onPress={() => setEmailOpen(true)} className="flex-row items-center gap-3 px-[14px] py-[13px]">
            <Mail size={17} color={c.ink3} strokeWidth={1.8} />
            <Text className="text-ink flex-1 text-[14.5px]">Change email</Text>
            <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>

      <ChangePasswordModal visible={pwOpen} onClose={() => setPwOpen(false)} onSubmit={updatePassword} themeVars={themeVars} />
      <ChangeEmailModal visible={emailOpen} currentEmail={email} onClose={() => setEmailOpen(false)} onSubmit={updateEmail} themeVars={themeVars} />
    </SafeAreaView>
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

  const reset = () => {
    setPw("");
    setConfirm("");
    setShow(false);
    setError(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    setError(null);
    if (!credentials.shape.password.safeParse(pw).success) {
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

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <Pressable onPress={close} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full border p-4">
          <Text className="text-ink mb-3 text-[15px] font-semibold">Change password</Text>
          <View className="bg-chip rounded-input mb-2.5 h-11 flex-row items-center gap-2.5 px-3">
            <TextInput
              autoFocus
              value={pw}
              onChangeText={setPw}
              placeholder="New password"
              placeholderTextColor={c.ink3}
              secureTextEntry={!show}
              autoCapitalize="none"
              className="text-ink flex-1 text-[14px]"
              style={{ paddingVertical: 0 }}
            />
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
              {show ? <EyeOff size={17} color={c.ink3} strokeWidth={1.8} /> : <Eye size={17} color={c.ink3} strokeWidth={1.8} />}
            </Pressable>
          </View>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderTextColor={c.ink3}
            secureTextEntry={!show}
            autoCapitalize="none"
            className="bg-chip rounded-input text-ink h-11 px-3 text-[14px]"
            style={{ paddingVertical: 0 }}
          />
          {error ? <Text className="text-critical mt-2 text-[12.5px]">{error}</Text> : null}
          <View className="mt-4 flex-row justify-end gap-2">
            <Pressable onPress={close} className="px-4 py-2">
              <Text className="text-ink-2 text-[14px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} className={`bg-accent rounded-input px-4 py-2 ${busy ? "opacity-60" : ""}`}>
              <Text className="text-on-accent text-[14px] font-semibold">{busy ? "Saving…" : "Update"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
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
    if (!credentials.shape.email.safeParse(email).success) {
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
      <Pressable onPress={close} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full border p-4">
          <Text className="text-ink mb-1 text-[15px] font-semibold">Change email</Text>
          <Text className="text-ink-3 mb-3 text-[12.5px] leading-[18px]">We'll send a confirmation link to the new address before it takes effect.</Text>
          <TextInput
            autoFocus
            value={email}
            onChangeText={setEmail}
            placeholder="new@email.com"
            placeholderTextColor={c.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            className="bg-chip rounded-input text-ink h-11 px-3 text-[14px]"
            style={{ paddingVertical: 0 }}
          />
          {error ? <Text className="text-critical mt-2 text-[12.5px]">{error}</Text> : null}
          <View className="mt-4 flex-row justify-end gap-2">
            <Pressable onPress={close} className="px-4 py-2">
              <Text className="text-ink-2 text-[14px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} className={`bg-accent rounded-input px-4 py-2 ${busy ? "opacity-60" : ""}`}>
              <Text className="text-on-accent text-[14px] font-semibold">{busy ? "Sending…" : "Send link"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
