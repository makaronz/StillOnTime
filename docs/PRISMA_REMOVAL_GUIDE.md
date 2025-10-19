# 🧹 Prisma Removal Guide - Kompletny Poradnik Usuwania Prisma

**Data**: 2025-01-19  
**Status**: Prisma → Kysely Migration Complete  
**Cel**: Całkowite usunięcie wszystkich śladów Prisma z repozytorium

---

## 📋 Executive Summary

Po pomyślnej migracji z Prisma na Kysely (100% repozytoriów zmigrowane), należy teraz usunąć wszystkie pozostałe ślady Prisma z kodu, zależności i konfiguracji. Ten dokument zawiera kompletną listę TODO zadań.

---

## 🎯 Główne Cele

- [ ] Usunąć wszystkie importy `@prisma/client`
- [ ] Usunąć zależności Prisma z `package.json`
- [ ] Usunąć pliki konfiguracyjne Prisma
- [ ] Zaktualizować wszystkie serwisy używające Prisma
- [ ] Usunąć testy używające PrismaClient
- [ ] Zaktualizować dokumentację
- [ ] Zweryfikować brak błędów kompilacji

---

## 📁 PHASE 1: Usunięcie Zależności i Konfiguracji

### 1.1 Package.json Cleanup
**Plik**: `backend/package.json`

#### TODO: Usuń zależności Prisma
```bash
# Usuń te linie z dependencies:
"@prisma/client": "^5.6.0",
"prisma": "^5.6.0"
```

#### TODO: Usuń scripts Prisma
```bash
# Usuń te linie z scripts:
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev",
"prisma:studio": "prisma studio", 
"prisma:reset": "prisma migrate reset",
"prisma:deploy": "prisma migrate deploy",
```

#### TODO: Dodaj nowe scripts dla Kysely (opcjonalnie)
```bash
# Możesz dodać:
"db:studio": "echo 'Use pgAdmin or similar for database management'",
"db:reset": "ts-node src/scripts/reset-database.ts",
```

### 1.2 Usuń Pliki Konfiguracyjne Prisma

#### TODO: Usuń katalog prisma/
```bash
rm -rf backend/prisma/
```

**Uwaga**: Przed usunięciem, upewnij się że:
- [ ] Wszystkie migracje zostały zastosowane do bazy danych
- [ ] Schemat jest dostępny w `database-types.ts`
- [ ] Nie ma już referencji do plików w `prisma/`

#### TODO: Usuń plik prisma.ts
```bash
rm backend/src/prisma.ts
```

**Powód**: Plik eksportuje tylko alias `db as prisma` dla kompatybilności wstecznej.

---

## 📁 PHASE 2: Aktualizacja Serwisów i Middleware

### 2.1 Email Service
**Plik**: `backend/src/services/emailService.ts`

#### TODO: Znajdź i zamień wszystkie referencje Prisma
```typescript
// ZNAJDŹ I ZAMIEŃ:
// Linia 360: prisma.scheduleData.create
// Linia 437: prisma.processedEmail.findMany  
// Linia 546-554: prisma.processedEmail.count
// Linia 585: prisma.processedEmail.deleteMany
// Linia 614: prisma.processedEmail.findMany
```

#### TODO: Dodaj import Kysely
```typescript
import { db } from "@/config/database";
import { scheduleDataRepository } from "@/repositories/schedule-data.repository";
import { processedEmailRepository } from "@/repositories/processed-email.repository";
```

#### TODO: Zamień operacje Prisma na repozytoria
```typescript
// PRZED:
const schedule = await prisma.scheduleData.create({
  data: { /* ... */ }
});

// PO:
const schedule = await scheduleDataRepository.create({
  /* ... */
});
```

### 2.2 Auth Middleware  
**Plik**: `backend/src/middleware/auth.ts`

#### TODO: Znajdź i zamień wszystkie referencje Prisma
```typescript
// ZNAJDŹ I ZAMIEŃ:
// Linia 81: prisma.user.findUnique
// Linia 160: prisma.user.findUnique
// Linia 256: prisma.scheduleData.findFirst
// Linia 263: prisma.processedEmail.findFirst  
// Linia 270: prisma.routePlan.findFirst
// Linia 363: prisma.user.findUnique
```

