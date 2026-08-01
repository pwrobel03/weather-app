import { authMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { router } from "expo-router";

import { AuthForm } from "../src/components/auth-form";
import { useAuth } from "../src/lib/auth/context";

export default function RegisterScreen() {
  const { signUp, registered } = useAuth();
  const locale = DEFAULT_LOCALE;

  return (
    <AuthForm
      mode="signUp"
      locale={locale}
      // Only while this device has places of its own to worry about.
      note={registered ? undefined : authMessages[locale].placesKeptOnSignUp}
      alternate={{ href: "/login", label: authMessages[locale].haveAccount }}
      onSubmit={async (credentials) => {
        const failure = await signUp(credentials);
        if (!failure) router.replace("/");
        return failure;
      }}
    />
  );
}
