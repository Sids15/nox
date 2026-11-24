import { usePrefs, useThemeColors } from "@nox/features";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanResponder, Platform, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * A pane whose width you can drag — by mouse on desktop, by finger on iPad. The handle sits on the
 * edge that faces the rest of the screen (`edge`); double-tap or double-click it to go back to the
 * default width. Widths are remembered per pane on this device.
 */
export function ResizablePane({
  id,
  initial,
  min,
  max,
  edge = "right",
  children,
  className,
  style,
}: {
  id: string;
  initial: number;
  min: number;
  max: number;
  /** Which side the drag handle is on. */
  edge?: "right" | "left";
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  const saved = usePrefs((s) => s.panes[id]);
  const setPane = usePrefs((s) => s.setPane);
  const clamp = (w: number) => Math.min(max, Math.max(min, w));
  const [width, setWidth] = useState(clamp(saved ?? initial));
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState(false);
  const start = useRef(width);
  const live = useRef(width);
  const lastTap = useRef(0);

  // Another window or device changed it, or the limits moved.
  useEffect(() => {
    if (!active) setWidth(clamp(saved ?? initial));
  }, [saved, initial, min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const now = Date.now();
        if (now - lastTap.current < 320) {
          // Double tap: back to the default.
          lastTap.current = 0;
          setPane(id, null);
          setWidth(clamp(initial));
          return;
        }
        lastTap.current = now;
        start.current = live.current;
        setActive(true);
      },
      onPanResponderMove: (_e, g) => {
        const next = clamp(start.current + (edge === "right" ? g.dx : -g.dx));
        live.current = next;
        setWidth(next);
      },
      onPanResponderRelease: () => {
        setActive(false);
        if (Math.abs(live.current - start.current) > 1) setPane(id, live.current);
      },
      onPanResponderTerminate: () => setActive(false),
    }),
  ).current;
  live.current = width;

  const web = Platform.OS === "web";
  // iPad and other touch screens (native, or Safari) get a visible grip to aim a finger at.
  const touch = !web || (typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);
  const showLine = active || hover;
  return (
    <View className={className} style={[style, { width, position: "relative" }]}>
      {children}
      <View
        {...responder.panHandlers}
        {...(web ? ({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object) : null)}
        accessibilityRole="adjustable"
        accessibilityLabel="Resize"
        accessibilityHint="Drag to change the width. Double-tap to reset."
        style={[
          { position: "absolute", top: 0, bottom: 0, width: touch ? 24 : 14, zIndex: 20, alignItems: "center" },
          edge === "right" ? { right: touch ? -12 : -7 } : { left: touch ? -12 : -7 },
          web ? ({ cursor: "col-resize", touchAction: "none" } as object) : null,
        ]}
      >
        <View style={{ width: showLine ? 3 : 0, height: "100%", borderRadius: 2, backgroundColor: c.accent, opacity: active ? 0.9 : 0.5 }} />
        {/* A grip you can see and hit with a finger on touch screens. */}
        {touch ? <View style={{ position: "absolute", top: "50%", marginTop: -18, width: 5, height: 36, borderRadius: 3, backgroundColor: c.ink3, opacity: 0.35 }} /> : null}
      </View>
    </View>
  );
}
