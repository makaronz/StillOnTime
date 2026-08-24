# Lista naprawcza — StillOnTime

Uporządkowana od blokad uruchomienia do usprawnień. Szczegóły ustaleń w `AUDIT_REPORT.md`.

Legenda: **[SETUP]** — czynność środowiskowa, nie zmienia repo · **[KOD]** — zmiana w repo.

---

## A. Blokady uruchomienia

### A1. Instalacja zależności · [SETUP]

```bash
npm run install:all
```

Świeży kontener nie ma `node_modules`. Bez tego `npm run dev` kończy się `concurrently: not found`.

> Instalacja w tym repo próbuje pobrać przeglądarkę Playwright. Jeśli sieć to blokuje, `npm install` zgłosi błąd **po** zainstalowaniu właściwych zależności — aplikacja zadziała, ucierpią tylko testy e2e. Pominięcie pobierania: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm run install:all`.

### A2. Pliki `.env` · [SETUP]

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Wszystkie trzy są w `.gitignore` — każdy nowy klon i każdy nowy kontener zaczyna bez nich.

### A3. Sekret JWT · [SETUP] — najczęstsza pułapka

**Wartość z `.env.example` nie zadziała.** Zawiera `jwt`, `secret` i `key`, a walidator odrzuca każdy z tych podciągów (`backend/src/config/security.ts`). Wymagania: ≥48 znaków, ≥3 klasy znaków, brak zakazanych podciągów.

```bash
openssl rand -base64 64 | tr -d '\n/+' | head -c 64
```

Wynik wklej do `backend/.env` jako `JWT_SECRET=`. Zakazane podciągi:
`jwt secret password token key auth 123 abc test demo default example`

### A4. Infrastruktura · [SETUP]

```bash
docker-compose up -d postgres redis qdrant
```

Weryfikacja:

```bash
redis-cli ping                                                    # PONG
psql -h localhost -U stillontime_user -d stillontime_automation -c 'SELECT 1'
```

Qdrant jest potrzebny tylko dla `/api/codenet`; postgres i redis są wymagane do startu.

### A5. Poświadczenia Google · [SETUP]

W Google Cloud Console: włącz Gmail API, Google Calendar API, Google Drive API, Maps (JavaScript + Directions + Geocoding). Utwórz OAuth 2.0 Client ID typu „Web application":

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/auth/callback`

