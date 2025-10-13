#!/bin/bash

# StillOnTime - Environment Validation Script
# Pre-flight checks before setup or deployment

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
MIN_NODE_VERSION=20
MIN_NPM_VERSION=9
MIN_DOCKER_VERSION=20
MIN_DISK_SPACE_GB=5
MIN_MEMORY_GB=4

# Paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Validation results
ERRORS=0
WARNINGS=0
CHECKS=0

# Logging functions
log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}═══ $1 ═══${NC}"
    echo ""
}

log_check() {
    ((CHECKS++))
    echo -e "${BLUE}→${NC} Checking $1..."
}

log_pass() {
    echo -e "  ${GREEN}✅ PASS:${NC} $1"
}

log_fail() {
    ((ERRORS++))
    echo -e "  ${RED}❌ FAIL:${NC} $1"
}

log_warn() {
    ((WARNINGS++))
    echo -e "  ${YELLOW}⚠️  WARN:${NC} $1"
}

log_info() {
    echo -e "  ${BLUE}ℹ️  INFO:${NC} $1"
}

# Version comparison
version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# Check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get disk space in GB
get_disk_space() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        df -g "$PROJECT_ROOT" | awk 'NR==2 {print $4}'
    else
        df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//'
    fi
}

# Get memory in GB
get_memory() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}'
    else
        free -g | awk '/^Mem:/{print $2}'
    fi
}

# Header
clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}         ${BOLD}🔍 StillOnTime - Environment Validation${NC}                ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"

# SECTION 1: Operating System
log_section "Operating System"

log_check "Operating system"
OS="$(uname -s)"
case "$OS" in
    Darwin)
        OS_VERSION=$(sw_vers -productVersion)
        log_pass "macOS $OS_VERSION"
        log_info "Architecture: $(uname -m)"
        ;;
    Linux)
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            log_pass "Linux - $NAME $VERSION"
        else
            log_pass "Linux - $(uname -r)"
        fi
        log_info "Architecture: $(uname -m)"
        ;;
    *)
        log_fail "Unsupported OS: $OS (requires macOS or Linux)"
        ;;
esac

# SECTION 2: System Resources
log_section "System Resources"

log_check "Available disk space"
DISK_SPACE=$(get_disk_space)
if [ "$DISK_SPACE" -ge "$MIN_DISK_SPACE_GB" ]; then
    log_pass "${DISK_SPACE}GB available (minimum: ${MIN_DISK_SPACE_GB}GB)"
else
    log_fail "Only ${DISK_SPACE}GB available (minimum: ${MIN_DISK_SPACE_GB}GB required)"
    log_info "Free up disk space before continuing"
fi

log_check "System memory"
MEMORY=$(get_memory)
if [ "$MEMORY" -ge "$MIN_MEMORY_GB" ]; then
    log_pass "${MEMORY}GB RAM (minimum: ${MIN_MEMORY_GB}GB)"
else
    log_warn "Only ${MEMORY}GB RAM (recommended: ${MIN_MEMORY_GB}GB)"
    log_info "Application may run slowly"
fi

# SECTION 3: Required Software
log_section "Required Software"

# Node.js
log_check "Node.js"
if command_exists node; then
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

    if [ "$NODE_MAJOR" -ge "$MIN_NODE_VERSION" ]; then
        log_pass "Node.js $NODE_VERSION (minimum: $MIN_NODE_VERSION.0.0)"
    else
        log_fail "Node.js $NODE_VERSION is too old (minimum: $MIN_NODE_VERSION.0.0)"
        log_info "Update Node.js: https://nodejs.org/"
    fi

    # Check Node.js path
    NODE_PATH=$(which node)
    log_info "Node.js location: $NODE_PATH"
else
    log_fail "Node.js not found"
    log_info "Install from: https://nodejs.org/"
fi

# npm
log_check "npm"
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d. -f1)

    if [ "$NPM_MAJOR" -ge "$MIN_NPM_VERSION" ]; then
        log_pass "npm $NPM_VERSION (minimum: $MIN_NPM_VERSION.0.0)"
    else
        log_fail "npm $NPM_VERSION is too old (minimum: $MIN_NPM_VERSION.0.0)"
        log_info "Update npm: npm install -g npm@latest"
    fi
else
    log_fail "npm not found (should come with Node.js)"
fi

# Docker
log_check "Docker"
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    log_pass "Docker $DOCKER_VERSION"

    # Check Docker daemon
    if docker ps >/dev/null 2>&1; then
        log_pass "Docker daemon is running"

        # Check Docker info
        DOCKER_MEMORY=$(docker info 2>/dev/null | grep "Total Memory" | awk '{print $3}')
        log_info "Docker memory: $DOCKER_MEMORY"
    else
        log_fail "Docker daemon is not running"
        log_info "Start Docker Desktop and try again"
    fi
else
    log_fail "Docker not found"
    log_info "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
fi

# docker-compose
log_check "docker-compose"
if command_exists docker-compose; then
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $4}' | sed 's/,//')
    log_pass "docker-compose $COMPOSE_VERSION"
elif docker compose version >/dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version --short)
    log_pass "Docker Compose V2 ($COMPOSE_VERSION)"
else
    log_fail "docker-compose not found"
    log_info "Install docker-compose or use Docker Desktop (includes Compose V2)"
fi

# SECTION 4: Optional Tools
log_section "Optional Tools"

# PostgreSQL client
log_check "PostgreSQL client (psql)"
if command_exists psql; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    log_pass "psql $PSQL_VERSION"
    log_info "Useful for direct database access"
else
    log_info "psql not found (optional)"
    log_info "Install: brew install postgresql@15 (macOS)"
fi

