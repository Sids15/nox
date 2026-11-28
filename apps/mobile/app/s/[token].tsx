import { ShareRepository } from "@nox/api";
import { useThemeColors } from "@nox/features";
import type { SharedView } from "@nox/types";
import { useLocalSearchParams } from "expo-router";
import { CheckCircle2, Circle, FileText, Lightbulb, Link2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TABULAR } from "../../components/menu";

const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * A shared note, idea or space, read-only. Public: no sign-in. Shows exactly what the `share`
 * function returns — text only — with a small "Made with Nox" footer.
 */
export default function SharedPage() {
  const c = useThemeColors();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [view, setView] = useState<SharedView | null | undefined>(undefined);

  useEffect(() => {
    const t = typeof token === "string" ? token : "";
    ShareRepository.open(t).then(setView).catch(() => setView(null));
  }, [token]);

  useEffect(() => {
    if (typeof document === "undefined" || !view) return;
    document.title = `${view.kind === "space" ? view.name : view.title} · Nox`;
  }, [view]);

  return (
    <SafeAreaView className="bg-bg flex-1">
      <ScrollView contentContainerStyle={{ paddingVertical: 32, paddingBottom: 80 }}>
        <View className="px-screen" style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
          {view === undefined ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 80 }} />
          ) : view === null ? (
            <View className="items-center py-24">
              <Text className="text-ink text-[20px] font-semibold">This link doesn't work</Text>
              <Text className="text-ink-3 mt-2 text-center text-[14px]">It may have been turned off by the person who shared it.</Text>
            </View>
          ) : view.kind === "space" ? (
            <>
              <Text className="text-ink font-serif text-[30px] font-bold tracking-[-0.01em]">
                {view.icon ? `${view.icon} ` : ""}
                {view.name}
              </Text>
              {view.goal || view.due_date ? (
                <Text className="text-ink-2 mt-1 text-[15px]">
                  {view.goal}
                  {view.goal && view.due_date ? " · " : ""}
                  {view.due_date ? `by ${day(view.due_date)}` : ""}
                </Text>
              ) : null}
              {view.tasks.length > 0 ? (
                <>
                  <Text className="text-ink-3 mb-1 mt-7 text-[12px] font-semibold">
                    Tasks · {view.tasks.filter((t) => t.done).length} of {view.tasks.length} done
                  </Text>
                  {view.tasks.map((t, i) => (
                    <View key={i} className="border-line flex-row items-center gap-2.5 border-b py-2.5">
                      {t.done ? <CheckCircle2 size={17} color={c.accent} strokeWidth={2} /> : <Circle size={17} color={c.ink3} strokeWidth={2} />}
                      <Text className={`flex-1 text-[15px] ${t.done ? "text-ink-3 line-through" : "text-ink"}`}>{t.title}</Text>
                      {t.due_date ? (
                        <Text style={TABULAR} className="text-ink-3 text-[12px]">
                          {day(t.due_date)}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}
              {view.pages.length > 0 ? (
                <>
                  <Text className="text-ink-3 mb-1 mt-7 text-[12px] font-semibold">Notes and ideas</Text>
                  {view.pages.map((p, i) => (
                    <View key={i} className="flex-row items-center gap-2.5 py-2">
                      {p.kind === "idea" ? <Lightbulb size={15} color={c.ink3} strokeWidth={2} /> : <FileText size={15} color={c.ink3} strokeWidth={2} />}
                      <Text className="text-ink-2 flex-1 text-[15px]">{p.title}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <>
              {view.status ? <Text className="text-ink-3 mb-1 text-[12px] font-semibold uppercase">{view.status}</Text> : null}
              <Text className="text-ink font-serif text-[30px] font-bold tracking-[-0.01em]">{view.title}</Text>
              {view.description ? <Text className="text-ink-2 mt-3 text-[16px] leading-[24px]">{view.description}</Text> : null}
              <View className="mt-4 gap-3">
                {view.blocks.map((b, i) =>
                  b.type === "link" ? (
                    <Pressable key={i} onPress={() => void Linking.openURL(b.url)} accessibilityRole="link" className="border-line flex-row items-center gap-2 rounded-[10px] border px-3 py-2">
                      <Link2 size={14} color={c.ink3} strokeWidth={2} />
                      <Text numberOfLines={1} className="text-accent flex-1 text-[14px]">
                        {b.title || b.url}
                      </Text>
                    </Pressable>
                  ) : b.type === "heading" ? (
                    <Text key={i} className={`text-ink font-semibold ${b.level === 1 ? "text-[24px]" : "text-[20px]"}`}>
                      {b.text}
                    </Text>
                  ) : b.text ? (
                    <Text key={i} selectable className="text-ink-2 text-[16px] leading-[25px]">
                      {b.text}
                    </Text>
                  ) : null,
                )}
              </View>
            </>
          )}
          {view ? <Text className="text-ink-3 mt-12 text-center text-[12px]">Shared from Nox · view only</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
