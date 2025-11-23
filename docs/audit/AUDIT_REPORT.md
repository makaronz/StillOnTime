# RAPORT AUDYTU TECHNICZNEGO - StillOnTime

**Data audytu**: 2025-11-23
**Audytor**: Claude Code Agent
**Repozytorium**: https://github.com/makaronz/StillOnTime

---

## 1. PODSUMOWANIE (WYSOKI POZIOM)

### CZY DA SIĘ URUCHOMIĆ PROJEKT: **NIE**

Projekt **NIE MOŻE** zostać uruchomiony w obecnym stanie z powodu wielu krytycznych problemów konfiguracyjnych i brakujących zależności.

### NAJWIĘKSZY BLOKUJĄCY PROBLEM:

**BRAK PLIKÓW .env** - W całym projekcie nie istnieją pliki konfiguracyjne .env:
- `/home/user/StillOnTime/.env` - **NIE MA**
- `/home/user/StillOnTime/backend/.env` - **NIE MA**
- `/home/user/StillOnTime/frontend/.env` - **NIE MA**

Bez tych plików backend nie może się uruchomić (wymagane: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, itp.).

### KOLEJNOŚĆ BLOKAD (co się stanie po kolei):

1. `npm run dev` → **FAIL**: `concurrently: not found` (zależności nie zainstalowane)
2. Po `npm install` → **FAIL**: Backend crash - brak zmiennych środowiskowych
3. Po skopiowaniu .env.example → **FAIL**: PostgreSQL nie działa
4. Po uruchomieniu PostgreSQL → **FAIL**: Redis nie działa
5. Po uruchomieniu Redis → **FAIL**: Brak Google OAuth credentials
6. Po Google setup → Potencjalnie działa, ale z błędami API

---

## 2. MAPA APLIKACJI (UŻYTKOWNIK)

### Ekrany / Widoki dostępne w aplikacji:

| Ścieżka | Komponent | Opis | Wymaga auth |
|---------|-----------|------|-------------|
| `/login` | `Login` | Strona logowania Google OAuth | NIE |
| `/auth/callback` | `OAuthCallback` | Obsługa callback OAuth | NIE |
| `/privacy-policy` | `PrivacyPolicy` | Polityka prywatności | NIE |
| `/onboarding` | `Onboarding` | Kreator konfiguracji | TAK |
| `/` | `Dashboard` | Główny dashboard | TAK |
| `/configuration` | `Configuration` | Ustawienia użytkownika | TAK |
| `/history` | `History` | Historia przetworzonych emaili | TAK |
| `/monitoring` | `Monitoring` | Monitorowanie systemu | TAK |

### Co powinno się dziać na każdym ekranie:

#### Dashboard (`/`)
- Wyświetla status systemu (połączenia z API)
- Pokazuje ostatnie przetworzone emaile
- Pokazuje nadchodzące harmonogramy
- Przycisk "Przetwórz emaile" wywołuje `/api/emails/process`

#### Configuration (`/configuration`)
- Formularz z adresami (dom, Panavision)
- Ustawienia buforów czasowych
- Preferencje powiadomień
- Status połączeń z API (Gmail, Calendar, Maps, Weather)

#### History (`/history`)
- Lista przetworzonych emaili z paginacją
- Filtry (status, data, wyszukiwanie)
- Eksport do CSV/JSON
- Retry dla nieudanych emaili

#### Monitoring (`/monitoring`)
- Metryki performance
- Status circuit breakers
- Alerty i reguły alertów
- Health check systemu

---

## 3. MAPA TECHNICZNA (KOD)

### Struktura folderów:

```
StillOnTime/
├── backend/                    # Express.js API (port 3001)
│   ├── src/
│   │   ├── index.ts           # Entry point backendu
│   │   ├── config/            # Konfiguracja (database, redis, security)
│   │   ├── controllers/       # Kontrolery HTTP
│   │   ├── routes/            # 18 plików routes (140+ endpointów)
│   │   ├── services/          # Logika biznesowa
│   │   ├── middleware/        # Auth, error handling, monitoring
│   │   └── types/             # TypeScript types
│   └── package.json
├── frontend/                   # React + Vite (port 3000)
│   ├── src/
│   │   ├── main.tsx           # Entry point
│   │   ├── App.tsx            # Router (React Router v6)
│   │   ├── pages/             # Komponenty stron
│   │   ├── components/        # Reużywalne komponenty
│   │   ├── services/          # API calls (61 endpointów)
│   │   ├── stores/            # Zustand stores
│   │   └── hooks/             # Custom hooks
│   └── package.json
├── mobile/                     # React Native (nie audytowane)
├── docker-compose.yml          # PostgreSQL, Redis, Grafana, Prometheus
└── package.json                # Root monorepo
```

