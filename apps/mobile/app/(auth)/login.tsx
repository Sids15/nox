import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, useThemeColors } from "@nox/features";
import { credentials, type Credentials } from "@nox/types";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { signInWithPassword, signUp } = useAuth();
  const c = useThemeColors();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  const submit = (action: (values: Credentials) => Promise<unknown>) =>
    handleSubmit(async (values) => {
      setServerError(null);
      try {
        await action(values);
      } catch (e) {
        setServerError(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 justify-center px-6">
        <Text className="text-ink mb-8 text-3xl font-bold">Nox</Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="bg-surface text-ink rounded-input mb-1 px-4 py-3"
              placeholder="Email"
              placeholderTextColor={c.ink3}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
            />
          )}
        />
        {errors.email ? (
          <Text className="text-critical mb-1">{errors.email.message}</Text>
        ) : null}

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="bg-surface text-ink rounded-input mb-1 mt-3 px-4 py-3"
              placeholder="Password"
              placeholderTextColor={c.ink3}
              secureTextEntry
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
            />
          )}
        />
        {errors.password ? (
          <Text className="text-critical mb-1">{errors.password.message}</Text>
        ) : null}

        {serverError ? (
          <Text className="text-destructive mt-2">{serverError}</Text>
        ) : null}

        <Pressable
          disabled={isSubmitting}
          onPress={submit(signInWithPassword)}
          className="bg-accent rounded-input mt-6 items-center py-3"
        >
          <Text className="text-ink font-semibold">Sign in</Text>
        </Pressable>
        <Pressable
          disabled={isSubmitting}
          onPress={submit(signUp)}
          className="mt-2 items-center py-3"
        >
          <Text className="text-ink-secondary">Create account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
