#!/bin/bash

# StillOnTime - One-Click Setup Script
# Complete automated setup with validation and rollback capabilities

set -e  # Exit on error (we'll handle rollback manually)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=3000
POSTGRES_PORT=5432
REDIS_PORT=6379
MIN_NODE_VERSION=20
MIN_NPM_VERSION=9

# Paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
LOGS_DIR="$PROJECT_ROOT/setup-logs"

# Create logs directory
mkdir -p "$LOGS_DIR"
SETUP_LOG="$LOGS_DIR/setup-$(date +%Y%m%d_%H%M%S).log"

# Rollback tracking
ROLLBACK_STEPS=()

# Logging functions
log() {
    echo -e "${CYAN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$SETUP_LOG"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$SETUP_LOG"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$SETUP_LOG"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$SETUP_LOG"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$SETUP_LOG"
}

log_step() {
    echo -e "\n${MAGENTA}${BOLD}▶ $1${NC}" | tee -a "$SETUP_LOG"
}

# Add rollback step
add_rollback() {
    ROLLBACK_STEPS+=("$1")
}

# Execute rollback
rollback() {
    log_error "Setup failed! Rolling back changes..."

    for ((i=${#ROLLBACK_STEPS[@]}-1; i>=0; i--)); do
        log_warning "Rollback: ${ROLLBACK_STEPS[$i]}"
        eval "${ROLLBACK_STEPS[$i]}" 2>/dev/null || true
    done

    log_info "Rollback complete. Check logs at: $SETUP_LOG"
    exit 1
}

# Trap errors for rollback
trap 'rollback' ERR

# Header
clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}        ${BOLD}🎬 StillOnTime - One-Click Setup Script${NC}              ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Setup log: $SETUP_LOG"
echo ""

# Version comparison function
version_compare() {
    local version=$1
    local required=$2

    # Convert versions to comparable integers
    local ver_int=$(echo "$version" | awk -F. '{ printf("%d%03d%03d\n", $1,$2,$3); }')
    local req_int=$(echo "$required" | awk -F. '{ printf("%d%03d%03d\n", $1,$2,$3); }')

    [ "$ver_int" -ge "$req_int" ]
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for port to be available
wait_for_port() {
    local port=$1
    local service=$2
    local max_wait=${3:-30}

    log "Waiting for $service on port $port..."

    for i in $(seq 1 $max_wait); do
        if lsof -i :$port >/dev/null 2>&1; then
            log_success "$service is ready on port $port"
            return 0
        fi
        sleep 1
    done

    log_error "$service failed to start on port $port (timeout after ${max_wait}s)"
    return 1
}

# Wait for Docker service
wait_for_docker_service() {
    local container=$1
    local max_wait=${2:-30}

    log "Waiting for Docker container: $container..."

    for i in $(seq 1 $max_wait); do
        if docker ps | grep -q "$container"; then
            if [ "$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null)" = "healthy" ] || \
               [ "$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)" = "running" ]; then
                log_success "Container $container is ready"
                return 0
            fi
        fi
        sleep 1
    done

    log_error "Container $container failed to start (timeout after ${max_wait}s)"
    return 1
}

# Check if port is in use
check_port_available() {
    local port=$1
    local service=$2

    if lsof -i :$port >/dev/null 2>&1; then
        log_error "Port $port is already in use (required for $service)"
        log_info "Process using port $port:"
        lsof -i :$port | tee -a "$SETUP_LOG"
        return 1
    fi
    return 0
}

# STEP 1: Validate Prerequisites
log_step "STEP 1: Validating Prerequisites"

# Check operating system
OS="$(uname -s)"
case "$OS" in
    Darwin)
        log_success "Operating System: macOS"
        OS_TYPE="macos"
        ;;
    Linux)
        log_success "Operating System: Linux"
        OS_TYPE="linux"
        ;;
    *)
        log_error "Unsupported operating system: $OS"
        log_info "This script supports macOS and Linux only"
        exit 1
        ;;
esac

