import { useAuth } from "@nox/features";
import { initialsFrom } from "@nox/utils";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";

/**
 * 34px profile chip shown top-right in every module header. Per the handoff there is no Settings
 * tab — tapping the avatar pushes the Settings route. Initials are derived from the signed-in email.
 */
export function ProfileAvatar() {
  const router = useRouter();
  const { session } = useAuth();
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      className="border-accent/[0.35] bg-accent/[0.18] rounded-pill h-[34px] w-[34px] items-center justify-center border"
    >
      <Text className="text-accent text-[12px] font-bold">{initialsFrom(session?.user?.email)}</Text>
    </Pressable>
  );
}
