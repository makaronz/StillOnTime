# AGENTS.md - Przewodnik po nieoczywistych elementach projektu StillOnTime

Ten dokument nie jest pełną dokumentacją. Jego celem jest zwrócenie uwagi na specyficzne, niestandardowe i potencjalnie zaskakujące elementy projektu, które są kluczowe dla efektywnej pracy.

## Architektura i Kluczowe Założenia

*   **Monorepo**: Projekt jest monorepem, ale serwisy (backend, frontend) mają własne, niezależne zależności i skrypty w swoich podkatalogach.
*   **Krytyczne Zależności Zewnętrzne**: Cała funkcjonalność opiera się na poprawnym działaniu i konfiguracji **Google APIs** (dla kalendarza i map) oraz **Twilio** (dla SMS). Awarie tych usług są obsługiwane przez wewnętrzne mechanizmy odpornościowe.

## Uruchamianie i Testowanie

Standardowe polecenia jak `npm run dev` działają zgodnie z oczekiwaniami. Poniżej znajdują się niestandardowe warianty:

*   **Lekki start backendu**: Aby uruchomić serwer Node.js bez dodatkowych procesów (jak Bull worker), użyj:
    ```bash
    npm run dev:simple
    ```
*   **Testy Frontendu z UI**: Do uruchomienia testów Playwright w trybie UI dla frontendu służy dedykowany skrypt:
    ```bash
    npm run test:ui
    ```
*   **Uruchamianie pojedynczego testu**: Aby wykonać jeden, konkretny test (np. w backendzie), użyj następującej składni:
    ```bash
    npm run test -- <ścieżka_do_pliku_testowego> --testNamePattern="<dokładna_nazwa_testu>"
    ```

## Styl Kodu i Standardy

*   **Rygorystyczny ESLint w Backendzie**: Backend (`/backend`) ma **bardzo ścisłe** reguły lintingu. Najważniejszą z nich jest wymóg jawnego typowania wartości zwracanych przez funkcje. Kod bez `Promise<void>`, `Promise<string>`, itp. nie przejdzie walidacji.
*   **Łagodniejszy ESLint w Frontendzie**: Frontend (`/frontend`) ma znacznie bardziej liberalne zasady, zbliżone do standardowych konfiguracji React/Vite.

## Krytyczne Implementacje Wewnętrzne

Projekt zawiera własne, zaawansowane narzędzia, których znajomość jest niezbędna do zrozumienia logiki biznesowej i przepływu danych.

### Hierarchiczna Obsługa Błędów

Najważniejszy mechanizm w projekcie. Zamiast generycznych błędów, używamy hierarchicznej struktury klas, np. `APIError`, `BusinessLogicError`. Całość jest zarządzana przez centralny middleware:

*   **Lokalizacja**: `backend/src/middleware/errorHandler.ts`
*   **Funkcjonalność**: Automatycznie loguje błędy w ustrukturyzowanym formacie (JSON), mapuje je na odpowiednie kody statusu HTTP i może zawierać sugestie dotyczące naprawy problemu. **Zawsze opakowuj błędy w odpowiednią klasę.**

### Niestandardowe Narzędzia Odpornościowe (Resilience)

Aby chronić aplikację przed awariami usług zewnętrznych, zaimplementowano własne mechanizmy.

*   **Circuit Breaker**: Chroni system przed wielokrotnym wywoływaniem niedziałającej usługi (np. Google Maps API). Po przekroczeniu progu błędów "otwiera obwód" i natychmiast zwraca błąd, oszczędzając zasoby.
    *   **Lokalizacja**: `backend/src/utils/circuit-breaker.ts`
*   **Retry Manager z Dekoratorem `@withRetry`**: Automatyzuje ponawianie prób dla operacji, które mogą chwilowo zawodzić. Używa logiki *exponential backoff*. Wystarczy dodać dekorator do metody, aby włączyć ten mechanizm.
    *   **Lokalizacja**: `backend/src/utils/retry.ts`

### Ustrukturyzowane Logowanie

Wszystkie logi w backendzie powinny używać dostarczonego loggera, który zapisuje dane w formacie JSON z dodatkowym kontekstem (np. `traceId`). Ułatwia to przeszukiwanie i analizę logów w środowiskach produkcyjnych.

*   **Lokalizacja**: `backend/src/utils/logger.ts`

## Konfiguracja Środowiska

*   **Krytyczne Zmienne Środowiskowe**: Aplikacja w trybie `production` **nie uruchomi się**, jeśli brakuje poniższych zmiennych. Upewnij się, że są one zdefiniowane w pliku `.env` lub w środowisku systemowym:
    *   `DATABASE_URL`
    *   `JWT_SECRET`
    *   Klucze do API Google
    *   Klucze do API Twilio
    *   `REDIS_URL`