# Check Node.js
log "Checking Node.js..."
if ! command_exists node; then
    log_error "Node.js is not installed"
    log_info "Please install Node.js $MIN_NODE_VERSION or higher from: https://nodejs.org/"

    if [ "$OS_TYPE" = "macos" ]; then
        log_info "Or install via Homebrew: brew install node@20"
    fi

    read -p "$(echo -e ${YELLOW}'Install Node.js now? (y/n): '${NC})" INSTALL_NODE
    if [ "$INSTALL_NODE" = "y" ] || [ "$INSTALL_NODE" = "Y" ]; then
        if [ "$OS_TYPE" = "macos" ] && command_exists brew; then
            log "Installing Node.js via Homebrew..."
            brew install node@20 && brew link node@20
        else
            log_error "Automatic installation not supported for this system"
            exit 1
        fi
    else
        exit 1
    fi
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt "$MIN_NODE_VERSION" ]; then
    log_error "Node.js version $NODE_VERSION is too old (required: >=$MIN_NODE_VERSION.0.0)"
    exit 1
fi
log_success "Node.js $NODE_VERSION (OK)"

# Check npm
log "Checking npm..."
if ! command_exists npm; then
    log_error "npm is not installed (should come with Node.js)"
    exit 1
fi

NPM_VERSION=$(npm --version)
NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d. -f1)

if [ "$NPM_MAJOR" -lt "$MIN_NPM_VERSION" ]; then
    log_error "npm version $NPM_VERSION is too old (required: >=$MIN_NPM_VERSION.0.0)"
    log_info "Update npm: npm install -g npm@latest"
    exit 1
fi
log_success "npm $NPM_VERSION (OK)"

# Check Docker
log "Checking Docker..."
if ! command_exists docker; then
    log_error "Docker is not installed"
    log_info "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"

    read -p "$(echo -e ${YELLOW}'Install Docker now? (y/n): '${NC})" INSTALL_DOCKER
    if [ "$INSTALL_DOCKER" = "y" ] || [ "$INSTALL_DOCKER" = "Y" ]; then
        if [ "$OS_TYPE" = "macos" ] && command_exists brew; then
            log "Installing Docker Desktop via Homebrew..."
            brew install --cask docker
            log_info "Please start Docker Desktop manually and run this script again"
        else
            log_error "Please install Docker manually from docker.com"
        fi
        exit 1
    else
        exit 1
    fi
fi

# Check if Docker daemon is running
if ! docker ps >/dev/null 2>&1; then
    log_error "Docker is installed but not running"
    log_info "Please start Docker Desktop and run this script again"
    exit 1
fi

DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
log_success "Docker $DOCKER_VERSION (running)"

# Check docker-compose
log "Checking docker-compose..."
if ! command_exists docker-compose; then
    log_warning "docker-compose not found as standalone command"
    log_info "Checking for 'docker compose' (Docker Compose V2)..."

    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose V2 available"
        # Create alias function for compatibility
        docker-compose() {
            docker compose "$@"
        }
        export -f docker-compose
    else
        log_error "Neither docker-compose nor 'docker compose' is available"
        exit 1
    fi
else
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $4}' | sed 's/,//')
    log_success "docker-compose $COMPOSE_VERSION (OK)"
fi

# Check for PostgreSQL client (optional, for direct DB access)
log "Checking PostgreSQL client..."
if command_exists psql; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    log_success "PostgreSQL client $PSQL_VERSION (OK)"
else
    log_warning "PostgreSQL client (psql) not found (optional)"
    log_info "Install for direct database access: brew install postgresql@15 (macOS)"
fi

# Check for Redis client (optional)
log "Checking Redis client..."
if command_exists redis-cli; then
    REDIS_VERSION=$(redis-cli --version | awk '{print $2}')
    log_success "Redis client $REDIS_VERSION (OK)"
else
    log_warning "Redis client (redis-cli) not found (optional)"
    log_info "Install for direct Redis access: brew install redis (macOS)"
fi

log_success "All required prerequisites are installed!"

# STEP 2: Check Port Availability
log_step "STEP 2: Checking Port Availability"

PORTS_OK=true

check_port_available $FRONTEND_PORT "Frontend" || PORTS_OK=false
check_port_available $BACKEND_PORT "Backend API" || PORTS_OK=false
check_port_available $POSTGRES_PORT "PostgreSQL" || PORTS_OK=false
check_port_available $REDIS_PORT "Redis" || PORTS_OK=false

