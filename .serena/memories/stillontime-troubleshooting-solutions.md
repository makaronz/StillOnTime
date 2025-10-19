# StillOnTime Troubleshooting & Solutions

## 🚨 Common Issues & Solutions

### 1. Database Connection Issues

#### Problem: "Database connection failed"
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Restart PostgreSQL
docker restart trad_ag_ai_postgres

# Check port configuration
lsof -i :5433
```

#### Solution: Port Configuration
```bash
# Update .env file
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5433/stillontime_dev

# Verify connection
docker exec trad_ag_ai_postgres psql -U stillontime_user -d stillontime_dev -c "SELECT 1;"
```

### 2. Backend TypeScript Errors

#### Problem: "TypeScript compilation failed"
```bash
# Check TypeScript errors
cd backend && npx tsc --noEmit

# Common fixes:
# - Add explicit return types
# - Fix import paths
# - Resolve type conflicts
```

#### Solution: Use Demo Backend
```bash
# Use working demo backend
cd backend && npm run dev:simple

# Full backend has TypeScript errors
# Demo backend works perfectly for development
```

### 3. Frontend Connection Issues

#### Problem: "Cannot connect to backend"
```bash
# Check backend status
curl http://localhost:3001/api/health

# Check frontend proxy
curl http://localhost:3000/api/health
```

#### Solution: Proxy Configuration
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

### 4. Docker Container Issues

#### Problem: "Container not running"
```bash
# Check container status
docker ps -a

# Restart containers
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs postgres
docker-compose logs redis
```

#### Solution: Container Management
```bash
# Start specific services
npm run docker:up

# Stop services
npm run docker:down

# Rebuild containers
docker-compose build --no-cache
```

## 🔧 Development Issues

### 1. Port Conflicts

#### Problem: "Port already in use"
```bash
# Check port usage
lsof -i :3000
lsof -i :3001
lsof -i :5433

# Kill processes
pkill -f "npm run dev"
pkill -f "ts-node"
```

#### Solution: Process Management
```bash
# Kill all Node processes
pkill -f node

# Restart services
npm run dev
```

### 2. Environment Variables

#### Problem: "Environment variable not found"
```bash
# Check .env file
cat .env

# Verify variables
echo $DATABASE_URL
echo $JWT_SECRET
```

#### Solution: Environment Setup
```bash
# Copy example environment
cp .env.example .env

# Update with actual values
nano .env
```

### 3. Database Migration Issues

#### Problem: "Migration failed"
```bash
# Check database permissions
docker exec trad_ag_ai_postgres psql -U postgres -c "GRANT ALL ON SCHEMA public TO stillontime_user;"

# Run migration manually
docker exec trad_ag_ai_postgres psql -U postgres -d stillontime_dev -f /tmp/schema.sql
```

#### Solution: Permission Fix
```sql
-- Grant all permissions
GRANT ALL PRIVILEGES ON DATABASE stillontime_dev TO stillontime_user;
GRANT ALL ON SCHEMA public TO stillontime_user;
GRANT CREATE ON SCHEMA public TO stillontime_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stillontime_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stillontime_user;
```

## 🧪 Testing Issues

### 1. Test Failures

#### Problem: "Tests are failing"
```bash
# Run tests with verbose output
npm run test -- --verbose

# Check specific test
npm run test -- --testNamePattern="specific test"
```

#### Solution: Test Debugging
```bash
# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- src/services/email.service.test.ts
```

### 2. E2E Test Issues

#### Problem: "Playwright tests failing"
```bash
# Check browser installation
npx playwright install

# Run tests in headed mode
npm run test:e2e:headed
```

#### Solution: E2E Configuration
```bash
# Install browsers
npx playwright install

# Run specific test
npx playwright test tests/login.spec.ts
```

## 🔒 Security Issues

### 1. OAuth Configuration

#### Problem: "OAuth not working"
```bash
# Check Google OAuth setup
# Verify client ID and secret
# Check redirect URIs
```

#### Solution: OAuth Setup
```typescript
// Verify OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/callback'
);
```

### 2. JWT Token Issues

#### Problem: "JWT token invalid"
```bash
# Check JWT secret
echo $JWT_SECRET

# Verify token format
# Check expiration time
```

#### Solution: JWT Configuration
```typescript
// JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
  issuer: 'stillontime'
};
```

## 📊 Performance Issues

### 1. Slow API Responses

#### Problem: "API responses slow"
```bash
# Check database queries
# Monitor Redis cache
# Check external API calls
```

#### Solution: Performance Optimization
```typescript
// Add caching
const cached = await redis.get(`route:${routeId}`);
if (cached) return JSON.parse(cached);

// Use circuit breaker
const result = await circuitBreaker.execute(() => {
  return externalService.call();
});
```

### 2. Memory Issues

#### Problem: "High memory usage"
```bash
# Check memory usage
ps aux | grep node

# Monitor heap usage
node --inspect src/index.ts
```

#### Solution: Memory Management
```typescript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  logger.info('Memory usage', usage);
}, 60000);
```

## 🚀 Deployment Issues

### 1. Production Build

#### Problem: "Build failed"
```bash
# Check TypeScript errors
npm run build

# Check environment variables
# Verify all dependencies
```

#### Solution: Build Configuration
```bash
# Clean build
rm -rf dist/
npm run build

# Check build output
ls -la dist/
```

### 2. Docker Build Issues

#### Problem: "Docker build failed"
```bash
# Check Dockerfile
# Verify base image
# Check build context
```

#### Solution: Docker Configuration
```dockerfile
# Use specific Node version
FROM node:18-alpine

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build
```

## 🔍 Debugging Tools

### 1. Logging
```typescript
// Structured logging
logger.info('Operation started', { 
  operation: 'email_processing',
  userId: user.id,
  timestamp: new Date().toISOString()
});
```

### 2. Monitoring
```typescript
// Health checks
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    database: await checkDatabase(),
    redis: await checkRedis(),
    external: await checkExternalAPIs()
  };
  res.json(health);
});
```

### 3. Error Tracking
```typescript
// Error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { 
    error: error.message,
    stack: error.stack,
    context: 'operation_name'
  });
  throw new BusinessLogicError('Operation failed', error);
}
```