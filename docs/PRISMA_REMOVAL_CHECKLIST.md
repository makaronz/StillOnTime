# ✅ Prisma Removal Checklist

**Quick Reference** - Szybka lista kontrolna do usuwania Prisma

---

## 🚀 Quick Start

```bash
# 1. Dry run (sprawdź co zostanie usunięte)
./scripts/remove-prisma.sh --dry-run

# 2. Z backup (zalecane)
./scripts/remove-prisma.sh --backup

# 3. Bez backup (szybko)
./scripts/remove-prisma.sh
```

---

## 📋 Manual Checklist

### ✅ Phase 1: Dependencies
- [ ] Usunięto `@prisma/client` z `backend/package.json`
- [ ] Usunięto `prisma` z `backend/package.json`
- [ ] Usunięto scripts: `prisma:generate`, `prisma:migrate`, `prisma:studio`, `prisma:reset`, `prisma:deploy`

### ✅ Phase 2: Files
- [ ] Usunięto katalog `backend/prisma/`
- [ ] Usunięto plik `backend/src/prisma.ts`

### ✅ Phase 3: Code Updates
- [ ] `backend/src/services/emailService.ts` - usunięto referencje do `prisma.`
- [ ] `backend/src/middleware/auth.ts` - usunięto referencje do `prisma.`
- [ ] `backend/src/types/index.ts` - usunięto importy z `@prisma/client`
- [ ] `backend/src/repositories/base.repository.ts` - usunięto importy Prisma
- [ ] `backend/src/scripts/test-database.ts` - zastąpiono PrismaClient
- [ ] `backend/src/scripts/init-db.ts` - zastąpiono PrismaClient

### ✅ Phase 4: Tests
- [ ] `backend/tests/integration/api.integration.test.ts`
- [ ] `backend/tests/unit/services/authService.test.ts`
- [ ] `backend/tests/unit/services/scheduleService.test.ts`
- [ ] `backend/tests/unit/services/emailService.test.ts`
- [ ] Wszystkie pliki w `backend/tests/repositories/`

### ✅ Phase 5: Verification
- [ ] `npm run build` - brak błędów TypeScript
- [ ] `npm run test` - wszystkie testy przechodzą
- [ ] `npm run dev:simple` - aplikacja się uruchamia
- [ ] Global search: brak referencji do "prisma", "Prisma", "@prisma"

---

## 🔍 Search Commands

```bash
# Sprawdź czy zostały referencje do Prisma
grep -r "prisma\|Prisma\|@prisma" backend/src/ --include="*.ts"
grep -r "prisma\|Prisma" backend/tests/ --include="*.ts"
grep -r "prisma\|Prisma" . --include="*.json" --include="*.md"
```

---

## 🚨 Emergency Rollback

```bash
# Jeśli coś poszło nie tak, przywróć z backup
cp -r ../backup-YYYYMMDD_HHMMSS/* .

# Lub z git (jeśli commitowałeś przed zmianami)
git reset --hard HEAD~1
```

---

## 📞 Quick Help

**Problem**: Błędy kompilacji TypeScript
**Rozwiązanie**: Sprawdź importy w plikach z błędami

**Problem**: Testy nie przechodzą  
**Rozwiązanie**: Sprawdź czy wszystkie operacje Prisma zostały zastąpione

**Problem**: Aplikacja się nie uruchamia
**Rozwiązanie**: Sprawdź czy wszystkie serwisy używają repozytoriów zamiast Prisma

---

**Szacowany czas**: 30 minut (z automatyzacją) / 2-3 godziny (ręcznie)  
**Poziom trudności**: Średni  
**Ryzyko**: Niskie (z backup)
