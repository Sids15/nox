import { refKindLabel, useThemeColors, type Ref } from "@nox/features";
import { ArrowUpRight, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { KindIcon } from "./kind-icon";
import { openRef, usePages } from "./pages";

/**
 * A link to another page inside a document. Shows the page's current title (the stored one is only a
 * fallback for a page that's gone); tap opens it, long-press or ✕ removes the link.
 */
export function RefCard({ target, storedTitle, onRemove }: { target: Ref; storedTitle: string | null; onRemove?: () => void }) {
  const c = useThemeColors();
  const pages = usePages();
  const page = pages.find(target);
  const missing = !page;
  const title = page?.title ?? storedTitle ?? "Untitled";

  return (
    <Pressable
      onPress={() => !missing && openRef(target, pages.resource(target.id))}
      onLongPress={onRemove}
      accessibilityRole="link"
      accessibilityLabel={`${refKindLabel(target.kind)}: ${title}${missing ? " (deleted)" : ""}`}
      className="border-line bg-surface hover:border-accent/[0.4] flex-row items-center gap-2.5 self-start rounded-[10px] border py-1.5 pl-2.5 pr-1.5"
      style={{ maxWidth: "100%" }}
    >
      <KindIcon kind={target.kind} color={missing ? c.ink3 : c.accent} />
      <Text
        numberOfLines={1}
        className={`flex-shrink text-[14px] font-medium ${missing ? "text-ink-3 line-through" : page?.done ? "text-ink-2" : "text-ink"}`}
      >
        {title}
      </Text>
      {missing ? <Text className="text-ink-3 text-[12px]">deleted</Text> : <ArrowUpRight size={13} color={c.ink3} strokeWidth={2} />}
      {onRemove ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onRemove();
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Remove link"
          className="hover:bg-chip ml-0.5 h-6 w-6 items-center justify-center rounded-[7px]"
        >
          <X size={13} color={c.ink3} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Small inline label for a page: icon + title, tappable. Used in lists ("Linked from", space pages). */
export function PageChip({ target, title, done }: { target: Ref; title: string; done?: boolean }) {
  const c = useThemeColors();
  const pages = usePages();
  return (
    <Pressable
      onPress={() => openRef(target, pages.resource(target.id))}
      accessibilityRole="link"
      className="hover:bg-chip flex-row items-center gap-2.5 rounded-[8px] px-2 py-2"
    >
      <KindIcon kind={target.kind} color={c.ink3} />
      <Text numberOfLines={1} className={`flex-1 text-[14px] ${done ? "text-ink-3" : "text-ink"}`}>
        {title}
      </Text>
      <View />
    </Pressable>
  );
}
