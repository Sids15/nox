import { useAuth } from "@nox/features";
import { Redirect } from "expo-router";

/** Entry route — sends the user to the app or the login screen based on session. */
export default function Index() {
  const { isAuthenticated, recovery } = useAuth();
  if (recovery) return <Redirect href="/(auth)/reset-password" />;
  return <Redirect href={isAuthenticated ? "/(tabs)/tasks" : "/(auth)/login"} />;
}
