# StillOnTime Repository Map

## Root Level
- `backend/` – Node.js/TypeScript API service with Express, Prisma, and resilience utilities.
- `frontend/` – React + Vite dashboard client.
- `e2e-tests/` – Playwright end-to-end suites (frontend + backend integration).
- `poc-engineering/` – Proof-of-concept experiments and auxiliary tooling.
- Documentation (`README.md`, `CS_*`, `TASK_*`, etc.) – Product, architecture, and implementation notes.
- Infrastructure (`docker-compose.yml`, `Dockerfile.dev`) – Local orchestration for services.

## Backend Service (`backend/`)
- `package.json`, `tsconfig.json` – Backend build, lint, and type-check configuration.
- `src/index.ts` – Express app bootstrapper configuring security middleware, rate limiting, routes, and startup logging.
- `src/config/` – Environment configuration, database/Redis initialisers, circuit breaker policies, and security settings.
- `src/controllers/` – HTTP controllers grouped by domain (auth, calendar, email, route planning, scheduling, SMS, user management).
  - `schedule/` – Sub-controllers for CRUD, statistics, routing, and weather enrichment.
- `src/routes/` – Express routers wiring controllers into `/api/*` endpoints (auth, user, email, schedule, monitoring, etc.).
- `src/services/` – Core business logic: Gmail ingestion, schedule summarisation, route planning, monitoring, error recovery, notification delivery, caching, and weather orchestration.
  - `job-processor/` – Bull queue processors for email, periodic, and weather jobs.
  - `summary/` – Domain logic for schedule summaries.
- `src/repositories/` – Data access layer built on Prisma for users, schedules, calendars, notifications, etc.
- `src/middleware/` – Authentication guards, structured error handler, and monitoring instrumentation.
- `src/utils/` – Cross-cutting utilities (circuit breaker, retry decorator, structured logger, domain errors).
- `src/types/` & `src/@types/` – Shared TypeScript interfaces and Express augmentation.
- `src/jobs/` – Scheduled background jobs (e.g., weather monitoring).
- `src/scripts/`, `tests/` – Maintenance scripts and automated tests.

## Frontend Client (`frontend/`)
- `package.json`, `vite.config.ts`, `tsconfig.json` – Frontend tooling and TypeScript configuration.
- `src/main.tsx`, `src/App.tsx` – Application entry and router composition.
- `src/components/` – Reusable UI building blocks:
  - `dashboard/` cards for status, activity, schedules.
  - `configuration/` cards for addresses, API connections, notifications, and buffers.
  - `history/` tables, filters, charts, and modal for email history.
  - Shared components: layout shell, OAuth callback handler, protected routing, loading spinner.
- `src/pages/` – Top-level views (Dashboard, Configuration, History, Monitoring, Login).
- `src/services/` – API clients for auth, dashboard metrics, monitoring, configuration, history, and Axios wrapper.
- `src/hooks/` – React hooks bridging services with views (auth, dashboard, history, configuration state).
- `src/stores/` – Zustand store for auth session state.
- `src/utils/` – OAuth helper and session management utilities.
- `src/types/` – Shared frontend domain models (user, schedule, route plan, monitoring structures, API responses).
- `src/styles/` – Tailwind layer definitions.
- `src/test/` – Vitest utilities and component tests.

## Supporting Assets
- `node_modules/` – Installed dependencies for root-level tooling.
- `playwright.config.ts`, `playwright-frontend.config.ts` – Playwright setups for backend and frontend.
- `docker/` (backend) – Container build assets for API service.
