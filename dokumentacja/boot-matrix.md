# Matryca instalacji, buildów i testów

| Moduł | Install | Build | Run (dev) | Run (prod) | Test | Uwagi |
| --- | --- | --- | --- | --- | --- | --- |
| Root Monorepo | `npm install` | `npm run build` | `npm run dev` | `npm run build && npm run start` | `npm test` | Obsługuje workspace `backend`, `frontend` |
| Backend | `cd backend && npm ci` | `cd backend && npm run build` | `cd backend && npm run dev:simple` | `cd backend && npm run start` | `cd backend && npm test` | Wymaga `DATABASE_URL`, `REDIS_URL`, `GOOGLE_*`, `TWILIO_*` |
| Frontend | `cd frontend && npm ci` | `cd frontend && npm run build` | `cd frontend && npm run dev` | `cd frontend && npm run preview -- --host` | `cd frontend && npm test` | Potrzebny endpoint API (`VITE_API_URL`) |
| Mobile | `cd mobile && npm install` | `npx expo prebuild` | `npx expo start` | `eas build --platform ios|android` | `npx expo test` | Oznaczony jako `experimental` |
| E2E | `npm install` | `npm run build:frontend` | `npx playwright test smoke-test.spec.ts` | `npx playwright test` | `npx playwright test` | Testy UI, logi w `logs/playwright/` |
| Docker Compose | `docker compose pull` | `docker compose build` | `docker compose --profile dev up` | `docker compose -f docker-compose.production.yml --profile prod up` | `docker compose run backend npm test` | Ustaw `<SERVICE_PORTS>` w `.env` |
| CI Pipeline | `actions/setup-node` | `npm run build` | `npm run start --if-present` | n/a | `npm test && npm run lint && npm run test:e2e:smoke` | Definicja w `.github/workflows/ci.yaml` |

## Szybki start
```bash
./scripts/bootstrap.sh --profile dev
./scripts/build.sh --profile dev
./scripts/start.sh --profile dev --target docker
./scripts/smoke-test.sh --profile dev
```

## Artefakty
- Logi: `logs/*.log`
- Raporty: `analysis/`
- Backups: `BACKUP/`

## TODO(decision)
- Potwierdzić `<STACK_HINT>` dla QA.
- Zdefiniować `<SERVICE_PORTS>` i `<DB_CONNECTION_STRING?>` w `.env` / `config/`.