### Entry Points:

- **Frontend**: `/home/user/StillOnTime/frontend/src/main.tsx`
- **Backend**: `/home/user/StillOnTime/backend/src/index.ts`

### Router:

Frontend używa **React Router v6** z lazy loading:
- `BrowserRouter` w `main.tsx`
- `Routes` / `Route` w `App.tsx`
- `ProtectedRoute` wrapper dla auth

---

## 4. POŁĄCZENIA FRONT–BACK–API

### KRYTYCZNE NIEZGODNOŚCI:

| Frontend wywołuje | Backend ma | Status | Problem |
|-------------------|------------|--------|---------|
| `GET /api/health` | `GET /health` | NIEZGODNOŚĆ | Backend: `/health`, nie `/api/health` |
| `GET /monitoring/dashboard` | `GET /api/monitoring/dashboard` | NIEZGODNOŚĆ | Frontend bez `/api` prefix |
| `GET /monitoring/performance/history` | `GET /api/monitoring/performance/history` | NIEZGODNOŚĆ | Frontend bez `/api` prefix |
| `POST /api/performance/web-vitals` | - | NIE ISTNIEJE | Endpoint całkowicie brakuje |
| `GET /api/notifications` | - | NIE ISTNIEJE | Brak routes dla notifications |
| `PATCH /api/notifications/:id/read` | - | NIE ISTNIEJE | Brak routes dla notifications |
| `PUT /api/oauth/preferences` | - | NIE ISTNIEJE | Brak tego endpointu |
| `GET /api/oauth/folders` | - | NIE ISTNIEJE | Brak tego endpointu |
| `GET /api/oauth/calendars` | - | NIE ISTNIEJE | Brak tego endpointu |
| `POST /api/schedules` | - | NIE ISTNIEJE | Brak POST dla schedules |
| `DELETE /api/emails/:id` | - | NIE ISTNIEJE | Brak DELETE dla emails |

### ZGODNE ENDPOINTY (przykłady):

| Frontend | Backend | Status |
|----------|---------|--------|
| `GET /api/auth/login` | `GET /api/auth/login` | OK |
| `POST /api/auth/callback` | `POST /api/auth/callback` | OK |
| `GET /api/auth/status` | `GET /api/auth/status` | OK |
| `GET /api/system/status` | `GET /api/system/status` | OK |
| `GET /api/user/config` | `GET /api/user/config` | OK |
| `PUT /api/user/config` | `PUT /api/user/config` | OK |
| `GET /api/emails/recent` | `GET /api/emails/recent` | OK |
| `POST /api/emails/process` | `POST /api/email/process` | UWAGA: `/email` vs `/emails` |
| `GET /api/schedules/upcoming` | `GET /api/schedules/upcoming` | OK |

### STATYSTYKI:

- **Frontend wywołuje**: 61 unikalnych endpointów
- **Backend definiuje**: 140+ endpointów
- **Niezgodności**: ~15 endpointów
- **Brakuje w backend**: ~10 endpointów

---

## 5. PROBLEMY KRYTYCZNE

### POZIOM KRYTYCZNY (blokuje uruchomienie):

#### 1. BRAK PLIKÓW .env
**Lokalizacja**: Cały projekt
**Problem**: Żadne pliki .env nie istnieją
**Skutek**: Backend crash przy starcie - `Missing required environment variable`
**Rozwiązanie**: Skopiować `.env.example` → `.env` i uzupełnić wartości

#### 2. BRAK ZAINSTALOWANYCH ZALEŻNOŚCI
**Lokalizacja**: Root `/home/user/StillOnTime`
**Problem**: `npm run dev` → `concurrently: not found`
**Skutek**: Nie można uruchomić żadnego serwera
**Rozwiązanie**: `npm run install:all`

#### 3. BRAK INFRASTRUKTURY (PostgreSQL, Redis)
**Lokalizacja**: System
**Problem**: Brak uruchomionych usług PostgreSQL i Redis
**Skutek**: Backend crash - `ECONNREFUSED` dla database/redis
**Rozwiązanie**: `docker-compose up -d` lub manualna instalacja

#### 4. WYMAGANE KLUCZE API
**Lokalizacja**: `.env`
**Problem**: Wymagane:
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (OAuth)
- `OPENWEATHER_API_KEY` (pogoda)
- `GOOGLE_MAPS_API_KEY` (mapy)

**Skutek**: Backend crash lub funkcje nie działają
**Rozwiązanie**: Utworzyć projekt w Google Cloud Console, uzyskać klucze

### POZIOM WYSOKI (błędy runtime):

