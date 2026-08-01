import type { Locale } from "@weather-app/contract";

/**
 * Login and registration, including the failure messages.
 *
 * The failures are keyed by what went wrong rather than by HTTP status, so a
 * caller maps 401 to `invalidCredentials` once and every client says the same
 * thing. apps/web currently hardcodes Polish equivalents inside its Server
 * Actions - those should move here, which is a change to how a Server Action
 * learns the request's locale and so is not folded into this commit.
 */
export type AuthMessages = {
  signIn: string;
  signUp: string;
  signOut: string;
  email: string;
  password: string;
  displayName: string;
  displayNameOptional: string;
  noAccount: string;
  haveAccount: string;
  invalidCredentials: string;
  emailTaken: string;
  invalidInput: string;
  failed: string;
};

export const authMessages: Record<Locale, AuthMessages> = {
  pl: {
    signIn: "Zaloguj się",
    signUp: "Załóż konto",
    signOut: "Wyloguj się",
    email: "E-mail",
    password: "Hasło",
    displayName: "Nazwa",
    displayNameOptional: "Nazwa (opcjonalnie)",
    noAccount: "Nie masz konta? Załóż je",
    haveAccount: "Masz już konto? Zaloguj się",
    invalidCredentials: "Nieprawidłowy e-mail lub hasło.",
    emailTaken: "Ten adres e-mail jest już zarejestrowany.",
    invalidInput: "Sprawdź poprawność danych - hasło musi mieć od 8 do 72 znaków.",
    failed: "Nie udało się. Spróbuj ponownie.",
  },
  en: {
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    displayName: "Name",
    displayNameOptional: "Name (optional)",
    noAccount: "No account? Create one",
    haveAccount: "Already have an account? Sign in",
    invalidCredentials: "Incorrect email or password.",
    emailTaken: "That email address is already registered.",
    invalidInput: "Check the details - the password must be 8 to 72 characters.",
    failed: "That did not work. Please try again.",
  },
};
