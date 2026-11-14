import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Platform, TextInput, type TextInputProps, type TextStyle } from "react-native";

/**
 * Multiline TextInput that behaves like a document canvas on every platform. Native RN auto-grows
 * multiline inputs by itself. react-native-web renders a fixed-height <textarea>, and sizing it from
 * onContentSizeChange only ever grew: a textarea's scrollHeight never drops below its current height,
 * so deleting lines left a tall empty box. On web we measure the DOM node directly — collapse to
 * `auto`, read scrollHeight, set it — on every value change and on resize.
 */
export const AutoGrowInput = forwardRef<TextInput, TextInputProps & { minHeight?: number }>(function AutoGrowInput(
  { style, minHeight = 26, value, ...rest },
  ref,
) {
  const web = Platform.OS === "web";
  const node = useRef<TextInput | null>(null);
  const [height, setHeight] = useState(minHeight);

  const setRefs = useCallback(
    (el: TextInput | null) => {
      node.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const measure = useCallback(() => {
    const el = node.current as unknown as HTMLTextAreaElement | null;
    if (!web || !el || typeof el.scrollHeight !== "number") return;
    const prev = el.style.height;
    // Collapse to 0, not "auto": an auto-height textarea falls back to its default two rows, which
    // would make every one-line field measure two lines tall.
    el.style.height = "0px";
    const h = Math.max(minHeight, el.scrollHeight);
    el.style.height = prev;
    setHeight((cur) => (cur === h ? cur : h));
  }, [web, minHeight]);

  useLayoutEffect(measure, [value, measure]);
  useLayoutEffect(() => {
    if (!web || typeof window === "undefined") return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [web, measure]);

  return (
    <TextInput
      ref={setRefs}
      multiline
      scrollEnabled={false}
      value={value}
      style={[style, web ? ({ height, overflow: "hidden", outlineWidth: 0, resize: "none" } as TextStyle) : null]}
      {...rest}
    />
  );
});
