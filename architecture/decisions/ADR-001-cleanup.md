# ADR-001: Repozytoryjne porządki i przygotowanie do bootability

- **Status**: Accepted (2024-XX-XX)
- **Kontekst**: Rozproszona dokumentacja, brak spójnych skryptów startowych, brak backupu przed refaktoryzacją.
- **Decyzja**:
  1. Przenosimy całą dokumentację do `dokumentacja/` wraz z indeksami.
  2. Tworzymy zestaw skryptów (`backup_and_branch`, `bootstrap`, `build`, `start`, `smoke-test`, `purge_unused`, `update-doc-links`).
  3. Wprowadzamy strukturę artefaktów `BACKUP/`, `analysis/`, `architecture/`, `scripts/`, `config/`, `logs/`.
  4. Dodajemy workflow CI `build → test → lint → smoke-test → artifact`.
- **Konsekwencje**:
  - Łatwiejszy onboarding dzięki matrycy i planowi wykonania.
  - Możliwość rollbacku dzięki tagowi `pre-cleanup-*` i archiwom.
  - Wymagane ręczne potwierdzenie `<STACK_HINT>`, `<SERVICE_PORTS>`, `<DB_CONNECTION_STRING?>`.
  - Potrzebne dostosowanie pipeline'ów mobilnych (TODO).
