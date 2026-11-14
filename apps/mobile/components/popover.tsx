import { useThemeColors, useThemeVars } from "@nox/features";
import { vars } from "nativewind";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";

const GAP = 6;
const EDGE = 12;
/** Emil Kowalski's strong ease-out: instant response, soft landing. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Rect = { x: number; y: number; w: number; h: number };

/**
 * A menu anchored to the control that opened it — the way Linear and Todoist show a property's
 * options — instead of an inline box that grows the surrounding layout. Rendered in a Modal portal so
 * it escapes clipping parents (overflow-hidden dialogs, scroll views).
 *
 * Placement: below the trigger, aligned to its left edge (its right edge when it sits in the right half
 * of the window); flipped above when there isn't room underneath;
 * kept `EDGE` px inside the window. Content taller than the space available scrolls.
 *
 * Motion: scales in from the trigger side (0.96 → 1, with opacity) over 160 ms on a strong ease-out;
 * closes instantly — a menu used many times a day shouldn't make you wait on the way out. Reduced
 * motion keeps only the fade.
 */
export function Popover({
  anchorRef,
  open,
  onClose,
  width,
  children,
  accessibilityLabel,
}: {
  anchorRef: RefObject<View | null>;
  open: boolean;
  onClose: () => void;
  /** Preferred width; clamped to the window. */
  width: number;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const themeVars = useThemeVars();
  const c = useThemeColors();
  const win = useWindowDimensions();
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Measure the trigger every time we open (it may have moved since).
  useEffect(() => {
    if (!open) {
      setAnchor(null);
      setHeight(null);
      progress.setValue(0);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }, [open, anchorRef, progress, win.width, win.height]);

  // Animate in once the content has been measured and placed.
  useEffect(() => {
    if (!open || !anchor || height === null) return;
    Animated.timing(progress, { toValue: 1, duration: 160, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [open, anchor, height, progress]);

  if (!open) return null;

  const w = Math.min(width, win.width - EDGE * 2);
  // Left-aligned to the trigger, or right-aligned when the trigger sits in the right half of the window.
  const rightSide = anchor ? anchor.x + anchor.w / 2 > win.width / 2 : false;
  const preferred = anchor ? (rightSide ? anchor.x + anchor.w - w : anchor.x) : EDGE;
  const left = Math.max(EDGE, Math.min(preferred, win.width - w - EDGE));
  const below = anchor ? win.height - (anchor.y + anchor.h + GAP) - EDGE : 0;
  const above = anchor ? anchor.y - GAP - EDGE : 0;
  const h = height ?? 0;
  const placeAbove = anchor !== null && h > below && above > below;
  const room = Math.max(160, placeAbove ? above : below);
  const top = anchor ? (placeAbove ? anchor.y - GAP - Math.min(h, room) : anchor.y + anchor.h + GAP) : 0;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.96, 1] });
  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : placeAbove ? 4 : -4, 0] });
  const ready = anchor !== null && height !== null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={[{ flex: 1 }, vars(themeVars)]}>
        <Pressable style={{ position: "absolute", inset: 0 }} onPress={onClose} accessibilityLabel="Close menu" />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          // Colours set directly: className styles don't reach an Animated.View.
          style={{
            backgroundColor: c.elev,
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: 12,
            overflow: "hidden",
            position: "absolute",
            left,
            top,
            width: w,
            maxHeight: room,
            opacity: ready ? progress : 0,
            transform: [{ translateY: shift }, { scale }],
            transformOrigin: `${placeAbove ? "bottom" : "top"} ${rightSide ? "right" : "left"}`,
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 14 },
            elevation: 16,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(_, ch) => setHeight(ch)}
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