#### 5. HEALTH CHECK PATH MISMATCH
**Lokalizacja**:
- Frontend: `frontend/src/services/api.ts:194`
- Backend: `backend/src/routes/health.routes.ts`

**Problem**: Frontend woła `/api/health`, backend ma `/health`
**Skutek**: Health check zawsze fail → connection store pokazuje "disconnected"
**Rozwiązanie**: Zmienić frontend na `/health` lub backend dodać `/api/health`

#### 6. MONITORING ROUTES PREFIX MISMATCH
**Lokalizacja**: `frontend/src/services/monitoring.ts`
**Problem**: Frontend woła `/monitoring/...`, backend ma `/api/monitoring/...`
**Skutek**: Wszystkie metryki monitoring → 404
**Rozwiązanie**: Dodać `/api` prefix w frontend

#### 7. BRAKUJĄCE ENDPOINTY NOTIFICATIONS
**Lokalizacja**: `frontend/src/hooks/useNotifications.ts`
**Problem**: Frontend woła `/api/notifications`, backend nie ma tych routes
**Skutek**: Powiadomienia nie działają → 404
**Rozwiązanie**: Dodać `notifications.routes.ts` w backend

#### 8. BRAKUJĄCY ENDPOINT PERFORMANCE
**Lokalizacja**: `frontend/src/services/performance-monitoring.service.ts:315`
**Problem**: Frontend POSTuje `/api/performance/web-vitals`, endpoint nie istnieje
**Skutek**: Web vitals nie są zapisywane
**Rozwiązanie**: Dodać endpoint w backend

### POZIOM ŚREDNI (niepełna funkcjonalność):

#### 9. EMAIL vs EMAILS PATH INCONSISTENCY
**Problem**: Backend ma zarówno `/api/email/*` jak `/api/emails/*` (aliasy)
**Ale**: Niektóre endpointy tylko pod jedną ścieżką
**Skutek**: Potencjalne 404 dla niektórych operacji

#### 10. BRAKUJĄCE OAUTH PREFERENCES/FOLDERS/CALENDARS
**Lokalizacja**: `frontend/src/services/oauth.service.ts`
**Problem**: Frontend woła endpointy których nie ma w `oauth-settings.routes.ts`
**Skutek**: Konfiguracja OAuth niepełna

#### 11. JWT_SECRET VALIDATION TOO STRICT
**Lokalizacja**: `backend/src/config/security.ts:118-128`
**Problem**: JWT_SECRET nie może zawierać słów: "jwt", "secret", "password", "token", "key", "auth", "test", "demo"
**Skutek**: Nawet rozsądne secrety mogą być odrzucone

---

## 6. TYPOWE BŁĘDY W KONSOLI (prognoza)

Po uruchomieniu aplikacji bez pełnej konfiguracji:

```
# Backend startup errors:
Error: Missing required environment variable: JWT_SECRET
Error: Missing required environment variable: GOOGLE_CLIENT_ID
Error: ECONNREFUSED 127.0.0.1:5432 (PostgreSQL)
Error: ECONNREFUSED 127.0.0.1:6379 (Redis)

# Frontend console errors:
GET http://localhost:3001/api/health 404 (Not Found)
GET http://localhost:3001/monitoring/dashboard 404 (Not Found)
GET http://localhost:3001/api/notifications 404 (Not Found)
POST http://localhost:3001/api/performance/web-vitals 404 (Not Found)

# Network errors:
CORS policy: No 'Access-Control-Allow-Origin' header
TypeError: Cannot read property 'data' of undefined
```

---

## 7. WERYFIKACJA NAPRAW

Po wykonaniu TODO, sprawdzić:

1. `npm run dev` uruchamia oba serwery
2. Backend loguje: `StillOnTime Backend API server running on port 3001`
3. Frontend dostępny na `http://localhost:3000`
4. `curl http://localhost:3001/health` zwraca `{"status":"healthy"}`
5. Login przez Google działa
6. Dashboard ładuje dane z API
7. Brak błędów 404 w Network tab

---

## PODSUMOWANIE KOŃCOWE

**Stan projektu**: Kod istnieje i jest kompletny strukturalnie, ale **konfiguracja jest całkowicie pusta**. Projekt wymaga manualnego setupu infrastruktury i credentials.

**Główna przyczyna "nie działa"**: **BRAK PLIKÓW .env** + niezainstalowane zależności + brak infrastruktury (PostgreSQL/Redis).

**Czas naprawy**: ~2-4 godziny dla doświadczonego developera (większość to setup Google Cloud Console i API keys).

**Krytyczne niezgodności API**: ~15 endpointów wymaga naprawy ścieżek lub dodania w backendzie.
