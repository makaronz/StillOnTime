#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/bootstrap.log"
PROFILE="dev"
DRY_RUN=false

usage() {
  cat <<USAGE
Użycie: ./scripts/bootstrap.sh [--profile dev|prod] [--dry-run]
Uruchamiaj w katalogu: <ABSOLUTE_REPO_PATH>
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[bootstrap] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
echo "[bootstrap] start $(date -Is) profile=${PROFILE} dry-run=${DRY_RUN}" | tee -a "$LOG_FILE"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[bootstrap][dry-run] $*" | tee -a "$LOG_FILE"
  else
    echo "[bootstrap] $*" | tee -a "$LOG_FILE"
    eval "$@"
  fi
}

# Node.js projects
declare -a NODE_PROJECTS=("." "backend" "frontend" "mobile")
for project in "${NODE_PROJECTS[@]}"; do
  if [[ -f "$project/package.json" ]]; then
    if [[ -f "$project/pnpm-lock.yaml" ]]; then
      run "cd $project && pnpm install --frozen-lockfile"
    elif [[ -f "$project/yarn.lock" ]]; then
      run "cd $project && yarn install --immutable"
    elif [[ -f "$project/package-lock.json" ]]; then
      run "cd $project && npm ci"
    else
      run "cd $project && npm install"
    fi
  fi
  if [[ -f "$project/.env.example" && ! -f "$project/.env" ]]; then
    run "cp $project/.env.example $project/.env"
  fi
done

# Python (optional)
if [[ -f "backend/requirements.txt" ]]; then
  if command -v python >/dev/null 2>&1; then
    run "python -m venv .venv"
    run ".venv/bin/pip install --upgrade pip"
    run ".venv/bin/pip install -r backend/requirements.txt"
  else
    echo "[bootstrap] TODO(decision): Zainstaluj Python 3.x dla backend/requirements.txt" | tee -a "$LOG_FILE"
  fi
fi

# Go (optional)
if [[ -f "go.mod" ]]; then
  if command -v go >/dev/null 2>&1; then
    run "go mod download"
  else
    echo "[bootstrap] TODO(decision): Zainstaluj Go 1.21+" | tee -a "$LOG_FILE"
  fi
fi

# Database migrations
if [[ -d "backend/prisma" ]]; then
  run "cd backend && npx prisma migrate deploy"
fi

if [[ "$PROFILE" == "prod" ]]; then
  echo "[bootstrap] TODO(decision): Przygotuj cache offline i secrets dla produkcji." | tee -a "$LOG_FILE"
fi

echo "[bootstrap] done $(date -Is)" | tee -a "$LOG_FILE"