`backend/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
`frontend/.env`: `VITE_GOOGLE_CLIENT_ID`

### A6. Klucze API · [SETUP]

`OPENWEATHER_API_KEY` (openweathermap.org, darmowy plan wystarcza) oraz `GOOGLE_MAPS_API_KEY`.
Oba są walidowane pod kątem długości (≥10 znaków) — wartości-zaślepki z szablonu przejdą walidację, ale wywołania API zwrócą błąd w czasie działania.

### A7. Inicjalizacja bazy · [SETUP]

```bash
npm run db:init     # backend/src/scripts/init-db.ts
npm run db:test     # test połączenia
```

---

## B. Brakujące endpointy — frontend wywołuje, backend nie odpowiada · [KOD]

Każda pozycja to potwierdzone 404. Kolejność: od najbardziej widocznych w UI.

### B1. `POST /api/schedules` — tworzenie planu zdjęciowego

Woła: `frontend/src/hooks/useSchedules.ts:47`
Brak w: `backend/src/routes/schedule.routes.ts` (są tylko POST-y na `/:scheduleId/route/recalculate` i `/:scheduleId/weather/update`).

Trasę trzeba dodać **przed** trasami z parametrem `/:scheduleId`, inaczej parametr przechwyci żądanie. Walidacja spójna z istniejącym `PUT /:scheduleId`: `shootingDate` (ISO8601), `callTime` (`HH:MM`), `location` (1–255), opcjonalnie `baseLocation`, `sceneType` (`INT`/`EXT`), `scenes`, `equipment`, `contacts`, `notes`, `safetyNotes`.

### B2. `DELETE /api/emails/:id` — usuwanie z historii

Woła: `frontend/src/services/history.ts:129`
Brak w: `backend/src/routes/email.routes.ts` (żadnego `router.delete`).

### B3. `GET /api/emails/export` — eksport historii do CSV/JSON

Woła: `frontend/src/services/history.ts:154`
Brak w: `backend/src/routes/email.routes.ts`.

Musi być zadeklarowana **przed** `GET /:emailId`, inaczej `export` zostanie potraktowane jako identyfikator maila. Odpowiedź: strumień pliku z `Content-Disposition: attachment`.

### B4–B6. Endpointy OAuth

Woła: `frontend/src/services/oauth.service.ts`
Backend (`oauth-settings.routes.ts`) ma tylko `/status`, `/refresh`, `/disconnect`, `/reconnect`, `/test`.

| Brakuje | Przeznaczenie |
|---------|---------------|
| `PUT /api/oauth/preferences` | Zapis preferencji synchronizacji |
| `GET /api/oauth/folders` | Lista etykiet Gmail do wyboru monitorowanego folderu |
| `GET /api/oauth/calendars` | Lista kalendarzy docelowych |

Dwa ostatnie wymagają realnych wywołań Gmail API i Calendar API — zaślepka zwracająca stałą listę odblokuje UI, ale nie da użytkownikowi wyboru spośród jego rzeczywistych zasobów. Jeśli implementujesz zaślepkę, oznacz to jawnie, żeby nie wyglądała na działającą funkcję.

---

## C. Spójność i higiena · [KOD]

### C1. `history.ts` omija `apiService`

`frontend/src/services/history.ts:154` używa surowego `fetch` z relatywnym URL-em. Omija wstrzykiwanie tokenu Bearer, retry z backoffem, śledzenie stanu połączenia i obsługę 401 → wylogowanie. Jako jedyne wywołanie faktycznie zależy od proxy Vite, więc zachowa się inaczej w buildzie produkcyjnym. Podobnie `services/systemConfig.ts` korzysta z axiosa bezpośrednio.

Eksport pliku wymaga odpowiedzi typu blob, więc przejście na `apiService` może wymagać rozszerzenia go o `responseType`.

### C2. Aliasy `email`/`emails` i `schedule`/`schedules`

Oba są montowane jako aliasy tego samego routera. To działa, ale sprawia, że w kodzie frontu mieszają się obie formy i łatwo o błędne założenie, że to osobne zasoby. Warto ujednolicić wywołania frontendu na liczbę mnogą, zostawiając aliasy dla kompatybilności.

### C3. Walidacja `JWT_SECRET` odrzuca poprawne sekrety

Filtr podciągów (`key`, `auth`, `abc`, `123`) odrzuca losowe sekrety o wysokiej entropii tylko dlatego, że przypadkiem zawierają te znaki — `openssl rand -base64 64` trafia na to regularnie. Lista blokuje też wartość z własnego `.env.example` projektu.

Sensowniejsze: sprawdzać długość i entropię, a filtr podciągów ograniczyć do pełnych, oczywiście słabych wartości (`password`, `changeme`, `123456`). **To zmiana w kontrolce bezpieczeństwa — wymaga świadomej decyzji, nie cichej modyfikacji.**

### C4. Komunikaty o brakujących zmiennych

`getRequiredEnvVar` rzuca `Missing required environment variable: X` bez wskazówki, że wystarczy skopiować `.env.example` — i bez ostrzeżenia, że wartość z szablonu i tak nie przejdzie walidacji (A3). To dokładnie ten moment, w którym nowa osoba utyka.

### C5. Bałagan w katalogu głównym

~60 luźnych plików `.md` w roocie (raporty sesji, podsumowania faz, `chat_err.md` ~122 kB, `kilo_code_task_*.md` ~1,3 MB). Utrudnia znalezienie faktycznej dokumentacji. Przeniesienie do `docs/` jest bezpieczne, ale to duży diff — najlepiej osobnym commitem, nie przy okazji zmian funkcjonalnych.

---

## D. Kolejność wykonania

```
A1 → A2 → A3 → A4 → A7        aplikacja startuje
A5 → A6                        logowanie i integracje zewnętrzne działają
B1 → B2 → B3 → B4/B5/B6        znikają 404 w UI
C1 → C2 → C4                   spójność warstwy HTTP
C3                             wymaga decyzji o polityce bezpieczeństwa
C5                             osobny commit porządkowy
```

Sekcja A to konfiguracja środowiska — nie zostawia śladu w repo i musi być powtórzona w każdym nowym kontenerze. Dopiero sekcje B i C są zmianami w kodzie.
