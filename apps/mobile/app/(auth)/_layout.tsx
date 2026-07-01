import { useAuth } from "@nox/features";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Redirect href="/(tabs)/tasks" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