# Redis client
log_check "Redis client (redis-cli)"
if command_exists redis-cli; then
    REDIS_VERSION=$(redis-cli --version | awk '{print $2}')
    log_pass "redis-cli $REDIS_VERSION"
    log_info "Useful for cache inspection"
else
    log_info "redis-cli not found (optional)"
    log_info "Install: brew install redis (macOS)"
fi

# Git
log_check "Git"
if command_exists git; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    log_pass "Git $GIT_VERSION"
else
    log_warn "Git not found (recommended for version control)"
fi

# curl
log_check "curl"
if command_exists curl; then
    CURL_VERSION=$(curl --version | head -1 | awk '{print $2}')
    log_pass "curl $CURL_VERSION"
else
    log_fail "curl not found (required for health checks)"
fi

# SECTION 5: Project Structure
log_section "Project Structure"

log_check "Project root directory"
if [ -d "$PROJECT_ROOT" ]; then
    log_pass "Found at: $PROJECT_ROOT"
else
    log_fail "Project root not found"
fi

log_check "Backend directory"
if [ -d "$BACKEND_DIR" ]; then
    log_pass "Found at: $BACKEND_DIR"

    # Check package.json
    if [ -f "$BACKEND_DIR/package.json" ]; then
        log_pass "backend/package.json exists"
    else
        log_fail "backend/package.json not found"
    fi

    # Check Prisma schema
    if [ -f "$BACKEND_DIR/prisma/schema.prisma" ]; then
        log_pass "Prisma schema exists"
    else
        log_fail "Prisma schema not found"
    fi
else
    log_fail "Backend directory not found"
fi

log_check "Frontend directory"
if [ -d "$FRONTEND_DIR" ]; then
    log_pass "Found at: $FRONTEND_DIR"

    # Check package.json
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        log_pass "frontend/package.json exists"
    else
        log_fail "frontend/package.json not found"
    fi
else
    log_fail "Frontend directory not found"
fi

log_check "Docker Compose configuration"
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
    log_pass "docker-compose.yml exists"
else
    log_fail "docker-compose.yml not found"
fi

# SECTION 6: Configuration Files
log_section "Configuration Files"

log_check "Backend environment file"
if [ -f "$BACKEND_DIR/.env" ]; then
    log_pass "backend/.env exists"

    # Validate required variables
    REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "PORT")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" "$BACKEND_DIR/.env" 2>/dev/null; then
            log_info "$var is set"
        else
            log_warn "$var not found in .env"
        fi
    done
elif [ -f "$BACKEND_DIR/.env.example" ]; then
    log_warn "backend/.env not found (template exists at .env.example)"
    log_info "Run: ./scripts/create-env.sh"
else
    log_fail "Neither backend/.env nor .env.example found"
fi

log_check "Frontend environment file"
if [ -f "$FRONTEND_DIR/.env" ]; then
    log_pass "frontend/.env exists"

    # Check VITE_ variables
    if grep -q "^VITE_API_URL=" "$FRONTEND_DIR/.env" 2>/dev/null; then
        log_info "VITE_API_URL is set"
    else
        log_warn "VITE_API_URL not found in .env"
    fi
elif [ -f "$FRONTEND_DIR/.env.example" ]; then
    log_warn "frontend/.env not found (template exists at .env.example)"
    log_info "Run: ./scripts/create-env.sh"
else
    log_fail "Neither frontend/.env nor .env.example found"
fi

# SECTION 7: Port Availability
log_section "Port Availability"

PORTS=("3000:Frontend" "3001:Backend API" "5432:PostgreSQL" "6379:Redis")

for port_info in "${PORTS[@]}"; do
    PORT="${port_info%%:*}"
    SERVICE="${port_info##*:}"

    log_check "Port $PORT ($SERVICE)"
    if lsof -i :$PORT >/dev/null 2>&1; then
        log_warn "Port $PORT is in use"
        log_info "$(lsof -i :$PORT | tail -1)"
    else
        log_pass "Port $PORT is available"
    fi
done

# SECTION 8: Network Connectivity
log_section "Network Connectivity"

log_check "Internet connectivity"
if curl -s --head --max-time 5 https://www.google.com >/dev/null 2>&1; then
    log_pass "Internet connection is working"
else
    log_warn "Internet connection may be unavailable"
    log_info "Required for installing dependencies and API calls"
fi

log_check "npm registry"
if curl -s --head --max-time 5 https://registry.npmjs.org >/dev/null 2>&1; then
    log_pass "npm registry is accessible"
else
    log_warn "Cannot reach npm registry"
    log_info "Required for installing Node.js packages"
fi

log_check "Docker Hub"
if curl -s --head --max-time 5 https://hub.docker.com >/dev/null 2>&1; then
    log_pass "Docker Hub is accessible"
else
    log_warn "Cannot reach Docker Hub"
    log_info "May affect Docker image pulls"
fi

# SECTION 9: Summary
log_section "Validation Summary"

echo ""
echo -e "${BOLD}Total Checks:${NC} $CHECKS"
echo -e "${RED}${BOLD}Errors:${NC}       $ERRORS"
echo -e "${YELLOW}${BOLD}Warnings:${NC}     $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}              ${BOLD}✅ All checks passed! Ready to setup.${NC}               ${GREEN}║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${CYAN}Next step:${NC} Run ./scripts/one-click-setup.sh"
        exit 0
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║${NC}        ${BOLD}⚠️  Validation passed with $WARNINGS warning(s)${NC}                 ${YELLOW}║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${CYAN}You can proceed, but review warnings above${NC}"
        exit 0
    fi
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║${NC}          ${BOLD}❌ Validation failed with $ERRORS error(s)${NC}                  ${RED}║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Please fix the errors above before continuing${NC}"
    exit 1
fi
