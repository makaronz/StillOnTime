#!/bin/bash

# StillOnTime Health Check Script
# Usage: ./health-check.sh [environment] [timeout]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT=${1:-staging}
TIMEOUT=${2:-300}
NAMESPACE="stillontime"

if [ "$ENVIRONMENT" = "production" ]; then
    NAMESPACE="stillontime"
    FRONTEND_URL="https://stillontime.app"
    API_URL="https://api.stillontime.app"
else
    NAMESPACE="stillontime-staging"
    FRONTEND_URL="https://staging.stillontime.app"
    API_URL="https://api.staging.stillontime.app"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check results
HEALTHY_SERVICES=0
TOTAL_SERVICES=0

# Check Kubernetes components
check_kubernetes_components() {
    log_info "Checking Kubernetes components..."

    # Check namespace
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_success "Namespace $NAMESPACE exists"
        ((HEALTHY_SERVICES++))
    else
        log_error "Namespace $NAMESPACE not found"
    fi
    ((TOTAL_SERVICES++))

    # Check deployments
    DEPLOYMENTS=("backend" "frontend" "postgres" "redis")
    for deployment in "${DEPLOYMENTS[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            STATUS=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
            REPLICAS=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')

            if [ "$STATUS" = "$REPLICAS" ] && [ "$STATUS" != "0" ]; then
                log_success "Deployment $deployment: $STATUS/$REPLICAS replicas ready"
                ((HEALTHY_SERVICES++))
            else
                log_error "Deployment $deployment: $STATUS/$REPLICAS replicas ready"
            fi
        else
            log_error "Deployment $deployment not found"
        fi
        ((TOTAL_SERVICES++))
    done

    # Check services
    SERVICES=("backend-service" "frontend-service" "postgres-service" "redis-service")
    for service in "${SERVICES[@]}"; do
        if kubectl get service "$service" -n "$NAMESPACE" &> /dev/null; then
            log_success "Service $service exists"
            ((HEALTHY_SERVICES++))
        else
            log_error "Service $service not found"
        fi
        ((TOTAL_SERVICES++))
    done

    # Check pod status
    FAILED_PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers | wc -l)
    if [ "$FAILED_PODS" -eq 0 ]; then
        log_success "All pods are running"
        ((HEALTHY_SERVICES++))
    else
        log_error "$FAILED_PODS pods are not running"
    fi
    ((TOTAL_SERVICES++))
}

# Check application health endpoints
check_application_health() {
    log_info "Checking application health endpoints..."

    # Frontend health check
    if curl -f -s --max-time 10 "$FRONTEND_URL/health" > /dev/null; then
        log_success "Frontend health check passed"
        ((HEALTHY_SERVICES++))
    else
        log_error "Frontend health check failed"
    fi
    ((TOTAL_SERVICES++))

    # Backend health check
    if curl -f -s --max-time 10 "$API_URL/health" > /dev/null; then
        log_success "Backend health check passed"
        ((HEALTHY_SERVICES++))
    else
        log_error "Backend health check failed"
    fi
    ((TOTAL_SERVICES++))

    # Backend ready check
    if curl -f -s --max-time 10 "$API_URL/ready" > /dev/null; then
        log_success "Backend readiness check passed"
        ((HEALTHY_SERVICES++))
    else
        log_error "Backend readiness check failed"
    fi
    ((TOTAL_SERVICES++))
}

# Check database connectivity
check_database_connectivity() {
    log_info "Checking database connectivity..."

    # PostgreSQL connectivity
    if kubectl exec -n "$NAMESPACE" deployment/postgres -- pg_isready -U postgres -d stillontime > /dev/null 2>&1; then
        log_success "PostgreSQL is ready"
        ((HEALTHY_SERVICES++))
    else
        log_error "PostgreSQL is not ready"
    fi
    ((TOTAL_SERVICES++))

    # Redis connectivity
    if kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli ping > /dev/null 2>&1; then
        log_success "Redis is ready"
        ((HEALTHY_SERVICES++))
    else
        log_error "Redis is not ready"
    fi
    ((TOTAL_SERVICES++))
}

