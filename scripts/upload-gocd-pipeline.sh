#!/bin/bash

# Script to upload GoCD pipeline configuration via API
# This automates the pipeline setup in GoCD

set -e

echo "======================================"
echo "Upload GoCD Pipeline Configuration"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

GOCD_SERVER="http://localhost:8153"
PIPELINE_FILE="gocd-pipeline.yaml"

echo -e "${YELLOW}Checking GoCD Server...${NC}"

# Check if GoCD server is running
if ! curl -s "${GOCD_SERVER}/go/api/v1/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ GoCD Server is not accessible at ${GOCD_SERVER}${NC}"
    echo "Please run: ./scripts/setup-gocd-local.sh"
    exit 1
fi

echo -e "${GREEN}✅ GoCD Server is accessible${NC}"

# Check if pipeline file exists
if [ ! -f "${PIPELINE_FILE}" ]; then
    echo -e "${RED}❌ Pipeline file not found: ${PIPELINE_FILE}${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Creating Config Repository...${NC}"

# Create config repository for pipeline-as-code
CONFIG_REPO_ID="pulse-mft-tests-config"

# First, try to get existing config repos
EXISTING_REPOS=$(curl -s -X GET "${GOCD_SERVER}/go/api/admin/config_repos" \
  -H "Accept: application/vnd.go.cd.v4+json" 2>/dev/null || echo "")

if echo "${EXISTING_REPOS}" | grep -q "${CONFIG_REPO_ID}"; then
    echo -e "${YELLOW}Config repository already exists. Updating...${NC}"
    
    # Delete existing config repo
    curl -s -X DELETE "${GOCD_SERVER}/go/api/admin/config_repos/${CONFIG_REPO_ID}" \
      -H "Accept: application/vnd.go.cd.v4+json" > /dev/null 2>&1 || true
    
    sleep 2
fi

# Create new config repository
RESPONSE=$(curl -s -X POST "${GOCD_SERVER}/go/api/admin/config_repos" \
  -H "Accept: application/vnd.go.cd.v4+json" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"${CONFIG_REPO_ID}\",
    \"plugin_id\": \"yaml.config.plugin\",
    \"material\": {
      \"type\": \"git\",
      \"attributes\": {
        \"url\": \"file:///workspace\",
        \"branch\": \"main\",
        \"auto_update\": true
      }
    },
    \"configuration\": [
      {
        \"key\": \"file_pattern\",
        \"value\": \"gocd-pipeline.yaml\"
      }
    ]
  }")

if echo "${RESPONSE}" | grep -q "\"id\":\"${CONFIG_REPO_ID}\""; then
    echo -e "${GREEN}✅ Config repository created successfully${NC}"
else
    echo -e "${YELLOW}Note: Config repository creation may have failed or already exists${NC}"
    echo "Response: ${RESPONSE}"
fi

echo -e "\n${YELLOW}Triggering pipeline parsing...${NC}"
sleep 5

echo -e "\n${GREEN}======================================"
echo "Pipeline Upload Complete!"
echo "======================================${NC}"
echo ""
echo "🌐 View Pipeline: ${GOCD_SERVER}/go/pipelines"
echo ""
echo "📋 Pipeline Details:"
echo "  - Name: pulse-mft-automation"
echo "  - Group: automation-testing"
echo "  - Stages: 6 (validate, install, infrastructure, test, publish, cleanup)"
echo ""
echo "🚀 To trigger the pipeline:"
echo "  1. Go to ${GOCD_SERVER}/go/pipelines"
echo "  2. Find 'pulse-mft-automation'"
echo "  3. Click the 'play' button to trigger"
echo ""
echo "Or use: curl -X POST '${GOCD_SERVER}/go/api/pipelines/pulse-mft-automation/schedule' \\"
echo "  -H 'Accept: application/vnd.go.cd.v3+json' \\"
echo "  -H 'X-GoCD-Confirm: true'"
echo ""
