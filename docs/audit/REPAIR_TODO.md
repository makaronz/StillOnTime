# SZCZEGÓŁOWA LISTA TODO - NAPRAWA StillOnTime

**Data utworzenia**: 2025-11-23
**Priorytet**: Od najważniejszych do najmniej ważnych

---

## PRIORYTET KRYTYCZNY (bez tego nie ruszy)

### TODO-001: Zainstalować zależności npm
**Status**: [ ] Do zrobienia
**Czas**: ~5 minut
**Polecenia**:
```bash
cd /home/user/StillOnTime
npm run install:all
```
**Weryfikacja**: `which concurrently` zwraca ścieżkę

---

### TODO-002: Utworzyć pliki .env z szablonów
**Status**: [ ] Do zrobienia
**Czas**: ~2 minuty
**Polecenia**:
```bash
cd /home/user/StillOnTime
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
**Weryfikacja**: Pliki .env istnieją w 3 lokalizacjach

---

### TODO-003: Wygenerować bezpieczny JWT_SECRET
**Status**: [ ] Do zrobienia
**Czas**: ~1 minuta
**Wymagania**:
- Minimum 48 znaków
- Mix: wielkie litery, małe litery, cyfry, znaki specjalne
- NIE może zawierać: "jwt", "secret", "password", "token", "key", "auth", "test", "demo"

**Polecenie generowania**:
```bash
openssl rand -base64 64 | tr -d '\n' | head -c 64
```

**Przykład poprawnego secretu**:
```
Xk9mP2vL8nQ3wR5tY7uI0oA4sD6fG1hJ2kZ3xC5vB8nM9qW0eR7tY4uI1oP6aS
```

**Plik do edycji**: `backend/.env`
**Linia**: `JWT_SECRET=<wygenerowany_secret>`

---

### TODO-004: Uruchomić infrastrukturę (PostgreSQL + Redis)
**Status**: [ ] Do zrobienia
**Czas**: ~5 minut

**Opcja A - Docker (ZALECANA)**:
```bash
cd /home/user/StillOnTime
docker-compose up -d postgres redis
```

**Opcja B - Manualne usługi**:
```bash
# PostgreSQL
sudo systemctl start postgresql
sudo -u postgres createdb stillontime_automation
sudo -u postgres createuser stillontime_user -P

# Redis
sudo systemctl start redis-server
```

**Weryfikacja**:
```bash
psql -h localhost -U stillontime_user -d stillontime_automation -c "SELECT 1"
redis-cli ping  # Powinno zwrócić PONG
```

---

### TODO-005: Skonfigurować Google OAuth 2.0
**Status**: [ ] Do zrobienia
**Czas**: ~30 minut

**Kroki w Google Cloud Console**:

1. Przejdź do https://console.cloud.google.com/
2. Utwórz nowy projekt lub wybierz istniejący
3. Włącz APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Maps JavaScript API
   - Google Maps Directions API
4. Przejdź do "APIs & Services" → "Credentials"
5. Kliknij "Create Credentials" → "OAuth client ID"
6. Typ: "Web application"
7. Authorized JavaScript origins:
   - `http://localhost:3000`
8. Authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
9. Skopiuj Client ID i Client Secret

**Pliki do edycji**:

`backend/.env`:
```env
GOOGLE_CLIENT_ID=<twój_client_id>
GOOGLE_CLIENT_SECRET=<twój_client_secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

`frontend/.env`:
```env
VITE_GOOGLE_CLIENT_ID=<twój_client_id>
```

---

### TODO-006: Uzyskać klucze API dla zewnętrznych usług
**Status**: [ ] Do zrobienia
**Czas**: ~20 minut

#### OpenWeatherMap API:
1. Zarejestruj się na https://openweathermap.org/api
2. Wygeneruj API key (darmowy plan wystarczy)
3. Dodaj do `backend/.env`:
   ```env
   OPENWEATHER_API_KEY=<twój_api_key>
   ```

#### Google Maps API:
1. W Google Cloud Console → "APIs & Services" → "Credentials"
2. Utwórz API key
3. Ogranicz do: Maps JavaScript API, Directions API, Geocoding API
4. Dodaj do `backend/.env`:
   ```env
   GOOGLE_MAPS_API_KEY=<twój_api_key>
   ```

---

## PRIORYTET WYSOKI (naprawić przed użyciem)

### TODO-007: Naprawić health check path w frontend
**Status**: [ ] Do zrobienia
**Czas**: ~2 minuty

**Plik**: `frontend/src/services/api.ts`
**Linia**: 194

**Zmiana**:
```typescript
// PRZED:
await this.client.get('/api/health', { timeout: 5000 });

