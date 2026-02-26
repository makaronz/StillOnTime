# Weryfikacja operacji porządkowej

| Krok | Komenda | Oczekiwany wynik |
| --- | --- | --- |
| 1 | `./scripts/backup_and_branch.sh --dry-run` | Log w `logs/backup.log`, brak zmian w repo |
| 2 | `./scripts/backup_and_branch.sh` | Archiwa w `BACKUP/`, tag + gałąź utworzone |
| 3 | `./scripts/bootstrap.sh --profile dev` | Log `logs/bootstrap.log`, zainstalowane zależności |
| 4 | `./scripts/build.sh --profile dev` | Log `logs/build.log`, artefakty build w `backend/dist`, `frontend/dist` |
| 5 | `./scripts/start.sh --profile dev --target docker` | Kontenery dev running (`docker ps`) |
| 6 | `./scripts/smoke-test.sh --profile dev` | Raport `analysis/dynamic-smoke-summary.json` uzupełniony |
| 7 | `./scripts/purge_unused.sh --dry-run` | Raporty `analysis/purge-report.md/csv` |
| 8 | `./scripts/update-doc-links.sh --dry-run` | Log `logs/update-doc-links.log` bez zmian |

## Sanity check struktury
```bash
ls -1 | sort
# spodziewane m.in.: BACKUP, analysis, architecture, backend, dokumentacja, scripts
```

## Smoke test (manual)
- Wejdź na `http://localhost:<SERVICE_PORTS>` dla frontendu.
- Sprawdź log `logs/smoke-test.log`.

## Raport z porównania
Po wykonaniu `scripts/smoke-test.sh`:
- Różnice pomiędzy `analysis/runtime-modules-<profile>.txt` a `analysis/dependency-graph.json` odnotować w `analysis/purge-report.md`.
