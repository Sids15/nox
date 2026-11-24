import { useThemeColors, type WidgetSection, type WidgetSnapshot } from "@nox/features";
import { formatTime12 } from "@nox/utils";
import { Circle, CircleCheck, FileText, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { TABULAR } from "../menu";

export interface WidgetActions {
  onToggleTask: (id: string, done: boolean) => void;
  onOpen: (path: string) => void;
  onCapture: (title: string) => void;
}

/**
 * The widget's content, drawn from a snapshot: the same sections, in the same order, as the Android
 * home-screen widget. Interactive here (tick a task, add one, open anything).
 */
export function WidgetView({ snapshot, actions }: { snapshot: WidgetSnapshot; actions: WidgetActions }) {
  if (snapshot.sections.length === 0) {
    return <Text className="text-ink-3 px-1 py-6 text-center text-[13px]">Nothing to show. Pick what the widget shows in Settings → Widget.</Text>;
  }
  return (
    <View className={snapshot.compact ? "gap-3" : "gap-4"}>
      {snapshot.sections.map((s, i) => (
        <Section key={`${s.kind}${i}`} section={s} compact={snapshot.compact} actions={actions} />
      ))}
    </View>
  );
}

function Heading({ children, right }: { children: string; right?: string }) {
  return (
    <View className="mb-1 flex-row items-baseline justify-between px-1">
      <Text className="text-ink-3 text-[11px] font-semibold tracking-[0.05em]">{children.toUpperCase()}</Text>
      {right ? (
        <Text style={TABULAR} className="text-ink-3 text-[11px]">
          {right}
        </Text>
      ) : null}
    </View>
  );
}

function Section({ section, compact, actions }: { section: WidgetSection; compact: boolean; actions: WidgetActions }) {
  const c = useThemeColors();
  const rowPad = compact ? "py-1" : "py-1.5";

  switch (section.kind) {
    case "today":
      return (
        <View>
          <Heading right={section.total ? `${section.done}/${section.total}` : undefined}>Today</Heading>
          {section.total > 0 ? (
            <View className="bg-chip mx-1 mb-1.5 h-[3px] overflow-hidden rounded-full">
              <View className="bg-accent h-full" style={{ width: `${(100 * section.done) / section.total}%` }} />
            </View>
          ) : null}
          {section.items.length === 0 ? <Text className="text-ink-3 px-1 text-[13px]">Nothing left today.</Text> : null}
          {section.items.map((t) => (
            <View key={t.id} className={`flex-row items-center gap-2 rounded-[8px] px-1 ${rowPad}`}>
              <Pressable onPress={() => actions.onToggleTask(t.id, !t.done)} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={t.title}>
                {t.done ? <CircleCheck size={17} color={c.accent} strokeWidth={2} /> : <Circle size={17} color={c.ink3} strokeWidth={2} />}
              </Pressable>
              <Pressable onPress={() => actions.onOpen(`/task/${t.id}`)} className="hover:opacity-70 flex-1 flex-row items-center gap-2">
                <Text numberOfLines={1} className={`flex-1 text-[13px] ${t.done ? "text-ink-3 line-through" : "text-ink"}`}>
                  {t.title}
                </Text>
                {t.time ? (
                  <Text style={TABULAR} className="text-ink-3 text-[11px]">
                    {formatTime12(t.time)}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          ))}
          {section.more > 0 ? (
            <Pressable onPress={() => actions.onOpen("/(tabs)/tasks")} className="px-1 pt-0.5">
              <Text className="text-ink-3 text-[12px]">+{section.more} more</Text>
            </Pressable>
          ) : null}
        </View>
      );
    case "next":
      return (
        <View>
          <Heading>Up next</Heading>
          {section.items.length === 0 ? <Text className="text-ink-3 px-1 text-[13px]">Nothing else at a set time today.</Text> : null}
          {section.items.map((t) => (
            <Pressable key={t.id} onPress={() => actions.onOpen(`/task/${t.id}`)} className={`hover:bg-chip flex-row items-baseline gap-2.5 rounded-[8px] px-1 ${rowPad}`}>
              <Text style={TABULAR} className="text-accent w-[56px] text-[12px] font-semibold">
                {formatTime12(t.time)}
              </Text>
              <Text numberOfLines={1} className="text-ink flex-1 text-[13px]">
                {t.title}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    case "capture":
      return <Capture onCapture={actions.onCapture} />;
    case "space":
      return (
        <View>
          <Heading right={`${section.pages} pages`}>{`${section.icon ? `${section.icon} ` : ""}${section.name}`}</Heading>
          <Pressable onPress={() => actions.onOpen(`/space/${section.spaceId}`)} className="hover:bg-chip flex-row flex-wrap gap-1.5 rounded-[8px] px-1 py-1">
            {section.stages.length === 0 ? <Text className="text-ink-3 text-[13px]">No stages in this space.</Text> : null}
            {section.stages.map((st) => (
              <View key={st.name} className="bg-chip flex-row items-center gap-1 rounded-[6px] px-1.5 py-0.5">
                <Text className="text-ink-2 text-[12px]">{st.name}</Text>
                <Text style={TABULAR} className={`text-[12px] font-semibold ${st.count ? "text-ink" : "text-ink-3"}`}>
                  {st.count}
                </Text>
              </View>
            ))}
          </Pressable>
        </View>
      );
    case "pinned":
      return (
        <View>
          <Heading>Pinned</Heading>
          {section.items.length === 0 ? <Text className="text-ink-3 px-1 text-[13px]">Pin a note to see it here.</Text> : null}
          {section.items.map((n) => (
            <Pressable key={n.id} onPress={() => actions.onOpen(`/note/${n.id}`)} className={`hover:bg-chip flex-row items-center gap-2 rounded-[8px] px-1 ${rowPad}`}>
              <FileText size={13} color={c.ink3} strokeWidth={2} />
              <Text numberOfLines={1} className="text-ink flex-1 text-[13px]">
                {n.title}
              </Text>
            </Pressable>
          ))}
        </View>
      );
  }
}

function Capture({ onCapture }: { onCapture: (title: string) => void }) {
  const c = useThemeColors();
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t.slice(0, 200));
    setText("");
  };
  return (
    <View className="bg-surface border-line h-[36px] flex-row items-center gap-2 rounded-[10px] border px-2.5">
      <Plus size={14} color={c.ink3} strokeWidth={2.2} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder="Add a task for today"
        placeholderTextColor={c.ink3}
        returnKeyType="done"
        maxLength={200}
        className="text-ink flex-1 text-[13px]"
        style={{ paddingVertical: 0 }}
      />
    </View>
  );
}
