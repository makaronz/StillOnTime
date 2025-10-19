#!/bin/bash

# 🧹 Prisma Removal Script
# Automatyczny skrypt do usuwania śladów Prisma z repozytorium
# Użycie: ./scripts/remove-prisma.sh [--dry-run] [--backup]

set -e

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flagi
DRY_RUN=false
BACKUP=false

# Parsowanie argumentów
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --backup)
      BACKUP=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--backup]"
      echo "  --dry-run    Show what would be done without making changes"
      echo "  --backup     Create backup before making changes"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🧹 Prisma Removal Script${NC}"
echo -e "${BLUE}========================${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
fi

if [ "$BACKUP" = true ]; then
    echo -e "${YELLOW}💾 BACKUP MODE - Creating backup before changes${NC}"
fi

# Funkcja do wykonywania komend z obsługą dry-run
execute() {
    local cmd="$1"
    local description="$2"
    
    echo -e "${BLUE}📋 $description${NC}"
    echo -e "   Command: $cmd"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}   [DRY RUN] Would execute: $cmd${NC}"
    else
        eval "$cmd"
        echo -e "${GREEN}   ✅ Completed${NC}"
    fi
    echo
}

# Funkcja do tworzenia backup
create_backup() {
    if [ "$BACKUP" = true ]; then
        local backup_dir="backup-$(date +%Y%m%d_%H%M%S)"
        echo -e "${YELLOW}💾 Creating backup in $backup_dir${NC}"
        
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}   [DRY RUN] Would create backup: $backup_dir${NC}"
        else
            cp -r . "../$backup_dir"
            echo -e "${GREEN}   ✅ Backup created: ../$backup_dir${NC}"
        fi
        echo
    fi
}

# Sprawdzenie czy jesteśmy w katalogu projektu
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting Prisma removal process...${NC}"
echo

# Tworzenie backup
create_backup

# PHASE 1: Usunięcie zależności z package.json
echo -e "${BLUE}📦 PHASE 1: Removing Prisma dependencies${NC}"
echo "==============================================="

execute "cd backend && npm uninstall @prisma/client prisma" "Removing Prisma packages"

execute "cd backend && sed -i.bak '/\"@prisma\/client\"/d' package.json" "Removing @prisma/client from package.json"
execute "cd backend && sed -i.bak '/\"prisma\"/d' package.json" "Removing prisma from package.json"

execute "cd backend && sed -i.bak '/\"prisma:generate\"/d' package.json" "Removing prisma:generate script"
execute "cd backend && sed -i.bak '/\"prisma:migrate\"/d' package.json" "Removing prisma:migrate script"
execute "cd backend && sed -i.bak '/\"prisma:studio\"/d' package.json" "Removing prisma:studio script"
execute "cd backend && sed -i.bak '/\"prisma:reset\"/d' package.json" "Removing prisma:reset script"
execute "cd backend && sed -i.bak '/\"prisma:deploy\"/d' package.json" "Removing prisma:deploy script"

# Usunięcie plików backup
execute "cd backend && rm -f package.json.bak" "Cleaning up backup files"

# PHASE 2: Usunięcie plików konfiguracyjnych
echo -e "${BLUE}🗂️ PHASE 2: Removing Prisma configuration files${NC}"
echo "==============================================="

execute "rm -rf backend/prisma/" "Removing prisma directory"

execute "rm -f backend/src/prisma.ts" "Removing prisma.ts file"

# PHASE 3: Wyszukiwanie pozostałych referencji
echo -e "${BLUE}🔍 PHASE 3: Finding remaining Prisma references${NC}"
echo "==============================================="

echo -e "${BLUE}📋 Searching for Prisma imports in TypeScript files...${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}   [DRY RUN] Would search for Prisma references${NC}"
else
    find backend/src -name "*.ts" -exec grep -l "prisma\|Prisma\|@prisma" {} \; | while read file; do
        echo -e "${YELLOW}   📄 Found references in: $file${NC}"
    done
fi

echo -e "${BLUE}📋 Searching for Prisma references in test files...${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}   [DRY RUN] Would search for Prisma references in tests${NC}"
else
    find backend/tests -name "*.ts" -exec grep -l "prisma\|Prisma\|@prisma" {} \; | while read file; do
        echo -e "${YELLOW}   📄 Found references in: $file${NC}"
    done
fi

# PHASE 4: Sprawdzenie kompilacji
echo -e "${BLUE}🔨 PHASE 4: Testing compilation${NC}"
echo "==============================================="

execute "cd backend && npm run build" "Testing TypeScript compilation"

# PHASE 5: Podsumowanie
echo -e "${BLUE}📊 PHASE 5: Summary${NC}"
echo "==============================================="

echo -e "${GREEN}✅ Prisma removal script completed!${NC}"
echo

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 DRY RUN SUMMARY:${NC}"
    echo -e "${YELLOW}   - No actual changes were made${NC}"
    echo -e "${YELLOW}   - Review the commands above before running without --dry-run${NC}"
else
    echo -e "${GREEN}✅ CHANGES MADE:${NC}"
    echo -e "${GREEN}   - Removed Prisma packages from package.json${NC}"
    echo -e "${GREEN}   - Removed Prisma scripts from package.json${NC}"
    echo -e "${GREEN}   - Removed prisma/ directory${NC}"
    echo -e "${GREEN}   - Removed prisma.ts file${NC}"
    echo -e "${GREEN}   - Tested TypeScript compilation${NC}"
fi

echo
echo -e "${BLUE}📋 NEXT STEPS:${NC}"
echo -e "${BLUE}   1. Review the files listed above that still contain Prisma references${NC}"
echo -e "${BLUE}   2. Manually update those files using the PRISMA_REMOVAL_GUIDE.md${NC}"
echo -e "${BLUE}   3. Run tests: cd backend && npm run test${NC}"
echo -e "${BLUE}   4. Test the application: cd backend && npm run dev:simple${NC}"
echo

if [ "$BACKUP" = true ] && [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}💾 Backup created in: ../backup-$(date +%Y%m%d_%H%M%S)${NC}"
    echo -e "${YELLOW}   You can restore from backup if needed${NC}"
fi

echo -e "${GREEN}🎉 Script completed successfully!${NC}"
