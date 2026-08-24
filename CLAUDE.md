# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StillOnTime is a film schedule automation system: it monitors Gmail for shooting-schedule emails with PDF attachments, parses them, calculates routes (Google Maps), fetches weather (OpenWeatherMap), and creates Google Calendar events. Monorepo with npm workspaces: `backend` (Express + TypeScript, port 3001), `frontend` (React + Vite, port 3000), plus `mobile` (React Native, separate package, not part of the main dev flow).

## Commands

```bash
# Setup (from root)
npm run install:all          # install root + backend + frontend deps
cp backend/.env.example backend/.env    # backend WILL NOT START without this (see Environment)
cp frontend/.env.example frontend/.env
docker-compose up -d postgres redis qdrant   # required infrastructure

# Development
npm run dev                  # both servers via concurrently
npm run dev:backend          # backend only (nodemon + ts-node with tsconfig-paths)
cd backend && npm run dev:simple   # lightweight backend without Bull workers (src/simple-server.ts)
npm run dev:frontend         # frontend only (vite)

# Build / lint
npm run build                # backend (tsc) then frontend (tsc && vite build)
npm run lint                 # both; also lint:backend / lint:frontend

# Tests
npm run test:backend         # Jest (backend/) — 80% coverage thresholds enforced
npm run test:frontend        # Vitest (frontend/), single run
cd backend && npm test -- path/to/file.test.ts --testNamePattern="exact test name"   # single backend test
cd frontend && npx vitest run path/to/file.test.tsx                                  # single frontend test
npm run test:e2e             # Playwright (root config)

# Database
npm run db:init              # backend/src/scripts/init-db.ts
npm run db:test              # connectivity check
```

## Environment (critical)

`backend/src/config/config.ts` runs `validateEnvironment()` + `validateSecurityConfig()` at import time. The backend crashes on startup if `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_SECRET` are missing (warnings only in development for some; `JWT_SECRET` is always required).

`JWT_SECRET` validation (`backend/src/config/security.ts`) is unusually strict: ≥48 chars, ≥3 character classes, and it **rejects secrets containing substrings** like "jwt", "secret", "token", "key", "auth", "test", "demo", "abc", "123" — which also rejects the placeholder in `backend/.env.example`. Generate with `openssl rand -base64 64 | tr -d '\n/+' | head -c 64`, and regenerate if the output happens to contain a banned substring.

Frontend env vars use the `VITE_` prefix (`VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`). The Vite dev server proxies `/api` → `http://localhost:3001`, but `frontend/src/services/api.ts` also sets an absolute `baseURL` from `VITE_API_URL`.

## Architecture

### Backend (`backend/src/`)

Request flow: `index.ts` (helmet → CORS → rate limit → CSRF → request-id) → `routes/index.ts` (mounts everything under `/api`) → `routes/*.routes.ts` (express-validator chains) → `controllers/` → `services/` → `repositories/` (Kysely + pg — **not Prisma**, despite some stale docs). Bull + Redis for background jobs (`jobs/`), Qdrant for the CodeNet RAG feature (`/api/codenet`).

Path aliases: `@/*` → `src/*` (tsconfig-paths at runtime, `moduleNameMapper` in Jest). Always import via `@/`.

Non-obvious internals you must use rather than reinvent (see also AGENTS.md):
- **Error handling**: hierarchical error classes (`APIError`, `BusinessLogicError`, …) consumed by the central `middleware/errorHandler.ts`. Always throw/wrap typed errors, never bare `Error` in request paths.
- **Resilience**: `utils/circuit-breaker.ts` (protects Google/Weather calls) and `utils/retry.ts` (`@withRetry` decorator, exponential backoff).
- **Logging**: `utils/logger.ts` exports `structuredLogger` (JSON + request-id context). Route handlers should use it, not `console.log`.
- **Auth**: two middleware layers — `authenticateToken` (JWT) and `requireValidOAuth` (Google token validity). Most business routes require both; dashboard-ish routes (`/stats`, `/recent`, `/upcoming`) only JWT. `secure-auth.routes.ts` is a parallel cookie+CSRF auth stack under `/api/auth/secure`.
- **CSRF**: `index.ts` skips CSRF for GETs, health checks, OAuth callback, and all `/api/*` in development — so CSRF bugs only surface in production mode.

### API path conventions

- Everything is under `/api/...` **except** `/health/*` (mounted at root, no prefix).
- `email`/`emails` and `schedule`/`schedules` are dual-mounted aliases for the same routers (`routes/index.ts`) — a route defined once is reachable under both singular and plural.
- Route param routes (`/:scheduleId`) are declared **after** static routes (`/statistics`, `/weather/...`) — keep that ordering when adding routes or static paths get swallowed.
- `GET /api/health` exists separately (in `routes/index.ts`) and lists all mounted route groups — useful as a quick smoke test.

### Frontend (`frontend/src/`)

- `App.tsx`: React Router v6 with lazy-loaded pages (`pages/`): Dashboard `/`, Login, OAuth callback, Onboarding, Configuration, History, Monitoring. Protected routes wrap in `ProtectedRoute` + `Layout`.
- State: Zustand stores in `stores/` (`authStore`, `connectionStore`, etc.). `authStore.checkAuth()` runs on app mount.
- All HTTP goes through `services/api.ts` (`apiService`): axios instance with Bearer-token injection, connection-status tracking, 401 → forced logout/redirect, and `retryWithBackoff` on every method by default. Feature services (`auth.ts`, `dashboard.ts`, `configuration.ts`, `history.ts`, `oauth.service.ts`, `monitoring.ts`, `systemConfig.ts`) wrap it. Note: `systemConfig.ts` and the history export use raw axios/fetch instead — keep endpoint paths in sync manually there.
- Path alias `@/*` → `src/*` (vite.config.ts + tsconfig).

### Frontend/backend contract

When adding or renaming an endpoint, update both sides — the frontend services hardcode paths. `docs/audit/AUDIT_REPORT.md` maps the verified endpoint-by-endpoint state and `docs/audit/REPAIR_TODO.md` lists the remaining work. Six frontend calls currently 404 because the backend route is missing: `POST /api/schedules`, `DELETE /api/emails/:id`, `GET /api/emails/export`, and `PUT /api/oauth/preferences` / `GET /api/oauth/folders` / `GET /api/oauth/calendars`. Re-verify against the code before relying on that list — the branch has been rebuilt more than once.

## Code style

- **Backend ESLint is strict**: explicit return types are required on functions (`Promise<void>`, etc.). Frontend ESLint is standard React/Vite (but `--max-warnings 0`).
- Backend tsconfig is intentionally loose (`strict: false`); frontend is `strict: true`.
- Frontend test files live next to code and in `src/tests/`; backend tests in `backend/tests/` and `src/**/*.test.ts`.

## claude-flow / SPARC tooling

The repo carries claude-flow orchestration config (`.claude/`, `.hive-mind/`, `claude-flow` binary, SPARC skills). If using it: `npx claude-flow sparc modes`, `npx claude-flow sparc tdd "<feature>"`. Never save working files, reports, or test scratch files to the repo root — use `docs/`, `scripts/`, or the appropriate subdirectory. The root already suffers from ~60 stray markdown reports; don't add more.
