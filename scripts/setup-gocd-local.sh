#!/bin/bash

# Script to set up GoCD locally for testing
# This will start GoCD server and agent, then configure the pipeline

set -e

echo "======================================"
echo "GoCD Local Setup for MFT Tests"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GOCD_VERSION="v24.4.0"
GOCD_SERVER_PORT="8153"
GOCD_AGENT_KEY="gocd-agent-key-$(date +%s)"

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check if ports are available
if lsof -Pi :${GOCD_SERVER_PORT} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}❌ Port ${GOCD_SERVER_PORT} is already in use${NC}"
    echo "Please stop the service using this port or change GOCD_SERVER_PORT"
    exit 1
fi
echo -e "${GREEN}✅ Port ${GOCD_SERVER_PORT} is available${NC}"

echo -e "\n${YELLOW}Step 2: Starting GoCD Server...${NC}"

# Stop and remove existing GoCD containers if they exist
docker stop gocd-server gocd-agent 2>/dev/null || true
docker rm gocd-server gocd-agent 2>/dev/null || true

# Start GoCD Server
docker run -d \
  --name gocd-server \
  -p ${GOCD_SERVER_PORT}:8153 \
  -v gocd-server-data:/godata \
  -v "$(pwd)":/workspace \
  gocd/gocd-server:${GOCD_VERSION}

echo -e "${GREEN}✅ GoCD Server started on port ${GOCD_SERVER_PORT}${NC}"

echo -e "\n${YELLOW}Step 3: Waiting for GoCD Server to be ready...${NC}"

# Wait for GoCD Server to be ready (can take 2-3 minutes)
RETRY_COUNT=0
MAX_RETRIES=60

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s "http://localhost:${GOCD_SERVER_PORT}/go/api/v1/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ GoCD Server is ready!${NC}"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 3
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "\n${RED}❌ GoCD Server failed to start within timeout${NC}"
        echo "Check logs with: docker logs gocd-server"
        exit 1
    fi
done

echo -e "\n${YELLOW}Step 4: Starting GoCD Agent...${NC}"

# Start GoCD Agent with Docker socket access for running tests
docker run -d \
  --name gocd-agent \
  --link gocd-server:gocd-server \
  -e GO_SERVER_URL=https://gocd-server:8154/go \
  -e AGENT_AUTO_REGISTER_KEY="${GOCD_AGENT_KEY}" \
  -e AGENT_AUTO_REGISTER_RESOURCES="docker,nodejs,playwright" \
  -e AGENT_AUTO_REGISTER_ENVIRONMENTS="pulse-local" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v gocd-agent-data:/godata \
  -v "$(pwd)":/workspace \
  gocd/gocd-agent-docker-dind:${GOCD_VERSION}

echo -e "${GREEN}✅ GoCD Agent started${NC}"

echo -e "\n${YELLOW}Step 5: Waiting for Agent to register (30 seconds)...${NC}"
sleep 30

echo -e "\n${GREEN}======================================"
echo "GoCD Setup Complete!"
echo "======================================${NC}"
echo ""
echo "🌐 GoCD Server URL: http://localhost:${GOCD_SERVER_PORT}"
echo ""
echo "📋 Next Steps:"
echo "  1. Open http://localhost:${GOCD_SERVER_PORT} in your browser"
echo "  2. Navigate to Admin > Config Repositories"
echo "  3. Add a new config repository:"
echo "     - Type: YAML Configuration Plugin"
echo "     - Repository URL: file:///workspace/gocd-pipeline.yaml"
echo "     - Or use the API to upload the pipeline (see below)"
echo ""
echo "🔧 Useful Commands:"
echo "  View Server Logs:  docker logs -f gocd-server"
echo "  View Agent Logs:   docker logs -f gocd-agent"
echo "  Stop GoCD:         docker stop gocd-server gocd-agent"
echo "  Remove GoCD:       docker rm gocd-server gocd-agent"
echo ""
echo "📊 To upload pipeline configuration:"
echo "  ./scripts/upload-gocd-pipeline.sh"
echo ""
echo -e "${YELLOW}Note: First-time GoCD setup may require admin authentication.${NC}"
echo "      Default credentials will be shown in server logs."
echo ""
