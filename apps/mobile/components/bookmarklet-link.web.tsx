import { useThemeColors } from "@nox/features";
import { createElement, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { bookmarkletCode } from "../lib/bookmarklet";
import { webBase } from "../lib/web-base";


export const bookmarkletAvailable = true;

/**
 * The "Save to Nox" bookmarklet: drag the button to the bookmarks bar (Chrome, Edge, Firefox, Arc), or
 * copy the code and paste it as a bookmark's address (Safari). React won't render a `javascript:`
 * link, so the address is set on the element directly once it's on the page.
 */
export function BookmarkletLink() {
  const c = useThemeColors();
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [copied, setCopied] = useState(false);
  const at = webBase();
  const code = at ? bookmarkletCode(at) : null;

  useEffect(() => {
    if (ref.current && code) ref.current.setAttribute("href", code);
  }, [code]);

  if (!code) {
    return <Text className="text-ink-3 text-[13px]">Open Nox in your web browser to get it.</Text>;
  }
  return (
    <View className="flex-row items-center gap-2">
      {createElement(
        "a",
        {
          ref,
          draggable: true,
          title: "Drag me to your bookmarks bar",
          onClick: (e: { preventDefault: () => void }) => e.preventDefault(),
          style: {
            display: "inline-flex",
            alignItems: "center",
            height: 30,
            padding: "0 12px",
            borderRadius: 8,
            background: c.accent,
            color: c.onAccent,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            cursor: "grab",
            whiteSpace: "nowrap",
          },
        },
        "Save to Nox",
      )}
      <Pressable
        onPress={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        accessibilityRole="button"
        className="hover:bg-chip h-[30px] justify-center rounded-[8px] px-2.5"
      >
        <Text className="text-ink-2 text-[13px] font-medium">{copied ? "Copied" : "Copy"}</Text>
      </Pressable>
    </View>
  );
}
