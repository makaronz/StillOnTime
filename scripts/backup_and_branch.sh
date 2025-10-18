#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="logs/backup.log"
DRY_RUN=false

usage() {
  cat <<USAGE
Użycie: ./scripts/backup_and_branch.sh [--dry-run]
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
      echo "[backup] Nieznana opcja: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
echo "[backup] start $(date -Is)" | tee -a "$LOG_FILE"

TIMESTAMP="$(date +%Y%m%d-%H%M)"
TAG_NAME="pre-cleanup-${TIMESTAMP}"
BRANCH_NAME="chore/repo-cleanup-and-boot"
ARCHIVE_PREFIX="stillontime-pre-cleanup-${TIMESTAMP}"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[backup][dry-run] $*" | tee -a "$LOG_FILE"
  else
    echo "[backup] $*" | tee -a "$LOG_FILE"
    eval "$@"
  fi
}

run "git status -sb"
run "git tag --list $TAG_NAME >/dev/null 2>&1 && echo '[backup] Tag już istnieje' || git tag $TAG_NAME"
run "git branch --list $BRANCH_NAME >/dev/null 2>&1 && echo '[backup] Gałąź już istnieje' || git checkout -b $BRANCH_NAME"
run "git archive --format=zip --output=BACKUP/${ARCHIVE_PREFIX}.zip HEAD"
run "git archive --format=tar --output=BACKUP/${ARCHIVE_PREFIX}.tar HEAD"
run "gzip -f BACKUP/${ARCHIVE_PREFIX}.tar"
run "(cd .. && zip -r StillOnTime-${ARCHIVE_PREFIX}.zip StillOnTime)"
run "sha256sum BACKUP/${ARCHIVE_PREFIX}.zip BACKUP/${ARCHIVE_PREFIX}.tar.gz > BACKUP/checksums.txt"
run "git rev-parse HEAD > BACKUP/latest-commit.txt"

if [[ "$DRY_RUN" == false ]]; then
  cat > BACKUP/checksums.json <<JSON
{
  "tag": "${TAG_NAME}",
  "branch": "${BRANCH_NAME}",
  "archives": [
    {
      "path": "BACKUP/${ARCHIVE_PREFIX}.zip",
      "sha256": "$(sha256sum BACKUP/${ARCHIVE_PREFIX}.zip | cut -d' ' -f1)"
    },
    {
      "path": "BACKUP/${ARCHIVE_PREFIX}.tar.gz",
      "sha256": "$(sha256sum BACKUP/${ARCHIVE_PREFIX}.tar.gz | cut -d' ' -f1)"
    }
  ],
  "generated_at": "${TIMESTAMP}"
}
JSON
fi

echo "[backup] done $(date -Is)" | tee -a "$LOG_FILE"
