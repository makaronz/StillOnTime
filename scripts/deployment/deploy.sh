#!/bin/bash

# StillOnTime Deployment Script
# Usage: ./deploy.sh [environment] [version]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
NAMESPACE="stillontime"

if [ "$ENVIRONMENT" = "production" ]; then
    NAMESPACE="stillontime"
else
    NAMESPACE="stillontime-staging"
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        exit 1
    fi

    # Check if connected to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Not connected to Kubernetes cluster"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace $NAMESPACE does not exist. Creating..."
        kubectl create namespace "$NAMESPACE"
    fi

    log_success "Prerequisites check passed"
}

# Build and push Docker images
build_and_push() {
    log_info "Building and pushing Docker images..."

    cd "$PROJECT_ROOT"

    # Build backend image
    log_info "Building backend image..."
    docker build -f infrastructure/docker/Dockerfile.backend -t ghcr.io/ruvnet/stillontime/backend:"$VERSION" .

    # Build frontend image
    log_info "Building frontend image..."
    docker build -f infrastructure/docker/Dockerfile.frontend -t ghcr.io/ruvnet/stillontime/frontend:"$VERSION" .

    # Push images
    log_info "Pushing images to registry..."
    docker push ghcr.io/ruvnet/stillontime/backend:"$VERSION"
    docker push ghcr.io/ruvnet/stillontime/frontend:"$VERSION"

    log_success "Images built and pushed successfully"
}

# Update Kubernetes manifests
update_manifests() {
    log_info "Updating Kubernetes manifests..."

    # Update image tags in deployments
    kubectl set image deployment/backend backend=ghcr.io/ruvnet/stillontime/backend:"$VERSION" -n "$NAMESPACE"
    kubectl set image deployment/frontend frontend=ghcr.io/ruvnet/stillontime/frontend:"$VERSION" -n "$NAMESPACE"

    log_success "Kubernetes manifests updated"
}

# Wait for rollout
wait_for_rollout() {
    log_info "Waiting for rollout to complete..."

    # Wait for backend rollout
    kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=600s

    # Wait for frontend rollout
    kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=600s

    log_success "Rollout completed successfully"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."

    # Get the application URL
    if [ "$ENVIRONMENT" = "production" ]; then
        APP_URL="https://stillontime.app"
        API_URL="https://api.stillontime.app"
    else
        APP_URL="https://staging.stillontime.app"
        API_URL="https://api.staging.stillontime.app"
    fi

    # Wait for application to be ready
    sleep 30

    # Check frontend health
    if curl -f -s "$APP_URL/health" > /dev/null; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        exit 1
    fi

    # Check backend health
    if curl -f -s "$API_URL/health" > /dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        exit 1
    fi

    log_success "All health checks passed"
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."

    cd "$PROJECT_ROOT"

    # Run smoke tests against deployed environment
    if [ "$ENVIRONMENT" = "production" ]; then
        npm run test:smoke -- --baseUrl=https://stillontime.app
    else
        npm run test:smoke -- --baseUrl=https://staging.stillontime.app
    fi

    log_success "Smoke tests passed"
}

# Notify deployment
notify_deployment() {
    log_info "Sending deployment notification..."

    # Send Slack notification if webhook is configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 StillOnTime v$VERSION deployed to $ENVIRONMENT successfully\"}"
    fi

    log_success "Deployment notification sent"
}

# Rollback function
rollback() {
    log_warning "Initiating rollback..."

    # Rollback to previous revision
    kubectl rollout undo deployment/backend -n "$NAMESPACE"
    kubectl rollout undo deployment/frontend -n "$NAMESPACE"

    # Wait for rollback to complete
    kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=600s
    kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=600s

    log_success "Rollback completed"
}

# Main deployment function
deploy() {
    log_info "Starting deployment to $ENVIRONMENT with version $VERSION"

    check_prerequisites

    if [ "$SKIP_BUILD" != "true" ]; then
        build_and_push
    fi

    update_manifests
    wait_for_rollout
    run_health_checks

    if [ "$RUN_TESTS" = "true" ]; then
        run_smoke_tests
    fi

    notify_deployment

    log_success "Deployment to $ENVIRONMENT completed successfully"
}

# Handle script arguments
case "${1:-}" in
    "staging"|"production")
        deploy
        ;;
    "rollback")
        rollback
        ;;
    "health")
        run_health_checks
        ;;
    "test")
        run_smoke_tests
        ;;
    *)
        echo "Usage: $0 [staging|production|rollback|health|test] [version]"
        echo ""
        echo "Environment variables:"
        echo "  SKIP_BUILD=true     Skip building and pushing images"
        echo "  RUN_TESTS=true      Run smoke tests after deployment"
        echo "  SLACK_WEBHOOK=URL   Send Slack notification"
        exit 1
        ;;
esac