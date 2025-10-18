# Statyczny graf zależności

- **Źródło**: `analysis/dependency-graph.json`
- **Metodyka**: ręczna inspekcja `package.json`, `docker-compose.yml`, `kubernetes/` oraz dokumentacji.

## Warstwy
1. `backend` – API i zadania asynchroniczne.
2. `frontend` – panel operatorski.
3. `mobile` – klient mobilny (status: eksperymentalny).
4. `monitoring` – definicje obserwowalności.

## Kandydaci do usunięcia / deprecjacji
| Element | Kryterium | Ryzyko | Mitigacja |
| --- | --- | --- | --- |
| `claude-flow` (root dependency) | Brak referencji w kodzie, tylko dokumentacja. | Automatyczne agentowe testy mogą przestać działać. | Dodać jako opcjonalne narzędzie CLI w dokumentacji, usunąć z `package.json` po akceptacji QA. |
| `mobile` workspace | Brak testów w CI, niska aktywność commitów. | Możliwe utracenie funkcjonalności mobilnej. | Dodanie smoke testu (patrz `scripts/smoke-test.sh`) lub oznaczenie jako `experimental`. |
| `gitingest-ingest/` | Dane historyczne, brak referencji w nowszych skryptach. | Możliwe potrzebne do audytu. | Przenieść do `dokumentacja/legacy-docs/` lub archiwum zewnętrznego. |

## Statyczne vs dynamiczne
- Statyczna analiza wykryła 3 warstwy runtime (backend, frontend, worker) + 2 external services.
- Dynamiczna inspekcja `scripts/smoke-test.sh` zapisuje moduły do `analysis/runtime-modules-<profile>.txt`; różnice raportowane w `analysis/dynamic-smoke-summary.json`.

## Znane luki
- Brak automatycznego grafu dla `kubernetes/` (TODO: dodać `helm template`).
- Niezweryfikowano zależności Python (brak `requirements.txt`).
