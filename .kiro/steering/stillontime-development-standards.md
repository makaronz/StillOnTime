---
inclusion: always
---

# StillOnTime Film Schedule Automation - Development Standards

## Code Standards and Best Practices

### TypeScript Development

- Use strict TypeScript configuration with `noImplicitAny` and `strictNullChecks`
- Prefer interfaces over types for object shapes
- Use proper error handling with custom error classes
- Implement proper logging with structured data
- Follow functional programming principles where applicable

### API Development Standards

- Use RESTful API design principles
- Implement proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Use consistent error response format:

```typescript
interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  path: string;
}
```

### OAuth 2.0 Security Standards

- Always use HTTPS in production
- Implement PKCE (Proof Key for Code Exchange) for OAuth flows
- Store tokens securely with encryption
- Implement proper token refresh mechanisms
- Use minimal required scopes for Google APIs
- Implement proper session management with JWT

### Database Standards

- Use Prisma migrations for all schema changes
- Implement proper indexing for query performance
- Use transactions for multi-table operations
- Follow naming conventions: camelCase for fields, PascalCase for models
- Implement soft deletes where appropriate

### Error Handling Standards

- Use custom error classes with proper inheritance
- Implement exponential backoff for API retries
- Log all errors with context and stack traces
- Provide user-friendly error messages
- Implement circuit breaker pattern for external APIs

### Testing Standards

- Maintain minimum 80% code coverage
- Use Jest for unit and integration tests
- Mock external API calls in tests
- Test OAuth flows with test tokens
- Implement end-to-end tests for critical paths

### Performance Standards

- Implement caching for frequently accessed data
- Use background jobs for heavy processing
- Optimize database queries with proper indexing
- Implement rate limiting for API endpoints
- Monitor and log performance metrics

### Security Standards

- Validate and sanitize all user inputs
- Implement proper CORS configuration
- Use helmet.js for security headers
- Implement rate limiting per user
- Regular security audits of dependencies
- Encrypt sensitive data at rest

## StillOnTime-Specific Business Logic

### Email Processing Rules

- Only process emails with schedule keywords in subject
- Validate sender domains against whitelist
- Require PDF attachment for processing
- Implement duplicate detection using message ID and PDF hash
- Process emails every 5 minutes maximum

### Schedule Data Validation

- Shooting date must be in YYYY-MM-DD format
- Call time must be in HH:MM 24-hour format
- Location must be geocodable address
- Scene type must be 'INT' or 'EXT'
- Validate extracted data confidence scores

### Route Calculation Rules

- Always calculate Dom→Panavision→Location route
- Apply standard buffers: 15min car change, 10min parking, 10min entry, 20min traffic, 45min morning routine
- Use real-time traffic data when available
- Validate wake-up time is not before 4:00 AM
- Provide alternative routes when possible

### Calendar Integration Rules

- Event title format: "StillOnTime — Dzień zdjęciowy (location)"
- Set event duration: departure time to call_time + 10 hours
- Create 3 alarms: wake_up-10min, wake_up, wake_up+5min
- Set reminders: -12h, -3h, -1h, departure time
- Include comprehensive description with all details

### Weather Integration Rules

- Fetch weather for EXT shoots (detailed), INT shoots (basic)
- Generate warnings for: temp <0°C or >30°C, precipitation >0mm, wind >10m/s
- Update weather data 24 hours before shooting
- Cache weather data for 24 hours
- Provide fallback when weather API unavailable

## File Organization

### Backend Structure

```
backend/
├── src/
│   ├── controllers/     # API route handlers
│   ├── services/        # Business logic services
│   ├── repositories/    # Data access layer
│   ├── middleware/      # Express middleware
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── config/         # Configuration files
│   └── jobs/           # Background job processors
├── prisma/             # Database schema and migrations
├── tests/              # Test files
└── docker/             # Docker configuration
```

### Frontend Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API service functions
│   ├── stores/         # Zustand state stores
│   ├── types/          # TypeScript interfaces
│   ├── utils/          # Utility functions
│   └── styles/         # Global styles and Tailwind config
├── public/             # Static assets
└── tests/              # Frontend tests
```

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/stillontime_automation"
REDIS_URL="redis://localhost:6379"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/callback"

# External APIs
OPENWEATHER_API_KEY="your-openweather-api-key"
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# Application
JWT_SECRET="your-jwt-secret"
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
```

## Deployment Guidelines

### Development Environment

- Use Docker Compose for local development
- Hot reloading for both frontend and backend
- Use test databases with sample data
- Mock external APIs when possible

### Production Environment

- Use environment-specific configuration
- Implement proper logging and monitoring
- Use HTTPS for all communications
- Implement proper backup strategies
- Use connection pooling for database
- Implement health checks for all services

## Monitoring and Logging

### Logging Standards

- Use structured logging with Winston
- Log levels: error, warn, info, debug
- Include request IDs for tracing
- Log all OAuth flows and API calls
- Implement log rotation and retention

### Monitoring Requirements

- Monitor API response times
- Track OAuth token refresh rates
- Monitor email processing success rates
- Track calendar event creation success
- Monitor external API usage and quotas
- Implement alerting for critical failures
