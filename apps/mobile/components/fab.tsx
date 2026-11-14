import { useThemeColors } from "@nox/features";
import { Plus } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

/** How far the list must move in one direction before the button reacts — ignores jitter. */
const SCROLL_SLOP = 8;
/** Near the top the button always shows, so a short list never loses it. */
const TOP_ZONE = 24;

/**
 * Hide-on-scroll-down / show-on-scroll-up for a floating button. Wire `onScroll` (with
 * `scrollEventThrottle={16}`) onto the list's ScrollView and pass `visible` to <Fab>.
 *
 * The floating + sits over the bottom of every list, so it permanently covered part of a row (and
 * the count badges on Tasks' Done/Upcoming groups). Getting out of the way while you read down a
 * list, and returning the moment you scroll back up, is the standard answer.
 */
export function useHideOnScroll() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (y <= TOP_ZONE) setVisible(true);
    else if (dy > SCROLL_SLOP) setVisible(false);
    else if (dy < -SCROLL_SLOP) setVisible(true);
    else return; // inside the slop: keep the reference point so slow scrolls still accumulate
    lastY.current = y;
  }, []);

  return { visible, onScroll };
}

/** The accent + button floating over a list (phones). `bottom` clears the tab bar where there is one. */
export function Fab({
  onPress,
  label,
  bottom = 112,
  visible = true,
}: {
  onPress: () => void;
  label: string;
  bottom?: number;
  visible?: boolean;
}) {
  const c = useThemeColors();
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(offset, {
      // Slide fully below the screen edge, past the shadow.
      toValue: visible ? 0 : bottom + 80,
      duration: 200,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible, bottom, offset]);

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={{ position: "absolute", right: 20, bottom, transform: [{ translateY: offset }] }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="bg-accent rounded-fab h-[54px] w-[54px] items-center justify-center"
        style={{
          shadowColor: c.accent,
          shadowOpacity: 0.4,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}
