# One-Click Startup - Edge Cases & Error Scenarios

**Version**: 1.0.0
**Date**: 2025-01-13
**Purpose**: Document edge cases, error scenarios, and recovery procedures

---

## Edge Case Catalog

### 1. Port Conflicts

#### Scenario
Backend or frontend port already in use by another process.

#### Detection
```bash
# Check if port is in use
lsof -i :3001  # Backend
lsof -i :3000  # Frontend
```

#### Test Coverage
```typescript
test('should handle port already in use gracefully', async () => {
  const portInUse = await isPortInUse(BACKEND_PORT);

  if (portInUse) {
    // Should provide clear error message
    expect(errorMessage).toContain('already running');
    expect(errorMessage).toContain('restart');
  }
});
```

#### Recovery Procedure
1. Identify process using port: `lsof -ti :3001`
2. Stop conflicting process: `kill -9 <PID>`
3. Retry startup: `./scripts/app-control.sh start`

#### User-Facing Error
```
⚠️  Application appears to be running!
  Backend:  ✅ RUNNING (PID: 12345, Port: 3001)
  Frontend: ✅ RUNNING (PID: 12346, Port: 3000)

Stop and restart? (y/n):
```

---

### 2. Missing Environment Variables

#### Scenario
Required .env variables not set or .env file missing entirely.

#### Detection
```bash
# Check for .env file
[ -f "backend/.env" ] && echo "Found" || echo "Missing"

# Check for required variables
grep -q "DATABASE_URL" backend/.env || echo "DATABASE_URL missing"
```

#### Test Coverage
```typescript
test('should handle missing environment variables gracefully', () => {
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];

  requiredVars.forEach(varName => {
    expect(envContent).toContain(varName);
  });
});
```

#### Recovery Procedure
1. Run env creation script: `./scripts/create-env.sh`
2. Verify all required variables: `./scripts/test-apis.sh`
3. Restart application: `./scripts/app-control.sh start`

#### User-Facing Error
```
❌ backend/.env not found!
   Run: ./scripts/create-env.sh

Required Variables:
  • DATABASE_URL
  • REDIS_URL
  • JWT_SECRET
  • GOOGLE_CLIENT_ID
  • GOOGLE_CLIENT_SECRET
  • OPENWEATHER_API_KEY
  • GOOGLE_MAPS_API_KEY
```

---

### 3. Docker Not Running

#### Scenario
Docker Desktop not started or Docker daemon not accessible.

#### Detection
```bash
# Check if Docker is running
docker ps >/dev/null 2>&1 || echo "Docker not running"
```

#### Test Coverage
```typescript
test('should handle Docker not running scenario', () => {
  try {
    execCommand('docker ps');
    expect(true).toBe(true);
  } catch (error) {
    expect(error).toBeDefined();
    expect(errorMessage).toContain('Docker');
  }
});
```

#### Recovery Procedure
1. Start Docker Desktop application
2. Wait for Docker to be fully started (may take 30-60 seconds)
3. Verify: `docker ps`
4. Retry startup: `./scripts/app-control.sh start`

#### User-Facing Error
```
❌ Docker is not running!

Please start Docker Desktop:
  • macOS: Open Docker.app from Applications
  • Linux: sudo systemctl start docker
  • Windows: Start Docker Desktop from Start Menu

Then retry: ./scripts/app-control.sh start
```

---

### 4. Database Connection Failure

#### Scenario
PostgreSQL container running but database not accessible.

#### Detection
```bash
# Check PostgreSQL container
docker ps | grep stillontime-postgres

# Test database connection
psql postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation -c "SELECT 1"
```

#### Test Coverage
```typescript
test('should verify database connectivity', async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const result = await pool.query('SELECT NOW()');
    expect(result.rows).toBeDefined();
  } finally {
    await pool.end();
  }
});
```

#### Recovery Procedure
1. Check container status: `docker ps -a | grep stillontime-postgres`
2. Restart container: `docker restart stillontime-postgres`
3. Check logs: `docker logs stillontime-postgres`
4. If corrupted, recreate: `npm run docker:down && npm run docker:up`
5. Re-initialize: `cd backend && npm run db:init`

#### User-Facing Error
```
❌ Database connection failed!

Container Status: RUNNING
Connection: REFUSED

Troubleshooting:
  1. Check container logs: docker logs stillontime-postgres
  2. Restart container: docker restart stillontime-postgres
  3. Verify credentials in .env file
  4. Re-initialize: cd backend && npm run db:init
```

---

### 5. Redis Connection Failure

#### Scenario
Redis container running but connection fails.

