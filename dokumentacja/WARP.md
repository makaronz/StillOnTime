# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

StillOnTime is a comprehensive film schedule automation system that processes MP2 shooting schedule emails, extracts data from PDF attachments, calculates optimal routes, integrates with Google Calendar, and provides weather forecasts for shooting days. The system consists of a Node.js/TypeScript backend API, React frontend dashboard, PostgreSQL database, and Redis cache.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  React Frontend │────│  Node.js Backend │────│   PostgreSQL    │
│  (Port 3000)    │    │   (Port 3001)    │    │   (Port 5432)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                         ┌──────────────┐
                         │    Redis     │
                         │ (Port 6379)  │
                         └──────────────┘
```

**Key Integration Points:**
- **Gmail API**: Monitors inbox for MP2 schedule emails
- **Google Calendar API**: Creates events with alarms and notifications
- **Google Maps API**: Calculates optimal routes with traffic data
- **OpenWeatherMap API**: Provides weather forecasts for shooting locations

## Essential Commands

### Development Setup
```bash
# Initial setup
docker-compose up -d                    # Start PostgreSQL and Redis
cd backend && npm install               # Install backend dependencies
cd frontend && npm install              # Install frontend dependencies

# Database initialization
cd backend
npx prisma migrate dev                  # Run database migrations
npx prisma generate                     # Generate Prisma client
npm run db:init                         # Initialize database with test data
```

### Development Workflow
```bash
# Start development servers
docker-compose up -d                    # Start services (postgres, redis)
cd backend && npm run dev               # Backend API server (port 3001)
cd frontend && npm run dev              # Frontend dev server (port 3000)

# Alternative: Start everything with Docker
docker-compose up                       # All services including frontend/backend
```

### Testing Commands
```bash
# Backend testing
cd backend
npm test                               # Run unit tests
npm run test:watch                     # Run tests in watch mode
npm run test:coverage                  # Run tests with coverage

# Frontend testing
cd frontend
npm test                               # Run Vitest unit tests
npm run test:ui                        # Run tests with UI
npm run test:coverage                  # Run tests with coverage

# End-to-end testing
cd e2e-tests
npm run test:e2e:basic                 # Basic functionality tests
npm run test:e2e:full                  # Full application tests
npm run e2e                            # All E2E tests with service auto-start
```

### Database Operations
```bash
cd backend
npx prisma studio                      # Open database GUI
npx prisma migrate dev --name <name>   # Create new migration
npx prisma migrate reset               # Reset database (destructive)
npx prisma migrate deploy              # Deploy migrations (production)
npm run db:test                        # Test database connection
```

### Code Quality
```bash
# Backend linting
cd backend
npm run lint                           # Run ESLint
npm run lint:fix                       # Fix linting issues

# Frontend linting  
cd frontend
npm run lint                           # Run ESLint
npm run lint:fix                       # Fix linting issues
```

### Build and Production
```bash
# Backend build
cd backend
npm run build                          # Compile TypeScript to dist/
npm start                              # Run production server

