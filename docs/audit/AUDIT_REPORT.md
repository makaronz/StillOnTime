# Raport audytu technicznego — StillOnTime

**Zakres:** pełne przejście ścieżki „klonuję repo → uruchamiam → klikam w UI", oraz mapowanie połączeń frontend ↔ backend ↔ API ↔ konfiguracja.

> **Uwaga o wersji dokumentu.** Wcześniejsza wersja raportu przepadła, gdy gałąź została przebudowana w innej sesji (commit z raportem stał się nieosiągalny). Ten dokument został odtworzony i **zweryfikowany ponownie względem aktualnego kodu** — nie jest kopią poprzedniej wersji. Kilka wcześniejszych ustaleń okazało się nieaktualnych lub błędnych i zostało skorygowanych (patrz sekcja 6).

---

## 1. Podsumowanie

**Czy projekt uruchomi się po samym `git clone`? NIE.**

Blokada nie leży w kodzie aplikacji, tylko w konfiguracji i infrastrukturze. Kod backendu i frontendu jest kompletny strukturalnie; brakuje warstwy, bez której proces backendu kończy się natychmiast po starcie.

**Największy blokujący problem:** `backend/src/config/config.ts` wykonuje `validateEnvironment()` i `validateSecurityConfig()` **w czasie importu modułu**. Brak `JWT_SECRET` przerywa start zanim Express zdąży wystartować. Pliki `.env` są w `.gitignore`, więc świeży klon ich nie ma.

**Kolejność blokad przy pierwszym uruchomieniu:**

| # | Krok | Wynik |
|---|------|-------|
| 1 | `npm run dev` | `concurrently: not found` — brak `node_modules` |
| 2 | po `npm run install:all` | crash backendu: brak `JWT_SECRET` |
| 3 | po skopiowaniu `.env.example` | crash: `JWT_SECRET` z szablonu **nie przechodzi walidacji** (patrz §3) |
| 4 | po wygenerowaniu sekretu | `ECONNREFUSED` — brak PostgreSQL i Redis |
| 5 | po `docker-compose up -d` | start OK; funkcje Google/Weather nieaktywne bez kluczy API |

---

## 2. Mapa aplikacji (perspektywa użytkownika)

Routing: React Router v6, strony ładowane leniwie (`React.lazy`), w `frontend/src/App.tsx`.

| Ścieżka | Komponent | Auth | Czego oczekuje użytkownik |
|---------|-----------|------|---------------------------|
| `/login` | `Login` | nie | Logowanie przez Google OAuth |
| `/auth/callback` | `OAuthCallback` | nie | Wymiana `code` na token, przekierowanie |
| `/privacy-policy` | `PrivacyPolicy` | nie | Treść statyczna |
| `/onboarding` | `OnboardingFlow` | tak | Kreator pierwszej konfiguracji |
| `/` | `Dashboard` | tak | Status systemu, ostatnie maile, nadchodzące plany zdjęciowe |
| `/configuration` | `Configuration` | tak | Adresy, bufory czasowe, powiadomienia, status połączeń |
| `/history` | `History` | tak | Historia maili z paginacją, filtrami i eksportem |
| `/monitoring` | `Monitoring` | tak | Metryki, circuit breakery, alerty |

Trasy chronione są opakowane w `ProtectedRoute` + `Layout`. `authStore.checkAuth()` startuje przy montowaniu aplikacji.

---

## 3. Konfiguracja — miejsca, które zaskakują

### Walidacja `JWT_SECRET` (`backend/src/config/security.ts`)

Nietypowo restrykcyjna. Sekret musi mieć **≥48 znaków** i **≥3 klasy znaków**, a dodatkowo jest **odrzucany, jeśli zawiera podciąg**:

```
jwt, secret, password, token, key, auth, 123, abc, test, demo, default, example
```

Konsekwencja praktyczna: wartość z `backend/.env.example`
(`your-jwt-secret-must-be-at-least-48-chars-change-in-production`)
**nie przejdzie walidacji** — zawiera `jwt`, `secret` i `key`. Samo `cp .env.example .env` nie wystarcza, co jest łatwe do przeoczenia.

