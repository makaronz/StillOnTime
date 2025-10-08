#!/bin/bash

# StillOnTime - Application Control Script
# Manages application lifecycle: start, stop, restart, status

BACKEND_PORT=3001
FRONTEND_PORT=3000

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              🎬 StillOnTime - Application Control                   ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Function to check if port is in use
check_port() {
    local PORT=$1
    lsof -i :$PORT >/dev/null 2>&1
    return $?
}

# Function to get PID using port
get_pid() {
    local PORT=$1
    lsof -ti :$PORT 2>/dev/null
}

# Function to stop application
stop_app() {
    echo "🛑 Stopping application..."
    echo ""
    
    # Stop backend
    if check_port $BACKEND_PORT; then
        BACKEND_PID=$(get_pid $BACKEND_PORT)
        echo "  Stopping backend (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
        kill -9 $BACKEND_PID 2>/dev/null
        echo "  ✅ Backend stopped"
    else
        echo "  ℹ️  Backend not running"
    fi
    
    # Stop frontend
    if check_port $FRONTEND_PORT; then
        FRONTEND_PID=$(get_pid $FRONTEND_PORT)
        echo "  Stopping frontend (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
        kill -9 $FRONTEND_PID 2>/dev/null
        echo "  ✅ Frontend stopped"
    else
        echo "  ℹ️  Frontend not running"
    fi
    
    # Stop any npm run dev processes
    pkill -f "npm run dev" 2>/dev/null
    
    echo ""
    echo "✅ Application stopped"
}

# Function to start application
start_app() {
    echo "🚀 Starting application..."
    echo ""
    
    # Check if already running
    if check_port $BACKEND_PORT || check_port $FRONTEND_PORT; then
        echo "⚠️  Application appears to be running!"
        echo ""
        status_app
        echo ""
        read -p "Stop and restart? (y/n): " RESTART
        if [ "$RESTART" = "y" ] || [ "$RESTART" = "Y" ]; then
            stop_app
            echo ""
            sleep 2
        else
            echo "❌ Cancelled"
            exit 0
        fi
    fi
    
    # Check prerequisites
    echo "🔍 Checking prerequisites..."
    
    # Check Docker
    if ! docker ps >/dev/null 2>&1; then
        echo "  ❌ Docker is not running!"
        echo "     Start Docker Desktop first"
        exit 1
    fi
    
    # Check PostgreSQL
    if ! docker ps | grep stillontime-postgres >/dev/null; then
        echo "  ⚠️  PostgreSQL not running"
        echo "     Starting Docker services..."
        npm run docker:up
        sleep 3
    else
        echo "  ✅ PostgreSQL running"
    fi
    
    # Check Redis
    if ! docker ps | grep stillontime-redis >/dev/null; then
        echo "  ⚠️  Redis not running"
        echo "     Starting Docker services..."
        npm run docker:up
        sleep 3
    else
        echo "  ✅ Redis running"
    fi
    
    # Check .env files
    if [ ! -f "backend/.env" ]; then
        echo "  ❌ backend/.env not found!"
        echo "     Run: ./scripts/create-env.sh"
        exit 1
    else
        echo "  ✅ Configuration files exist"
    fi
    
    echo ""
    echo "🚀 Starting application services..."
    echo ""
    
    # Start application
    npm run dev > /dev/null 2>&1 &
    
    echo "  ⏳ Waiting for services to start..."
    sleep 5
    
    # Wait for backend
    for i in {1..10}; do
        if check_port $BACKEND_PORT; then
            echo "  ✅ Backend started on port $BACKEND_PORT"
            break
        fi
        if [ $i -eq 10 ]; then
            echo "  ❌ Backend failed to start (timeout)"
            exit 1
        fi
        sleep 1
    done
    
    # Wait for frontend
    for i in {1..10}; do
        if check_port $FRONTEND_PORT; then
            echo "  ✅ Frontend started on port $FRONTEND_PORT"
            break
        fi
        if [ $i -eq 10 ]; then
            echo "  ❌ Frontend failed to start (timeout)"
            exit 1
        fi
        sleep 1
    done
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║                    🎉 Application Started!                          ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📍 Access URLs:"
    echo "  • Frontend:  http://localhost:$FRONTEND_PORT"
    echo "  • Backend:   http://localhost:$BACKEND_PORT"
    echo "  • Health:    http://localhost:$BACKEND_PORT/health"
    echo ""
    echo "📊 View logs:"
    echo "  • Backend:   npm run dev:backend"
    echo "  • Frontend:  npm run dev:frontend"
    echo ""
    echo "🛑 Stop application:"
    echo "  ./scripts/app-control.sh stop"
    echo ""
}

