# 🚀 StillOnTime - Quick Start

## New One-Click Setup (Recommended)

```bash
# Complete automated setup (handles everything)
./scripts/one-click-setup.sh
```

**That's it!** This single command will:
- ✅ Check all prerequisites
- ✅ Install dependencies
- ✅ Setup environment files
- ✅ Start Docker services
- ✅ Initialize database
- ✅ Build projects
- ✅ Start application
- ✅ Run health checks

**Access URLs after setup:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health: http://localhost:3001/health

---

## Optional Pre-Flight Check

```bash
# Validate environment before setup (optional)
./scripts/validate-environment.sh
```

---

## Daily Operations

```bash
# Start application
./scripts/app-control.sh start

# Stop application
./scripts/app-control.sh stop

# Check status
./scripts/app-control.sh status

# View logs
./scripts/app-control.sh logs

# Restart everything
./scripts/app-control.sh restart
```

---

## Health Monitoring

```bash
# Comprehensive health check
./scripts/health-check.sh
```

---

## Troubleshooting

### Application not starting?
```bash
# Check what's wrong
./scripts/health-check.sh

# View detailed logs
cat setup-logs/app-output.log
./scripts/app-control.sh logs
```

### Port conflicts?
```bash
# Find what's using port 3001 (backend)
lsof -i :3001

# Stop everything
./scripts/app-control.sh stop
npm run docker:down
```

### Need fresh start?
```bash
# Complete reset
./scripts/app-control.sh stop
npm run docker:down
docker volume rm stillontime_postgres_data stillontime_redis_data
rm -rf backend/dist frontend/dist

# Setup again
./scripts/one-click-setup.sh
```

---

## Script Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `one-click-setup.sh` | Complete automated setup | First-time setup, reset |
| `validate-environment.sh` | Pre-flight validation | Before setup, troubleshooting |
| `health-check.sh` | Post-startup validation | After startup, monitoring |
| `app-control.sh` | Start/stop/status | Daily operations |
| `create-env.sh` | Manual env setup | Custom configuration |
| `test-apis.sh` | API testing | Verify external APIs |

---

## Need Help?

📚 **Detailed Documentation:**
- Setup Guide: `scripts/README-SETUP.md`
- API Setup: `scripts/README.md`
- Main README: `README.md`

🐛 **Common Issues:**
- Docker not running → Start Docker Desktop
- Port in use → `./scripts/app-control.sh stop`
- Missing .env → `./scripts/create-env.sh`
- Health check fails → Check logs in `setup-logs/`

---

**Version**: 1.0.0 | **Last Updated**: 2025-10-13
