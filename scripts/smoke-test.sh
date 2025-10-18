#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/smoke-test.log"
PROFILE="dev"
DRY_RUN=false

usage() {
  cat <<USAGE
Użycie: ./scripts/smoke-test.sh [--profile dev|prod] [--dry-run]
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
      echo "[smoke] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
echo "[smoke] start $(date -Is) profile=${PROFILE} dry-run=${DRY_RUN}" | tee -a "$LOG_FILE"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[smoke][dry-run] $*" | tee -a "$LOG_FILE"
  else
    echo "[smoke] $*" | tee -a "$LOG_FILE"
    eval "$@"
  fi
}

MODULE_LOG="analysis/dynamic-module-usage-${PROFILE}.json"
if [[ "$DRY_RUN" == false ]]; then
  mkdir -p analysis
  cat > "$MODULE_LOG" <<JSON
{
  "profile": "${PROFILE}",
  "generated_at": "$(date -Is)",
  "loaded_modules": []
}
JSON
fi

run "cd backend && npm test -- --runInBand --passWithNoTests > ../logs/backend-smoke-${PROFILE}.json"
run "cd frontend && npm test -- --run --passWithNoTests > ../logs/frontend-smoke-${PROFILE}.json"
run "cd backend && node scripts/list-runtime-modules.mjs ${PROFILE} > ../analysis/runtime-backend-modules-${PROFILE}.log"
run "cd frontend && node scripts/list-runtime-modules.mjs ${PROFILE} > ../analysis/runtime-frontend-modules-${PROFILE}.log"

if [[ "$DRY_RUN" == false ]]; then
  cat <<PY | python -
import json, pathlib, os
profile = os.environ.get('SMOKE_PROFILE', '${PROFILE}')
backend = pathlib.Path('logs') / f'backend-smoke-{profile}.json'
frontend = pathlib.Path('logs') / f'frontend-smoke-{profile}.json'
report = {
    "profile": profile,
    "backend_log": backend.read_text() if backend.exists() else "",
    "frontend_log": frontend.read_text() if frontend.exists() else "",
    "notes": "Porównaj runtime-modules z analysis/dependency-graph.json"
}
pathlib.Path('analysis/dynamic-smoke-summary.json').write_text(json.dumps(report, indent=2))
PY
fi

echo "[smoke] done $(date -Is)" | tee -a "$LOG_FILE"
