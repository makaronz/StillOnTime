# Raport błędów — StillOnTime (listopad 2026)

Zakres: backend (Express/Kysely), frontend (React/Vite), konfiguracja testów i zależności.
Rejestr maszynowy: `bug-findings.json`, `bug-findings.csv` (75 pozycji: 44 naprawione, 31 otwartych).
Pozycje BUG-022..BUG-042 i OPEN-21..OPEN-33 oraz zamknięcie OPEN-11 i OPEN-20 pochodzą z naprawy testów backendu (gałąź `claude/busy-volta-oy0otf`); poniższe podsumowanie opisuje stan sprzed tej zmiany.

## Podsumowanie

Naprawiono 21 usterek: 5 bezpieczeństwa, 10 funkcjonalnych, 2 integracyjne, 3 jakości (testy, lint, build), 1 konfiguracji. Część z nich wyłączała cały ekran lub przepływ (onboarding, ustawienia OAuth, monitoring, CSRF na produkcji). Nie naprawiono wszystkiego: 10 pozycji zostaje otwartych (zależności, stare testy, dług lintowy, kilka decyzji projektowych). Lista nie jest pełnym audytem repozytorium — przejrzano trasy backendu, warstwę auth/CSRF, przepływ OAuth, onboarding i warstwę HTTP frontendu. Nie czytano m.in. serwisów PDF/Gmail/Calendar/Maps, kolejek Bull, `mobile/`, `kubernetes/`, `infrastructure/`.

## Stan przed i po