#### TODO: Dodaj import repozytoriów
```typescript
import { userRepository } from "@/repositories/user.repository";
import { scheduleDataRepository } from "@/repositories/schedule-data.repository";
import { processedEmailRepository } from "@/repositories/processed-email.repository";
import { routePlanRepository } from "@/repositories/route-plan.repository";
```

#### TODO: Zamień operacje Prisma na repozytoria
```typescript
// PRZED:
const user = await prisma.user.findUnique({
  where: { id: decoded.userId },
  select: { /* ... */ }
});

// PO:
const user = await userRepository.findById(decoded.userId);
```

---

## 📁 PHASE 3: Aktualizacja Typów i Repozytoriów

### 3.1 Types Index
**Plik**: `backend/src/types/index.ts`

#### TODO: Usuń importy Prisma
```typescript
// USUŃ:
import {
  User as PrismaUser,
  ProcessedEmail as PrismaProcessedEmail,
  ScheduleData as PrismaScheduleData,
  RoutePlan as PrismaRoutePlan,
  WeatherData as PrismaWeatherData,
  CalendarEvent as PrismaCalendarEvent,
  UserConfig as PrismaUserConfig,
  Notification as PrismaNotification,
  Summary as PrismaSummary,
  Prisma,
} from "@prisma/client";
```

#### TODO: Zamień typy Prisma na Kysely
```typescript
// ZAMIEŃ:
export type CreateUserInput = Prisma.UserCreateInput;
export type UpdateUserInput = Prisma.UserUpdateInput;
// ... wszystkie inne Prisma types

// NA:
import { NewUser, UserUpdate } from "@/config/database-types";
export type CreateUserInput = NewUser;
export type UpdateUserInput = UserUpdate;
// ... dla wszystkich modeli
```

#### TODO: Aktualizuj typy z relacjami
```typescript
// PRZED:
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    processedEmails: true;
    schedules: true;
    routePlans: true;
    weatherData: true;
    calendarEvents: true;
    userConfig: true;
    notifications: true;
    summaries: true;
  };
}>;

// PO: Stwórz nowe typy bazujące na Kysely lub użyj istniejących z repozytoriów
export type UserWithRelations = User & {
  processedEmails: ProcessedEmail[];
  schedules: ScheduleData[];
  routePlans: RoutePlan[];
  weatherData: WeatherData[];
  calendarEvents: CalendarEvent[];
  userConfig: UserConfig | null;
  notifications: Notification[];
  summaries: Summary[];
};
```

### 3.2 Base Repository
**Plik**: `backend/src/repositories/base.repository.ts`

#### TODO: Usuń import Prisma
```typescript
// USUŃ:
import type { Prisma } from "@prisma/client";
```

#### TODO: Usuń typy Prisma (jeśli są)
```typescript
// USUŃ wszystkie typy związane z Prisma, zastąp typami Kysely
```

---

## 📁 PHASE 4: Aktualizacja Skryptów i Testów

### 4.1 Database Test Script
**Plik**: `backend/src/scripts/test-database.ts`

#### TODO: Usuń PrismaClient
```typescript
// USUŃ:
import { PrismaClient } from "@prisma/client";

// ZAMIEŃ:
import { db } from "@/config/database";
import { userRepository } from "@/repositories/user.repository";
import { userConfigRepository } from "@/repositories/user-config.repository";
// ... inne repozytoria
```

#### TODO: Zamień wszystkie operacje Prisma
```typescript
// PRZED:
const testUser = await prisma.user.create({
  data: { /* ... */ }
});

// PO:
const testUser = await userRepository.create({
  /* ... */
});
```

#### TODO: Usuń $disconnect()
```typescript
// USUŃ:
await prisma.$disconnect();

// Kysely nie wymaga disconnect() - connection pooling jest automatyczny
```

### 4.2 Init Database Script
**Plik**: `backend/src/scripts/init-db.ts`

#### TODO: Usuń PrismaClient
```typescript
// USUŃ:
import { PrismaClient } from "@prisma/client";

// ZAMIEŃ:
import { db } from "@/config/database";
```

#### TODO: Zamień $queryRaw
```typescript
// PRZED:
await prisma.$queryRaw`SELECT 1`;

// PO:
await db.selectFrom(sql`(SELECT 1) as result`).execute();
// LUB:
import { sql } from 'kysely';
await sql`SELECT 1`.execute(db);
```

