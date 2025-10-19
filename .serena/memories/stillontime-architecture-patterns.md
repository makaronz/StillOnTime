# StillOnTime Architecture Patterns

## 🏗️ System Architecture

### Monorepo Structure
```
StillOnTime/
├── backend/           # Node.js/TypeScript API
├── frontend/          # React/TypeScript UI
├── e2e-tests/         # Playwright tests
├── docs/             # Documentation
└── .hive-mind/       # Hive-mind coordination
```

### Backend Architecture
```
backend/src/
├── controllers/       # API route handlers
├── services/         # Business logic layer
├── middleware/       # Express middleware (auth, errors, logging)
├── models/          # Data models and types
├── utils/           # Utilities (circuit-breaker, retry, logger)
├── repositories/     # Data access layer (Kysely)
├── routes/          # API route definitions
└── types/           # TypeScript type definitions
```

### Frontend Architecture
```
frontend/src/
├── components/       # React components
├── pages/           # Route-level page components
├── stores/          # Zustand state management
├── services/        # API calls and business logic
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
└── types/           # TypeScript interfaces
```

## 🔧 Key Patterns

### 1. Error Handling Hierarchy
```typescript
// Hierarchical error classes
throw new APIError('External service failed', 503, originalError);
throw new BusinessLogicError('Invalid schedule data', originalError);
throw new ValidationError('Required field missing: startTime');
```

### 2. Circuit Breaker Pattern
```typescript
import { circuitBreaker } from '../utils/circuit-breaker';

const result = await circuitBreaker.execute(() => {
  return externalService.call();
});
```

### 3. Retry Logic with Decorator
```typescript
import { withRetry } from '../utils/retry';

@withRetry({ maxAttempts: 3, backoff: 'exponential' })
async function unstableOperation(): Promise<Result> {
  return await externalService.call();
}
```

### 4. Structured Logging
```typescript
import { logger } from '../utils/logger';

logger.info('Email processing started', { 
  emailId, 
  userId, 
  processingType: 'schedule_extraction' 
});
```

## 🗄️ Database Patterns

### Kysely Query Builder
```typescript
// Type-safe database queries
const users = await db
  .selectFrom('users')
  .select(['id', 'email', 'name'])
  .where('active', '=', true)
  .execute();
```

### Repository Pattern
```typescript
// Data access layer
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }
}
```

## 🔄 State Management

### Zustand Store Pattern
```typescript
interface AppState {
  user: User | null;
  config: Config;
  setUser: (user: User) => void;
  setConfig: (config: Config) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  config: defaultConfig,
  setUser: (user) => set({ user }),
  setConfig: (config) => set({ config }),
}));
```

## 🧪 Testing Patterns

### TDD Approach
```typescript
// 1. Write failing test
describe('EmailService', () => {
  it('should process email within 2 minutes', async () => {
    const start = Date.now();
    await emailService.processEmail(emailId);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(120000); // 2 minutes
  });
});

// 2. Implement minimal code
// 3. Refactor while keeping tests green
```

### Test Structure
```typescript
// Unit tests: services, utilities
// Integration tests: API, database
// E2E tests: Playwright automation
```

## 🚀 Performance Patterns

### Caching Strategy
```typescript
// Redis caching with TTL
const cached = await redis.get(`route:${routeId}`);
if (cached) return JSON.parse(cached);

const result = await calculateRoute(routeId);
await redis.setex(`route:${routeId}`, 3600, JSON.stringify(result));
```

### Queue Processing
```typescript
// Bull queue for background jobs
const emailQueue = new Bull('email processing');
emailQueue.process('extract-schedule', emailProcessor);
```

## 🔒 Security Patterns

### OAuth 2.0 PKCE
```typescript
// Google OAuth with PKCE
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  code_challenge: codeChallenge,
  code_challenge_method: 'S256'
});
```

### JWT Authentication
```typescript
// JWT token validation
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

## 📊 Monitoring Patterns

### Health Checks
```typescript
// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      external: await checkExternalAPIs()
    }
  });
});
```

### Metrics Collection
```typescript
// Performance metrics
const metrics = {
  emailProcessingTime: Date.now() - startTime,
  queueSize: await emailQueue.getWaiting(),
  errorRate: errors / totalRequests
};
```