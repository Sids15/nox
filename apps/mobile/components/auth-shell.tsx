import { useThemeColors } from "@nox/features";
import { Check } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsDesktop } from "../lib/use-responsive";

/** The brand panel is always ink with paper type, in either theme — it's the cover of the notebook. */
export const COVER = "#1B2131";
export const COVER_INK = "#EDE7DA";
export const COVER_DIM = "#9EA3B4";

/** An illustrative page of the notebook: a few of the day's tasks, one already done. Decorative. */
const SAMPLE: { title: string; when: string; ring: string; done?: boolean }[] = [
  { title: "Morning run", when: "7:00 AM", ring: "#9EA3B4", done: true },
  { title: "Review the sync engine PR", when: "9:30 AM", ring: "#E0694A" },
  { title: "Call the landlord", when: "Anytime", ring: "#D19A3A" },
];

/**
 * A page from the notebook: a few of the day's tasks, one already done. Illustrative and hidden from
 * screen readers. With `animate`, the rows write themselves in one after another — the onboarding
 * cover's one entrance (60 ms apart, 320 ms each on a strong ease-out; a fade only under reduced motion).
 */
export function NotebookPage({ animate = false }: { animate?: boolean }) {
  const rows = useRef(SAMPLE.map(() => new Animated.Value(animate ? 0 : 1))).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (!animate) return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
    Animated.stagger(
      70,
      rows.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 320, delay: 260, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
      ),
    ).start();
  }, [animate, rows]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="rounded-[14px] px-5 py-3"
      style={{ backgroundColor: "rgba(237,231,218,0.06)", borderWidth: 1, borderColor: "rgba(237,231,218,0.1)" }}
    >
      {SAMPLE.map((t, i) => (
        <Animated.View
          key={t.title}
          // Layout set inline: className styles don't reach an Animated.View.
          style={[
            { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
            i > 0 ? { borderTopWidth: 1, borderTopColor: "rgba(237,231,218,0.08)" } : null,
            {
              opacity: rows[i],
              transform: [{ translateY: rows[i]!.interpolate({ inputRange: [0, 1], outputRange: [still ? 0 : 8, 0] }) }],
            },
          ]}
        >
          {t.done ? (
            <View className="h-[19px] w-[19px] items-center justify-center rounded-full" style={{ backgroundColor: "#D9472B" }}>
              <Check size={11} color="#fff" strokeWidth={3} />
            </View>
          ) : (
            <View className="h-[19px] w-[19px] rounded-full" style={{ borderWidth: 2, borderColor: t.ring }} />
          )}
          <Text
            className="flex-1 text-[15px] font-medium"
            style={{ color: t.done ? COVER_DIM : COVER_INK, textDecorationLine: t.done ? "line-through" : "none" }}
          >
            {t.title}
          </Text>
          <Text className="text-[13px]" style={{ color: COVER_DIM, fontVariant: ["tabular-nums"] }}>
            {t.when}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

function CoverPanel() {
  return (
    <View className="flex-1 justify-between px-14 py-12" style={{ backgroundColor: COVER }}>
      <Image
        source={require("../assets/nox-wordmark.png")}
        style={{ width: 84, height: 49, tintColor: COVER_INK, marginLeft: -4 }}
        resizeMode="contain"
        accessibilityLabel="Nox"
      />

      <View style={{ maxWidth: 460 }}>
        <Text className="font-serif text-[44px] font-bold leading-[52px] tracking-[-0.01em]" style={{ color: COVER_INK }}>
          Plan the day.{"\n"}Catch the idea.{"\n"}Keep what matters.
        </Text>

        <View className="mt-10">
          <NotebookPage />
        </View>
      </View>

      <Text className="text-[13px]" style={{ color: COVER_DIM }}>
        Tasks · Ideas · Notes · Resources — on your phone and your computer.
      </Text>
    </View>
  );
}

/**
 * The frame for the sign-in, sign-up and reset-password screens. Desktop: the notebook's cover on the
 * left (the promise, and a page of sample tasks), the form on the right. Phone: the form alone, with
 * the wordmark above it.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  const c = useThemeColors();

  const form = (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 28,
          paddingVertical: 36,
          maxWidth: 420,
          width: "100%",
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {!isDesktop && (
          <Image
            source={require("../assets/nox-wordmark.png")}
            style={{ width: 76, height: 44, tintColor: c.ink, marginLeft: -3, marginBottom: 28 }}
            resizeMode="contain"
            accessibilityLabel="Nox"
          />
        )}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!isDesktop) return <SafeAreaView className="bg-bg flex-1">{form}</SafeAreaView>;

  return (
    <View className="bg-bg flex-1 flex-row">
      <View style={{ flex: 1.05 }}>
        <CoverPanel />
      </View>
      <View className="flex-1">{form}</View>
    </View>
  );
}
