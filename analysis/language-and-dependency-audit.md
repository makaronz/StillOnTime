# Audit języków i zależności

## Wykryte ekosystemy
| Ekosystem | Kryterium detekcji | Kluczowe katalogi | Szacowany LOC* |
| --- | --- | --- | --- |
| TypeScript / Node.js | `package.json`, `.ts` pliki | `backend/`, `frontend/`, `mobile/`, `e2e-tests/` | ~65k |
| JavaScript (konfiguracje) | `*.config.js`, `*.mjs` | `backend/`, `frontend/`, `scripts/` | ~2k |
| YAML / Konfiguracje | `docker-compose*.yml`, `kubernetes/` | `config/`, `kubernetes/`, `.github/` | ~1.5k |
| Markdown / Dokumentacja | `.md` pliki | `dokumentacja/` | ~50k |

\* LOC oszacowane na podstawie poprzednich raportów `analysis/legacy-reports/` i liczby plików; dokładny wynik dostępny po uruchomieniu `npx cloc --vcs=git`.

## Zależności krytyczne
- **Backend**: `express`, `prisma`, `bull`, `@googlemaps/google-maps-services-js`, `twilio`, `redis`.
- **Frontend**: `react`, `vite`, `react-router-dom`, `tailwindcss`, `zustand`.
- **Mobile**: `react-native`, `expo` (wymaga potwierdzenia, brak lockfile).
- **Testy**: `@playwright/test`, `vitest`, `jest`.

## Procedura audytu (do uruchomienia)
```bash
# 1. Statyczny audyt (Node)
cd <ABSOLUTE_REPO_PATH>
npx --yes depcheck --json > analysis/depcheck.json

# 2. LOC
npx --yes cloc --include-lang=TypeScript,JavaScript,YAML,JSON,Markdown --report-file=analysis/cloc.txt

# 3. Python/Go (jeśli pojawią się pliki)
# TODO(decision): dodać pipdeptree / go list
```

## Wnioski
1. **Brak aktywnych modułów Python/Go** – skrypty bootstrapowe pozostawiono z sekcją TODO.
2. **`claude-flow`** – kandydat do przesunięcia do sekcji narzędzi opcjonalnych.
3. **`mobile`** – brak testów i integracji w pipeline; zmapowano jako eksperymentalny.
4. **Dokumentacja** – wysoki udział w LOC; przeniesiono do `dokumentacja/` z indeksami CSV/MD.

## Ryzyka i mitigacje
- *Ryzyko*: `npm ci` wymaga połączenia sieciowego. *Mitigacja*: przygotować cache offline (artifacts w CI).
- *Ryzyko*: brak `.env` z sekretami => skrypty fail. *Mitigacja*: `scripts/bootstrap.sh` kopiuje `.env.example`.