if [ "$PORTS_OK" = false ]; then
    log_error "One or more required ports are in use"
    log_info "Stop conflicting services or change port configuration"
    exit 1
fi

log_success "All required ports are available"

# STEP 3: Install Dependencies
log_step "STEP 3: Installing Dependencies"

# Root dependencies
log "Installing root dependencies..."
cd "$PROJECT_ROOT"
if [ -f "package-lock.json" ]; then
    npm ci 2>&1 | tee -a "$SETUP_LOG" || npm install 2>&1 | tee -a "$SETUP_LOG"
else
    npm install 2>&1 | tee -a "$SETUP_LOG"
fi
log_success "Root dependencies installed"
add_rollback "cd '$PROJECT_ROOT' && rm -rf node_modules package-lock.json"

# Backend dependencies
log "Installing backend dependencies..."
cd "$BACKEND_DIR"
if [ -f "package-lock.json" ]; then
    npm ci 2>&1 | tee -a "$SETUP_LOG" || npm install 2>&1 | tee -a "$SETUP_LOG"
else
    npm install 2>&1 | tee -a "$SETUP_LOG"
fi
log_success "Backend dependencies installed"
add_rollback "cd '$BACKEND_DIR' && rm -rf node_modules package-lock.json"

# Frontend dependencies
log "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
if [ -f "package-lock.json" ]; then
    npm ci 2>&1 | tee -a "$SETUP_LOG" || npm install 2>&1 | tee -a "$SETUP_LOG"
else
    npm install 2>&1 | tee -a "$SETUP_LOG"
fi
log_success "Frontend dependencies installed"
add_rollback "cd '$FRONTEND_DIR' && rm -rf node_modules package-lock.json"

cd "$PROJECT_ROOT"

# STEP 4: Setup Environment Files
log_step "STEP 4: Setting Up Environment Files"

# Check if .env files already exist
BACKEND_ENV_EXISTS=false
FRONTEND_ENV_EXISTS=false

if [ -f "$BACKEND_DIR/.env" ]; then
    log_warning "Backend .env file already exists"
    BACKEND_ENV_EXISTS=true
fi

if [ -f "$FRONTEND_DIR/.env" ]; then
    log_warning "Frontend .env file already exists"
    FRONTEND_ENV_EXISTS=true
fi

# If both exist, ask user
if [ "$BACKEND_ENV_EXISTS" = true ] && [ "$FRONTEND_ENV_EXISTS" = true ]; then
    read -p "$(echo -e ${YELLOW}'Environment files exist. Regenerate? (y/n): '${NC})" REGEN_ENV

    if [ "$REGEN_ENV" = "y" ] || [ "$REGEN_ENV" = "Y" ]; then
        # Backup existing files
        BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
        log "Backing up existing .env files..."
        cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.$BACKUP_TIME"
        cp "$FRONTEND_DIR/.env" "$FRONTEND_DIR/.env.backup.$BACKUP_TIME"
        log_success "Backups created (.env.backup.$BACKUP_TIME)"

        # Run create-env.sh
        if [ -f "$SCRIPTS_DIR/create-env.sh" ]; then
            log "Running environment setup..."
            bash "$SCRIPTS_DIR/create-env.sh" 2>&1 | tee -a "$SETUP_LOG"
        else
            log_error "create-env.sh not found at $SCRIPTS_DIR/create-env.sh"
            exit 1
        fi
    else
        log_info "Using existing environment files"
    fi
else
    # Create missing .env files
    if [ "$BACKEND_ENV_EXISTS" = false ]; then
        log "Creating backend .env file..."
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            log_success "Backend .env created from .env.example"
            log_warning "Please edit $BACKEND_DIR/.env with your actual credentials"
        else
            log_error "Backend .env.example not found"
            exit 1
        fi
    fi

    if [ "$FRONTEND_ENV_EXISTS" = false ]; then
        log "Creating frontend .env file..."
        if [ -f "$FRONTEND_DIR/.env.example" ]; then
            cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
            log_success "Frontend .env created from .env.example"
            log_warning "Please edit $FRONTEND_DIR/.env with your actual configuration"
        else
            log_error "Frontend .env.example not found"
            exit 1
        fi
    fi

    log_warning "Environment files created but may need configuration"
    read -p "$(echo -e ${YELLOW}'Continue with default values? (y/n): '${NC})" CONTINUE_DEFAULT

    if [ "$CONTINUE_DEFAULT" != "y" ] && [ "$CONTINUE_DEFAULT" != "Y" ]; then
        log_info "Please edit .env files and run this script again"
        exit 0
    fi
