# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StillOnTime is a film schedule automation system that processes shooting schedule emails, extracts PDF data, calculates optimal routes, integrates with Google Calendar, and provides weather forecasts. It's a TypeScript monorepo with a Node.js/Express backend and React frontend.

## Development Commands

### Root Level Commands
```bash
# Development (starts both backend and frontend)
npm run dev

# Build entire project
npm run build

# Run all tests
npm run test

# Linting
npm run lint

# Install all dependencies
npm install:all

# Docker operations
npm run docker:up
npm run docker:down
npm run docker:logs

# Database operations
npm run prisma:migrate
npm run prisma:studio
npm run prisma:generate

# E2E Testing
npm run test:e2e                # Run all E2E tests
npm run test:e2e:headed         # Run with browser UI
npm run test:e2e:basic          # Run basic functionality tests
npm run test:e2e:smoke          # Run smoke tests
npm run test:e2e:report         # Show test report
npm run e2e:frontend            # Frontend-only E2E tests
```

### Backend Commands (from /backend directory)
```bash
npm run dev              # Start development server with nodemon
npm run dev:simple       # Start simple server without full features
npm run build            # TypeScript compilation
npm run test             # Jest tests
npm run test:watch       # Jest watch mode
npm run test:coverage    # Coverage report
npm run lint             # ESLint
npm run db:init          # Initialize database
npm run db:test          # Test database connection
npm run prisma:studio    # Open Prisma Studio
npm run prisma:reset     # Reset database
```

### Frontend Commands (from /frontend directory)
```bash
npm run dev              # Vite dev server
npm run build            # Production build
npm run preview          # Preview build
npm run test             # Vitest tests
npm run test:watch       # Vitest watch mode
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage report
npm run lint             # ESLint
```

## Architecture Overview

### Backend Architecture (Node.js/TypeScript)

**Layered Architecture Pattern:**
- `src/controllers/` - HTTP request handlers and API routes
- `src/services/` - Business logic and external API integrations
- `src/repositories/` - Data access layer with Prisma ORM
- `src/middleware/` - Express middleware (auth, error handling, monitoring)
- `src/types/` - TypeScript type definitions and domain models
- `src/utils/` - Utility functions and helpers
- `src/config/` - Configuration management
- `src/jobs/` - Background job processors

**Key Services:**
- **OAuth2Service** - Google authentication and token management
- **GmailService** - Email monitoring and PDF attachment processing  
- **PDFParserService** - Extract schedule data from PDF files
- **RouteplannerService** - Calculate optimal routes with Google Maps
- **WeatherService** - OpenWeatherMap integration for forecasts
- **CalendarService** - Google Calendar event creation
- **NotificationService** - Multi-channel notifications (email, SMS, push)
- **JobProcessorService** - Background email processing pipeline
- **CacheService** - Redis caching for performance
- **MonitoringService** - Health checks and system monitoring

**Data Layer:**
- **PostgreSQL** database with Prisma ORM
- **Redis** for caching and session storage
- Repository pattern for data access abstraction
- Comprehensive relationships between User, ProcessedEmail, ScheduleData, RoutePlan, WeatherData, CalendarEvent entities

### Frontend Architecture (React/TypeScript)

**Component Structure:**
- `src/pages/` - Main page components (Dashboard, Configuration, History, Monitoring)
- `src/components/` - Reusable UI components organized by feature
- `src/hooks/` - Custom React hooks for data fetching and state
- `src/services/` - API service functions for backend communication
- `src/stores/` - Zustand state management stores
- `src/types/` - TypeScript interfaces
- `src/utils/` - Utility functions

**State Management:**
- **Zustand** for global state (authentication, configuration)
- **React Hook Form** for form management with Zod validation
- **React Router** for navigation and protected routes

**UI Framework:**
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Recharts** for data visualization
- **React Hot Toast** for notifications

## Testing Strategy

### Backend Testing (Jest)
- Unit tests in `tests/` mirror `src/` structure
- Integration tests for API endpoints  
- Repository tests with database mocking
- Service tests with external API mocking
- Coverage thresholds: 80% for branches, functions, lines, statements

### Frontend Testing (Vitest)
- Component tests with React Testing Library
- Hook tests for custom React hooks
- Service layer tests for API functions
- JSDOM environment for DOM testing

### E2E Testing (Playwright)
- Full application workflow tests
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile viewport testing
- Automatic backend/frontend startup for testing
- Tests in `e2e-tests/` directory

## Key Integrations

### Google APIs
- **Gmail API** - Email monitoring and attachment downloading
- **Google Calendar API** - Event creation with alarms
- **Google Drive API** - PDF file access
- **Google Maps API** - Route calculation and geocoding

### External Services
- **OpenWeatherMap API** - Weather forecasts and warnings
- **Twilio** - SMS notifications
- **Redis** - Caching and background job queues

### OAuth 2.0 Flow
- Google OAuth for secure API access
- Token refresh and management
- Secure credential storage

## Development Guidelines

### Database Changes
1. Always create Prisma migrations: `npm run prisma:migrate`
2. Generate Prisma client after schema changes: `npm run prisma:generate`
3. Test database operations: `npm run db:test`

### Environment Setup
- Use `docker-compose up -d` for local development dependencies
- Backend runs on port 3001, frontend on port 3000
- PostgreSQL on port 5432, Redis on port 6379

### Code Patterns
- **Repository Pattern** - All database access through repositories
- **Service Layer** - Business logic separated from controllers
- **Dependency Injection** - Services injected into controllers
- **Error Handling** - Structured error responses with monitoring
- **Caching Strategy** - Redis caching for expensive operations
- **Background Jobs** - Bull queue for async processing

### API Conventions
- RESTful endpoints under `/api/*`
- Structured JSON responses with consistent error handling
- Rate limiting and security headers
- Request ID tracking for tracing

### Type Safety
- Strict TypeScript configuration
- Zod schemas for runtime validation
- Shared type definitions between frontend/backend
- Domain model types in `backend/src/types/domain.ts`

## Monitoring and Observability

### Health Checks
- `/health` - Basic application health
- `/api/health` - API health with route information
- `/api/monitoring/*` - Detailed system metrics

### Logging
- Winston for structured logging
- Request ID correlation
- Error tracking and alerting
- Log rotation and persistence

### Performance
- Redis caching for Google Maps, weather data
- Route calculation optimization
- Database query optimization with indexes
- Background job processing for heavy operations