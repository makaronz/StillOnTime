# StillOnTime Project Onboarding Report

**Generated**: 2025-10-01  
**Serena Version**: 0.1.4  
**Project Language**: TypeScript  

## Project Overview

StillOnTime is a **Film Schedule Automation System** designed for the film production industry. It's a full-stack TypeScript monorepo with comprehensive integration with Google APIs, weather services, and SMS notifications.

## Architecture Summary

### Technology Stack

**Backend (Node.js/Express)**
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for performance optimization
- **Authentication**: JWT + Google OAuth 2.0
- **Testing**: Jest with comprehensive coverage
- **Background Jobs**: Bull queue system

**Frontend (React + Vite)**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast development and builds)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library

**E2E Testing**
- **Framework**: Playwright
- **Coverage**: Full application workflow tests
- **Browsers**: Chrome, Firefox, Safari support

### Project Structure

```
StillOnTime/
├── backend/               # Node.js/Express API
│   ├── src/
│   │   ├── controllers/  # HTTP route handlers
│   │   ├── services/     # Business logic layer
│   │   ├── repositories/ # Data access with Prisma
│   │   ├── middleware/   # Express middleware
│   │   ├── types/        # TypeScript definitions
│   │   ├── utils/        # Helper functions
│   │   └── jobs/         # Background job processors
│   ├── tests/            # Unit and integration tests
│   └── prisma/           # Database schema and migrations
│
├── frontend/             # React application
│   └── src/
│       ├── pages/        # Main page components
│       ├── components/   # Reusable UI components
│       ├── hooks/        # Custom React hooks
│       ├── services/     # API communication
│       ├── stores/       # Zustand state management
│       └── types/        # TypeScript interfaces
│
├── e2e-tests/            # Playwright end-to-end tests
├── serena-installation/  # Serena AI toolkit
└── .serena/              # Serena configuration and cache
```

## Key Features & Integrations

### External API Integrations

1. **Google APIs**
   - **Gmail API**: Email monitoring and PDF attachment processing
   - **Google Calendar API**: Event creation with alarms
   - **Google Drive API**: PDF file access
   - **Google Maps API**: Route calculation and geocoding

2. **OpenWeatherMap API**
   - Weather forecasts and warnings
   - Location-based weather data

3. **Twilio**
   - SMS notifications for critical updates

### Core Functionality

1. **Email Processing Pipeline**
   - Automated Gmail monitoring
   - PDF schedule extraction
   - Background job processing

2. **Route Planning**
   - Google Maps integration
   - Optimal route calculation
   - Travel time estimation

3. **Calendar Management**
   - Automated calendar event creation
   - Alarm and reminder setup
   - Schedule conflict detection

4. **Weather Integration**
   - Location-based forecasts
   - Weather-aware scheduling

## Code Analysis Results

### Health Check Summary
✅ **All Tools Working Correctly**
- Language Server: TypeScript (v5.9.2)
- Analyzable Files: 203 files indexed
- Symbol Detection: Operational
- Pattern Search: 237 matches found
- Reference Finding: Operational

### File Statistics
- **Total TypeScript Files**: 203
- **Total Symbols Indexed**: Full project coverage
- **Cache Location**: `.serena/cache/typescript/`

## Development Patterns

### Backend Architecture Patterns

1. **Layered Architecture**
   - Controllers → Services → Repositories
   - Clear separation of concerns
   - Dependency injection pattern

2. **Error Handling**
   - Hierarchical error classes
   - Centralized error middleware
   - Structured logging with context

3. **Resilience Patterns**
   - Circuit breakers for external APIs
   - Retry logic with exponential backoff
   - Graceful degradation

4. **Caching Strategy**
   - Redis for API response caching
   - Route calculation optimization
   - Weather data caching

### Frontend Architecture Patterns

1. **Component Organization**
   - Atomic design principles
   - Reusable component library
   - Feature-based organization

2. **State Management**
   - Zustand for global state
   - React Hook Form for form state
   - Local state where appropriate

3. **API Communication**
   - Centralized service layer
   - Type-safe API calls
   - Error boundary implementation

## Testing Strategy

### Backend Testing (Jest)
- Unit tests for services and utilities
- Integration tests for API endpoints
- Repository tests with database mocking
- Coverage target: >80%

### Frontend Testing (Vitest)
- Component tests with React Testing Library
- Hook tests for custom React hooks
- Service layer tests for API functions

### E2E Testing (Playwright)
- Full application workflow tests
- Cross-browser compatibility
- Mobile viewport testing
- Automated backend/frontend startup

## Key Configuration Files

### Backend
- `backend/tsconfig.json` - TypeScript configuration
- `backend/prisma/schema.prisma` - Database schema
- `backend/package.json` - Dependencies and scripts

