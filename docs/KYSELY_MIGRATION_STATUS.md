# Kysely Migration Status Report

## ✅ Completed Steps

### 1. Database Configuration ✓
- **Stopped local PostgreSQL** - Only Docker PostgreSQL running on port 5432
- **Consolidated configuration** - Single source in `backend/src/config/database.ts`
- **Removed duplicate** - Deleted `kysely.ts` duplicate configuration
- **Updated prisma.ts** - Now exports Kysely `db` for backward compatibility

### 2. Import Updates ✓
All repository files now import:
```typescript
import { db } from "@/config/database";
```
Instead of:
```typescript
import { prisma } from "@/prisma";
```

### 3. Working Examples ✓
- **user.repository.ts** - Fully migrated to Kysely ✅
- **user.repository.kysely.ts** - Reference implementation ✅
- **database.ts** - Kysely connection configured ✅
- **database-types.ts** - All type definitions complete ✅

## 🔧 Remaining Work

### Repository Files Still Using Prisma Syntax

1. ❌ **processed-email.repository.ts** - 54 Prisma method calls
2. ❌ **schedule-data.repository.ts** - Uses AbstractBaseRepository with Prisma
3. ❌ **route-plan.repository.ts** - Uses AbstractBaseRepository with Prisma
4. ❌ **weather-data.repository.ts** - Needs conversion
5. ❌ **calendar-event.repository.ts** - 52 Prisma calls, Prisma namespace references
6. ❌ **user-config.repository.ts** - Still using `prisma.userConfig` methods
7. ❌ **notification.repository.ts** - 64 Prisma calls, Prisma namespace references
8. ❌ **summary.repository.ts** - Needs conversion
9. ❌ **base.repository.ts** - Abstract class still uses Prisma model pattern

### Controller Files with Issues

1. **auth.controller.ts** - Calls `userRepository.findWithRelations()` (not in Kysely version)
2. **health.controller.ts** - Uses `db.$queryRaw` (Kysely doesn't have this)
3. **system.controller.ts** - References `db.user` (should be `db.selectFrom('users')`)
4. **user.controller.ts** - Calls `findWithRelations()` method

## 📋 Kysely Conversion Patterns

### Basic CRUD Operations

```typescript
// Prisma
await prisma.table.findUnique({ where: { id } })
// Kysely
await db.selectFrom('table').selectAll().where('id', '=', id).executeTakeFirst()

// Prisma
await prisma.table.findMany({ where, orderBy, take: limit })
// Kysely
await db.selectFrom('table').selectAll().where(...).orderBy(...).limit(limit).execute()

// Prisma
await prisma.table.create({ data })
// Kysely
await db.insertInto('table').values(data).returningAll().executeTakeFirstOrThrow()

// Prisma
await prisma.table.update({ where: { id }, data })
// Kysely
await db.updateTable('table').set(data).where('id', '=', id).returningAll().executeTakeFirstOrThrow()

// Prisma
await prisma.table.delete({ where: { id } })
// Kysely
await db.deleteFrom('table').where('id', '=', id).returningAll().executeTakeFirstOrThrow()

// Prisma
await prisma.table.count({ where })
// Kysely
const result = await db.selectFrom('table').select(eb => eb.fn.countAll<number>().as('count')).where(...).executeTakeFirstOrThrow()
return Number(result.count)
```

### Advanced Operations

```typescript
// Relations (JOIN)
// Prisma
await prisma.user.findUnique({
  where: { id },
  include: { userConfig: true }
})

// Kysely
await db
  .selectFrom('users')
  .leftJoin('user_configs', 'users.id', 'user_configs.userId')
  .selectAll('users')
  .select(['user_configs.id as configId', 'user_configs.homeAddress', ...])
  .where('users.id', '=', id)
  .executeTakeFirst()

// Upsert Pattern
// Prisma
await prisma.table.upsert({ where, update, create })

// Kysely
const existing = await db.selectFrom('table').selectAll().where(...).executeTakeFirst()
if (existing) {
  await db.updateTable('table').set(update).where(...).returningAll().executeTakeFirstOrThrow()
} else {
  await db.insertInto('table').values(create).returningAll().executeTakeFirstOrThrow()
}

// Raw SQL (if absolutely necessary)
// Prisma
await prisma.$queryRaw`SELECT 1`

// Kysely
await db.selectFrom(sql`(SELECT 1) as result`.as('result')).execute()
// OR
import { sql } from 'kysely'
await sql`SELECT 1`.execute(db)
```

## 🗂️ PostgreSQL Table Names

| Prisma Model | PostgreSQL Table |
|-------------|------------------|
| User | users |
| ProcessedEmail | processed_emails |
| ScheduleData | schedule_data |
| RoutePlan | route_plans |
| WeatherData | weather_data |
| CalendarEvent | calendar_events |
| UserConfig | user_configs |
| Notification | notifications |
| Summary | summaries |

## 🚀 Quick Migration Guide

### For Each Repository File:

1. **Open the file** (e.g., `processed-email.repository.ts`)

2. **Find all Prisma calls** - Search for:
   - `prisma.`
   - `Prisma.`
   - `.model.`

3. **Replace with Kysely syntax** using patterns above

4. **Add ID generation helper**:
```typescript
private generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomPart}`;
}
```

5. **Update type imports** from `@/config/database-types`:
```typescript
import { ProcessedEmail, NewProcessedEmail, ProcessedEmailUpdate } from "@/config/database-types";
```

6. **Test compilation**: `npm run build`

### Priority Order:

1. **base.repository.ts** - Affects all child repositories
2. **user-config.repository.ts** - Simple, good practice
3. **processed-email.repository.ts** - Critical for email processing
4. **schedule-data.repository.ts** - Core functionality
5. Other repositories in any order

## 🎯 Current Blocker

**The application won't start** because repositories still call Prisma methods that don't exist after the import update.

### Immediate Fix Options:

**Option A: Quick Fix (Temporary)**
- Revert import changes temporarily
- Complete Kysely migration methodically
- Update imports when ready

**Option B: Progressive Migration (Recommended)**
- Fix one repository at a time starting with base.repository.ts
- Test after each repository
- Controllers can be updated as repositories are completed

**Option C: Parallel Migration (Fastest if done right)**
- Use `user.repository.kysely.ts` as template
- Copy-paste pattern for each repository
- Adjust table names and specific methods
- Test all at once

## 📊 Estimated Remaining Work

- **Base repository**: ~2 hours (affects all others)
- **Each repository**: ~30-60 minutes each
- **Controller fixes**: ~1 hour total
- **Testing & debugging**: ~2 hours

**Total**: ~8-10 hours for complete migration

## 🔗 Useful Resources

- **Working Example**: `backend/src/repositories/user.repository.kysely.ts`
- **Type Definitions**: `backend/src/config/database-types.ts`
- **Kysely Docs**: https://kysely.dev/docs/getting-started
- **Backup Location**: `backend/.backup-20251009_210452/`

## ⚠️ Important Notes

1. **IDs Must Be Generated**: Kysely doesn't auto-generate IDs like Prisma
2. **Table Names**: Use PostgreSQL snake_case names
3. **JSON Fields**: Cast with `as unknown as ColumnType<unknown>`
4. **Dates**: Kysely handles Date objects directly
5. **Null Values**: Be explicit with `null` vs `undefined`

## 📝 Next Steps

1. Choose migration approach (A, B, or C above)
2. Start with base.repository.ts or one complete repository
3. Test compilation after each change
4. Update controllers as repositories are completed
5. Final end-to-end testing

---

*Migration started: 2025-10-09*
*Current status: ~40% complete (infrastructure ready, methods need conversion)*