Generowanie poprawnego sekretu wymaga usunięcia znaków, które mogą trafić na listę:

```bash
openssl rand -base64 64 | tr -d '\n/+' | head -c 64
```

### Zmienne wymagane przy starcie

`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
W trybie `development` część z nich daje tylko ostrzeżenie, ale **`JWT_SECRET` jest wymagany zawsze** (`getRequiredEnvVar("JWT_SECRET")` bez wartości zapasowej).

### Frontend

Prefiks `VITE_`: `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`.
Uwaga na podwójną ścieżkę: dev-server Vite proxuje `/api` → `http://localhost:3001`, ale `frontend/src/services/api.ts` ustawia też bezwzględny `baseURL` z `VITE_API_URL`. W praktyce ruch idzie bezpośrednio, nie przez proxy.

---

## 4. Mapa techniczna

```
StillOnTime/
├── backend/src/
│   ├── index.ts              # entry point: helmet → CORS → rate limit → CSRF → request-id
│   ├── config/               # config.ts (walidacja przy imporcie), security.ts, database.ts, redis.ts
│   ├── routes/               # 20 plików *.routes.ts, montowane w routes/index.ts pod /api
│   ├── controllers/ services/ repositories/   # Kysely + pg (NIE Prisma)
│   ├── middleware/           # errorHandler.ts, auth.middleware.ts, monitoring.middleware.ts
│   └── utils/                # logger.ts, circuit-breaker.ts, retry.ts
├── frontend/src/
│   ├── main.tsx App.tsx      # BrowserRouter + Routes
│   ├── pages/ components/    # widoki i komponenty
│   ├── services/             # api.ts + serwisy domenowe
│   ├── stores/               # Zustand
│   └── hooks/
├── mobile/                   # React Native, poza głównym flow
└── docker-compose.yml        # postgres, redis, qdrant, backend, frontend
```

**Entry pointy:** `backend/src/index.ts`, `frontend/src/main.tsx`.

### Konwencje ścieżek API (łatwe do naruszenia)

- Wszystko pod `/api/...` **z wyjątkiem** `/health/*`, montowanego w roocie (`app.use("/health", healthRoutes)`).
- Istnieje **osobny** `GET /api/health` (`routes/index.ts`), zwracający listę zamontowanych grup tras — dobry smoke test.
- `email`/`emails` oraz `schedule`/`schedules` są **podwójnie montowane** jako aliasy tego samego routera. Trasa zdefiniowana raz jest osiągalna pod liczbą pojedynczą i mnogą.
- Trasy z parametrem (`/:scheduleId`) są deklarowane **po** trasach statycznych (`/statistics`, `/weather/...`). Odwrócenie tej kolejności powoduje, że parametr „połyka" ścieżki statyczne.

### Mechanizmy, których nie należy pisać od nowa

| Mechanizm | Lokalizacja |
|-----------|-------------|
| Hierarchia klas błędów + centralny handler | `middleware/errorHandler.ts` |
| Circuit breaker (Google, Weather) | `utils/circuit-breaker.ts` |
| Retry z wykładniczym backoffem (`@withRetry`) | `utils/retry.ts` |
| Logowanie strukturalne (JSON + request-id) | `utils/logger.ts` → `structuredLogger` |
| Auth dwuwarstwowy | `authenticateToken` + `requireValidOAuth` |

**CSRF:** `index.ts` pomija ochronę dla metod GET, health checków, callbacku OAuth oraz **całego `/api/*` w trybie development**. Błędy CSRF ujawnią się dopiero na produkcji.

---

## 5. Połączenia frontend → backend (stan zweryfikowany)

### Działa poprawnie

| Wywołanie frontendu | Backend | Uwaga |
|---------------------|---------|-------|
| `GET /api/health` | `routes/index.ts` | Istnieje pod `/api`, obok osobnego `/health/*` |
| `GET/POST /api/auth/*` | `auth.routes.ts` | login, callback, status, refresh, logout, profile |
| `GET /api/system/status`, `/connections` | `system.routes.ts` | |
| `GET/PUT /api/user/config` | `user.routes.ts` | |
| `GET /api/emails/recent`, `/stats` | `email.routes.ts` | |
| `GET /api/schedules/upcoming` | `schedule.routes.ts` | |
| `/api/monitoring/*` (12 wywołań) | `monitoring.routes.ts` | Prefiks `/api` spójny po obu stronach |
| `/api/notifications`, `/read-all`, `/:id/read` | `notifications.routes.ts` | |
| `/api/performance/web-vitals`, `/metrics` | `performance.routes.ts` | |

