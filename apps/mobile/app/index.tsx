import { useAuth } from "@nox/features";
import { Redirect } from "expo-router";

/** Entry route — sends the user to the app or the login screen based on session. */
export default function Index() {
  const { isAuthenticated } = useAuth();
  return <Redirect href={isAuthenticated ? "/(tabs)/tasks" : "/(auth)/login"} />;
}
