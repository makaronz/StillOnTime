#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/build.log"
PROFILE="dev"
DRY_RUN=false

usage() {
  cat <<USAGE
Użycie: ./scripts/build.sh [--profile dev|prod] [--dry-run]
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
      echo "[build] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
echo "[build] start $(date -Is) profile=${PROFILE} dry-run=${DRY_RUN}" | tee -a "$LOG_FILE"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[build][dry-run] $*" | tee -a "$LOG_FILE"
  else
    echo "[build] $*" | tee -a "$LOG_FILE"
    eval "$@"
  fi
}

if [[ -f package.json ]]; then
  run "npm run build:${PROFILE:-dev} || npm run build"
fi

if [[ -f backend/package.json ]]; then
  run "cd backend && npm run build:${PROFILE:-dev} || npm run build"
fi

if [[ -f frontend/package.json ]]; then
  run "cd frontend && npm run build:${PROFILE:-dev} || npm run build"
fi

if [[ -f mobile/package.json ]]; then
  run "cd mobile && npm run build:${PROFILE:-dev} || npm run build"
fi

if [[ -d monitoring ]]; then
  run "echo '[build] TODO(decision): Uzupełnij build dla modułu monitoring (np. helm package)'"
fi

echo "[build] done $(date -Is)" | tee -a "$LOG_FILE"
