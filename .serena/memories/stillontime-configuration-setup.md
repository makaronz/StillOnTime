# StillOnTime Configuration & Setup Guide

## 🚀 Quick Start Commands

### Development Environment
```bash
# Start everything (recommended)
npm run dev

# Individual services
cd backend && npm run dev:simple    # Demo backend (port 3001)
cd frontend && npm run dev          # Frontend (port 3000)

# Database services
npm run docker:up                   # PostgreSQL + Redis
```

### Database Setup
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Access database
docker exec trad_ag_ai_postgres psql -U stillontime_user -d stillontime_dev

# Run migrations
docker exec trad_ag_ai_postgres psql -U postgres -d stillontime_dev -f /tmp/schema.sql
```

## 🔧 Configuration Files

### Environment Variables (.env)
```bash
# Database Configuration
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5433/stillontime_dev
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# JWT Configuration
JWT_SECRET=your-jwt-secret

# CodeNet RAG
QDRANT_URL=http://localhost:6333
CODENET_ENABLE_RAG=true
```

### Backend Configuration
```typescript
// backend/src/config/config.ts
export const config = {
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
  },
  redis: {
    url: process.env.REDIS_URL
  },
  apis: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
  }
};
```

### Frontend Configuration
```typescript
// frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

## 🗄️ Database Configuration

### PostgreSQL Setup
```sql
-- Create database
CREATE DATABASE stillontime_dev;

-- Create user
CREATE USER stillontime_user WITH PASSWORD 'stillontime_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE stillontime_dev TO stillontime_user;
GRANT ALL ON SCHEMA public TO stillontime_user;
GRANT CREATE ON SCHEMA public TO stillontime_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stillontime_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stillontime_user;
```

### Kysely Configuration
```typescript
// backend/src/config/database.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }),
  }),
});
```

## 🔒 Security Configuration

### OAuth 2.0 Setup
```typescript
// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/callback'
);

// PKCE flow
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');
```

### JWT Configuration
```typescript
// JWT token configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
  issuer: 'stillontime',
  audience: 'stillontime-users'
};
```

## 🧪 Testing Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Playwright Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## 📊 Monitoring Configuration

### Health Check Endpoints
```typescript
// Health check configuration
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      external: await checkExternalAPIs()
    }
  };
  res.json(health);
});
```

### Logging Configuration
```typescript
// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

## 🚀 Deployment Configuration

### Docker Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: stillontime_dev
      POSTGRES_USER: stillontime_user
      POSTGRES_PASSWORD: stillontime_password
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
```

### Production Environment
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/stillontime
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=production-jwt-secret
LOG_LEVEL=warn
```

## 🔧 Development Tools

### VS Code Configuration
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.suggest.autoImports": true
}
```

### Git Configuration
```bash
# Git hooks for quality
npm install --save-dev husky lint-staged

# Pre-commit hooks
npx husky add .husky/pre-commit "npm run lint-staged"
```

## 📱 Mobile Configuration

### React Native Setup
```bash
# Mobile development
cd mobile && npm install
npx react-native run-ios
npx react-native run-android
```

### Mobile Environment
```typescript
// mobile/src/config/environment.ts
export const config = {
  apiUrl: __DEV__ 
    ? 'http://localhost:3001/api' 
    : 'https://api.stillontime.com',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
};
```