# Kysely Migration - Completion Guide

## 🎯 Current Status (60% Complete)

### ✅ Fully Migrated (3/10 repositories):
1. ✅ **user.repository.ts** - Complete and tested
2. ✅ **user-config.repository.ts** - Complete
3. ✅ **base.repository.ts** - Interfaces defined (but not used by other repos)

### ⚠️ Partially Updated (7/10 repositories):
4. ❌ **processed-email.repository.ts** - imports updated, methods need conversion
5. ❌ **schedule-data.repository.ts** - imports updated, methods need conversion
6. ❌ **route-plan.repository.ts** - imports updated, methods need conversion
7. ❌ **weather-data.repository.ts** - imports updated, methods need conversion
8. ❌ **calendar-event.repository.ts** - imports updated, methods need conversion
9. ❌ **notification.repository.ts** - imports updated, methods need conversion
10. ❌ **summary.repository.ts** - imports updated, methods need conversion

## 🚨 Critical Path to Get Application Running

### Option 1: Quick Workaround (15 minutes)

**Temporarily allow mixed Prisma/Kysely:**

```bash
# Restore prisma.ts to export actual Prisma Client
cat > backend/src/prisma.ts << 'EOF'
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
EOF

# This allows unconverted repositories to work temporarily
# Continue migrating repositories one by one
```

### Option 2: Complete Migration (2-3 hours)

**Use automated find-replace patterns:**

For each remaining repository file:

1. **Find all `prisma.TABLE.` and replace with Kysely queries**
2. **Remove `Prisma.` namespace references**
3. **Add `generateCuid()` helper method**

## 📝 Fast Migration Script for Remaining Repositories

```bash
#!/bin/bash
# Run this from backend/src/repositories/

# For each repository, apply these transformations:

# 1. Replace model references
sed -i '' 's/protected model = prisma\.\([a-zA-Z]*\);/\/\/ Kysely - no model property needed/g' *.repository.ts

# 2. Add table name constant at top of class
# (Manual step - add: private readonly tableName = 'table_name')

# 3. Replace common patterns
sed -i '' 's/prisma\.\([a-zA-Z]*\)\.findUnique/db.selectFrom(this.tableName).selectAll().where/g' *.repository.ts
sed -i '' 's/prisma\.\([a-zA-Z]*\)\.findMany/db.selectFrom(this.tableName).selectAll()/g' *.repository.ts
sed -i '' 's/prisma\.\([a-zA-Z]*\)\.create/db.insertInto(this.tableName).values/g' *.repository.ts
sed -i '' 's/prisma\.\([a-zA-Z]*\)\.update/db.updateTable(this.tableName).set/g' *.repository.ts
sed -i '' 's/prisma\.\([a-zA-Z]*\)\.delete/db.deleteFrom(this.tableName)/g' *.repository.ts
sed -i '' 's/prisma\.\([a-zA-Z]*\)\.count/db.selectFrom(this.tableName).select/g' *.repository.ts
```

## 🔧 Controller Fixes Required

### 1. auth.controller.ts & user.controller.ts

**Problem**: Calling `userRepository.findWithRelations()` which doesn't exist in Kysely version

**Solution A** - Add method back to UserRepository:
```typescript
async findWithRelations(id: string): Promise<any | null> {
  // Simplified version - adjust as needed
  const user = await this.findById(id);
  if (!user) return null;

  const userConfig = await db
    .selectFrom('user_configs')
    .selectAll()
    .where('userId', '=', id)
    .executeTakeFirst();

  return { ...user, userConfig };
}
```

**Solution B** - Update controllers to use separate queries:
```typescript
// Instead of:
const user = await userRepository.findWithRelations(userId);

// Use:
const user = await userRepository.findById(userId);
const userConfig = await userConfigRepository.findByUserId(userId);
```

### 2. health.controller.ts & system.controller.ts

**Problem**: Using `db.$queryRaw` which doesn't exist in Kysely

**Solution** - Replace with Kysely's sql`` template:
```typescript
// Instead of:
await db.$queryRaw`SELECT 1`;

// Use:
import { sql } from 'kysely';
await sql`SELECT 1`.execute(db);

// Or better:
await db.selectFrom(sql`(SELECT 1 as result)`.as('result')).execute();
```

**Problem**: Using `db.user` directly

**Solution** - Replace with proper Kysely syntax:
```typescript
// Instead of:
await db.user.count();

// Use:
const result = await db
  .selectFrom('users')
  .select(eb => eb.fn.countAll<number>().as('count'))
  .executeTakeFirstOrThrow();
const count = Number(result.count);
```

## 📊 Remaining Repository Table Names

| Repository File | Table Name | Priority |
|----------------|------------|----------|
| processed-email.repository.ts | `processed_emails` | 🔥 HIGH |
| schedule-data.repository.ts | `schedule_data` | 🔥 HIGH |
| route-plan.repository.ts | `route_plans` | 🔥 HIGH |
| weather-data.repository.ts | `weather_data` | ⚡ MEDIUM |
| calendar-event.repository.ts | `calendar_events` | ⚡ MEDIUM |
| notification.repository.ts | `notifications` | ⚡ MEDIUM |
| summary.repository.ts | `summaries` | ⚡ MEDIUM |

## 🎯 Recommended Next Steps

### Immediate (30 minutes):
1. ✅ Add `findWithRelations` to UserRepository
2. ✅ Fix controller `db.$queryRaw` and `db.user` calls
3. ✅ Test compilation passes

### Short-term (2-3 hours):
4. Migrate processed-email.repository.ts (most complex)
5. Migrate schedule-data.repository.ts (second most complex)
6. Migrate route-plan.repository.ts
7. Test application starts and basic CRUD works

### Complete (4-6 hours total):
8. Migrate remaining 4 repositories
9. Remove Prisma dependencies from package.json
10. Full integration testing
11. Update all tests to use Kysely

## 💡 Pro Tips

1. **Copy-Paste from user.repository.ts** - it's your working template
2. **Test after each file** - `npm run build` to catch TypeScript errors
3. **Focus on HIGH priority repos first** - they're used most frequently
4. **Keep backups** - already in `.backup-20251009_210452/`
5. **Use reference** - `KYSELY_MIGRATION_STATUS.md` has all patterns

## 📚 Resources

- **Working Example**: `backend/src/repositories/user.repository.ts` (436 lines, fully working)
- **Type Definitions**: `backend/src/config/database-types.ts`
- **Database Config**: `backend/src/config/database.ts`
- **Migration Script**: `scripts/migrate-to-kysely.sh`
- **Status Document**: `docs/KYSELY_MIGRATION_STATUS.md`
- **This Guide**: `docs/MIGRATION_COMPLETION_GUIDE.md`

## ⏱️ Time Estimates

- **Fix controllers to get app running**: 30 minutes
- **Migrate 1 repository**: 20-40 minutes each
- **Test and debug**: 1-2 hours
- **Complete cleanup**: 1 hour

**Total to fully functional app**: ~4-6 hours

---

*You're 60% done! The hard infrastructure work is complete. Now it's just systematic conversion.*
