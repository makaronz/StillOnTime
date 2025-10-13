# StillOnTime - One-Click Setup Guide

Complete automated setup system for the StillOnTime Film Schedule Automation System.

## 🚀 Quick Start (Recommended)

### For First-Time Setup

```bash
# 1. Validate your environment first
./scripts/validate-environment.sh

# 2. Run one-click setup (handles everything)
./scripts/one-click-setup.sh

# 3. Verify everything is working
./scripts/health-check.sh
```

That's it! The application should now be running at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

---

## 📋 Script Overview

### 1. `validate-environment.sh` - Pre-Flight Checks

**Purpose**: Validates your system is ready for setup before making any changes.

**What it checks**:
- ✅ Operating system compatibility (macOS, Linux)
- ✅ System resources (disk space, memory)
- ✅ Required software (Node.js ≥20, npm ≥9, Docker)
- ✅ Project structure (directories, config files)
- ✅ Port availability (3000, 3001, 5432, 6379)
- ✅ Network connectivity (npm registry, Docker Hub)

**Usage**:
```bash
./scripts/validate-environment.sh
```

**Exit codes**:
- `0` - All checks passed or passed with warnings
- `1` - Critical errors found, cannot proceed

**When to use**:
- Before first-time setup
- After system updates
- When troubleshooting issues
- In CI/CD pipelines

---

### 2. `one-click-setup.sh` - Complete Automated Setup

**Purpose**: Handles complete setup from zero to running application.

**What it does**:
1. ✅ Validates prerequisites (Node, npm, Docker)
2. ✅ Offers to auto-install missing dependencies (macOS with Homebrew)
3. ✅ Checks port availability
4. ✅ Installs all Node.js dependencies (root, backend, frontend)
5. ✅ Sets up environment files (.env)
6. ✅ Starts Docker services (PostgreSQL, Redis)
7. ✅ Initializes database with Prisma migrations
8. ✅ Builds backend and frontend
9. ✅ Runs tests (optional)
10. ✅ Starts the application
11. ✅ Performs health checks
12. ✅ Runs API tests (optional)

**Usage**:
```bash
./scripts/one-click-setup.sh
```

**Features**:
- **Rollback on Failure**: Automatically reverts changes if setup fails
- **Idempotent**: Safe to run multiple times
- **Colored Output**: Clear visual feedback
- **Detailed Logging**: Full logs saved to `setup-logs/setup-YYYYMMDD_HHMMSS.log`
- **Cross-Platform**: Works on macOS and Linux
- **Interactive Prompts**: Asks for confirmation on critical steps
- **Error Handling**: Comprehensive error detection and reporting

**What gets installed** (with permission):
- Node.js 20+ (macOS via Homebrew)
- Docker Desktop (macOS via Homebrew)

**Environment file handling**:
- Creates `.env` from `.env.example` if missing
- Offers to regenerate if `.env` exists
- Backs up existing files before overwriting

**Logs location**:
- Setup logs: `setup-logs/setup-YYYYMMDD_HHMMSS.log`
- Application output: `setup-logs/app-output.log`
- Application PID: `setup-logs/app.pid`

---

### 3. `health-check.sh` - Post-Startup Validation

**Purpose**: Comprehensive health checks after application startup.

**What it checks**:
- ✅ Application services (backend, frontend)
- ✅ Docker containers (PostgreSQL, Redis)
- ✅ Database schema and migrations
- ✅ File system (builds, logs, dependencies)
- ✅ Integration tests (frontend-backend-database)
- ✅ Resource usage (Docker stats, disk usage)

**Usage**:
```bash
./scripts/health-check.sh
```

**Health scoring**:
- **100%** - All systems healthy (green)
- **>80%** - Healthy with warnings (yellow)
- **<80%** - Critical issues (red)

**Exit codes**:
- `0` - All checks passed or passed with warnings
- `1` - Critical failures detected

