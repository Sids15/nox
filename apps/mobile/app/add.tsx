import { useSpaces, useThemeColors } from "@nox/features";
import { useLocalSearchParams } from "expo-router";
import { FileText, Lightbulb, Link2, SquareCheckBig, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SpaceMark } from "../components/brain/space-mark";
import { firstUrl, looksLikeUrl, useQuickAdd, type QuickKind } from "../components/brain/use-quick-add";
import { pressScale } from "../components/menu";
import { goBack } from "../lib/go-back";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * "Add to Nox": one line, what it is, and which space. Opened by sharing to Nox (Android share
 * sheet, or the installed web app), and by the widgets' "+". A shared link is saved as a link.
 */
export default function AddScreen() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ text?: string; url?: string; title?: string; space?: string }>();
  const { data: spaces = [] } = useSpaces();
  const quickAdd = useQuickAdd();

  // What was shared: prefer a link (from `url`, or found inside `text`), else the text itself.
  const shared = useMemo(() => {
    const url = one(params.url) || firstUrl(one(params.text));
    return (url || one(params.text) || one(params.title)).trim().slice(0, 4000);
  }, [params.url, params.text, params.title]);
  const [draft, setDraft] = useState(shared);
  const [kind, setKind] = useState<QuickKind>("task");
  const active = spaces.filter((s) => !s.archived);
  const [spaceId, setSpaceId] = useState<string | null>(() => one(params.space) || null);

  const isLink = looksLikeUrl(draft);
  const effective: QuickKind = isLink ? "link" : kind === "link" ? "task" : kind;
  const close = () => {
    // Opened by the "Save to Nox" bookmarklet in its own little window: close it.
    if (Platform.OS === "web" && typeof window !== "undefined" && window.name === "nox-add") {
      window.close();
      return;
    }
    goBack("/tasks");
  };
  const save = () => {
    if (!draft.trim()) return;
    void quickAdd(draft, effective, { spaceId: spaceId && spaces.some((s) => s.id === spaceId) ? spaceId : null, inbox: true });
    close();
  };

  const KINDS = [
    { key: "task" as const, label: "Task", Icon: SquareCheckBig },
    { key: "idea" as const, label: "Idea", Icon: Lightbulb },
    { key: "note" as const, label: "Note", Icon: FileText },
    ...(isLink ? [{ key: "link" as const, label: "Link", Icon: Link2 }] : []),
  ];

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top", "bottom"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <View className="mb-4 flex-row items-center">
          <Text className="text-ink flex-1 font-serif text-[24px] font-bold">Add to Nox</Text>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="bg-chip h-[34px] w-[34px] items-center justify-center rounded-full">
            <X size={18} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
        </View>

        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={save}
          placeholder="Add a task (e.g. film intro friday), an idea, or paste a link"
          placeholderTextColor={c.ink3}
          returnKeyType="done"
          maxLength={4000}
          autoCapitalize={isLink ? "none" : "sentences"}
          className="bg-surface border-line text-ink rounded-[12px] border px-3 text-[16px]"
          style={{ paddingVertical: 12 }}
        />

        <View className="mt-2 flex-row flex-wrap gap-1">
          {KINDS.map(({ key, label, Icon }) => {
            const on = effective === key;
            return (
              <Pressable key={key} onPress={() => setKind(key)} accessibilityRole="radio" accessibilityState={{ checked: on }} className={`h-[32px] flex-row items-center gap-1.5 rounded-[8px] px-2.5 ${on ? "bg-accent/[0.12]" : "hover:bg-chip"}`}>
                <Icon size={14} color={on ? c.accent : c.ink3} strokeWidth={2} />
                <Text className={`text-[14px] font-medium ${on ? "text-accent" : "text-ink-3"}`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {active.length > 0 ? (
          <>
            <Text className="text-ink-3 mb-1.5 mt-5 text-[12px] font-semibold">Space</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {[{ id: null as string | null, name: "No space" }, ...active].map((s) => {
                const on = spaceId === s.id;
                return (
                  <Pressable key={s.id ?? "none"} onPress={() => setSpaceId(s.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} className={`h-[34px] flex-row items-center gap-1.5 rounded-pill border px-3 ${on ? "border-accent bg-accent/[0.08]" : "border-line hover:bg-chip"}`}>
                    {"icon" in s ? <SpaceMark space={s} size={18} /> : null}
                    <Text numberOfLines={1} className={`max-w-[180px] text-[13px] font-medium ${on ? "text-accent" : "text-ink-2"}`}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Pressable onPress={save} disabled={!draft.trim()} accessibilityRole="button" style={(st) => ({ ...pressScale(st), opacity: draft.trim() ? 1 : 0.5 })} className="bg-accent mt-6 h-[44px] items-center justify-center rounded-[12px]">
          <Text className="text-on-accent text-[15px] font-semibold">Add</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