### Frontend
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/tailwind.config.js` - Tailwind CSS configuration
- `frontend/tsconfig.json` - TypeScript configuration

### Root Level
- `docker-compose.yml` - Local development services
- `package.json` - Monorepo scripts
- `playwright.config.ts` - E2E test configuration

## Build and Development Commands

### Root Level
```bash
npm run dev              # Start both backend and frontend
npm run build            # Build entire project
npm run test             # Run all tests
npm run lint             # Lint all code
npm run docker:up        # Start Docker services
npm run prisma:migrate   # Run database migrations
npm run test:e2e         # Run E2E tests
```

### Backend
```bash
npm run dev              # Start with nodemon
npm run dev:simple       # Start without Bull workers
npm run test             # Run Jest tests
npm run test:coverage    # Generate coverage report
npm run db:init          # Initialize database
npm run prisma:studio    # Open Prisma Studio
```

### Frontend
```bash
npm run dev              # Start Vite dev server
npm run build            # Production build
npm run test             # Run Vitest tests
npm run test:ui          # Open Vitest UI
```

## Critical Dependencies

### Backend Key Dependencies
- `@prisma/client` - Database ORM
- `express` - Web framework
- `googleapis` - Google API integration
- `bull` - Background job processing
- `redis` - Caching and job queues
- `jsonwebtoken` - JWT authentication
- `twilio` - SMS notifications
- `pdf-lib` - PDF processing
- `winston` - Structured logging

### Frontend Key Dependencies
- `react` - UI library
- `vite` - Build tool
- `zustand` - State management
- `react-hook-form` - Form handling
- `zod` - Schema validation
- `recharts` - Data visualization
- `tailwindcss` - Styling

## Database Schema

### Key Entities (Prisma)
- `User` - User accounts and authentication
- `ProcessedEmail` - Email processing history
- `ScheduleData` - Parsed schedule information
- `RoutePlan` - Calculated routes
- `WeatherData` - Weather forecasts
- `CalendarEvent` - Calendar integration
- `Notification` - Notification history

## Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Google OAuth 2.0 integration
- Secure token storage
- Role-based access control

### Data Protection
- Environment variable management
- Secrets encryption
- API key protection
- HTTPS enforcement

### External API Security
- Circuit breakers prevent API abuse
- Rate limiting on endpoints
- Timeout protection
- Error handling for API failures

## Performance Optimizations

### Backend Optimizations
- Redis caching for expensive operations
- Database query optimization with Prisma
- Background job processing for heavy tasks
- Connection pooling

### Frontend Optimizations
- Code splitting with Vite
- Lazy loading of components
- Optimized bundle size
- Fast refresh during development

## Monitoring and Observability

### Logging
- Winston for structured logging
- Request ID tracking
- Error tracking and alerting
- Log rotation and persistence

### Health Checks
- `/health` endpoint for basic health
- `/api/health` for API health with routes
- `/api/monitoring/*` for detailed metrics

## Next Steps for Development

### Recommended Development Workflow

1. **Setup Environment**
   ```bash
   npm install:all
   npm run docker:up
   npm run prisma:migrate
   ```

2. **Start Development**
   ```bash
   npm run dev
   ```

3. **Run Tests**
   ```bash
   npm run test
   npm run test:e2e
   ```

4. **Use Serena for Code Analysis**
   - Navigate to http://127.0.0.1:24283/dashboard/
   - Use semantic search tools
   - Leverage symbol-based code editing

### Key Areas for Serena Usage

1. **Code Navigation**
   - Use `find_symbol` to locate specific functions/classes
   - Use `get_symbols_overview` to understand file structure
   - Use `find_referencing_symbols` to track dependencies

2. **Refactoring**
   - Use `replace_symbol_body` for large changes
   - Use `replace_regex` for targeted edits
   - Use `insert_after_symbol` for additions

3. **Documentation**
   - Use `write_memory` to store important patterns
   - Use `read_memory` to retrieve stored knowledge
   - Use `onboarding` to understand new areas

## Serena Integration Status

✅ **Serena Configured**: TypeScript language server active  
✅ **Project Indexed**: 203 files with full symbol cache  
✅ **Tools Available**: 26 semantic tools ready  
✅ **Web Dashboard**: http://127.0.0.1:24283/dashboard/  
✅ **Memory System**: Project-specific knowledge storage enabled  

## Conclusion

StillOnTime is a well-architected, production-ready film schedule automation system with:
- **Clear separation of concerns** across backend, frontend, and testing
- **Comprehensive external integrations** with Google APIs, weather, and SMS
- **Robust error handling** and resilience patterns
- **Strong testing coverage** across unit, integration, and E2E tests
- **Modern tech stack** with TypeScript throughout
- **Performance optimizations** with caching and background processing

Serena is now fully configured and ready to assist with code analysis, refactoring, and development tasks across this TypeScript monorepo.
