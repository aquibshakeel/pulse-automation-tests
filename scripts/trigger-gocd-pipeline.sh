#!/bin/bash

# Script to trigger the GoCD pipeline

set -e

echo "======================================"
echo "Trigger GoCD Pipeline"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

GOCD_SERVER="http://localhost:8153"
PIPELINE_NAME="pulse-mft-automation"

echo -e "${YELLOW}Checking GoCD Server...${NC}"

# Check if GoCD server is running
if ! curl -s "${GOCD_SERVER}/go/api/v1/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ GoCD Server is not accessible at ${GOCD_SERVER}${NC}"
    echo "Please run: ./scripts/setup-gocd-local.sh"
    exit 1
fi

echo -e "${GREEN}✅ GoCD Server is accessible${NC}"

echo -e "\n${YELLOW}Triggering pipeline: ${PIPELINE_NAME}...${NC}"

# Trigger the pipeline
RESPONSE=$(curl -s -X POST "${GOCD_SERVER}/go/api/pipelines/${PIPELINE_NAME}/schedule" \
  -H "Accept: application/vnd.go.cd.v1+json" \
  -H "X-GoCD-Confirm: true" \
  -H "Content-Type: application/json" \
  2>&1)

if echo "${RESPONSE}" | grep -q "message"; then
    echo -e "${GREEN}✅ Pipeline triggered successfully!${NC}"
    echo ""
    echo "Message: $(echo ${RESPONSE} | grep -o '"message":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${YELLOW}Note: Pipeline trigger response:${NC}"
    echo "${RESPONSE}"
fi

echo -e "\n${GREEN}======================================"
echo "Pipeline Triggered!"
echo "======================================${NC}"
echo ""
echo "🌐 Monitor Pipeline: ${GOCD_SERVER}/go/pipelines/${PIPELINE_NAME}"
echo ""
echo "📊 Pipeline Stages:"
echo "  1. validate-environment   - Check prerequisites"
echo "  2. install-dependencies   - Install npm packages"
echo "  3. start-infrastructure   - Start Docker services"
echo "  4. run-mft-tests         - Execute tests"
echo "  5. publish-results       - Generate reports"
echo "  6. cleanup               - Clean up resources"
echo ""
echo "⏱️  Expected Duration: 5-10 minutes"
echo ""
echo "💡 View logs:"
echo "   docker logs -f gocd-server"
echo "   docker logs -f gocd-agent"
echo ""