# Function to show status
status_app() {
    echo "📊 Application Status"
    echo "──────────────────────────────────────────────────────────────────────"
    echo ""
    
    # Backend status
    if check_port $BACKEND_PORT; then
        BACKEND_PID=$(get_pid $BACKEND_PORT)
        echo "  Backend:  ✅ RUNNING (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
        
        # Test health endpoint
        HEALTH=$(curl -s http://localhost:$BACKEND_PORT/health 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "            ✅ Health check: HEALTHY"
        else
            echo "            ⚠️  Health check: FAILED"
        fi
    else
        echo "  Backend:  ❌ NOT RUNNING (Port: $BACKEND_PORT)"
    fi
    
    echo ""
    
    # Frontend status
    if check_port $FRONTEND_PORT; then
        FRONTEND_PID=$(get_pid $FRONTEND_PORT)
        echo "  Frontend: ✅ RUNNING (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
        
        # Test frontend
        FRONTEND_TEST=$(curl -s http://localhost:$FRONTEND_PORT 2>/dev/null | head -1)
        if [ $? -eq 0 ]; then
            echo "            ✅ Web server: RESPONDING"
        else
            echo "            ⚠️  Web server: NOT RESPONDING"
        fi
    else
        echo "  Frontend: ❌ NOT RUNNING (Port: $FRONTEND_PORT)"
    fi
    
    echo ""
    echo "──────────────────────────────────────────────────────────────────────"
    echo ""
    
    # Docker services
    echo "🐳 Docker Services:"
    echo ""
    
    if docker ps | grep stillontime-postgres >/dev/null; then
        echo "  PostgreSQL: ✅ RUNNING"
    else
        echo "  PostgreSQL: ❌ NOT RUNNING"
    fi
    
    if docker ps | grep stillontime-redis >/dev/null; then
        echo "  Redis:      ✅ RUNNING"
    else
        echo "  Redis:      ❌ NOT RUNNING"
    fi
    
    echo ""
}

# Function to restart application
restart_app() {
    stop_app
    echo ""
    sleep 2
    start_app
}

# Function to show logs
logs_app() {
    echo "📋 Application Logs"
    echo "──────────────────────────────────────────────────────────────────────"
    echo ""
    echo "Choose which logs to view:"
    echo "  1) Backend logs"
    echo "  2) Frontend logs"
    echo "  3) Both (split terminal)"
    echo "  4) Docker logs"
    echo ""
    read -p "Selection (1-4): " CHOICE
    
    case $CHOICE in
        1)
            echo ""
            echo "Showing backend logs (Ctrl+C to exit)..."
            sleep 1
            cd backend && npm run dev
            ;;
        2)
            echo ""
            echo "Showing frontend logs (Ctrl+C to exit)..."
            sleep 1
            cd frontend && npm run dev
            ;;
        3)
            echo ""
            echo "Starting both services (Ctrl+C to exit)..."
            sleep 1
            npm run dev
            ;;
        4)
            echo ""
            echo "Showing Docker logs (Ctrl+C to exit)..."
            sleep 1
            docker-compose logs -f
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac
}

# Main menu
if [ $# -eq 0 ]; then
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the application"
    echo "  stop    - Stop the application"
    echo "  restart - Restart the application"
    echo "  status  - Show application status"
    echo "  logs    - View application logs"
    echo ""
    exit 1
fi

case "$1" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        restart_app
        ;;
    status)
        status_app
        ;;
    logs)
        logs_app
        ;;
    *)
        echo "Invalid command: $1"
        echo "Use: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
