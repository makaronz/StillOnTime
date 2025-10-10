#!/bin/bash

# Kysely Migration Script
# Converts all repository files from Prisma to Kysely syntax

set -e

echo "🔄 Starting Kysely migration..."

# Backup original files
echo "📦 Creating backup..."
BACKUP_DIR="/Users/arkadiuszfudali/Git/StillOnTime/backend/.backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r /Users/arkadiuszfudali/Git/StillOnTime/backend/src/repositories "$BACKUP_DIR/"

echo "✅ Backup created at: $BACKUP_DIR"

# Repository files to migrate
REPO_DIR="/Users/arkadiuszfudali/Git/StillOnTime/backend/src/repositories"

# Step 1: Update all import statements
echo "📝 Step 1: Updating imports..."

find "$REPO_DIR" -name "*.ts" ! -name "*.kysely.ts" ! -name "base.repository.ts" -type f | while read -r file; do
  echo "  - Processing: $(basename "$file")"

  # Replace Prisma imports with Kysely
  sed -i.tmp 's|import { prisma } from "@/prisma"|import { db } from "@/config/database"|g' "$file"
  sed -i.tmp 's|import { prisma } from "@/config/database"|import { db } from "@/config/database"|g' "$file"

  # Remove Prisma client imports
  sed -i.tmp '/import.*@prisma\/client/d' "$file"

  # Clean up temp files
  rm -f "$file.tmp"
done

echo "✅ Import statements updated"

# Step 2: Instructions for manual migration
echo ""
echo "📋 Manual Migration Steps Required:"
echo ""
echo "Each repository file needs Prisma method calls converted to Kysely:"
echo ""
echo "Prisma → Kysely Conversion Patterns:"
echo "────────────────────────────────────"
echo "1. findUnique({ where: { id } })"
echo "   → db.selectFrom('table').selectAll().where('id', '=', id).executeTakeFirst()"
echo ""
echo "2. findMany({ where, orderBy, take })"
echo "   → db.selectFrom('table').selectAll().where(...).orderBy(...).limit(take).execute()"
echo ""
echo "3. create({ data })"
echo "   → db.insertInto('table').values(data).returningAll().executeTakeFirstOrThrow()"
echo ""
echo "4. update({ where: { id }, data })"
echo "   → db.updateTable('table').set(data).where('id', '=', id).returningAll().executeTakeFirstOrThrow()"
echo ""
echo "5. delete({ where: { id } })"
echo "   → db.deleteFrom('table').where('id', '=', id).returningAll().executeTakeFirstOrThrow()"
echo ""
echo "6. count({ where })"
echo "   → db.selectFrom('table').select(eb => eb.fn.countAll<number>().as('count')).where(...).executeTakeFirstOrThrow()"
echo ""
echo "Table Names (PostgreSQL uses snake_case):"
echo "─────────────────────────────────────────"
echo "  - users"
echo "  - processed_emails"
echo "  - schedule_data"
echo "  - route_plans"
echo "  - weather_data"
echo "  - calendar_events"
echo "  - user_configs"
echo "  - notifications"
echo "  - summaries"
echo ""
echo "Reference: /Users/arkadiuszfudali/Git/StillOnTime/backend/src/repositories/user.repository.kysely.ts"
echo ""
echo "💡 Recommendation: Use the working user.repository.kysely.ts as a template"
echo ""
