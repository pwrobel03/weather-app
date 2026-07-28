import { authMessages, type Locale } from "@weather-app/core";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AuthFormProps = {
  mode: "signIn" | "signUp";
  locale: Locale;
  onSubmit: (credentials: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<string | null>;
  /** Where to go when the user does not have the account this screen assumes. */
  alternate: { href: "/login" | "/register"; label: string };
  /**
   * One line under the title, for what happens to what the device already
   * holds. Absent when there is nothing at stake.
   */
  note?: string;
};

/**
 * One form for both login and registration.
 *
 * They differ by exactly one field and one button label, so two screens would
 * be two copies of the same keyboard handling, the same validation and the
 * same error placement - and the copies would drift.
 *
 * autoComplete/textContentType are set so the platform password manager offers
 * to fill and to save. Without them iOS treats the fields as ordinary text and
 * silently never offers a saved password, which reads to the user as the app
 * being broken rather than as a missing prop.
 */
export function AuthForm({ mode, locale, onSubmit, alternate, note }: AuthFormProps) {
  const insets = useSafeAreaInsets();
  const messages = authMessages[locale];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    setError(null);
    const failure = await onSubmit({ email: email.trim(), password, displayName });
    setPending(false);
    if (failure) setError(failure);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-tlo"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={`text-3xl font-bold text-tekst ${note ? "mb-2" : "mb-8"}`}>
          {mode === "signIn" ? messages.signIn : messages.signUp}
        </Text>

        {note && <Text className="mb-8 text-sm text-tekst-muted">{note}</Text>}

        {mode === "signUp" && (
          <Field
            label={messages.displayNameOptional}
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
            textContentType="name"
          />
        )}

        <Field
          label={messages.email}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <Field
          label={messages.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          textContentType={mode === "signIn" ? "password" : "newPassword"}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error && (
          <Text className="mb-4 text-sm font-medium text-warning-3" accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={pending}
          className="mt-2 h-12 items-center justify-center rounded-2xl bg-primary active:opacity-80 disabled:opacity-50"
        >
          {pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {mode === "signIn" ? messages.signIn : messages.signUp}
            </Text>
          )}
        </Pressable>

        <Link href={alternate.href} className="mt-6 text-center text-sm text-tekst-muted">
          {alternate.label}
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-tekst-muted">
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor="#8A94A6"
        className="h-12 rounded-2xl border border-linia/10 bg-powierzchnia px-4 text-base text-tekst"
      />
    </View>
  );
}