fi

# Validate environment files exist
if [ ! -f "$BACKEND_DIR/.env" ] || [ ! -f "$FRONTEND_DIR/.env" ]; then
    log_error "Environment files are missing"
    exit 1
fi

log_success "Environment files are configured"

# STEP 5: Start Docker Services
log_step "STEP 5: Starting Docker Services"

cd "$PROJECT_ROOT"

# Stop any existing containers
log "Stopping any existing containers..."
docker-compose down 2>&1 | tee -a "$SETUP_LOG" || true

# Start services
log "Starting PostgreSQL and Redis via Docker Compose..."
docker-compose up -d postgres redis 2>&1 | tee -a "$SETUP_LOG"
add_rollback "cd '$PROJECT_ROOT' && docker-compose down"

# Wait for services to be healthy
wait_for_docker_service "stillontime-postgres" 30
wait_for_docker_service "stillontime-redis" 30

log_success "Docker services are running"

# STEP 6: Initialize Database
log_step "STEP 6: Initializing Database"

cd "$BACKEND_DIR"

# Generate Prisma Client
log "Generating Prisma Client..."
npx prisma generate 2>&1 | tee -a "$SETUP_LOG"
log_success "Prisma Client generated"

# Run migrations
log "Running database migrations..."
npx prisma migrate deploy 2>&1 | tee -a "$SETUP_LOG" || {
    log_warning "Migrate deploy failed, trying migrate dev..."
    npx prisma migrate dev 2>&1 | tee -a "$SETUP_LOG"
}
log_success "Database migrations complete"

# Run database initialization script if it exists
if [ -f "src/scripts/init-db.ts" ]; then
    log "Running database initialization script..."
    npm run db:init 2>&1 | tee -a "$SETUP_LOG" || log_warning "Database initialization script failed (may be optional)"
fi

cd "$PROJECT_ROOT"

log_success "Database initialized"

# STEP 7: Build Projects
log_step "STEP 7: Building Projects"

# Build backend
log "Building backend..."
cd "$BACKEND_DIR"
npm run build 2>&1 | tee -a "$SETUP_LOG"
log_success "Backend built successfully"

# Build frontend
log "Building frontend..."
cd "$FRONTEND_DIR"
npm run build 2>&1 | tee -a "$SETUP_LOG"
log_success "Frontend built successfully"

cd "$PROJECT_ROOT"

log_success "All projects built successfully"

# STEP 8: Run Tests
log_step "STEP 8: Running Tests (Optional)"

read -p "$(echo -e ${YELLOW}'Run tests before starting? (y/n): '${NC})" RUN_TESTS

if [ "$RUN_TESTS" = "y" ] || [ "$RUN_TESTS" = "Y" ]; then
    # Backend tests
    log "Running backend tests..."
    cd "$BACKEND_DIR"
    npm test 2>&1 | tee -a "$SETUP_LOG" || log_warning "Backend tests failed"

    # Frontend tests
    log "Running frontend tests..."
    cd "$FRONTEND_DIR"
    npm test 2>&1 | tee -a "$SETUP_LOG" || log_warning "Frontend tests failed"

    cd "$PROJECT_ROOT"
    log_success "Tests complete"
else
    log_info "Skipping tests"
fi

# STEP 9: Start Application
log_step "STEP 9: Starting Application"

log "Starting backend and frontend services..."

# Start in background
npm run dev > "$LOGS_DIR/app-output.log" 2>&1 &
APP_PID=$!
add_rollback "kill $APP_PID 2>/dev/null || true"

# Wait for services
wait_for_port $BACKEND_PORT "Backend API" 60
wait_for_port $FRONTEND_PORT "Frontend" 60

log_success "Application started successfully"

# STEP 10: Health Checks
log_step "STEP 10: Running Health Checks"

