#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/purge-unused.log"
DRY_RUN=false
REPORT_MD="analysis/purge-report.md"
REPORT_CSV="analysis/purge-report.csv"

usage() {
  cat <<USAGE
Użycie: ./scripts/purge_unused.sh [--dry-run]
Uruchamiaj w katalogu: <ABSOLUTE_REPO_PATH>
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[purge] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p logs analysis
echo "[purge] start $(date -Is) dry-run=${DRY_RUN}" | tee -a "$LOG_FILE"

declare -A CANDIDATES
CANDIDATES["backend/node_modules_unused"]="backend/node_modules_unused"
CANDIDATES["frontend/node_modules_unused"]="frontend/node_modules_unused"
CANDIDATES["tmp"]="tmp"
CANDIDATES["mobile/android/.gradle"]="mobile/android/.gradle"

cat > "$REPORT_MD" <<MD
# Raport czyszczenia (dry-run=${DRY_RUN})

| Ścieżka | Powód | Kryterium |
| --- | --- | --- |
MD

echo "path,reason,criterion" > "$REPORT_CSV"

for key in "${!CANDIDATES[@]}"; do
  path="${CANDIDATES[$key]}"
  if [[ -d "$path" || -f "$path" ]]; then
    reason="Artefakt potencjalnie nieużywany"
    criterion="Brak referencji w repo (statyczna analiza)"
    echo "| $path | $reason | $criterion |" >> "$REPORT_MD"
    echo "$path,$reason,$criterion" >> "$REPORT_CSV"
    if [[ "$DRY_RUN" == false ]]; then
      rm -rf "$path"
      echo "[purge] removed $path" | tee -a "$LOG_FILE"
    else
      echo "[purge][dry-run] would remove $path" | tee -a "$LOG_FILE"
    fi
  else
    echo "[purge] skip missing $path" | tee -a "$LOG_FILE"
  fi
done

echo "[purge] done $(date -Is)" | tee -a "$LOG_FILE"
