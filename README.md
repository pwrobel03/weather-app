# Weather App

Aplikacja pogodowa z systemem ostrzeżeń dla Polski.

Poza zwykłą prognozą aplikacja pilnuje miejsc, które obserwujesz, i wysyła
powiadomienie, kiedy IMGW wyda dla nich ostrzeżenie meteorologiczne — w podobnym
duchu co alerty RCB.

Projekt jest na etapie planowania, kodu jeszcze nie ma.

## Założenia

Aplikacja ma działać na iOS, Androidzie i w przeglądarce (a przez to również na
macOS). Wersja mobilna i webowa to osobne interfejsy, ale stoją na tym samym API.

Ostrzeżenia biorę z IMGW, prognozę z Open-Meteo. IMGW opisuje obszar ostrzeżenia
kodami TERYT powiatów, a nie geometrią, więc granice powiatów trzeba dołożyć
z osobnego źródła i trzymać w bazie jako poligony.

Interfejs opiera się na ciemnym tle z gradientem zależnym od warunków i pory dnia.
Kiedy pojawia się ostrzeżenie, przejmuje ono całe tło. Kolory stopni zagrożenia
(żółty, pomarańczowy, czerwony) są zgodne ze skalą IMGW i zarezerwowane wyłącznie
dla ostrzeżeń.

## Stack

- Kotlin + Spring Boot
- PostgreSQL + PostGIS
- REST + OpenAPI, zod jako wspólny kontrakt
- Expo (React Native) — iOS i Android
- Next.js 16 — web
- Tailwind, shadcn/ui, lucide-react
- WebSocket do dostarczania alertów

Całość w jednym monorepo — dzięki temu zmiana kontraktu API mieści się w jednym
commicie i klient nie rozjeżdża się z serwerem.

## Struktura

```
apps/mobile        Expo
apps/web           Next.js
packages/contract  schematy zod
backend            Kotlin + Spring Boot
infra              docker-compose z Postgresem i PostGIS
```

## Uruchomienie

Do uzupełnienia, kiedy pojawi się kod.
