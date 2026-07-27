import { authMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { router } from "expo-router";

import { AuthForm } from "../src/components/auth-form";
import { useAuth } from "../src/lib/auth/context";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const locale = DEFAULT_LOCALE;

  return (
    <AuthForm
      mode="signIn"
      locale={locale}
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
