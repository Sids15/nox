import { useEffect, useRef } from "react";
import { Animated, View, type DimensionValue } from "react-native";

/** A rounded placeholder block with a gentle opacity pulse. */
export function Skeleton({
  width = "100%",
  height,
  radius = 12,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className="bg-chip"
      style={[{ width, height, borderRadius: radius, opacity }, style]}
    />
  );
}

/** A stacked list of card skeletons (Ideas / Notes / Tasks). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View className="gap-[10px]">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={72} radius={16} />
      ))}
    </View>
  );
}

/** Two masonry columns of varied-height card skeletons (Resources). */
export function MasonrySkeleton() {
  const heights = [
    [150, 96, 128],
    [110, 168, 92],
  ];
  return (
    <View className="flex-row gap-[11px]">
      {heights.map((col, i) => (
        <View key={i} className="flex-1 gap-[11px]">
          {col.map((h, j) => (
            <Skeleton key={j} height={h} radius={16} />
          ))}
        </View>
      ))}
    </View>
  );
}