// PO:
await this.client.get('/health', { timeout: 5000 });
```

**Weryfikacja**: Po uruchomieniu, connection status pokazuje "connected"

---

### TODO-008: Naprawić monitoring routes prefix w frontend
**Status**: [ ] Do zrobienia
**Czas**: ~10 minut

**Plik**: `frontend/src/services/monitoring.ts`

**Zmiany** (wszystkie wywołania):
```typescript
// PRZED:
'/monitoring/dashboard'
'/monitoring/performance/history'
'/monitoring/apm/history'
'/monitoring/services/${serviceName}/history'
'/monitoring/errors/metrics'
'/monitoring/circuit-breakers'
'/monitoring/metrics/custom'
'/monitoring/alerts/rules'
'/monitoring/test/alert'
'/monitoring/health'
'/monitoring/health/detailed'
'/monitoring/health/readiness'
'/monitoring/health/liveness'

// PO:
'/api/monitoring/dashboard'
'/api/monitoring/performance/history'
'/api/monitoring/apm/history'
'/api/monitoring/services/${serviceName}/history'
'/api/monitoring/errors/metrics'
'/api/monitoring/circuit-breakers'
'/api/monitoring/metrics/custom'
'/api/monitoring/alerts/rules'
'/api/monitoring/test/alert'
'/api/monitoring/health'
'/api/monitoring/health/detailed'
'/api/monitoring/health/readiness'
'/api/monitoring/health/liveness'
```

---

### TODO-009: Dodać brakujące routes dla notifications w backend
**Status**: [ ] Do zrobienia
**Czas**: ~30 minut

**Utworzyć plik**: `backend/src/routes/notifications.routes.ts`

**Zawartość**:
```typescript
import { Router, Response } from "express";
import { authenticateToken } from "@/middleware/auth";

const router = Router();