### Luki potwierdzone — frontend woła, backend nie ma

| # | Wywołanie frontendu | Plik wołający | Stan backendu |
|---|---------------------|---------------|---------------|
| 1 | `PUT /api/oauth/preferences` | `services/oauth.service.ts` | brak trasy |
| 2 | `GET /api/oauth/folders` | `services/oauth.service.ts` | brak trasy |
| 3 | `GET /api/oauth/calendars` | `services/oauth.service.ts` | brak trasy |
| 4 | `POST /api/schedules` | `hooks/useSchedules.ts:47` | brak `router.post("/")` |
| 5 | `DELETE /api/emails/:id` | `services/history.ts:129` | brak `router.delete` |
| 6 | `GET /api/emails/export` | `services/history.ts:154` | brak trasy `/export` |

`oauth-settings.routes.ts` definiuje wyłącznie: `/status`, `/refresh`, `/disconnect`, `/reconnect`, `/test`.

**Skutek:** każde z tych 6 wywołań kończy się 404. Trafiają na centralny `notFoundHandler`, a we froncie — na przechwytywacz błędów axiosa, więc UI pokaże błąd połączenia zamiast konkretnej informacji.

Dodatkowo `services/history.ts:154` używa **surowego `fetch`** z relatywnym URL-em zamiast `apiService`. Omija to wstrzykiwanie tokenu, retry i śledzenie stanu połączenia — i jako jedyne wywołanie faktycznie polega na proxy Vite.

---

## 6. Korekty względem poprzedniej wersji raportu

Ponowna weryfikacja obaliła trzy wcześniejsze ustalenia:

| Wcześniejsze twierdzenie | Stan faktyczny |
|--------------------------|----------------|
| „Frontend woła `/api/health`, backend ma tylko `/health` → 404" | **Błędne.** Backend serwuje **oba**: `/health/*` w roocie i `GET /api/health` w `routes/index.ts`. Wywołanie frontendu jest poprawne. |
| „Frontend woła `/monitoring/*` bez prefiksu `/api`" | **Nieaktualne.** Wszystkie 12 wywołań używa `/api/monitoring/*`. |
| „Brak tras notifications i performance" | **Nieaktualne.** Oba routery istnieją i są zarejestrowane (`routes/index.ts:70,73`). |

Wniosek metodologiczny: raport opisujący stan gałęzi traci ważność, gdy gałąź jest przebudowywana równolegle. Przed działaniem na podstawie tego dokumentu warto powtórzyć weryfikację z §5.

---

## 7. Typowe błędy przy pierwszym uruchomieniu

```
# Backend (start)
Error: Missing required environment variable: JWT_SECRET
Error: JWT_SECRET contains weak pattern: "jwt". Use a strong, random secret.
Error: connect ECONNREFUSED 127.0.0.1:5432      # PostgreSQL nie działa
Error: connect ECONNREFUSED 127.0.0.1:6379      # Redis nie działa

# Frontend (konsola przeglądarki) — po poprawnym starcie backendu
PUT  http://localhost:3001/api/oauth/preferences  404
GET  http://localhost:3001/api/oauth/folders      404
GET  http://localhost:3001/api/oauth/calendars    404
POST http://localhost:3001/api/schedules          404
```

---

## 8. Weryfikacja po naprawach

```bash
npm run dev                                   # oba serwery startują
curl http://localhost:3001/health             # {"status":"healthy",...}
curl http://localhost:3001/api/health         # lista zamontowanych grup tras
npm run lint                                  # backend wymaga jawnych typów zwracanych
npm run test:backend                          # progi pokrycia 80%
```

W zakładce Network przeglądarki nie powinno być odpowiedzi 404 dla wywołań z §5.
