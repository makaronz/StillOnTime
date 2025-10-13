#!/bin/bash

# StillOnTime - Comprehensive Health Check Script
# Post-startup validation and monitoring

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=3000
POSTGRES_PORT=5432
REDIS_PORT=6379

# Paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging functions
log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}═══ $1 ═══${NC}"
    echo ""
}

log_check() {
    ((TOTAL_CHECKS++))
    echo -e "${BLUE}→${NC} Checking $1..."
}

log_pass() {
    ((PASSED_CHECKS++))
    echo -e "  ${GREEN}✅ HEALTHY:${NC} $1"
}

log_fail() {
    ((FAILED_CHECKS++))
    echo -e "  ${RED}❌ FAILED:${NC} $1"
}

log_warn() {
    ((WARNING_CHECKS++))
    echo -e "  ${YELLOW}⚠️  WARNING:${NC} $1"
}

log_info() {
    echo -e "  ${BLUE}ℹ️  INFO:${NC} $1"
}

# Check if port is responding
check_port() {
    local port=$1
    lsof -i :$port >/dev/null 2>&1
}

# Get process info for port
get_port_info() {
    local port=$1
    lsof -i :$port 2>/dev/null | tail -1
}

# HTTP health check with timeout
http_check() {
    local url=$1
    local timeout=${2:-5}
    curl -s --max-time $timeout "$url" 2>/dev/null
}

# HTTP status code check
http_status() {
    local url=$1
    local timeout=${2:-5}
    curl -s -o /dev/null -w "%{http_code}" --max-time $timeout "$url" 2>/dev/null
}

# JSON response check
check_json_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -q "\"$field\""
}

# Header
clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}            ${BOLD}🏥 StillOnTime - Health Check${NC}                       ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Timestamp:${NC} $(date)"
echo -e "${BLUE}Host:${NC} $(hostname)"

# SECTION 1: Application Services
log_section "Application Services"

# Backend
log_check "Backend API (port $BACKEND_PORT)"
if check_port $BACKEND_PORT; then
    log_pass "Backend is listening on port $BACKEND_PORT"

    # Process info
    BACKEND_INFO=$(get_port_info $BACKEND_PORT)
    log_info "Process: $BACKEND_INFO"

    # Health endpoint
    log_check "Backend health endpoint"
    BACKEND_HEALTH=$(http_check "http://localhost:$BACKEND_PORT/health")
    BACKEND_STATUS=$(http_status "http://localhost:$BACKEND_PORT/health")

    if [ "$BACKEND_STATUS" = "200" ]; then
        log_pass "Health endpoint responding (HTTP 200)"

        # Parse health response
        if echo "$BACKEND_HEALTH" | grep -q "healthy\|status.*ok\|running"; then
            log_info "Status: HEALTHY"
        else
            log_warn "Health endpoint returned unexpected response"
            log_info "Response: $BACKEND_HEALTH"
        fi

        # Check for database connectivity in health response
        if echo "$BACKEND_HEALTH" | grep -qi "database"; then
            log_info "Database connectivity reported in health check"
        fi
    else
        log_fail "Health endpoint not responding correctly (HTTP $BACKEND_STATUS)"
        log_info "Response: $BACKEND_HEALTH"
    fi

    # API endpoints
    log_check "Backend API routes"
    API_ROUTES=$(http_check "http://localhost:$BACKEND_PORT/api" || echo "")
    if [ -n "$API_ROUTES" ]; then
        log_pass "API routes are accessible"
    else
        log_warn "Could not access /api endpoint"
    fi
else
    log_fail "Backend is not running on port $BACKEND_PORT"
    log_info "Start with: npm run dev:backend"
fi

# Frontend
log_check "Frontend (port $FRONTEND_PORT)"
if check_port $FRONTEND_PORT; then
    log_pass "Frontend is listening on port $FRONTEND_PORT"

    # Process info
    FRONTEND_INFO=$(get_port_info $FRONTEND_PORT)
    log_info "Process: $FRONTEND_INFO"

    # HTTP check
    log_check "Frontend web server"
    FRONTEND_STATUS=$(http_status "http://localhost:$FRONTEND_PORT")

    if [ "$FRONTEND_STATUS" = "200" ]; then
        log_pass "Frontend is serving content (HTTP 200)"

        # Check for React app
        FRONTEND_HTML=$(http_check "http://localhost:$FRONTEND_PORT")
        if echo "$FRONTEND_HTML" | grep -qi "root\|react"; then
            log_info "React application detected"
        fi
    else
        log_warn "Frontend returned HTTP $FRONTEND_STATUS"
    fi
else
    log_fail "Frontend is not running on port $FRONTEND_PORT"
    log_info "Start with: npm run dev:frontend"
fi

# SECTION 2: Docker Services
log_section "Docker Services"

# Check Docker daemon
log_check "Docker daemon"
if docker ps >/dev/null 2>&1; then
    log_pass "Docker daemon is running"
else
    log_fail "Docker daemon is not running"
    log_info "Start Docker Desktop"
    exit 1
