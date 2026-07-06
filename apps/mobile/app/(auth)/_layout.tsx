import { useAuth } from "@nox/features";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const { isAuthenticated, recovery } = useAuth();
  // During password recovery the user has a (temporary) session but must stay here to set a new
  // password, so don't bounce them into the app.
  if (isAuthenticated && !recovery) return <Redirect href="/(tabs)/tasks" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