#### TODO: Zamień count operations
```typescript
// PRZED:
const userCount = await prisma.user.count();

// PO:
const result = await db
  .selectFrom("users")
  .select((eb) => eb.fn.countAll<number>().as("count"))
  .executeTakeFirstOrThrow();
const userCount = Number(result.count);
```

---

## 📁 PHASE 5: Aktualizacja Testów

### 5.1 Integration Tests
**Plik**: `backend/tests/integration/api.integration.test.ts`

#### TODO: Sprawdź i usuń referencje do Prisma
```bash
# Wyszukaj w pliku:
grep -n "prisma\|Prisma" backend/tests/integration/api.integration.test.ts
```

#### TODO: Zamień na Kysely/repozytoria jeśli są używane

### 5.2 Unit Tests
**Pliki**: Wszystkie pliki w `backend/tests/unit/`

#### TODO: Sprawdź każdy plik testowy
```bash
# Wyszukaj wszystkie referencje:
find backend/tests/ -name "*.ts" -exec grep -l "prisma\|Prisma" {} \;
```

#### TODO: Zamień PrismaClient w testach na repozytoria

### 5.3 Repository Tests
**Pliki**: `backend/tests/repositories/`

#### TODO: Sprawdź czy testy używają starych metod Prisma
```bash
grep -r "prisma\|Prisma" backend/tests/repositories/
```

#### TODO: Zaktualizuj testy do nowych metod Kysely

---

## 📁 PHASE 6: Dokumentacja i Konfiguracja

### 6.1 Database Documentation
**Plik**: `backend/DATABASE.md`

#### TODO: Usuń referencje do Prisma
```markdown
# ZNAJDŹ I USUŃ:
- "Prisma ORM" → "Kysely Query Builder"
- "prisma generate" → "database types are auto-generated"
- "prisma migrate" → "use direct SQL migrations"
- "prisma studio" → "use pgAdmin or similar"
```

#### TODO: Zaktualizuj instrukcje setup
```markdown
# ZAMIEŃ sekcje:
## 4. Generate Prisma Client
## 5. Run Database Migrations

# NA:
## 4. Database is ready (no client generation needed)
## 5. Database schema is managed via direct SQL
```

### 6.2 Package.json Root
**Plik**: `package.json` (root level)

#### TODO: Sprawdź czy są referencje do Prisma scripts
```bash
grep -n "prisma" package.json
```

#### TODO: Usuń jeśli są obecne

### 6.3 Docker Configuration
**Pliki**: `docker-compose.yml`, `docker-compose.production.yml`

#### TODO: Sprawdź czy są referencje do Prisma w Docker
```bash
grep -n "prisma" docker-compose*.yml
```

#### TODO: Usuń komendy Prisma z Dockerfiles jeśli są

---

## 📁 PHASE 7: Weryfikacja i Cleanup

### 7.1 Global Search dla Pozostałych Referencji
```bash
# Wyszukaj wszystkie pliki z referencjami do Prisma:
grep -r "prisma\|Prisma\|@prisma" backend/src/ --include="*.ts" --include="*.js"

# Sprawdź wszystkie pliki konfiguracyjne:
grep -r "prisma\|Prisma" . --include="*.json" --include="*.md" --include="*.yml"
```

### 7.2 Test Compilation
```bash
cd backend
npm run build
```

#### TODO: Sprawdź czy nie ma błędów kompilacji
- [ ] Brak błędów TypeScript
- [ ] Wszystkie importy działają
- [ ] Brak referencji do nieistniejących plików

### 7.3 Runtime Testing
```bash
cd backend
npm run dev:simple
```

#### TODO: Sprawdź czy aplikacja się uruchamia
- [ ] Brak błędów przy starcie
- [ ] Połączenie z bazą danych działa
- [ ] API endpoints odpowiadają

### 7.4 Test Suite
```bash
cd backend
npm run test
```

#### TODO: Sprawdź czy wszystkie testy przechodzą
- [ ] Unit tests
- [ ] Integration tests
- [ ] Repository tests

---

## 📁 PHASE 8: Final Cleanup

### 8.1 Usuń Backup Files (jeśli istnieją)
```bash
# Sprawdź czy są pliki backup:
ls -la backend/.backup-*
rm -rf backend/.backup-*
```

### 8.2 Usuń Temporary Files
```bash
# Sprawdź czy są pliki tymczasowe związane z Prisma:
find . -name "*prisma*" -type f
find . -name "*Prisma*" -type f
```