# Frontend build
cd frontend
npm run build                          # Build for production
npm run preview                        # Preview production build
```

## Codebase Architecture

### Backend Structure (`backend/src/`)
- **`controllers/`**: API request handlers organized by domain (auth, schedule, calendar, etc.)
- **`services/`**: Business logic layer with service classes for external integrations
- **`repositories/`**: Data access layer using Prisma ORM
- **`middleware/`**: Express middleware for auth, error handling, monitoring
- **`routes/`**: API route definitions
- **`jobs/`**: Background job processors using Bull queue
- **`config/`**: Configuration management and database setup

**Key Service Architecture:**
- `gmail.service.ts`: Email processing and PDF extraction
- `google-maps.service.ts`: Route calculation with traffic data
- `calendar.service.ts`: Google Calendar integration
- `oauth2.service.ts`: Google OAuth 2.0 authentication flow
- `notification.service.ts`: Multi-channel notification system

### Frontend Structure (`frontend/src/`)
- **`pages/`**: Main page components (Dashboard, Configuration, History, Login)
- **`components/`**: Reusable UI components organized by feature area
- **`hooks/`**: Custom React hooks for data fetching and state management  
- **`services/`**: API client functions for backend communication
- **`stores/`**: Zustand state management stores
- **`types/`**: TypeScript type definitions

### Data Model (Prisma Schema)
Core entities: `User` → `ProcessedEmail` → `ScheduleData` → `RoutePlan` + `WeatherData` + `CalendarEvent`

**Key relationships:**
- Each processed email creates one schedule data record
- Schedule data has optional route plan, weather data, and calendar event
- All entities are user-scoped for multi-tenancy

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/stillontime_automation
REDIS_URL=redis://localhost:6379

# Google OAuth 2.0 (Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# External APIs
OPENWEATHER_API_KEY=your-openweather-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Application
JWT_SECRET=your-jwt-secret
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### API Permissions Setup
1. **Google Cloud Console**: Enable Gmail API, Calendar API, Drive API, Maps API
2. **OAuth Scopes**: `gmail.readonly`, `calendar`, `drive.file`
3. **OpenWeatherMap**: Sign up for free API key at openweathermap.org

## Development Workflows

### Email Processing Flow
1. Gmail API monitors inbox for MP2 emails with PDF attachments
2. PDF content is extracted and parsed for schedule data (date, call time, location)
3. Route calculation: Home → Panavision → Location with traffic buffers
4. Weather forecast fetched for shooting date/location
5. Google Calendar event created with alarms and comprehensive description
6. Summary notification sent to user

### Adding New Features
1. **Backend**: Add controller → service → repository layers
2. **Frontend**: Create page/component → add routes → integrate API calls
3. **Database**: Create Prisma migration if schema changes needed
4. **Tests**: Add unit tests (backend) and E2E tests for user flows

### Debugging Tips
- Use `npx prisma studio` to inspect database state
- Check `backend/logs/` for application logs
- E2E tests run with `--headed` flag to see browser interactions
- Redis CLI: `redis-cli` to inspect cache state
- Backend dev server logs include detailed API request/response info

### Common Issues
- **Port conflicts**: Ensure ports 3000, 3001, 5432, 6379 are available
- **Google API errors**: Check OAuth credentials and API quotas in Google Cloud Console
- **PDF parsing fails**: Ensure PDF-lib can handle the document format
- **Database connection errors**: Verify PostgreSQL is running and accessible

## Testing Strategy

### Unit Tests (Jest)
- Backend services and repositories have comprehensive test coverage (80%+ requirement)
- Mock external APIs (Google, OpenWeatherMap) in tests
- Test error handling and edge cases

### E2E Tests (Playwright)  
- `basic-functionality.spec.ts`: Core app loading and interaction
- `app-functionality.spec.ts`: Full user workflows with authentication
- Run across multiple browsers and mobile viewports
- Automatic screenshot/video capture on failures

### Integration Tests
- Database operations through Prisma
- API endpoint testing with supertest
- OAuth flow testing with mocked Google responses

## Performance Considerations

- **Database**: Use Prisma query optimization and connection pooling
- **Caching**: Redis stores frequently accessed data (user configs, weather)
- **Background Jobs**: Bull queue processes email parsing and route calculations
- **Rate Limiting**: Express rate limiting protects external API usage
- **Error Recovery**: Circuit breaker pattern for external service failures

## Security Implementation

- **OAuth 2.0**: Secure Google services integration with token refresh
- **JWT**: Stateless authentication with secure token management  
- **Helmet.js**: Security headers and protection middleware
- **Input Validation**: Zod schema validation on all API inputs
- **Environment Isolation**: Secrets stored in encrypted environment variables
- **Database Security**: Parameterized queries prevent SQL injection

This system is specifically designed for MP2 film production scheduling automation, with domain-specific logic for Polish addresses (home, Panavision office) and film industry workflows.