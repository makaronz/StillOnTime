# Research brief — doprowadzenie StillOnTime do działania

## Baseline

Aplikacja nie działa nie dlatego, że brakuje jej endpointów, lecz dlatego, że **backend w ogóle się nie kompiluje** — `tsc --noEmit` zwraca 373 błędy. Wcześniejszy audyt tego nie wykrył, bo skupił się na zgodności ścieżek API, a nie na tym, czy kod się buduje.

## Ustalenia niekonwencjonalne

### 1. Jedna wadliwa deklaracja typu generuje 92% błędów kompilacji

`src/types/express.d.ts:15` deklaruje:

```ts
declare global {
  namespace Express {
    interface Request extends ExpressRequest {   // ExpressRequest = express.Request
```

`express.Request` sam dziedziczy po `Express.Request`, więc powstaje cykl. TypeScript zgłasza
`TS2310: Type 'Request' recursively references itself as a base type` i **degeneruje typ `Request`
w całym projekcie** — każde `req.path`, `req.body`, `req.params` przestaje istnieć.

Zmierzone: usunięcie `extends ExpressRequest` (kanoniczny wzorzec augmentacji) daje **373 → 29 błędów**.

### 2. Hipoteza „cykl typów powoduje lawinę lintu" — obalona pomiarem

Naturalne założenie: skoro `req` jest zdegenerowane, to reguły `no-unsafe-*` strzelają z tego powodu.
Pomiar tego nie potwierdza — lint spada jedynie **4269 → 3953** (−316).

Prawdziwa przyczyna 3953 problemów to konflikt konfiguracji, nie pojedynczy błąd:
`.eslintrc.js` włącza preset `recommended-requiring-type-checking` (rodzina `no-unsafe-*`),
podczas gdy `tsconfig.json` ma `strict: false` i `noImplicitAny: false`. TypeScript pozwala
na `any`, a ESLint karze za każde jego użycie. Do tego 480 jawnych `any` w kodzie.

To nie jest 3953 niezależnych usterek, tylko jedna decyzja konfiguracyjna rozlana po 125 plikach.

### 3. Część pozostałych błędów dotyczy martwego kodu

`services/emailService.ts` (13 z 29 pozostałych błędów) importuje `./gmailService`, `./pdfService`,
`./processedEmailService`, `./scheduleExtractionService` — **żaden nie istnieje** (realne pliki nazywają się
`gmail.service.ts`, `pdf-parser.service.ts`). Plik nie jest importowany przez nic w `src/`.
To osierocony relikt, nie działający komponent.

## Fałszywe ograniczenia

- **„Trzeba dockera na Postgres/Redis"** — nieprawda. Daemon dockera nie odpowiada, ale
  `/usr/lib/postgresql/16/bin/postgres` i `redis-server` są zainstalowane natywnie.
- **„Backend nie ruszy bez prawdziwych kluczy Google"** — nieprawda. `getRequiredEnvVar` sprawdza
  jedynie niepustość, więc wartości-zaślepki z `.env.example` pozwalają wystartować serwerowi.

## Twarde ograniczenie

Nie mam i nie mogę zdobyć poświadczeń Google OAuth użytkownika. **Logowanie przez Google i przepływy
zależne od Gmaila/Kalendarza są nieweryfikowalne end-to-end.** Weryfikowalne pozostają: start serwera,
health checki, powierzchnia API, odpowiedzi 401/404, build frontendu.

## Pozostałe 29 błędów kompilacji — klasyfikacja

| Liczba | Lokalizacja | Charakter |
|---:|---|---|
| 13 | `services/emailService.ts` | martwy plik, importy do nieistniejących modułów |
| 6 | `scripts/test-database.ts` | skrypt deweloperski, relacje w stylu Prisma na typie Kysely |
| 5 | `config/database.ts` | `pool` zadeklarowany, ale nieeksportowany |
| 2 | `sparc-orchestrator.service.ts` | niezgodność API `MonitoringService` |
| 2 | `performance-monitoring.service.ts` | arytmetyka na typie nie-liczbowym |
| 1 | `secure-auth.routes.ts` | import `@/middleware/csrf.middleware`, plik nazywa się `csrf.ts` |
| 1 | `types/requests.ts` | `AppRequest` nadpisuje `ip` niezgodnie z `Omit<Request,'ip'>` |