fi

# PostgreSQL
log_check "PostgreSQL container"
if docker ps | grep -q "stillontime-postgres"; then
    log_pass "PostgreSQL container is running"

    # Container health
    POSTGRES_HEALTH=$(docker inspect -f '{{.State.Health.Status}}' stillontime-postgres 2>/dev/null || echo "unknown")
    if [ "$POSTGRES_HEALTH" = "healthy" ]; then
        log_pass "PostgreSQL health: $POSTGRES_HEALTH"
    else
        POSTGRES_STATUS=$(docker inspect -f '{{.State.Status}}' stillontime-postgres 2>/dev/null)
        if [ "$POSTGRES_STATUS" = "running" ]; then
            log_pass "PostgreSQL status: running"
        else
            log_warn "PostgreSQL health: $POSTGRES_HEALTH (status: $POSTGRES_STATUS)"
        fi
    fi

    # Port check
    if check_port $POSTGRES_PORT; then
        log_pass "PostgreSQL is accessible on port $POSTGRES_PORT"
    else
        log_warn "PostgreSQL port $POSTGRES_PORT is not accessible"
    fi

    # Connection test from backend
    log_check "Database connectivity from backend"
    cd "$BACKEND_DIR"
    DB_TEST=$(npx prisma db execute --stdin <<< "SELECT 1" 2>&1)
    if echo "$DB_TEST" | grep -q "1\|Success"; then
        log_pass "Backend can connect to database"
    else
        log_fail "Backend cannot connect to database"
        log_info "Error: $DB_TEST"
    fi
    cd "$PROJECT_ROOT"
else
    log_fail "PostgreSQL container is not running"
    log_info "Start with: npm run docker:up"
fi

# Redis
log_check "Redis container"
if docker ps | grep -q "stillontime-redis"; then
    log_pass "Redis container is running"

    # Container status
    REDIS_STATUS=$(docker inspect -f '{{.State.Status}}' stillontime-redis 2>/dev/null)
    log_info "Redis status: $REDIS_STATUS"

    # Port check
    if check_port $REDIS_PORT; then
        log_pass "Redis is accessible on port $REDIS_PORT"
    else
        log_warn "Redis port $REDIS_PORT is not accessible"
    fi

    # Redis connectivity test
    if command -v redis-cli >/dev/null 2>&1; then
        log_check "Redis connectivity"
        REDIS_PING=$(redis-cli -h localhost -p $REDIS_PORT ping 2>/dev/null || echo "FAILED")
        if [ "$REDIS_PING" = "PONG" ]; then
            log_pass "Redis responding to PING"
        else
            log_warn "Redis not responding: $REDIS_PING"
        fi
    fi
else
    log_fail "Redis container is not running"
    log_info "Start with: npm run docker:up"
fi

# SECTION 3: Database Schema
log_section "Database Schema"

if docker ps | grep -q "stillontime-postgres"; then
    log_check "Database tables"
    cd "$BACKEND_DIR"

    # List tables
    TABLES=$(docker exec stillontime-postgres psql -U stillontime_user -d stillontime_automation -t -c "\dt" 2>/dev/null || echo "")

    if [ -n "$TABLES" ]; then
        TABLE_COUNT=$(echo "$TABLES" | grep -c "public" || echo "0")
        log_pass "Found $TABLE_COUNT database tables"
        log_info "Tables: $(echo "$TABLES" | awk '{print $3}' | grep -v "^$" | tr '\n' ', ' | sed 's/,$//')"
    else
        log_warn "No tables found in database"
        log_info "Run migrations: npm run prisma:migrate"
    fi

    # Check Prisma migrations
    log_check "Prisma migrations"
    MIGRATIONS=$(docker exec stillontime-postgres psql -U stillontime_user -d stillontime_automation -t -c "SELECT COUNT(*) FROM _prisma_migrations" 2>/dev/null || echo "0")
    MIGRATIONS=$(echo "$MIGRATIONS" | tr -d ' ')

    if [ "$MIGRATIONS" -gt "0" ]; then
        log_pass "Applied $MIGRATIONS Prisma migrations"
    else
        log_warn "No Prisma migrations applied"
    fi

    cd "$PROJECT_ROOT"
fi

# SECTION 4: File System
log_section "File System"

# Build artifacts
log_check "Backend build artifacts"
if [ -d "$BACKEND_DIR/dist" ]; then
    BUILD_SIZE=$(du -sh "$BACKEND_DIR/dist" | awk '{print $1}')
    log_pass "Backend build exists ($BUILD_SIZE)"
else
    log_warn "Backend build not found (dist/ directory missing)"
    log_info "Build with: cd backend && npm run build"
fi

log_check "Frontend build artifacts"
if [ -d "$FRONTEND_DIR/dist" ]; then
    BUILD_SIZE=$(du -sh "$FRONTEND_DIR/dist" | awk '{print $1}')
    log_pass "Frontend build exists ($BUILD_SIZE)"
else
    log_warn "Frontend build not found (dist/ directory missing)"
    log_info "Build with: cd frontend && npm run build"