**When to use**:
- After starting the application
- After deployments
- For monitoring and diagnostics
- In CI/CD health checks

**Detailed checks**:

1. **Application Services**
   - Backend API listening on port 3001
   - Health endpoint responding (HTTP 200)
   - Frontend serving on port 3000
   - Process information

2. **Docker Services**
   - PostgreSQL container running and healthy
   - Redis container running
   - Port accessibility
   - Connection tests

3. **Database Schema**
   - Tables exist
   - Prisma migrations applied
   - Connectivity from backend

4. **File System**
   - Build artifacts present
   - Log files status
   - Dependencies installed

5. **Integration Tests**
   - Backend-database connectivity
   - Frontend-backend integration
   - API endpoints responding

6. **Resource Usage**
   - Docker container stats (CPU, memory)
   - Project disk usage

---

## 🔄 Complete Setup Workflow

### First-Time Setup

```bash
# Step 1: Validate environment
./scripts/validate-environment.sh
# Fix any errors before continuing

# Step 2: Run one-click setup
./scripts/one-click-setup.sh
# Follow prompts for environment configuration

# Step 3: Verify health
./scripts/health-check.sh
# Should show 100% healthy
```

### After Setup

**Stop the application**:
```bash
./scripts/app-control.sh stop
```

**Start the application**:
```bash
./scripts/app-control.sh start
```

**Check status**:
```bash
./scripts/app-control.sh status
./scripts/health-check.sh
```

**Restart everything**:
```bash
./scripts/app-control.sh restart
```

---

## 🐛 Troubleshooting

### Setup Fails at Prerequisites

**Error**: "Node.js version X.X.X is too old (required: >=20.0.0)"

**Solution**:
```bash
# macOS with Homebrew
brew install node@20 && brew link node@20

# Or download from https://nodejs.org/
```

---

### Setup Fails at Docker Services

**Error**: "Docker daemon is not running"

**Solution**:
1. Start Docker Desktop
2. Wait for Docker to fully start
3. Run setup again: `./scripts/one-click-setup.sh`

---

### Setup Fails at Database Migrations

**Error**: "Migrate deploy failed"

**Solution**:
```bash
# Stop Docker services
npm run docker:down

# Remove Docker volumes (WARNING: deletes all data)
docker volume rm stillontime_postgres_data

# Run setup again
./scripts/one-click-setup.sh
```

---

### Port Already in Use

**Error**: "Port 3001 is already in use (required for Backend API)"

**Solution**:
```bash
# Find what's using the port
lsof -i :3001

# Kill the process (replace PID with actual PID from above)
kill -9 PID

# Or use app control
./scripts/app-control.sh stop
```

---

### Environment Files Missing

**Error**: "backend/.env not found"

**Solution**:
```bash
# Run environment setup
./scripts/create-env.sh

# Or manually copy from examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit with your credentials
nano backend/.env
```

---

### Health Check Fails

**Error**: "Backend health check: FAILED"

**Solution**:
```bash
# Check application logs
./scripts/app-control.sh logs

# Or check specific logs
cat setup-logs/app-output.log
cat backend/logs/error*.log

# Restart application
./scripts/app-control.sh restart

# Run health check again
./scripts/health-check.sh
```

---

## 📊 What Gets Created

### Directories
```
setup-logs/              # Setup and runtime logs
  setup-YYYYMMDD_HHMMSS.log  # Setup execution log
  app-output.log         # Application stdout/stderr
  app.pid                # Application process ID

backend/
  dist/                  # Built backend code
  node_modules/          # Backend dependencies
  logs/                  # Backend application logs

frontend/
  dist/                  # Built frontend code
  node_modules/          # Frontend dependencies
```

### Files
```
backend/.env             # Backend configuration
frontend/.env            # Frontend configuration
backend/.env.backup.*    # Backup of previous .env
```