# Check resource usage
check_resource_usage() {
    log_info "Checking resource usage..."

    # Check CPU and memory usage
    CPU_HIGH=false
    MEMORY_HIGH=false

    while IFS= read -r pod; do
        POD_NAME=$(echo "$pod" | awk '{print $1}')
        CPU_USAGE=$(echo "$pod" | awk '{print $2}')
        MEMORY_USAGE=$(echo "$pod" | awk '{print $3}')

        # Convert CPU usage from millicores to percentage
        CPU_PERCENT=$(echo "scale=1; $CPU_USAGE / 10" | bc -l 2>/dev/null || echo "0")

        # Check if usage is high (>80%)
        if (( $(echo "$CPU_PERCENT > 80" | bc -l) )); then
            log_warning "High CPU usage on $POD_NAME: ${CPU_PERCENT}%"
            CPU_HIGH=true
        fi

        if [[ "$MEMORY_USAGE" == *"Mi"* ]]; then
            MEMORY_VALUE=$(echo "$MEMORY_USAGE" | sed 's/Mi//')
            if (( $(echo "$MEMORY_VALUE > 400" | bc -l) )); then
                log_warning "High memory usage on $POD_NAME: ${MEMORY_USAGE}"
                MEMORY_HIGH=true
            fi
        fi
    done < <(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null || echo "")

    if [ "$CPU_HIGH" = false ] && [ "$MEMORY_HIGH" = false ]; then
        log_success "Resource usage is within normal limits"
        ((HEALTHY_SERVICES++))
    else
        log_error "High resource usage detected"
    fi
    ((TOTAL_SERVICES++))
}

# Check external dependencies
check_external_dependencies() {
    log_info "Checking external dependencies..."

    # Google OAuth (if configured)
    if [ -n "$GOOGLE_CLIENT_ID" ]; then
        if curl -f -s --max-time 10 "https://accounts.google.com/.well-known/openid_configuration" > /dev/null; then
            log_success "Google OAuth endpoint is accessible"
            ((HEALTHY_SERVICES++))
        else
            log_error "Google OAuth endpoint is not accessible"
        fi
        ((TOTAL_SERVICES++))
    fi

    # Check SSL certificates
    if curl -s --max-time 10 "$FRONTEND_URL" 2>&1 | grep -q "SSL certificate"; then
        EXPIRY_DATE=$(echo | openssl s_client -servername "$(echo "$FRONTEND_URL" | sed 's|https://||')" -connect "$(echo "$FRONTEND_URL" | sed 's|https://||'):443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))

        if [ "$DAYS_UNTIL_EXPIRY" -gt 30 ]; then
            log_success "SSL certificate is valid for $DAYS_UNTIL_EXPIRY days"
            ((HEALTHY_SERVICES++))
        else
            log_error "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        fi
    else
        log_warning "Could not verify SSL certificate"
    fi
    ((TOTAL_SERVICES++))
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."

    cd "$PROJECT_ROOT"

    # Run API smoke tests
    if npm run test:smoke -- --baseUrl="$API_URL" > /dev/null 2>&1; then
        log_success "API smoke tests passed"
        ((HEALTHY_SERVICES++))
    else
        log_error "API smoke tests failed"
    fi
    ((TOTAL_SERVICES++))

    # Run E2E smoke tests (if available)
    if npm run test:e2e:smoke -- --baseUrl="$FRONTEND_URL" > /dev/null 2>&1; then
        log_success "E2E smoke tests passed"
        ((HEALTHY_SERVICES++))
    else
        log_error "E2E smoke tests failed"
    fi
    ((TOTAL_SERVICES++))
}

# Generate health report
generate_health_report() {
    log_info "Generating health report..."

    HEALTH_PERCENTAGE=$(( HEALTHY_SERVICES * 100 / TOTAL_SERVICES ))

    echo ""
    echo "=========================================="
    echo "StillOnTime Health Check Report"
    echo "=========================================="
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date)"
    echo "Healthy Services: $HEALTHY_SERVICES/$TOTAL_SERVICES"
    echo "Health Percentage: ${HEALTH_PERCENTAGE}%"
    echo "=========================================="

    if [ "$HEALTH_PERCENTAGE" -ge 95 ]; then
        log_success "System is HEALTHY"
        exit 0
    elif [ "$HEALTH_PERCENTAGE" -ge 80 ]; then
        log_warning "System has DEGRADED performance"
        exit 1
    else
        log_error "System is UNHEALTHY"
        exit 2
    fi
}

# Main health check function
health_check() {
    log_info "Starting health check for $ENVIRONMENT environment"
    log_info "Timeout: ${TIMEOUT}s"

    start_time=$(date +%s)

    check_kubernetes_components
    check_application_health
    check_database_connectivity
    check_resource_usage
    check_external_dependencies
    run_smoke_tests

    end_time=$(date +%s)
    duration=$((end_time - start_time))

    log_info "Health check completed in ${duration}s"

    generate_health_report
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [environment] [timeout]"
        echo ""
        echo "Arguments:"
        echo "  environment  Environment to check (staging|production, default: staging)"
        echo "  timeout      Health check timeout in seconds (default: 300)"
        echo ""
        echo "Examples:"
        echo "  $0"
        echo "  $0 production"
        echo "  $0 staging 600"
        exit 0
        ;;
    *)
        health_check
        ;;
esac