#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/update-doc-links.log"
DRY_RUN=false

usage() {
  cat <<USAGE
Użycie: ./scripts/update-doc-links.sh [--dry-run]
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
      echo "[update-doc-links] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
echo "[update-doc-links] start $(date -Is) dry-run=${DRY_RUN}" | tee -a "$LOG_FILE"

run_replace() {
  local search="$1"
  local replace="$2"
  local files
  IFS=$'\n' read -r -d '' -a files < <(rg --files-with-matches "$search" && printf '\0')
  for file in "${files[@]}"; do
    if [[ "$DRY_RUN" == true ]]; then
      echo "[update-doc-links][dry-run] $file: $search -> $replace" | tee -a "$LOG_FILE"
    else
      echo "[update-doc-links] $file: $search -> $replace" | tee -a "$LOG_FILE"
      perl -0pi -e "s|$search|$replace|g" "$file"
    fi
  done
}

run_replace "docs/" "dokumentacja/legacy-docs/"
run_replace "./docs" "./dokumentacja/legacy-docs"
run_replace "CLAUDE.md" "dokumentacja/CLAUDE.md"
run_replace "PROJECT_PLAN.md" "dokumentacja/PROJECT_PLAN.md"

# TODO decisions for manual review
echo "[update-doc-links] TODO(decision): Zweryfikuj odnośniki do prywatnych dokumentów (<CI_PROVIDER?>, Confluence)." | tee -a "$LOG_FILE"

echo "[update-doc-links] done $(date -Is)" | tee -a "$LOG_FILE"
