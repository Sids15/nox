import { backlinks, outgoingRefs, useThemeColors, type Ref } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { PageChip } from "./ref-card";
import { usePages } from "./pages";

/**
 * "Linked from": every page that links here, so following a thread works in both directions (the
 * heart of a second brain). Hidden when nothing links here and the page links nowhere.
 */
export function Backlinks({ target, content = [] }: { target: Ref; content?: readonly ContentBlock[] }) {
  const c = useThemeColors();
  const pages = usePages();
  const incoming = useMemo(() => backlinks(target, pages.linking), [target.kind, target.id, pages.linking]); // eslint-disable-line react-hooks/exhaustive-deps
  const outgoing = useMemo(() => outgoingRefs(content).length, [content]);
  if (incoming.length === 0 && outgoing === 0) return null;

  return (
    <View className="border-line mt-8 border-t pt-4">
      <Text className="text-ink-2 mb-1 px-2 text-[13px] font-semibold" style={{ color: c.ink2 }}>
        Linked from {incoming.length > 0 ? `· ${incoming.length}` : ""}
      </Text>
      {incoming.length === 0 ? (
        <Text className="text-ink-3 px-2 py-1 text-[13px]">Nothing links here yet. Type [[ in another page to link it.</Text>
      ) : (
        incoming.map((p) => {
          const page = pages.find(p);
          return <PageChip key={`${p.kind}:${p.id}`} target={p} title={page?.title ?? p.title} done={page?.done} />;
        })
      )}
    </View>
  );
}