// GET /api/notifications - pobierz wszystkie powiadomienia
router.get("/", authenticateToken, async (req: any, res: Response) => {
  try {
    // TODO: Implementacja pobierania z bazy
    const notifications = [];
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/:id/read - oznacz jako przeczytane
router.patch("/:id/read", authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: Implementacja aktualizacji w bazie
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// PATCH /api/notifications/read-all - oznacz wszystkie jako przeczytane
router.patch("/read-all", authenticateToken, async (req: any, res: Response) => {
  try {
    // TODO: Implementacja aktualizacji w bazie
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

export { router as notificationsRoutes };
```

**Dodać do**: `backend/src/routes/index.ts`
```typescript
import { notificationsRoutes } from "./notifications.routes";
// ...
router.use("/notifications", notificationsRoutes);
```

---

### TODO-010: Dodać endpoint performance/web-vitals w backend
**Status**: [ ] Do zrobienia
**Czas**: ~20 minut

**Utworzyć plik**: `backend/src/routes/performance.routes.ts`

**Zawartość**:
```typescript
import { Router, Response } from "express";

const router = Router();

// POST /api/performance/web-vitals - zapisz metryki web vitals
router.post("/web-vitals", async (req: any, res: Response) => {
  try {
    const metrics = req.body;

    // Log metrics (można później dodać zapis do bazy/Prometheus)
    console.log("Web Vitals received:", {
      timestamp: new Date().toISOString(),
      url: metrics.url,
      LCP: metrics.LCP,
      FID: metrics.FID,
      CLS: metrics.CLS,
      FCP: metrics.FCP,
      TTFB: metrics.TTFB
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to record metrics" });
  }
});

export { router as performanceRoutes };
```

**Dodać do**: `backend/src/routes/index.ts`
```typescript
import { performanceRoutes } from "./performance.routes";
// ...
router.use("/performance", performanceRoutes);
```

---

### TODO-011: Dodać brakujące endpointy OAuth
**Status**: [ ] Do zrobienia
**Czas**: ~30 minut

**Plik**: `backend/src/routes/oauth-settings.routes.ts`

**Dodać endpointy**:
```typescript
// PUT /api/oauth/preferences - aktualizuj preferencje synchronizacji
router.put("/preferences", authenticateToken, async (req: any, res: Response) => {
  try {
    const preferences = req.body;
    // TODO: Zapisz preferencje do bazy
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// GET /api/oauth/folders - pobierz foldery Gmail
router.get("/folders", authenticateToken, async (req: any, res: Response) => {
  try {
    // TODO: Pobierz foldery z Gmail API
    const folders = ["INBOX", "SENT", "DRAFT", "SPAM", "TRASH"];
    res.json({ data: { folders } });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch folders" });
  }
});

// GET /api/oauth/calendars - pobierz kalendarze
router.get("/calendars", authenticateToken, async (req: any, res: Response) => {
  try {
    // TODO: Pobierz kalendarze z Calendar API
    const calendars = [
      { id: "primary", name: "Primary Calendar" }
    ];
    res.json({ data: { calendars } });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch calendars" });
  }
});
```

---

### TODO-012: Dodać POST /api/schedules endpoint
**Status**: [ ] Do zrobienia
**Czas**: ~20 minut

**Plik**: `backend/src/routes/schedule.routes.ts`

**Dodać endpoint** (po linii z GET `/`):
```typescript
// POST /api/schedules - utwórz nowy harmonogram
router.post(
  "/",
  authenticateToken,
  requireValidOAuth,
  [
    body("shootingDate").isISO8601(),
    body("callTime").isISO8601(),
    body("location").isString().isLength({ min: 1, max: 255 }),
  ],
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const schedule = await scheduleController.createSchedule(req, res);
      return schedule;
    } catch (error) {
      res.status(500).json({ error: "Failed to create schedule" });
    }
  }
);
```

**Dodać do controller**: `backend/src/controllers/schedule.controller.ts`
```typescript
async createSchedule(req: any, res: Response) {
  // TODO: Implementacja tworzenia harmonogramu
  const newSchedule = req.body;
  res.status(201).json({ success: true, data: newSchedule });
}
```

---

### TODO-013: Dodać DELETE /api/emails/:id endpoint
**Status**: [ ] Do zrobienia
**Czas**: ~15 minut

**Plik**: `backend/src/routes/email.routes.ts`

**Dodać endpoint**:
```typescript
// DELETE /api/email/:emailId - usuń email
router.delete(
  "/:emailId",
  authenticateToken,
  requireValidOAuth,
  [param("emailId").isString().notEmpty()],
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // TODO: Implementacja usuwania z bazy
      const { emailId } = req.params;
      res.json({ success: true, message: `Email ${emailId} deleted` });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete email" });
    }
  }
);
```

---

## PRIORYTET ŚREDNI (poprawić jakość)

### TODO-014: Ujednolicić email/emails paths
**Status**: [ ] Do zrobienia
**Czas**: ~15 minut

**Problem**: Backend ma zarówno `/api/email/*` jak `/api/emails/*`

**Rozwiązanie**: Wybrać standard `/api/emails/*` i zaktualizować frontend

**Pliki do sprawdzenia**:
- `frontend/src/services/dashboard.ts` - używa `/api/emails/*` ✓
- `backend/src/routes/email.routes.ts` - niektóre pod `/api/email/*`

**Opcja**: Dodać alias w `backend/src/routes/index.ts` (już istnieje)

---

### TODO-015: Zluzować walidację JWT_SECRET
**Status**: [ ] Do zrobienia (OPCJONALNE)
**Czas**: ~5 minut

**Plik**: `backend/src/config/security.ts`
**Linie**: 118-128

**Zmiana**: Usunąć lub zmniejszyć listę zabronionych słów:
```typescript
// PRZED:
const weakPatterns = [
  "jwt", "secret", "password", "token", "key", "auth",
  "123", "abc", "test", "demo", "default", "example"
];

// PO:
const weakPatterns = [
  "password", "123456", "qwerty", "default", "example"
];
```

---

### TODO-016: Uruchomić migracje bazy danych
**Status**: [ ] Do zrobienia
**Czas**: ~5 minut

**Po uruchomieniu PostgreSQL**:
```bash
cd /home/user/StillOnTime
npm run db:init
```

Lub jeśli używasz Prisma:
```bash
npm run prisma:generate
npm run prisma:migrate
```

---

## PRIORYTET NISKI (opcjonalne usprawnienia)

### TODO-017: Posprzątać pliki .md w root
**Status**: [ ] Do zrobienia
**Czas**: ~10 minut

**Problem**: 60+ plików dokumentacji w root directory

**Rozwiązanie**: Przenieść do `docs/`:
```bash
mkdir -p docs/reports docs/guides docs/sessions
mv *_REPORT.md docs/reports/
mv *_GUIDE.md docs/guides/
mv *_SUMMARY.md docs/sessions/
mv STREAM_*.md docs/sessions/
mv PHASE_*.md docs/sessions/
```

---

### TODO-018: Dodać health check w docker-compose
**Status**: [ ] Do zrobienia
**Czas**: ~10 minut

**Plik**: `docker-compose.yml`

**Dodać dla każdego serwisu**:
```yaml
services:
  postgres:
    # ...
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stillontime_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    # ...
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    # ...
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

### TODO-019: Dodać lepsze error messages dla brakujących env vars
**Status**: [ ] Do zrobienia
**Czas**: ~15 minut

**Plik**: `backend/src/config/config.ts`

**Zmiana funkcji `getRequiredEnvVar`**:
```typescript
function getRequiredEnvVar(name: string, fallbackForDev?: string): string {
  const value = process.env[name];

  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    if (fallbackForDev) {
      console.warn(`⚠️  Using fallback for ${name}: ${fallbackForDev}`);
      return fallbackForDev;
    }

    // Helpful error message
    console.error(`
❌ Missing required environment variable: ${name}

To fix this:
1. Copy the .env.example file: cp .env.example .env
2. Edit the .env file and set ${name}

See README.md for more information on required environment variables.
    `);
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
```

---

## WERYFIKACJA PO NAPRAWACH

### Checklist końcowy:

- [ ] `npm run dev` uruchamia oba serwery bez błędów
- [ ] Backend loguje: `StillOnTime Backend API server running on port 3001`
- [ ] Frontend dostępny na `http://localhost:3000`
- [ ] `curl http://localhost:3001/health` zwraca `{"status":"healthy"}`
- [ ] Network tab w przeglądarce nie pokazuje błędów 404
- [ ] Connection status pokazuje "connected"
- [ ] Login przez Google działa
- [ ] Dashboard ładuje dane
- [ ] Configuration zapisuje ustawienia
- [ ] History pokazuje listę emaili
- [ ] Monitoring pokazuje metryki

---

## SZACOWANY CZAS NAPRAWY

| Priorytet | Liczba zadań | Czas |
|-----------|--------------|------|
| Krytyczny | 6 | ~1.5 godziny |
| Wysoki | 7 | ~2.5 godziny |
| Średni | 3 | ~30 minut |
| Niski | 3 | ~35 minut |
| **RAZEM** | **19** | **~5 godzin** |

**Uwaga**: Większość czasu to setup Google Cloud Console i uzyskiwanie API keys.
