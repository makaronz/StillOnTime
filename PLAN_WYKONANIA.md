# Plan wykonania operacji "backup → analiza i porządki" dla StillOnTime

## Faza 0. Przygotowanie
1. **Inwentaryzacja repozytorium** – identyfikacja ekosystemów (Node.js/TypeScript, Python, Go, mobilny React Native) na podstawie plików konfiguracyjnych (`package.json`, `requirements.txt`, `go.mod`, `android/ios`).
   - *Uzasadnienie*: poprawne skrypty muszą wiedzieć, które narzędzia uruchomić.
2. **Utworzenie katalogów docelowych** (`BACKUP/`, `analysis/`, `architecture/`, `dokumentacja/`, `scripts/`, `config/`, `logs/`).
   - *Uzasadnienie*: standaryzacja struktury i miejsce na artefakty procesu.

## Faza 1. Backup i gałąź robocza
1. **Tag bezpieczeństwa** `pre-cleanup-<YYYYMMDD-HHMM>` oraz gałąź `chore/repo-cleanup-and-boot`.
   - *Uzasadnienie*: łatwy rollback i izolacja zmian porządkowych.
2. **Archiwizacja repozytorium** do ZIP/TAR wraz z sumami SHA256.
   - *Uzasadnienie*: kopia zapasowa przed refaktoryzacją.
3. **Weryfikacja integralności** – zapis checksum do `BACKUP/checksums.txt` + instrukcja przywracania.
   - *Uzasadnienie*: możliwość potwierdzenia poprawności kopii.

## Faza 2. Analiza
1. **Analiza statyczna** – zliczenie LOC, wykrycie języków (cloc), wyciągnięcie zależności (`npm ls --json`, `pip list`, `go list`).
   - *Uzasadnienie*: baza do redukcji długu technicznego.
2. **Graf zależności** – wygenerowanie `analysis/dependency-graph.json` i raportu `.md` z kandydatami do usunięcia.
   - *Kryteria*: brak importów w kodzie, nieużywane w lockfile, zastępowalne narzędzia.
3. **Dynamiczna inspekcja** – uruchomienie smoke testu (backend + frontend) z logowaniem modułów i porównanie z analizą statyczną.
   - *Uzasadnienie*: weryfikacja realnego użycia zależności.
4. **Architektura de-facto** – opis komponentów + diagram Mermaid oraz decyzja ADR.
   - *Uzasadnienie*: dokumentacja powstałych ustaleń.

## Faza 3. Porządki
1. **Migracja dokumentacji** – przeniesienie materiałów do `dokumentacja/` i aktualizacja odnośników w README/CI.
   - *Uzasadnienie*: centralizacja wiedzy, łatwe wersjonowanie.
2. **Porządkowanie katalogu głównego** – aktualizacja `.gitignore`, przeniesienie skryptów do `scripts/`, konfiguracji do `config/` i `.github/`.
   - *Uzasadnienie*: klarowna struktura repo.
3. **Skrypt `scripts/purge_unused.sh`** – dry-run czyszczenia artefaktów + raport CSV/MD z uzasadnieniem.
   - *Uzasadnienie*: kontrolowana eliminacja nieużywanych plików/dependencji.
4. **Aktualizacja ścieżek w kodzie** – idempotentne skrypty migracyjne (sed/ts-node) aktualizujące importy po reorganizacji.
   - *Uzasadnienie*: zapewnienie kompatybilności po przenosinach.

## Faza 4. Bootability i automatyzacja
1. **Matryca komend** – `dokumentacja/boot-matrix.md` z tabelą `install/build/run/test` dla każdego modułu.
2. **Skrypty bootstrap/build/start/smoke-test** w `scripts/` z obsługą trybów dev/prod i logów w `logs/`.
3. **Docker** – multi-stage Dockerfile + `docker-compose.yml` z profilami `dev`/`prod` (jeśli wcześniej istniały, aktualizacja).
4. **CI/CD** – workflow GitHub Actions `ci.yaml` z sekwencją `build → test → lint → smoke-test → artifact`.

## Faza 5. Walidacja i rollback
1. **Sanity check struktury** – skrypt potwierdzający istnienie wymaganych katalogów i plików.
2. **Smoke test** – uruchomienie `scripts/smoke-test.sh` w trybie dev i prod.
3. **Instrukcja rollbacku** – procedura powrotu do tagu `pre-cleanup-*`.

## Kryteria sukcesu
- Wszystkie skrypty idempotentne, wspierają `--dry-run`, logują do `logs/`.
- Repo można uruchomić wg matrycy (dev + prod/Docker).
- Dokumentacja scentralizowana i zaktualizowana.
- Analiza zależności udokumentowana wraz z ryzykami i mitigacjami.

## Znane ryzyka i mitigacje
- **Brak części zależności offline** – dodano TODO w bootstrapie dot. manualnego cache.
- **Rozbieżności importów po przenosinach** – skrypty migracyjne + smoke test wykrywają brakujące moduły.
- **Złożoność środowisk (mobile, backend, frontend)** – matryca komand + dedykowane sekcje w skryptach.

