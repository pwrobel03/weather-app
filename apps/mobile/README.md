# Aplikacja mobilna

Expo + React Native. Ekrany renderują z `packages/core`, więc logika pogodowa i
napisy są wspólne z `apps/web`.

## Uruchomienie na Androidzie

Android jest platformą, na której działa pełna ścieżka powiadomień push
(decyzja 26 w roadmapie). iOS uruchamia się i wygląda tak samo, ale bez pusha —
ten wymaga płatnego konta Apple Developer.

### Jednorazowo

1. **Android Studio** — instaluje SDK oraz `adb`.

   ```
   brew install --cask android-studio
   ```

   **Uwaga na Javę.** Gradle Androida nie wspiera JDK 25, a to jest dziś domyślna
   w systemie *i* ta, którą przynosi samo Android Studio. Build trzeba uruchamiać
   z JDK 21:

   ```
   export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
   ```

   W kreatorze startowym wystarczą **Android SDK**, **SDK Platform** i
   **Build-Tools**. Emulator jest zbędny, jeśli masz telefon, a zajmuje kilka GB.

2. **`adb` na ścieżce** — Studio nie dopisuje niczego do `PATH`:

   ```
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$PATH:$ANDROID_HOME/platform-tools"
   ```

3. **Projekt Firebase** — darmowy, potrzebny wyłącznie dla powiadomień push.
   - aplikacja Androida o pakiecie `cloud.wrobeldev.weatherapp`
   - pobrany `google-services.json` do `apps/mobile/` (jest w `.gitignore`:
     plik niesie identyfikatory projektu, a to repozytorium jest publiczne)
   - klucz konta serwisowego: Ustawienia projektu → Konta usługi → wygeneruj
     nowy klucz prywatny

4. **Backend** dostaje ten klucz przez zmienne środowiskowe — całą zawartość
   pliku, nie ścieżkę:

   ```
   export FCM_PROJECT_ID="<id-projektu-firebase>"
   export FCM_SERVICE_ACCOUNT_JSON="$(cat ~/sciezka/do/klucza.json)"
   ```

   Bez nich backend wstaje normalnie i dostarcza ostrzeżenia socketem — push
   jest wtedy po prostu wyłączony, co jest stanem obsłużonym, a nie awarią.

### Za każdym razem

```
pnpm --filter mobile android
```

Pierwsze uruchomienie generuje katalog `android/` (poza gitem) i buduje
aplikację natywną — to potrwa. Kolejne są szybkie, dopóki nie zmieni się nic
natywnego. Telefon musi mieć włączone **debugowanie USB** i być podłączony
kablem; przy pierwszym połączeniu zapyta o zaufanie do komputera.

Sprawdzenie, czy telefon jest widoczny:

```
adb devices
```

### Tunele USB, czyli pułapka, w którą wpada się co chwilę

`expo run:android` ustawia przekierowanie portu Metro, ale **gubi się ono przy
każdym odłączeniu kabla, resecie debugowania i restarcie serwera adb**. Objaw
jest mylący: aplikacja wygląda normalnie, tylko przestaje przyjmować zmiany —
bo pokazuje bundle pobrany wcześniej. Łatwo wtedy uznać, że poprawka nie
działa, i szukać jej w kodzie.

Backendu Expo nie przekierowuje w ogóle. Na macOS z włączoną zaporą port 8080
po Wi-Fi jest blokowany, więc tunel jest tam jedyną drogą:

```
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:8080 tcp:8080   # backend
adb reverse --list              # pusta lista = to jest twój problem
```

Z tunelem na 8080 aplikacja musi wołać backend po `localhost`, a nie po adresie
w sieci — stąd `EXPO_PUBLIC_API_URL=http://localhost:8080` przy starcie Metro.

## Dlaczego push nie działa na symulatorze

`registerForPushNotifications` zaczyna się od `if (!Device.isDevice) return null`
— symulator ani emulator nie mają rejestracji FCM do wydania. Cała ścieżka
powiadomień wymaga fizycznego urządzenia, i to jest powód, dla którego przez
pierwsze kilkanaście faz nie była sprawdzona ani razu.

## iOS

```
pnpm --filter mobile ios
```

Działa bez konta Apple Developer na symulatorze. Na fizycznym iPhonie darmowe
konto wystarczy, ale profil provisioningu wygasa po siedmiu dniach — po tym
czasie aplikacja przestaje się uruchamiać, dopóki nie zbudujesz jej ponownie.
