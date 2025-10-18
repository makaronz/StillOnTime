# StillOnTime Monorepo – Repozytorium uporządkowane

Ten katalog główny zawiera skondensowany opis repozytorium po operacji "backup → analiza i porządki". Szczegółowa dokumentacja została przeniesiona do [`dokumentacja/`](dokumentacja/README.md).

## Struktura

```
BACKUP/                 # Artefakty kopii zapasowych
analysis/               # Raporty analityczne i graf zależności
architecture/           # Opis architektury oraz ADR-y
backend/                # Serwis API Node.js (Express + Prisma)
frontend/               # Aplikacja webowa React/Vite
mobile/                 # Klient mobilny (React Native)
monitoring/             # Definicje obserwowalności i alertów
scripts/                # Skrypty operacyjne (backup, bootstrap, build, test)
dokumentacja/           # Pełna dokumentacja produktowa i procesowa
config/                 # Pliki konfiguracyjne środowisk
```

## Kluczowe kroki operacji
1. **Backup** – Tag `pre-cleanup-*`, gałąź `chore/repo-cleanup-and-boot`, archiwa ZIP/TAR (`BACKUP/`).
2. **Analiza** – Raporty w `analysis/`, `architecture/` oraz `dokumentacja/boot-matrix.md`.
3. **Porządki** – Standardyzacja struktury katalogów, aktualizacja `.gitignore` i skryptów.
4. **Bootability** – Skrypty `scripts/bootstrap.sh`, `scripts/build.sh`, `scripts/start.sh`, `scripts/smoke-test.sh`.

## Jak zacząć
1. Zapoznaj się z [planem wykonania](PLAN_WYKONANIA.md).
2. Wykonaj backup zgodnie z `scripts/backup_and_branch.sh` (lub `.ps1`).
3. Uruchom `scripts/bootstrap.sh --dry-run`, następnie bez flagi, aby przygotować zależności.
4. Postępuj wg matrycy w `dokumentacja/boot-matrix.md`.

## Status CI/CD
Szablon workflow znajduje się w `.github/workflows/ci.yaml`. Po konfiguracji zmiennych środowiskowych pipeline realizuje kroki `build → test → lint → smoke-test → artifact`.

## Wsparcie
- **TODO(decision)**: potwierdź `<STACK_HINT>` oraz wymagane `<SERVICE_PORTS>` / `<DB_CONNECTION_STRING?>`.
- W razie problemów z zależnościami użyj `scripts/purge_unused.sh --dry-run` i przejrzyj raport w `logs/`.

