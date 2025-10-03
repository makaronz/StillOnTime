---
inclusion: always
---

# StillOnTime Development Standards

## Architecture Overview

**Monorepo Structure**: Backend (Node.js/TypeScript) + Frontend (React/TypeScript)

- **Database**: PostgreSQL with Prisma ORM, Redis for caching
- **Authentication**: Google OAuth 2.0 with JWT sessions
- **External APIs**: Google Calendar, Gmail, Maps, OpenWeather
- **Background Jobs**: Email processing, weather updates, route calculations

## Code Standards

### TypeScript

- Use strict mode with `noImplicitAny` and `strictNullChecks`
- Prefer `interface` over `type` for object shapes
- Create custom error classes extending base `Error`
- Use Winston for structured logging with request IDs

### API Design

- RESTful endpoints with proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Standardized error responses: `{ error: string, message: string, code: string, timestamp: string, path: string }`
- Validate all inputs using middleware
- Implement rate limiting per user/endpoint

### Database (Prisma)

- **ALWAYS** generate migrations for schema changes
- Naming: `camelCase` for fields, `PascalCase` for models
- Wrap multi-table operations in transactions
- Add indexes for frequently queried fields

### Security

- Use HTTPS in production
- Implement PKCE for OAuth flows
- Store tokens encrypted in database
- Request minimal Google API scopes only
- Apply CORS and security headers via helmet.js

## Business Logic Rules

### Email Processing Pipeline

- **Filter**: Only process emails with schedule keywords in subject line
- **Validation**: Check sender domains against approved whitelist
- **Requirements**: PDF attachment mandatory for processing
- **Deduplication**: Use message ID + PDF hash to prevent duplicates
- **Rate Limit**: Process maximum every 5 minutes

### Schedule Data Validation

- **Date Format**: YYYY-MM-DD (ISO 8601)
- **Time Format**: HH:MM (24-hour format)
- **Location**: Must be geocodable via Google Maps API
- **Scene Type**: Only 'INT' (interior) or 'EXT' (exterior)
- **Confidence**: Validate PDF extraction confidence scores before accepting

### Route Calculation Logic

- **Standard Route**: Home → Panavision Equipment → Shooting Location
- **Time Buffers**: 15min equipment + 10min parking + 10min entry + 20min traffic + 45min morning routine
- **Traffic**: Use real-time data when available, fallback to historical
- **Constraints**: Wake-up time never before 4:00 AM
- **Alternatives**: Always provide backup route options

### Calendar Event Creation

- **Title Format**: "StillOnTime — Dzień zdjęciowy ({location})"
- **Duration**: From departure_time to (call_time + 10 hours)
- **Alarms**: Set at wake_up-10min, wake_up, wake_up+5min
- **Reminders**: -12h, -3h, -1h, departure_time

### Weather Data Integration

- **EXT Shoots**: Full weather details (temp, precipitation, wind, visibility)
- **INT Shoots**: Basic weather overview only
- **Warnings**: Alert if temp <0°C or >30°C, precipitation >0mm, wind >10m/s
- **Timing**: Update 24h before shoot, cache for 24h

## Project Structure

### Backend (`backend/src/`)

- `controllers/` - Express route handlers (thin layer, delegate to services)
- `services/` - Core business logic (main processing logic)
- `repositories/` - Data access layer (Prisma queries and caching)
- `middleware/` - Express middleware (auth, validation, logging)
- `types/` - Shared TypeScript interfaces and types
- `utils/` - Pure utility functions (no business logic)
- `config/` - Environment and service configuration
- `jobs/` - Background job processors (email, weather, routes)

### Frontend (`frontend/src/`)

- `components/` - Reusable UI components (follow atomic design)
- `pages/` - Route-level page components
- `hooks/` - Custom React hooks (encapsulate stateful logic)
- `services/` - API client functions (axios-based)
- `stores/` - Zustand state management (global app state)
- `types/` - TypeScript interfaces (shared with backend)
- `utils/` - Pure utility functions
- `styles/` - Tailwind CSS and global styles

### File Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Services**: camelCase with `.service` suffix (`gmail.service.ts`)
- **Types**: camelCase with `.types` suffix (`calendar.types.ts`)
- **Tests**: Same name as file + `.test` suffix (`gmail.service.test.ts`)

## Development Guidelines

### Error Handling

- Use custom error classes extending base `Error`
- Implement circuit breakers for external API calls
- Add retry logic with exponential backoff
- Log all errors with context and request IDs
- Return user-friendly error messages in API responses

### Performance

- Implement Redis caching for frequently accessed data
- Use database connection pooling
- Optimize Prisma queries with proper `include`/`select`
- Implement pagination for list endpoints
- Use lazy loading for frontend components

### Code Quality

- Run ESLint with strict rules before committing
- Use Prettier for consistent code formatting
- Write unit tests for all service layer functions
- Integration tests for API endpoints
- E2E tests for critical user flows

### Logging & Monitoring

- **Winston Logging**: Structured logs with levels (error, warn, info, debug)
- **Request Tracing**: Include unique request IDs in all logs
- **API Monitoring**: Track response times, error rates, OAuth flows
- **Business Metrics**: Email processing rates, calendar sync success, route calculation performance

## AI Assistant Guidelines

### When Working with This Codebase

- Always follow the layered architecture: Controllers → Services → Repositories
- Use existing error classes and logging patterns
- Implement proper validation before database operations
- Follow the established naming conventions
- Add appropriate tests when creating new functionality
- Consider caching implications for data operations
- Validate business logic rules before implementation
