#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/start.log"
PROFILE="dev"
TARGET="all"
DRY_RUN=false

usage() {
  cat <<USAGE
Użycie: ./scripts/start.sh [--profile dev|prod] [--target all|backend|frontend|mobile|worker|docker] [--dry-run]
Uruchamiaj w katalogu: <ABSOLUTE_REPO_PATH>
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --target)
      TARGET="$2"
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
      echo "[start] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
echo "[start] start $(date -Is) profile=${PROFILE} target=${TARGET} dry-run=${DRY_RUN}" | tee -a "$LOG_FILE"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[start][dry-run] $*" | tee -a "$LOG_FILE"
  else
    echo "[start] $*" | tee -a "$LOG_FILE"
    eval "$@"
  fi
}

case "$TARGET" in
  backend|all)
    run "cd backend && npm run ${PROFILE}:server || npm run dev"
    ;;
  frontend|all)
    run "cd frontend && npm run ${PROFILE}:start || npm run dev"
    ;;
  mobile|all)
    run "cd mobile && npm run ${PROFILE}:start || npm run start"
    ;;
  worker|all)
    run "cd backend && npm run ${PROFILE}:worker || npm run worker"
    ;;
  docker)
    COMPOSE_FILE="docker-compose.yml"
    if [[ "$PROFILE" == "prod" && -f docker-compose.production.yml ]]; then
      COMPOSE_FILE="docker-compose.production.yml"
    fi
    run "docker compose -f $COMPOSE_FILE --profile $PROFILE up --build"
    ;;
  *)
    echo "[start] Nieobsługiwany target: $TARGET" >&2
    exit 1
    ;;
esac

echo "[start] done $(date -Is)" | tee -a "$LOG_FILE"