# Backend health check
log "Checking backend health..."
HEALTH_CHECK=$(curl -s http://localhost:$BACKEND_PORT/health 2>&1 || echo "FAILED")

if echo "$HEALTH_CHECK" | grep -q "healthy\|ok\|running"; then
    log_success "Backend health check: PASSED"
else
    log_error "Backend health check: FAILED"
    log_info "Response: $HEALTH_CHECK"
    log_info "Check logs at: $LOGS_DIR/app-output.log"
fi

# Frontend check
log "Checking frontend..."
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT 2>&1)

if [ "$FRONTEND_CHECK" = "200" ]; then
    log_success "Frontend check: PASSED"
else
    log_warning "Frontend check: HTTP $FRONTEND_CHECK"
fi

# Database connectivity
log "Checking database connectivity..."
cd "$BACKEND_DIR"
DB_CHECK=$(npx prisma db execute --stdin <<< "SELECT 1" 2>&1 | grep -q "1" && echo "OK" || echo "FAILED")
if [ "$DB_CHECK" = "OK" ]; then
    log_success "Database connectivity: PASSED"
else
    log_warning "Database connectivity: FAILED"
fi

cd "$PROJECT_ROOT"

# STEP 11: API Tests (Optional)
log_step "STEP 11: API Tests (Optional)"

if [ -f "$SCRIPTS_DIR/test-apis.sh" ]; then
    read -p "$(echo -e ${YELLOW}'Run API connectivity tests? (y/n): '${NC})" RUN_API_TESTS

    if [ "$RUN_API_TESTS" = "y" ] || [ "$RUN_API_TESTS" = "Y" ]; then
        log "Running API tests..."
        bash "$SCRIPTS_DIR/test-apis.sh" 2>&1 | tee -a "$SETUP_LOG" || log_warning "Some API tests failed"
    else
        log_info "Skipping API tests"
    fi
else
    log_info "API test script not found (optional)"
fi

# STEP 12: Final Summary
log_step "SETUP COMPLETE! 🎉"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}                   ${BOLD}✅ Setup Successful!${NC}                            ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📍 Access URLs:${NC}"
echo -e "  ${BOLD}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "  ${BOLD}Backend:${NC}   http://localhost:$BACKEND_PORT"
echo -e "  ${BOLD}Health:${NC}    http://localhost:$BACKEND_PORT/health"
echo ""

echo -e "${CYAN}🐳 Docker Services:${NC}"
echo -e "  ${BOLD}PostgreSQL:${NC} localhost:$POSTGRES_PORT"
echo -e "  ${BOLD}Redis:${NC}      localhost:$REDIS_PORT"
echo ""

echo -e "${CYAN}📋 Useful Commands:${NC}"
echo -e "  ${BOLD}Stop app:${NC}       ./scripts/app-control.sh stop"
echo -e "  ${BOLD}Restart app:${NC}    ./scripts/app-control.sh restart"
echo -e "  ${BOLD}View status:${NC}    ./scripts/app-control.sh status"
echo -e "  ${BOLD}View logs:${NC}      ./scripts/app-control.sh logs"
echo -e "  ${BOLD}Stop Docker:${NC}    npm run docker:down"
echo -e "  ${BOLD}Prisma Studio:${NC}  npm run prisma:studio"
echo ""

echo -e "${CYAN}📊 Logs and Data:${NC}"
echo -e "  ${BOLD}Setup log:${NC}      $SETUP_LOG"
echo -e "  ${BOLD}App output:${NC}     $LOGS_DIR/app-output.log"
echo -e "  ${BOLD}Backend logs:${NC}   $BACKEND_DIR/logs/"
echo ""

echo -e "${YELLOW}⚡ Next Steps:${NC}"
echo "  1. Open http://localhost:$FRONTEND_PORT in your browser"
echo "  2. Configure OAuth credentials if needed (see docs/INTERACTIVE_API_SETUP.md)"
echo "  3. Review API setup guide: ./scripts/README.md"
echo ""

log_info "Setup completed successfully at $(date)"
log_info "Application is running in the background (PID: $APP_PID)"

# Save PID for later management
echo "$APP_PID" > "$LOGS_DIR/app.pid"

exit 0
