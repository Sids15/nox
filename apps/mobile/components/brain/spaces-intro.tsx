import { useThemeColors } from "@nox/features";
import { ChevronRight, FileText, Lightbulb, Link2, SquareCheckBig } from "lucide-react-native";
import { type ReactNode } from "react";
import { Text, View } from "react-native";
import { SpaceMark } from "./space-mark";

/** A tiny drawn version of the real screen, so each step shows what it means instead of describing it. */
export function Frame({ children }: { children: ReactNode }) {
  return <View className="bg-bg border-line h-[176px] justify-center overflow-hidden rounded-[14px] border px-4">{children}</View>;
}

function MiniSpace({ icon, name, meta }: { icon: string; name: string; meta: string }) {
  return (
    <View className="bg-surface border-line flex-row items-center gap-2.5 rounded-[10px] border px-2.5 py-2">
      <SpaceMark space={{ icon }} size={26} />
      <View className="flex-1">
        <Text className="text-ink text-[12px] font-semibold">{name}</Text>
        <Text className="text-ink-3 text-[11px]">{meta}</Text>
      </View>
    </View>
  );
}

export function StepSpaces() {
  return (
    <Frame>
      <View className="gap-1.5">
        <MiniSpace icon="clapperboard" name="Tech channel" meta="12 pages · 3 open tasks" />
        <MiniSpace icon="rocket" name="Nox launch" meta="8 pages · 5 open tasks" />
        <MiniSpace icon="file-text" name="PRDs" meta="6 pages · 1 open task" />
      </View>
    </Frame>
  );
}

export function StepInside() {
  const c = useThemeColors();
  const rows: { Icon: typeof FileText; t: string }[] = [
    { Icon: Lightbulb, t: "Rust in 100 seconds" },
    { Icon: FileText, t: "Sponsor talking points" },
    { Icon: SquareCheckBig, t: "Record the intro" },
    { Icon: Link2, t: "Reference video" },
  ];
  return (
    <Frame>
      <View className="mb-2 flex-row gap-1">
        {["All", "Notes", "Tasks", "Links"].map((t, i) => (
          <View key={t} className={`rounded-pill px-2 py-[3px] ${i === 1 ? "bg-ink" : "bg-chip"}`}>
            <Text className={`text-[11px] font-semibold ${i === 1 ? "text-bg" : "text-ink-2"}`}>{t}</Text>
          </View>
        ))}
      </View>
      {rows.map(({ Icon, t }) => (
        <View key={t} className="border-line flex-row items-center gap-2 border-b py-[5px]">
          <Icon size={11} color={c.ink3} strokeWidth={2} />
          <Text className="text-ink text-[11px]">{t}</Text>
        </View>
      ))}
    </Frame>
  );
}

export function StepBoard() {
  const c = useThemeColors();
  const cols: { name: string; cards: string[] }[] = [
    { name: "Idea", cards: ["Rust in 100s", "Desk tour"] },
    { name: "Script", cards: ["Why I left VS Code"] },
    { name: "Film", cards: [] },
  ];
  return (
    <Frame>
      <View className="flex-row gap-1.5">
        {cols.map((col, i) => (
          <View key={col.name} className="bg-surface border-line flex-1 rounded-[9px] border p-1.5" style={{ minHeight: 120 }}>
            <Text className="text-ink mb-1 text-[11px] font-semibold">{col.name}</Text>
            {col.cards.map((t) => (
              <View key={t} className="bg-bg border-line mb-1 rounded-[6px] border px-1.5 py-1">
                <Text className="text-ink text-[11px]">{t}</Text>
                {i === 0 && t === "Rust in 100s" ? (
                  <View className="mt-0.5 flex-row justify-end">
                    <View className="bg-accent/[0.16] rounded-[4px] px-0.5">
                      <ChevronRight size={9} color={c.accent} strokeWidth={2.6} />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </Frame>
  );
}

export function StepLinks() {
  const c = useThemeColors();
  return (
    <Frame>
      <Text className="text-ink text-[12px]">
        Script draft. See <Text className="text-accent font-semibold">[[Rust</Text>
      </Text>
      <View className="bg-elev border-line mt-1.5 rounded-[9px] border p-1">
        {["Rust in 100 seconds", "Rust learning notes"].map((t, i) => (
          <View key={t} className={`flex-row items-center gap-1.5 rounded-[6px] px-1.5 py-1 ${i === 0 ? "bg-chip" : ""}`}>
            <FileText size={10} color={c.ink2} strokeWidth={2} />
            <Text className="text-ink text-[11px]">{t}</Text>
          </View>
        ))}
      </View>
      <Text className="text-ink-3 mt-2.5 text-[11px] font-semibold">Linked from · 2</Text>
      <Text className="text-ink-2 text-[11px]">Video PRD · Sponsor notes</Text>
    </Frame>
  );
}