### 8.3 Update .gitignore
**Plik**: `.gitignore`

#### TODO: Usuń wpisy związane z Prisma
```gitignore
# USUŃ jeśli są:
/prisma/migrations/
/prisma/schema.prisma
*.prisma
```

#### TODO: Dodaj wpisy dla Kysely (jeśli potrzebne)
```gitignore
# DODAJ jeśli potrzebne:
/database-types.ts.backup
```

---

## 📊 Checklist Postępu

### ✅ Phase 1: Dependencies & Config
- [ ] Usunięto `@prisma/client` z package.json
- [ ] Usunięto `prisma` z package.json  
- [ ] Usunięto scripts Prisma z package.json
- [ ] Usunięto katalog `backend/prisma/`
- [ ] Usunięto `backend/src/prisma.ts`

### ✅ Phase 2: Services & Middleware
- [ ] Zaktualizowano `emailService.ts`
- [ ] Zaktualizowano `auth.ts` middleware
- [ ] Dodano importy repozytoriów
- [ ] Zamieniono operacje Prisma na Kysely

### ✅ Phase 3: Types & Repositories  
- [ ] Usunięto importy Prisma z `types/index.ts`
- [ ] Zamieniono typy Prisma na Kysely
- [ ] Zaktualizowano `base.repository.ts`
- [ ] Zweryfikowano wszystkie repozytoria

### ✅ Phase 4: Scripts & Tests
- [ ] Zaktualizowano `test-database.ts`
- [ ] Zaktualizowano `init-db.ts`
- [ ] Sprawdzono integration tests
- [ ] Sprawdzono unit tests
- [ ] Sprawdzono repository tests

### ✅ Phase 5: Documentation
- [ ] Zaktualizowano `DATABASE.md`
- [ ] Sprawdzono root `package.json`
- [ ] Sprawdzono Docker configuration
- [ ] Usunięto referencje do Prisma z dokumentacji

### ✅ Phase 6: Verification
- [ ] Global search - brak referencji do Prisma
- [ ] Kompilacja TypeScript - brak błędów
- [ ] Runtime test - aplikacja się uruchamia
- [ ] Test suite - wszystkie testy przechodzą

### ✅ Phase 7: Final Cleanup
- [ ] Usunięto backup files
- [ ] Usunięto temporary files
- [ ] Zaktualizowano .gitignore
- [ ] Finalna weryfikacja

---

## 🚨 Ważne Uwagi

### ⚠️ Przed Rozpoczęciem
1. **Backup**: Zrób backup całego repozytorium
2. **Branch**: Stwórz nowy branch `remove-prisma-completely`
3. **Testing**: Przetestuj każdą zmianę przed przejściem dalej

### ⚠️ Podczas Wykonywania
1. **Stopniowo**: Wykonuj zmiany stopniowo, testując po każdej fazie
2. **Commits**: Rób częste commity z opisowymi wiadomościami
3. **Rollback**: Miej plan rollback w przypadku problemów

### ⚠️ Po Zakończeniu
1. **Documentation**: Zaktualizuj wszystkie dokumenty
2. **Team**: Poinformuj zespół o zmianach
3. **Deployment**: Sprawdź czy deployment działa z nowymi zmianami

---

## 🎯 Success Criteria

**Projekt jest gotowy gdy:**
- [ ] `npm run build` - brak błędów
- [ ] `npm run test` - wszystkie testy przechodzą  
- [ ] `npm run dev` - aplikacja się uruchamia
- [ ] Brak referencji do "prisma", "Prisma", "@prisma" w kodzie
- [ ] Dokumentacja zaktualizowana
- [ ] Zespół poinformowany o zmianach

---

## 📞 Support

W przypadku problemów podczas wykonywania tego przewodnika:

1. **Sprawdź logi**: `npm run dev` i sprawdź błędy w konsoli
2. **TypeScript**: `npm run build` pokaże błędy kompilacji
3. **Tests**: `npm run test` pokaże problemy z testami
4. **Database**: Sprawdź połączenie z bazą danych
5. **Rollback**: Jeśli wszystko się zepsuje, wróć do poprzedniego commita

---

**Data utworzenia**: 2025-01-19  
**Ostatnia aktualizacja**: 2025-01-19  
**Status**: Ready for Execution  
**Szacowany czas**: 4-6 godzin (w zależności od doświadczenia)