fi

# Logs
log_check "Backend logs"
if [ -d "$BACKEND_DIR/logs" ]; then
    LOG_FILES=$(find "$BACKEND_DIR/logs" -name "*.log" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$LOG_FILES" -gt "0" ]; then
        log_pass "Found $LOG_FILES log files"

        # Check for recent errors
        RECENT_ERRORS=$(find "$BACKEND_DIR/logs" -name "error*.log" -mmin -60 2>/dev/null | wc -l | tr -d ' ')
        if [ "$RECENT_ERRORS" -gt "0" ]; then
            log_warn "Found $RECENT_ERRORS error logs from last hour"
        fi
    else
        log_info "No log files found"
    fi
else
    log_info "Logs directory not created yet"
fi

# Node modules
log_check "Dependencies installed"
BACKEND_MODULES=0
FRONTEND_MODULES=0

if [ -d "$BACKEND_DIR/node_modules" ]; then
    BACKEND_MODULES=$(ls -1 "$BACKEND_DIR/node_modules" 2>/dev/null | wc -l | tr -d ' ')
fi

if [ -d "$FRONTEND_DIR/node_modules" ]; then
    FRONTEND_MODULES=$(ls -1 "$FRONTEND_DIR/node_modules" 2>/dev/null | wc -l | tr -d ' ')
fi

if [ "$BACKEND_MODULES" -gt "0" ] && [ "$FRONTEND_MODULES" -gt "0" ]; then
    log_pass "Backend: $BACKEND_MODULES packages, Frontend: $FRONTEND_MODULES packages"
else
    log_warn "Some dependencies may be missing"
    log_info "Run: npm run install:all"
fi

# SECTION 5: Integration Tests
log_section "Integration Tests"

# Backend-Database integration
log_check "Backend-Database integration"
if check_port $BACKEND_PORT && docker ps | grep -q "stillontime-postgres"; then
    log_pass "Both backend and database are running"

    # Try a simple API call that requires DB
    API_TEST=$(http_status "http://localhost:$BACKEND_PORT/api/health" || echo "000")
    if [ "$API_TEST" = "200" ]; then
        log_pass "Backend API with database connectivity is working"
    else
        log_warn "Backend API test returned HTTP $API_TEST"
    fi
else
    log_warn "Cannot test integration (services not running)"
fi

# Frontend-Backend integration
log_check "Frontend-Backend integration"
if check_port $FRONTEND_PORT && check_port $BACKEND_PORT; then
    log_pass "Both frontend and backend are running"

    # Check if frontend can reach backend (via CORS)
    FRONTEND_CONFIG=$(http_check "http://localhost:$FRONTEND_PORT/config" || echo "")
    if echo "$FRONTEND_CONFIG" | grep -q "$BACKEND_PORT"; then
        log_pass "Frontend is configured to use backend at port $BACKEND_PORT"
    fi
else
    log_warn "Cannot test integration (services not running)"
fi

# SECTION 6: Resource Usage
log_section "Resource Usage"

# Docker stats
log_check "Docker resource usage"
if docker ps >/dev/null 2>&1; then
    STATS=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep stillontime || echo "")

    if [ -n "$STATS" ]; then
        log_pass "Container resource usage:"
        echo "$STATS" | while read line; do
            log_info "$line"
        done
    fi
fi

# Disk usage
log_check "Project disk usage"
if [ -d "$PROJECT_ROOT" ]; then
    TOTAL_SIZE=$(du -sh "$PROJECT_ROOT" 2>/dev/null | awk '{print $1}')
    MODULES_SIZE=$(du -sh "$PROJECT_ROOT"/*/node_modules 2>/dev/null | awk '{sum+=$1} END {print sum"M"}')
    log_pass "Total: $TOTAL_SIZE (node_modules: ~$MODULES_SIZE)"
fi

# SECTION 7: Summary
log_section "Health Check Summary"

echo ""
echo -e "${BOLD}Total Checks:${NC}   $TOTAL_CHECKS"
echo -e "${GREEN}${BOLD}Passed:${NC}         $PASSED_CHECKS"
echo -e "${RED}${BOLD}Failed:${NC}         $FAILED_CHECKS"
echo -e "${YELLOW}${BOLD}Warnings:${NC}       $WARNING_CHECKS"
echo ""

# Calculate health percentage
if [ $TOTAL_CHECKS -gt 0 ]; then
    HEALTH_PERCENT=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
else
    HEALTH_PERCENT=0
fi

if [ $FAILED_CHECKS -eq 0 ]; then
    if [ $WARNING_CHECKS -eq 0 ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}                  ${BOLD}✅ All systems healthy! (100%)${NC}                  ${GREEN}║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║${NC}            ${BOLD}⚠️  System healthy with warnings ($HEALTH_PERCENT%)${NC}            ${YELLOW}║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    fi
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║${NC}              ${BOLD}❌ Health check failed ($HEALTH_PERCENT%)${NC}                    ${RED}║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Please fix the failed checks above${NC}"
    exit 1
fi
