import { authMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { router } from "expo-router";

import { AuthForm } from "../src/components/auth-form";
import { useAuth } from "../src/lib/auth/context";
import { useLocale } from "../src/lib/locale";

export default function LoginScreen() {
  const { signIn, registered } = useAuth();
  const { locale } = useLocale();

  return (
    <AuthForm
      mode="signIn"
      locale={locale}
      // Only while this device has places of its own to worry about.
      note={registered ? undefined : authMessages[locale].placesKeptOnSignIn}
      alternate={{ href: "/register", label: authMessages[locale].noAccount }}
      onSubmit={async (credentials) => {
        const failure = await signIn(credentials);
        // Replace rather than push: a back gesture from the home screen must
        // not land the user back on a login form they already cleared.
        if (!failure) router.replace("/");
        return failure;
      }}
    />
  );
}
