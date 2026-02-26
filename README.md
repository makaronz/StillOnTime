# StillOnTime Film Schedule Automation System

StillOnTime automates film shooting schedule operations: it ingests call-sheet emails, extracts schedule data from PDFs, enriches it with routing and weather context, and publishes actionable events to Google Calendar.

## Core Capabilities

- Automated email intake for schedule/call-sheet messages.
- PDF parsing and normalization of shoot metadata.
- Route planning with configurable travel buffers.
- Calendar event generation with reminders and rich descriptions.
- Weather forecast enrichment for outdoor shooting days.
- Operational dashboard for configuration, monitoring, and manual overrides.

## Repository Layout

```text
backend/        Node.js + TypeScript API, jobs, Prisma, and integrations
frontend/       React + Vite web dashboard
mobile/         React Native client
monitoring/     Observability and alerting assets
scripts/        Operational scripts (bootstrap/build/start/smoke-test)
dokumentacja/   Extended project and process documentation
analysis/       Generated dependency/runtime analysis artifacts
architecture/   Architecture overview and ADRs
```

## Quick Start (Local, without Docker)

1. Copy env templates and fill credentials.
2. Install dependencies in each app:
   - `cd backend && npm install`
   - `cd frontend && npm install`
3. Start infrastructure (Postgres/Redis/Qdrant) locally or via Docker.
4. Run backend in one terminal: `cd backend && npm run dev`
5. Run frontend in another: `cd frontend && npm run dev`

## Quick Start (Docker Compose)

```bash
docker compose --profile dev up --build
```

Services in dev profile:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Qdrant: localhost:6333

## Required Environment Variables

The app requires proper configuration for external integrations in production, especially:

- `DATABASE_URL`
- `JWT_SECRET`
- Google API credentials (Calendar/Maps/Gmail as used)
- Twilio credentials
- `REDIS_URL`

See project docs for full configuration guidance and operational runbooks:

- `dokumentacja/README.md`
- `dokumentacja/boot-matrix.md`
- `dokumentacja/verification-checklist.md`