### Docker
```
Containers:
  stillontime-postgres   # PostgreSQL 15
  stillontime-redis      # Redis 7

Volumes:
  postgres_data          # Database persistence
  redis_data             # Cache persistence

Networks:
  stillontime-network    # Internal network
```

---

## 🔧 Advanced Usage

### Automated/Unattended Setup

For CI/CD or automated environments:

```bash
#!/bin/bash

# Pre-create environment files
cat > backend/.env <<EOF
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -hex 32)
# ... other variables
EOF

cat > frontend/.env <<EOF
VITE_API_URL=http://localhost:3001
EOF

# Run setup with defaults (no prompts)
yes | ./scripts/one-click-setup.sh

# Verify
./scripts/health-check.sh
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "Setup successful!"
else
    echo "Setup failed!"
    cat setup-logs/setup-*.log
    exit 1
fi
```

### Cleanup and Reset

Complete cleanup for fresh start:

```bash
#!/bin/bash

# Stop everything
./scripts/app-control.sh stop
npm run docker:down

# Remove Docker volumes (WARNING: deletes all data)
docker volume rm stillontime_postgres_data stillontime_redis_data

# Remove build artifacts
rm -rf backend/dist frontend/dist

# Remove dependencies (optional)
rm -rf node_modules backend/node_modules frontend/node_modules
rm -f package-lock.json backend/package-lock.json frontend/package-lock.json

# Remove logs
rm -rf setup-logs backend/logs

# Start fresh
./scripts/one-click-setup.sh
```

---

## 📈 Monitoring

### Check Application Status

```bash
# Quick status check
./scripts/app-control.sh status

# Detailed health check
./scripts/health-check.sh

# View live logs
./scripts/app-control.sh logs

# Check Docker services
docker-compose ps
docker stats stillontime-postgres stillontime-redis
```

### Log Locations

```bash
# Setup logs
ls -lh setup-logs/

# Application logs
ls -lh backend/logs/

# Docker logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 🔐 Security Notes

### Environment Files

- ⚠️ **Never commit `.env` files to Git** (already in `.gitignore`)
- ✅ Always use strong JWT secrets (auto-generated are 64 chars)
- ✅ Change default database credentials for production
- ✅ Use different secrets for each environment

### Default Credentials

**PostgreSQL** (from docker-compose.yml):
- User: `stillontime_user`
- Password: `stillontime_password`
- Database: `stillontime_automation`

**⚠️ CHANGE THESE FOR PRODUCTION**

---

## 🎯 Integration with Other Scripts

The new setup scripts work alongside existing scripts:

### Existing Scripts (Still Useful)

- **`app-control.sh`** - Start/stop/status management after setup
- **`create-env.sh`** - Manual environment file creation
- **`test-apis.sh`** - API connectivity testing
- **`setup-api.sh`** - Interactive API setup guide

### Recommended Workflow

**Initial setup**: Use `one-click-setup.sh`
**Daily operation**: Use `app-control.sh`
**Troubleshooting**: Use `health-check.sh` + `app-control.sh logs`
**Validation**: Use `validate-environment.sh`

---

## 📚 Additional Documentation

- **API Setup**: See `scripts/README.md`
- **Interactive Guide**: See `claudedocs/INTERACTIVE_API_SETUP.md`
- **Main README**: See `README.md`

---

## ✅ Success Criteria

After successful setup, you should see:

```
╔══════════════════════════════════════════════════════════════════════╗
║                    ✅ Setup Successful!                             ║
╚══════════════════════════════════════════════════════════════════════╝

📍 Access URLs:
  Frontend:  http://localhost:3000
  Backend:   http://localhost:3001
  Health:    http://localhost:3001/health
```

And health check should show:

```
╔══════════════════════════════════════════════════════════════════════╗
║                  ✅ All systems healthy! (100%)                     ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

**Version**: 1.0.0
**Last Updated**: 2025-10-13
**Maintained By**: StillOnTime Development Team
