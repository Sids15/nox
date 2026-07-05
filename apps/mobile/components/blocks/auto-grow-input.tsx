import { useState } from "react";
import { Platform, TextInput, type TextInputProps, type TextStyle } from "react-native";

/**
 * Multiline TextInput that behaves like a document canvas on every platform. Native RN already
 * auto-grows multiline inputs, but react-native-web renders a fixed-height <textarea> with browser
 * scrollbars and a focus ring — the text "hides" in a small box. On web we track the content height
 * (onContentSizeChange) and size the input to it, hide the inner scrollbar, and drop the UA outline.
 */
export function AutoGrowInput({ style, minHeight = 26, ...rest }: TextInputProps & { minHeight?: number }) {
  const [height, setHeight] = useState(minHeight);
  const web = Platform.OS === "web";

  const webStyle = web
    ? ({ height: Math.max(minHeight, height), overflow: "hidden", outlineWidth: 0 } as TextStyle)
    : null;

  return (
    <TextInput
      multiline
      scrollEnabled={false}
      onContentSizeChange={web ? (e) => setHeight(e.nativeEvent.contentSize.height) : undefined}
      style={[style, webStyle]}
      {...rest}
    />
  );
}
