import { useThemeColors } from "@nox/features";
import type { Space } from "@nox/types";
import { relativeFromNow } from "@nox/utils";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIsDesktop } from "../../lib/use-responsive";
import { KindIcon } from "./kind-icon";
import { openRef } from "./pages";
import { fieldValue } from "./space-board";
import { spaceColor } from "./space-mark";
import { Empty, type SpacePage } from "./space-parts";

/**
 * Every page in the space as a table, Notion-database style: name, stage, then one column per field
 * used in the space, then when it was edited. Phones get the same rows as a compact list.
 */
export function SpaceTable({ space, pages }: { space: Space; pages: SpacePage[] }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const tint = spaceColor(space);
  // The fields used across the space's pages, by how often they appear.
  const fields = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of pages) for (const f of p.properties) if (f.name) count.set(f.name, (count.get(f.name) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  }, [pages]);

  if (pages.length === 0) return <Empty>No pages here yet. Use New to add one.</Empty>;

  const stagePill = (stage: string | null) =>
    stage ? (
      <View className="self-start rounded-[6px] px-1.5 py-0.5" style={{ backgroundColor: `${tint}1F` }}>
        <Text numberOfLines={1} className="text-[12px] font-medium" style={{ color: tint }}>
          {stage}
        </Text>
      </View>
    ) : (
      <Text className="text-ink-3 text-[12px]">—</Text>
    );

  if (!isDesktop) {
    return (
      <View className="px-screen">
        {pages.map((p) => {
          const values = p.properties.map(fieldValue).filter((v): v is string => !!v).slice(0, 3);
          return (
            <Pressable key={`${p.kind}:${p.id}`} onPress={() => openRef(p)} accessibilityRole="link" className="border-line border-b py-3">
              <View className="flex-row items-center gap-2.5">
                <KindIcon kind={p.kind} color={c.ink3} />
                <Text numberOfLines={1} className="text-ink flex-1 text-[15px] font-medium">
                  {p.title}
                </Text>
                {stagePill(p.stage)}
              </View>
              {values.length ? (
                <Text numberOfLines={1} className="text-ink-3 ml-[26px] mt-1 text-[12px]">
                  {values.join(" · ")}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  const W = { name: 300, stage: 130, field: 150, edited: 110 };
  const cell = "px-3 py-2.5 justify-center";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 20 }}>
      <View className="border-line rounded-[12px] border">
        <View className="border-line bg-chip/50 flex-row border-b">
          {[["Name", W.name], ...(space.stages.length ? [["Stage", W.stage]] : []), ...fields.map((f) => [f, W.field]), ["Edited", W.edited]].map(([label, w]) => (
            <View key={String(label)} className={cell} style={{ width: Number(w) }}>
              <Text numberOfLines={1} className="text-ink-3 text-[12px] font-semibold">
                {String(label)}
              </Text>
            </View>
          ))}
        </View>
        {pages.map((p, i) => (
          <Pressable
            key={`${p.kind}:${p.id}`}
            onPress={() => openRef(p)}
            accessibilityRole="link"
            className={`hover:bg-chip flex-row ${i === pages.length - 1 ? "" : "border-line border-b"}`}
          >
            <View className={`${cell} flex-row items-center gap-2`} style={{ width: W.name, justifyContent: "flex-start" }}>
              <KindIcon kind={p.kind} color={c.ink3} size={14} />
              <Text numberOfLines={1} className="text-ink flex-1 text-[14px] font-medium">
                {p.title}
              </Text>
            </View>
            {space.stages.length ? (
              <View className={cell} style={{ width: W.stage }}>
                {stagePill(p.stage)}
              </View>
            ) : null}
            {fields.map((f) => {
              const prop = p.properties.find((x) => x.name === f);
              return (
                <View key={f} className={cell} style={{ width: W.field }}>
                  <Text numberOfLines={1} className="text-ink-2 text-[13px]">
                    {prop ? (fieldValue(prop) ?? "") : ""}
                  </Text>
                </View>
              );
            })}
            <View className={cell} style={{ width: W.edited }}>
              <Text className="text-ink-3 text-[12px]">{relativeFromNow(p.updated_at)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
