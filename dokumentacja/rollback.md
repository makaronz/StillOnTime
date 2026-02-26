# Plan rollbacku do `pre-cleanup-*`

1. Zatrzymaj działające usługi (`docker compose down`).
2. Stwórz backup bieżącego stanu (opcjonalnie `git branch backup/<date>`).
3. Wykonaj:
   ```bash
   git fetch --tags
   git checkout pre-cleanup-<YYYYMMDD-HHMM>
   ```
4. Jeśli potrzebujesz przywrócić pliki robocze z archiwum:
   ```bash
   cd <ABSOLUTE_REPO_PATH>/BACKUP
   unzip stillontime-pre-cleanup-<timestamp>.zip -d ../restore-tmp
   rsync -a ../restore-tmp/ <ABSOLUTE_REPO_PATH>/
   ```
5. Usuń gałąź roboczą jeśli niepotrzebna:
   ```bash
   git branch -D chore/repo-cleanup-and-boot
   ```

## Kryteria sukcesu
- Repo przechodzi `npm test` i `scripts/smoke-test.sh --dry-run`.
- Struktura katalogów wraca do stanu sprzed migracji.

## Ryzyka
- Utrata zmian niezcommitowanych – wykonaj `git stash` przed checkoutem.
- Artefakty w `BACKUP/restore-tmp` – usuń po zakończeniu (`rm -rf BACKUP/restore-tmp`).