| Miara | Przed | Po | Źródło |
|---|---|---|---|
| Jest (backend), testy zielone | 0 (58/58 suite'ów padało na starcie) | 492 zielone, 0 regresji pass→fail | per-test porównanie JSON |
| Jest (backend), testy czerwone | — | 427 (istniały wcześniej, patrz OPEN-07) | j.w. |
| Vitest (frontend) | 8 czerwonych / 37 zielonych | 7 czerwonych / 49 zielonych | bieg na `bb21281` w osobnym worktree vs. HEAD |
| `tsc --noEmit` frontend | 37 błędów | 0 | `tsc` |
| `vite build` | nie przechodził (`tsc &&`) | przechodzi | build |
| `npm audit --omit=dev` | 94 (5 critical, 38 high) | 86 (4 critical, 33 high) | `npm audit` |

Testy backendu uruchamiano bez Redisa i Postgresa. Wszystkie nowe testy używają atrap (supertest na prawdziwym grafie tras albo na wydzielonych modułach), nie działającej infrastruktury.

## Naprawione

Pełny opis w `bug-findings.json`. Najważniejsze:

- **BUG-001 CSRF na produkcji** — `csurf` w trybie cookie bez `cookie-parser` zwracał 500 `misconfigured csrf` na każdym POST/PUT/DELETE i na `/api/csrf-token`. Odtworzone na replice konfiguracji z `index.ts`. Dodatkowo CORS nie przepuszczał `X-CSRF-Token`.
- **BUG-003 / BUG-004 / BUG-005** — `/api/codenet/*` bez uwierzytelnienia (w tym `generate` i `initialize`), IDOR w `/api/enhanced/*` (userId z URL/body), webhook SMS bez weryfikacji podpisu Twilio.
- **BUG-008 login CSRF w OAuth** — backend sprawdzał tylko długość `state`, a frontendowe `validateState` przepuszczało brak zapisanego stanu (jego własny test oczekiwał `false`).
- **BUG-002** — `/api/monitoring/*` nigdy nie było zamontowane.
- **BUG-010–015** — `oauth.service.ts` podwójnie rozpakowywał odpowiedzi (cały ekran ustawień OAuth rzucał wyjątki), onboarding nie mógł się zakończyć (limit kroku 4 przy 6 krokach), brakująca ikona wywalała moduł `SystemConfigStep`, `isSetupRequired` używane jako wartość zamiast wywołania, `completeSetup` wysyłał złe klucze.
- **BUG-019** — `tests/setup.ts` importował `config` przed ustawieniem zmiennych środowiskowych.

## Otwarte (nienaprawione)

| ID | Waga | Dlaczego zostaje |
|---|---|---|
| OPEN-01 | High | 86 zaleceń; `npm audit fix` blokuje konflikt peer-dependency z `langchain`, reszta to zmiany major. Wymaga osobnej decyzji. |
| OPEN-02 | Medium | Brak `trust proxy`. Poprawna wartość zależy od tego, co stoi przed aplikacją. |
| OPEN-04 | Medium | `memory-recovery.routes.ts` niezamontowane i bez auth; ryzyko tylko, jeśli ktoś je zamontuje. |
| OPEN-05 | Medium | `POST /api/codenet/initialize` dla każdego zalogowanego; w aplikacji nie ma ról. |
| OPEN-07 | Medium | 427 czerwonych testów backendu to głównie stare atrapy Prisma przeciw repozytoriom Kysely oraz timeouty bez Redisa. Naprawa = przepisanie testów. |
| OPEN-10 | niezweryfikowane | `/health/detailed` jest publiczne; zawartości nie sprawdzano. |

Pozostałe (OPEN-03, 06, 08, 09) są niskiej wagi; opis w rejestrze.

## Odstępstwa od zadanego procesu

- **Jedna gałąź zamiast gałęzi na każdą poprawkę.** Środowisko wymaga pracy na `claude/quirky-curie-mqgx1y`. Kod jest w 11 osobnych commitach, więc można je cofać pojedynczo; commit `237c67a` łączy trzy poprawki tras.
- **Czerwony stan nie wszędzie zaobserwowany.** Dla modułów dopiero tworzonych test padał na brakującym module, a nie na zachowaniu; zachowanie starego kodu pokazałem osobno tylko dla CSRF (skrypt odtwarzający), oauth.service (TypeError) i step-cap (AssertionError). Dla BUG-006 i BUG-012 nie ma testu czerwonego na starym kodzie (patrz kolumna „verification").
- **Zmieniono dwa istniejące testy** (`oauth-security`, `oauth.integration`), bo zakodowały stary format `state` (64 znaki hex), który celowo się zmienił.
- **Brak testów wydajności i brak testów na żywej infrastrukturze** (Postgres, Redis, Google, Twilio). Weryfikacja Twilio opiera się na `twilio.getExpectedTwilioSignature`, nie na prawdziwym wywołaniu.

## Zalecenia

1. Wdrożenie: ustawić `TWILIO_WEBHOOK_URL` (pełny publiczny adres webhooka) i `TWILIO_AUTH_TOKEN`; bez tokenu webhook odpowiada 503 (świadomie).
2. Zdecydować, kto może wywoływać `/api/codenet/initialize` (rola albo wyłączenie na produkcji).
3. Osobne zadanie: aktualizacja `langchain`/`@langchain/*` i reszty zależności z OPEN-01, z testami integracyjnymi.
4. Osobne zadanie: przepisać testy repozytoriów pod Kysely; do tego czasu nie traktować progu pokrycia 80% jako bramki.
5. Dodać do CI: `tsc --noEmit` i `eslint` frontendu (oba teraz działają), `npm audit --omit=dev --audit-level=critical`.
6. Wzorzec powtarzający się w repo: kod i jego testy rozjeżdżają się po migracjach (Prisma→Kysely, relaksacja walidacji, dopisane kroki wizarda). Warto łapać to w CI przez `tsc` oraz test na każdy publiczny kontrakt zamiast na szczegóły implementacji.

## Dodatek: testy repozytoriów pod Kysely

Dziewięć testów repozytoriów mockowało klienta Prisma, którego repozytoria już nie używają. Przepisano je na prawdziwy builder Kysely z fałszywym sterownikiem (`backend/tests/helpers/kysely-test-db.ts`): testy sprawdzają wygenerowany SQL, parametry i mapowanie wierszy. Wynik: 9 suite'ów, 447 testów zielonych (wcześniej wszystkie padały). Każdy plik był sprawdzony mutacyjnie (zepsuty operator, filtr, kierunek sortowania, wartość domyślna w źródle): wszystkie zepsucia zostały wykryte, źródło przywrócone bez zmian.

Przy okazji testy ujawniły metody, które przyjmują filtr i go ignorują (OPEN-11 do OPEN-19). Nie są asertowane w testach i nie były naprawiane. OPEN-18 (jsonb jako surowa tablica JS) jest niezweryfikowany, bo wymaga prawdziwego Postgresa.

Ograniczenie: fałszywy sterownik sprawdza to, co repozytorium wysyła, a nie to, jak zareaguje baza (typy kolumn, ograniczenia, indeksy).
