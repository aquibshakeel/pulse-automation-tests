#!/bin/bash

###############################################################################
# Local MFT Test Execution Script
# This script sets up the environment and runs MFT tests locally
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Cleanup function to run on exit
cleanup() {
    if [ "$CLEANUP_ON_EXIT" = "true" ]; then
        print_header "Cleaning Up Services"
        docker-compose down -v 2>/dev/null || true
        print_success "Cleanup completed"
    fi
}

# Register cleanup function
trap cleanup EXIT

# Configuration
CLEANUP_ON_EXIT=${CLEANUP_ON_EXIT:-false}
SKIP_INSTALL=${SKIP_INSTALL:-false}
SKIP_SERVICES=${SKIP_SERVICES:-false}
TEST_SUITE=${TEST_SUITE:-mf}  # mf, service-a, service-b, all

###############################################################################
# Main Execution
###############################################################################

print_header "🚀 Pulse MFT Test Execution - Local Mode"

# Step 1: Validate Prerequisites
print_header "Step 1: Validating Prerequisites"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_info "Node.js: $(node --version)"

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_info "npm: $(npm --version)"

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi
print_info "Docker: $(docker --version)"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi
print_info "Docker Compose: $(docker-compose --version)"

print_success "All prerequisites validated"

# Step 2: Install Dependencies
if [ "$SKIP_INSTALL" = "false" ]; then
    print_header "Step 2: Installing Dependencies"
    
    if [ -f "yarn.lock" ]; then
        print_info "Using Yarn for dependency installation..."
        yarn install
    else
        print_info "Using npm for dependency installation..."
        npm install
    fi
    
    print_info "Installing Playwright browsers..."
    npx playwright install --with-deps chromium
    
    print_success "Dependencies installed successfully"
else
    print_warning "Skipping dependency installation (SKIP_INSTALL=true)"
fi

# Step 3: Setup Environment
print_header "Step 3: Setting Up Environment"

if [ ! -f ".env" ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_success ".env file created"
else
    print_warning ".env file already exists"
fi

# Step 4: Start Services
if [ "$SKIP_SERVICES" = "false" ]; then
    print_header "Step 4: Starting Test Infrastructure"
    
    print_info "Starting Docker services..."
    docker-compose up -d
    
    print_info "Waiting for services to be ready..."
    sleep 15
    
    # Check service status
    print_info "Verifying service status..."
    docker-compose ps
    
    # Wait for Kafka
    print_info "Waiting for Kafka to be ready..."
    RETRY_COUNT=0
    MAX_RETRIES=30
    until docker exec pulse-kafka kafka-topics --bootstrap-server localhost:9092 --list &> /dev/null; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            print_error "Kafka failed to start within timeout"
            docker-compose logs kafka
            exit 1
        fi
        sleep 2
    done
    print_success "Kafka is ready"
    
    # Wait for MongoDB
    print_info "Waiting for MongoDB to be ready..."
    RETRY_COUNT=0
    until docker exec pulse-mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            print_error "MongoDB failed to start within timeout"
            docker-compose logs mongodb
            exit 1
        fi
        sleep 2
    done
    print_success "MongoDB is ready"
    
    print_success "All services started successfully"
else
    print_warning "Skipping service startup (SKIP_SERVICES=true)"
fi

# Step 5: Run Tests
print_header "Step 5: Running Tests"

case "$TEST_SUITE" in
    mf|mft)
        print_info "Running MFT Order Management tests..."
        npm run test:mf
        ;;
    service-a)
        print_info "Running Service A tests..."
        npm run test:service-a
        ;;
    service-b)
        print_info "Running Service B tests..."
        npm run test:service-b
        ;;
    smoke)
        print_info "Running Smoke tests..."
        npm run test:smoke
        ;;
    all)
        print_info "Running all tests..."
        npm test
        ;;
    *)
        print_error "Unknown test suite: $TEST_SUITE"
        print_info "Available options: mf, service-a, service-b, smoke, all"
        exit 1
        ;;
esac

print_success "Tests completed successfully!"

# Step 6: Generate Report
print_header "Step 6: Generating Test Report"

if [ -d "reports" ]; then
    print_info "Opening test report..."
    npm run report &
    print_success "Report generated and opened in browser"
else
    print_warning "No reports directory found"
fi

print_header "🎉 Test Execution Completed Successfully!"

print_info "Report location: reports/index.html"
print_info ""
print_info "Useful commands:"
print_info "  - View logs: docker-compose logs [service]"
print_info "  - Stop services: docker-compose down"
print_info "  - Clean volumes: docker-compose down -v"
print_info "  - Rerun tests: SKIP_INSTALL=true SKIP_SERVICES=true ./scripts/run-tests-local.sh"
