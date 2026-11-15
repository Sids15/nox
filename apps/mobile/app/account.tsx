import { useAuth, useFolders, useIdeas, useNotes, useResources, useTags, useTasks, useThemeColors, useThemeVars } from "@nox/features";
import { credentials } from "@nox/types";
import { monthShort, toDateKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { AlertCircle, CalendarHeart, Check, ChevronLeft, ChevronRight, Download, Eye, EyeOff, Lock, LogOut, Mail, Pencil, Trash2, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Alert } from "../lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sidebar } from "../components/sidebar";
import { authErrorMessage } from "../lib/auth-errors";
import { useIdentity } from "../lib/use-identity";
import { useIsDesktop } from "../lib/use-responsive";
import { goBack } from "../lib/go-back";
import { SectionHeading, sentenceCase } from "../components/section-heading";

function memberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const m = monthShort(toDateKey(d));
  return `${m[0]}${m.slice(1).toLowerCase()} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AccountScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const isDesktop = useIsDesktop();
  const { session, updatePassword, updateEmail, signOut, deleteAccount, updateProfile } = useAuth();

  // Mirrors reset-password.tsx: end the session and send the user back to sign in with the new
  // credential. `finally` so a failed sign-out still leaves them on the login screen rather than
  // stranded in an authed shell whose password just changed.
  const afterPasswordChange = async () => {
    try {
      await signOut();
    } finally {
      router.replace("/(auth)/login");
    }
  };

  const email = session?.user?.email ?? "";
  const { name, initials } = useIdentity();
  const joined = memberSince(session?.user?.created_at);

  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const afterDelete = () => {
    setDeleteOpen(false);
    router.replace("/(auth)/login");
  };

  // Name, edited in place; saved to the account so every device shows it.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const currentName = (session?.user?.user_metadata?.display_name as string | undefined) ?? "";
  const saveName = async () => {
    const next = (nameDraft ?? "").trim().slice(0, 60);
    setNameDraft(null);
    if (!next || next === currentName) return;
    setNameBusy(true);
    try {
      await updateProfile({ display_name: next });
    } catch {
      Alert.alert("Couldn't save your name", "Check your connection and try again.");
    } finally {
      setNameBusy(false);
    }
  };

  // What's in the account, for "Your data" and the export.
  const { data: notes = [] } = useNotes();
  const { data: ideas = [] } = useIdeas();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();
  const { data: folders = [] } = useFolders();
  const { data: tags = [] } = useTags();
  const canExport = Platform.OS === "web" && typeof document !== "undefined";
  const exportAll = () => {
    if (!canExport) return;
    const data = { exported_at: new Date().toISOString(), app: "nox", notes, folders, ideas, tasks, resources, tags };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nox-export-${toDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const row = (opts: { icon: ReactNode; title: string; detail?: string; right?: ReactNode; onPress?: () => void; last?: boolean; danger?: boolean }) => {
    const inner = (
      <>
        {opts.icon}
        <View className="min-w-0 flex-1">
          <Text style={opts.danger ? { color: c.high } : undefined} className={`text-[15px] font-medium ${opts.danger ? "" : "text-ink"}`}>
            {opts.title}
          </Text>
          {opts.detail ? (
            <Text numberOfLines={2} className="text-ink-3 mt-0.5 text-[13px]">
              {opts.detail}
            </Text>
          ) : null}
        </View>
        {opts.right ?? (opts.onPress ? <ChevronRight size={16} color={opts.danger ? c.high : c.ink3} strokeWidth={2} /> : null)}
      </>
    );
    const cls = `min-h-[58px] flex-row items-center gap-3.5 px-4 py-3 ${opts.last ? "" : "border-line border-b"}`;
    return opts.onPress ? (
      <Pressable onPress={opts.onPress} accessibilityRole="button" className={`${cls} hover:bg-chip`}>
        {inner}
      </Pressable>
    ) : (
      <View className={cls}>{inner}</View>
    );
  };
  const group = (children: ReactNode, danger = false) => (
    <View className="bg-surface overflow-hidden rounded-[14px] border" style={{ borderColor: danger ? `${c.high}33` : c.line }}>
      {children}
    </View>
  );
  const section = (title: string, intro: string, body: ReactNode) => (
    <View className="mt-8">
      <Text className="text-ink font-serif text-[20px] font-bold">{title}</Text>
      <Text className="text-ink-3 mb-3 mt-0.5 text-[13px]">{intro}</Text>
      {body}
    </View>
  );
  const stat = (n: number, label: string) => (
    <View key={label} className="min-w-[70px] flex-1 px-3.5 py-3">
      <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink font-serif text-[24px] font-bold">
        {n}
      </Text>
      <Text className="text-ink-3 text-[13px]">{label}</Text>
    </View>
  );

  const body = (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 60, paddingTop: isDesktop ? 30 : 8, maxWidth: 640, width: "100%", alignSelf: "center", paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center gap-2">
        <Pressable onPress={() => goBack("/settings")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to settings" className="hover:bg-chip -ml-2 h-9 flex-row items-center rounded-[10px] pl-1 pr-2.5">
          <ChevronLeft size={19} color={c.ink2} strokeWidth={2.2} />
          <Text className="text-ink-2 text-[14px] font-semibold">Settings</Text>
        </Pressable>
      </View>
      <Text className="text-ink mt-2 font-serif text-[30px] font-bold">Account</Text>

      {/* Profile */}
      <View className="border-line bg-surface mt-5 rounded-[16px] border p-5">
        <View className="flex-row items-center gap-4">
          <View className="bg-accent/[0.14] h-16 w-16 items-center justify-center rounded-full">
            <Text className="text-accent font-serif text-[20px] font-bold">{initials}</Text>
          </View>
          <View className="min-w-0 flex-1">
            {nameDraft !== null ? (
              <TextInput
                autoFocus
                value={nameDraft}
                onChangeText={setNameDraft}
                onSubmitEditing={() => void saveName()}
                onBlur={() => void saveName()}
                maxLength={60}
                placeholder="Your name"
                placeholderTextColor={c.ink3}
                accessibilityLabel="Your name"
                className="text-ink border-accent rounded-[9px] border px-2 text-[17px] font-semibold"
                style={{ height: 36, outlineWidth: 0 } as object}
              />
            ) : (
              <Pressable onPress={() => setNameDraft(currentName || name)} accessibilityRole="button" accessibilityLabel={`Name: ${name}. Edit`} className="group -ml-2 flex-row items-center gap-2 self-start rounded-[9px] px-2 py-1 hover:bg-chip">
                <Text numberOfLines={1} className="text-ink text-[20px] font-semibold">
                  {name}
                </Text>
                <Pencil size={13} color={c.ink3} strokeWidth={2} />
              </Pressable>
            )}
            <Text numberOfLines={1} className="text-ink-3 mt-0.5 text-[14px]">
              {email || "Not signed in"}
              {nameBusy ? " · saving…" : ""}
            </Text>
          </View>
        </View>
        {joined ? (
          <View className="border-line mt-4 flex-row items-center gap-2 border-t pt-3.5">
            <CalendarHeart size={14} color={c.ink3} strokeWidth={2} />
            <Text className="text-ink-3 text-[13px]">Member since {joined}</Text>
          </View>
        ) : null}
      </View>

      {section(
        "Your data",
        "Everything in your notebook, synced across your devices.",
        <>
          {group(
            <View className="flex-row flex-wrap">
              {stat(notes.filter((n) => !n.deleted).length, "notes")}
              {stat(ideas.filter((i) => !i.deleted).length, "ideas")}
              {stat(tasks.filter((t) => !t.deleted).length, "tasks")}
              {stat(resources.filter((r) => !r.deleted).length, "resources")}
            </View>,
          )}
          <View className="mt-3">
            {group(
              row({
                icon: <Download size={17} color={c.ink2} strokeWidth={2} />,
                title: "Export everything",
                detail: canExport
                  ? "Download your notes, ideas, tasks, resources, folders and tags as one JSON file."
                  : "Open Nox in a browser or on your computer to download a copy of your data.",
                onPress: canExport ? exportAll : undefined,
                last: true,
              }),
            )}
          </View>
        </>,
      )}

      {section(
        "Sign-in & security",
        "How you get into your account.",
        group(
          <>
            {row({ icon: <Mail size={17} color={c.ink2} strokeWidth={2} />, title: "Email", detail: email || "—", onPress: () => setEmailOpen(true), right: <Text className="text-accent text-[14px] font-semibold">Change</Text> })}
            {row({ icon: <Lock size={17} color={c.ink2} strokeWidth={2} />, title: "Password", detail: "You'll sign in again after changing it.", onPress: () => setPwOpen(true), right: <Text className="text-accent text-[14px] font-semibold">Change</Text> })}
            {row({ icon: <LogOut size={17} color={c.ink2} strokeWidth={2} />, title: "Sign out of this device", detail: "Your notebook stays in your account.", onPress: () => void signOut(), last: true })}
          </>,
        ),
      )}

      {section(
        "Delete account",
        "Permanently removes your account and everything in it, on every device.",
        group(
          row({
            icon: <Trash2 size={17} color={c.high} strokeWidth={2} />,
            title: "Delete my account",
            detail: canExport ? "No undo. Export your data first if you want a copy." : "No undo.",
            onPress: () => setDeleteOpen(true),
            danger: true,
            last: true,
          }),
          true,
        ),
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">{body}</View>
      </View>

      <ChangePasswordModal visible={pwOpen} desktop={isDesktop} onClose={() => setPwOpen(false)} onSubmit={updatePassword} onChanged={() => void afterPasswordChange()} themeVars={themeVars} />
      <ChangeEmailModal visible={emailOpen} desktop={isDesktop} currentEmail={email} onClose={() => setEmailOpen(false)} onSubmit={updateEmail} themeVars={themeVars} />
      <DeleteAccountModal visible={deleteOpen} desktop={isDesktop} email={email} onClose={() => setDeleteOpen(false)} onSubmit={deleteAccount} onDeleted={afterDelete} themeVars={themeVars} />
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
            : { borderColor: c.line, shadowColor: "#1B2131", shadowOpacity: 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 16 }
        }
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-ink text-[17px] font-bold tracking-[-0.01em]">{title}</Text>
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

function FieldLabel({ children }: { children: string; desktop?: boolean }) {
  return <Text className="text-ink-2 mb-1.5 text-[13px] font-semibold">{sentenceCase(children)}</Text>;
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
  const border = error ? "#C2362B" : focused ? accentColor : lineColor;
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
  confirmColor,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy: boolean;
  valid: boolean;
  desktop: boolean;
  accentColor: string;
  /** Overrides the accent/coral fill — used by destructive confirms, which must not look routine. */
  confirmColor?: string;
}) {
  const bg = confirmColor ?? accentColor;
  return (
    <View className="mt-5 flex-row gap-3">
      <Pressable onPress={onCancel} className="bg-chip border-line flex-1 items-center rounded-[13px] border py-[13px]">
        <Text className="text-ink-2 text-[15px] font-semibold">Cancel</Text>
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
        <Text className="text-[15px] font-bold text-white">{busy ? "…" : confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

function ChangePasswordModal({
  visible,
  desktop,
  onClose,
  onSubmit,
  onChanged,
  themeVars,
}: {
  visible: boolean;
  desktop: boolean;
  onClose: () => void;
  onSubmit: (pw: string) => Promise<void>;
  /** Runs after a successful change: signs the user out and returns them to the login screen. */
  onChanged: () => void;
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
      Alert.alert("Password updated", "Sign in again with your new password.");
      // Changing the password invalidates nothing on other devices by itself, so end this session
      // explicitly and make the user re-authenticate with the new credential.
      onChanged();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  const eye = (
    <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
      {show ? <EyeOff size={17} color={c.ink3} strokeWidth={2} /> : <Eye size={17} color={c.ink3} strokeWidth={2} />}
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
          icon={<Lock size={16} color={c.ink3} strokeWidth={2} />}
          right={eye}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          secureTextEntry={!show}
          autoCapitalize="none"
        />
        <View className="mb-3.5 mt-2 flex-row items-center gap-1.5">
          <Check size={12} color={longEnough ? c.success : c.ink3} strokeWidth={2.6} />
          <Text style={{ color: longEnough ? c.success : c.ink3 }} className="text-[11px]">at least 8 characters</Text>
        </View>

        <FieldLabel desktop={desktop}>CONFIRM PASSWORD</FieldLabel>
        <ModalField
          {...fieldProps}
          error={mismatch}
          icon={<Lock size={16} color={c.ink3} strokeWidth={2} />}
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

/**
 * Permanent account deletion. Nothing here is recoverable and there is no undo, so the confirm is
 * gated on typing the account's own email rather than a single tap — the one input the user can't
 * produce by reflex. Deliberately not styled with the accent: this is the only destructive action
 * in the app and it should not look like the other two rows in SECURITY.
 */
function DeleteAccountModal({
  visible,
  desktop,
  email,
  onClose,
  onSubmit,
  onDeleted,
  themeVars,
}: {
  visible: boolean;
  desktop: boolean;
  email: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onDeleted: () => void;
  themeVars: Record<string, string>;
}) {
  const c = useThemeColors();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setTyped("");
    setError(null);
    setBusy(false);
    onClose();
  };

  const valid = typed.trim().toLowerCase() === email.toLowerCase() && email.length > 0;

  const destroy = async () => {
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      await onSubmit();
      // The session is already gone; don't reset state through `close()` on a screen that is
      // about to unmount — just hand control back to the caller, which navigates to sign-in.
      onDeleted();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <ModalCard desktop={desktop} themeVars={themeVars} onClose={close} title="Delete account">
        <View
          className="mb-4 flex-row items-start gap-2.5 rounded-[12px] p-3"
          style={{ backgroundColor: `${c.high}14`, borderWidth: 1, borderColor: `${c.high}38` }}
        >
          <AlertCircle size={15} color={c.high} strokeWidth={2} style={{ marginTop: 1 }} />
          <Text className="text-ink-2 flex-1 text-[12px] leading-[17px]">
            This deletes your tasks, ideas, notes, resources and uploaded media on every device.
            It cannot be undone.
          </Text>
        </View>

        <FieldLabel desktop={desktop}>{`TYPE ${email ? email.toUpperCase() : "YOUR EMAIL"} TO CONFIRM`}</FieldLabel>
        <ModalField
          desktop={desktop}
          inkColor={c.ink}
          placeholderColor={c.ink3}
          lineColor={c.line}
          accentColor={c.high}
          autoFocus
          icon={<Mail size={16} color={c.ink3} strokeWidth={2} />}
          value={typed}
          onChangeText={setTyped}
          placeholder={email || "your email"}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {error ? <Text style={{ color: c.high }} className="mt-2 text-[12px] font-semibold">{error}</Text> : null}

        <ModalButtons
          onCancel={close}
          onConfirm={destroy}
          confirmLabel="Delete forever"
          busy={busy}
          valid={valid}
          desktop={desktop}
          accentColor={c.accent}
          confirmColor={c.high}
        />
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
  const noteBg = `${c.accent}14`;
  const noteBorder = desktop ? `${c.accent}38` : "transparent";

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <ModalCard desktop={desktop} themeVars={themeVars} onClose={close} title="Change email">
        <View className="bg-chip mb-3.5 h-[42px] flex-row items-center gap-2.5 rounded-[11px] px-3.5">
          <Text className="text-ink-3 text-[12px] font-semibold">Current</Text>
          <Text className="text-ink-2 text-[13px]">{currentEmail || "—"}</Text>
        </View>

        <FieldLabel desktop={desktop}>NEW EMAIL</FieldLabel>
        <ModalField
          desktop={desktop}
          inkColor={c.ink}
          placeholderColor={c.ink3}
          lineColor={c.line}
          accentColor={c.accent}
          autoFocus
          icon={<Mail size={16} color={c.ink3} strokeWidth={2} />}
          value={email}
          onChangeText={setEmail}
          placeholder="new@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {error ? <Text style={{ color: "#D2604A" }} className="mt-2 text-[12px] font-semibold">{error}</Text> : null}

        <View className="mt-3.5 flex-row items-start gap-2.5 rounded-[12px] p-3" style={{ backgroundColor: noteBg, borderWidth: 1, borderColor: noteBorder }}>
          <AlertCircle size={15} color={c.accent} strokeWidth={2} style={{ marginTop: 1 }} />
          <Text className="text-ink-2 flex-1 text-[12px] leading-[17px]">
            We'll send a confirmation link to the new address. Your email updates once you tap it.
          </Text>
        </View>

        <ModalButtons onCancel={close} onConfirm={save} confirmLabel="Send link" busy={busy} valid={valid} desktop={desktop} accentColor={c.accent} />
      </ModalCard>
    </Modal>
  );
}