#### Detection
```bash
# Check Redis container
docker ps | grep stillontime-redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

#### Test Coverage
```typescript
test('should handle Redis connection failure', async () => {
  const redisClient = createClient({
    url: process.env.REDIS_URL
  });

  try {
    await redisClient.connect();
    await redisClient.ping();
    expect(true).toBe(true);
  } catch (error) {
    expect(error).toBeDefined();
  } finally {
    await redisClient.quit();
  }
});
```

#### Recovery Procedure
1. Check container: `docker ps | grep stillontime-redis`
2. Restart: `docker restart stillontime-redis`
3. Check logs: `docker logs stillontime-redis`
4. If fails, recreate: `docker-compose down && docker-compose up -d`

#### User-Facing Error
```
⚠️  Redis connection failed!

Container Status: RUNNING
Connection: REFUSED

Quick Fix:
  docker restart stillontime-redis

Full Reset:
  docker-compose down
  docker-compose up -d
```

---

### 6. API Key Not Activated

#### Scenario
Google Maps or OpenWeather API keys not yet activated after creation.

#### Detection
```bash
# Test OpenWeather API
curl "https://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY"

# Test Google Maps API
curl "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=$GOOGLE_MAPS_API_KEY"
```

#### Test Coverage
```typescript
test('should handle API key activation delay', async () => {
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${apiKey}`
    );
    expect(response.status).toBe(200);
  } catch (error) {
    if (error.response?.status === 401) {
      expect(error.response.data).toContain('invalid api key');
    }
  }
});
```

#### Recovery Procedure
1. Wait for activation (Google: 5-10 minutes, OpenWeather: up to 2 hours)
2. Test again: `./scripts/test-apis.sh`
3. Verify API enabled in console:
   - Google: https://console.cloud.google.com/apis/library
   - OpenWeather: https://home.openweathermap.org/api_keys

#### User-Facing Error
```
❌ OpenWeather API: FAIL (HTTP 401)
   💡 Tip: New keys take up to 2 hours to activate

❌ Google Maps API: FAIL (HTTP 403)
   💡 Tip: Wait 5-10 minutes after key creation
   💡 Tip: Check if Geocoding API is enabled

Please wait for activation, then retest:
  ./scripts/test-apis.sh
```

---

### 7. Network Connectivity Issues

#### Scenario
No internet connection or firewall blocking external API calls.

#### Detection
```bash
# Test internet connectivity
curl -I https://www.google.com --connect-timeout 5

# Test specific APIs
curl -I https://api.openweathermap.org --connect-timeout 5
```

#### Test Coverage
```typescript
test('should handle network connectivity issues', async () => {
  try {
    await axios.get('http://localhost:9999/nonexistent', {
      timeout: 1000
    });
  } catch (error) {
    expect(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT']).toContain(error.code);
  }
});
```

#### Recovery Procedure
1. Check internet: `ping google.com`
2. Check firewall settings
3. Test with curl: `curl -v https://api.openweathermap.org`
4. If corporate network, configure proxy
5. Retry: `./scripts/test-apis.sh`

#### User-Facing Error
```
❌ Network connectivity issue detected!

Could not reach:
  • api.openweathermap.org
  • maps.googleapis.com

Troubleshooting:
  1. Check internet connection: ping google.com
  2. Check firewall settings
  3. Corporate network? Configure proxy in .env:
     HTTP_PROXY=http://proxy.company.com:8080
     HTTPS_PROXY=http://proxy.company.com:8080
```

---

### 8. Insufficient Disk Space

#### Scenario
Not enough disk space for Docker volumes or application data.

#### Detection
```bash
# Check disk space
df -h

# Check Docker space usage
docker system df
```

#### Test Coverage
```typescript
test('should warn on low disk space', () => {
  const { stdout } = execSync('df -h /');
  const match = stdout.match(/(\d+)%/);
  const usage = parseInt(match[1]);

  if (usage > 90) {
    console.warn('Low disk space detected');
  }
});
```

#### Recovery Procedure
1. Check space: `df -h`
2. Clean Docker: `docker system prune -a`
3. Clean npm cache: `npm cache clean --force`
4. Clean old logs: `rm -rf backend/logs/*.log`
5. Retry startup

#### User-Facing Error
```
⚠️  Low disk space detected!

Available: 2.3 GB
Recommended: 10+ GB

Clean up space:
  docker system prune -a     # Clean Docker
  npm cache clean --force    # Clean npm
  rm -rf backend/logs/*.log  # Clean logs

Then retry: ./scripts/app-control.sh start
```

---

### 9. Permission Denied Errors

#### Scenario
Scripts lack execute permissions or files not writable.

#### Detection
```bash
# Check script permissions
ls -la scripts/*.sh

# Check file permissions
ls -la backend/.env
```

#### Test Coverage
```typescript
test('should handle permission errors gracefully', () => {
  const scripts = [
    'app-control.sh',
    'create-env.sh',
    'setup-api.sh',
    'test-apis.sh'
  ];

  scripts.forEach(script => {
    expect(existsSync(`scripts/${script}`)).toBe(true);
  });
});
```

#### Recovery Procedure
1. Make scripts executable:
   ```bash
   chmod +x scripts/*.sh
   ```

2. Fix .env permissions:
   ```bash
   chmod 600 backend/.env
   chmod 600 .env
   ```

3. Fix directory permissions:
   ```bash
   chmod 755 backend
   chmod 755 frontend
   ```

4. Retry startup

#### User-Facing Error
```
❌ Permission denied: ./scripts/app-control.sh

Fix permissions:
  chmod +x scripts/*.sh      # Make scripts executable
  chmod 600 backend/.env     # Secure .env files

Then retry: ./scripts/app-control.sh start
```

---

### 10. Conflicting Node Versions

#### Scenario
Installed Node.js version doesn't meet requirements.

#### Detection
```bash
# Check Node version
node --version

# Check required version
grep "node" package.json | grep "engines"
```

#### Test Coverage
```typescript
test('should validate Node.js version', () => {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);

  expect(major).toBeGreaterThanOrEqual(20);
});
```

#### Recovery Procedure
1. Check version: `node --version`
2. Install required version (>=20.0.0):
   - Using nvm: `nvm install 20 && nvm use 20`
   - Using brew: `brew install node@20`
   - Direct download: https://nodejs.org/
3. Verify: `node --version`
4. Reinstall dependencies: `npm install`
5. Retry startup

#### User-Facing Error
```
❌ Node.js version mismatch!

Current:  v18.12.0
Required: >=20.0.0

Install Node.js 20+:
  • Using nvm:  nvm install 20 && nvm use 20
  • Using brew: brew install node@20
  • Direct:     https://nodejs.org/

Then reinstall:
  npm install
  ./scripts/app-control.sh start
```

---

## Recovery Workflow

### General Recovery Steps

1. **Stop Everything**
   ```bash
   ./scripts/app-control.sh stop
   npm run docker:down
   ```

2. **Check System Requirements**
   ```bash
   node --version    # Should be >=20.0.0
   docker --version  # Should be installed
   npm --version     # Should be >=9.0.0
   ```

3. **Verify Environment**
   ```bash
   ./scripts/test-apis.sh
   ```

4. **Clean Start**
   ```bash
   npm run docker:up
   ./scripts/app-control.sh start
   ```

5. **Check Status**
   ```bash
   ./scripts/app-control.sh status
   ```

---

## Troubleshooting Decision Tree

```
Is application starting?
├─ No
│  ├─ Docker running? → No → Start Docker Desktop
│  ├─ .env exists? → No → Run ./scripts/create-env.sh
│  ├─ Ports free? → No → Stop conflicting processes
│  └─ Try: ./scripts/app-control.sh start
│
└─ Yes, but services failing
   ├─ Database fails? → Check PostgreSQL container
   ├─ Redis fails? → Check Redis container
   ├─ API fails? → Check API keys with test-apis.sh
   └─ Try: ./scripts/app-control.sh restart
```

---

## Test Execution for Edge Cases

```bash
# Run all edge case tests
npm test -- --testNamePattern="Edge Cases"

# Run specific edge case
npm test -- --testNamePattern="port already in use"

# Run with verbose output
npm test -- --testNamePattern="Edge Cases" --verbose
```

---

## Monitoring & Logging

### Log Locations

- **Backend logs**: `backend/logs/`
- **Frontend logs**: Browser console
- **Docker logs**: `docker logs stillontime-postgres`
- **System logs**: `./scripts/app-control.sh logs`

### Diagnostic Commands

```bash
# Full system check
./scripts/app-control.sh status

# Docker services
docker ps -a

# API connectivity
./scripts/test-apis.sh

# Database check
cd backend && npm run db:test

# Backend health
curl http://localhost:3001/health
```

---

## Escalation Path

If edge cases persist after following recovery procedures:

1. **Collect Diagnostic Information**
   ```bash
   ./scripts/app-control.sh status > diagnostic-output.txt
   docker ps -a >> diagnostic-output.txt
   docker logs stillontime-postgres >> diagnostic-output.txt
   docker logs stillontime-redis >> diagnostic-output.txt
   ```

2. **Check Documentation**
   - Review `docs/ONE_CLICK_STARTUP_TEST_REPORT.md`
   - Check `README.md` for setup instructions
   - Review `claudedocs/INTERACTIVE_API_SETUP.md`

3. **Reset to Clean State**
   ```bash
   ./scripts/app-control.sh stop
   npm run docker:down
   rm backend/.env .env
   ./scripts/setup-api.sh
   ```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-13
**Next Review**: 2025-02-13
