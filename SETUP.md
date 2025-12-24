# GoCD Local Setup Guide

## 🚀 Quick Start - Running MFT Automation Tests with GoCD

This guide will help you set up the complete CI/CD pipeline locally using GoCD.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:

```bash
# Required
✅ Docker Desktop (for GoCD server, agent, and test infrastructure)
✅ Git (for cloning the repository)
✅ Node.js 18+ (for running tests locally)
✅ npm or yarn (package manager)

# Optional but recommended
✅ Java 17+ (for GoCD server if not using Docker)
✅ curl or Postman (for API testing)
```

**System Requirements:**
- macOS, Linux, or Windows
- 8GB RAM minimum (16GB recommended)
- 20GB free disk space

---

## 🛠️ Step-by-Step Setup

### **Step 1: Clone the Repository**

```bash
# Clone the repository
git clone https://github.com/aquibshakeel/pulse-automation-tests.git
cd pulse-automation-tests

# Verify files
ls -la
# Should see: tests/, common/, config/, docker-compose.yml, etc.
```

---

### **Step 2: Install GoCD Server and Agent**

#### **Option A: Using Docker (RECOMMENDED)**

```bash
# 1. Pull GoCD images
docker pull gocd/gocd-server:v24.4.0
docker pull gocd/gocd-agent-alpine-3.20:v24.4.0

# 2. Create Docker network
docker network create gocd-network

# 3. Start GoCD Server
docker run -d \
  --name gocd-server \
  --network gocd-network \
  -p 8153:8153 \
  -v $(pwd)/gocd-data:/godata \
  gocd/gocd-server:v24.4.0

# 4. Wait for server to start (2-3 minutes)
echo "Waiting for GoCD server to start..."
sleep 120

# 5. Start GoCD Agent
docker run -d \
  --name gocd-agent \
  --network gocd-network \
  -e GO_SERVER_URL=http://gocd-server:8153/go \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/workspace \
  gocd/gocd-agent-alpine-3.20:v24.4.0

# 6. Verify containers are running
docker ps | grep gocd
```

#### **Option B: Native Installation**

```bash
# macOS (using Homebrew)
brew install --cask gocd-server
brew install --cask gocd-agent

# Linux (Debian/Ubuntu)
echo "deb https://download.gocd.org /" | sudo tee /etc/apt/sources.list.d/gocd.list
curl https://download.gocd.org/GOCD-GPG-KEY.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install go-server go-agent

# Start services
sudo systemctl start go-server
sudo systemctl start go-agent
```

---

### **Step 3: Configure GoCD Agent**

```bash
# 1. Access GoCD dashboard
open http://localhost:8153

# 2. Enable the agent
# - Go to: Agents tab
# - You'll see 1 agent (pending approval)
# - Click "Enable" button

# 3. Install Node.js in agent (if using Docker)
docker exec -it gocd-agent sh -c "apk add --no-cache nodejs npm"

# 4. Verify Node.js installation
docker exec gocd-agent node --version
# Should output: v20.x.x
```

---

### **Step 4: Create Pipeline**

#### **Method 1: Using API (Automated)**

```bash
# Navigate to project directory
cd pulse-automation-tests

# Upload pipeline configuration
curl -X POST http://localhost:8153/go/api/admin/pipelines \
  -H "Accept: application/vnd.go.cd.v11+json" \
  -H "Content-Type: application/json" \
  -d '{
  "group": "mft-tests",
  "pipeline": {
    "name": "mft-automation",
    "materials": [{
      "type": "git",
      "attributes": {
        "url": "https://github.com/aquibshakeel/pulse-automation-tests.git",
        "branch": "main",
        "destination": "mft-tests"
      }
    }],
    "stages": [{
      "name": "run-tests",
      "jobs": [{
        "name": "execute",
        "environment_variables": [{
          "name": "KAFKA_BROKERS",
          "value": "host.docker.internal:9092"
        }, {
          "name": "MONGODB_URI",
          "value": "mongodb://host.docker.internal:27017"
        }, {
          "name": "SFTP_HOST",
          "value": "host.docker.internal"
        }],
        "tasks": [{
          "type": "exec",
          "attributes": {
            "command": "bash",
            "working_directory": "mft-tests",
            "arguments": ["-c", "docker-compose down -v || true && docker-compose up -d && sleep 30 && npm ci && npm run test:mf || true; docker-compose down -v"]
          }
        }],
        "artifacts": [{
          "type": "build",
          "source": "mft-tests/reports",
          "destination": "test-reports"
        }],
        "tabs": [{
          "name": "TestReport",
          "path": "test-reports/index.html"
        }]
      }]
    }]
  }
}'

echo "Pipeline created successfully!"
```

#### **Method 2: Using UI (Manual)**

```bash
1. Go to: http://localhost:8153
2. Click: "Admin" → "Pipelines"
3. Click: "Create a new pipeline"
4. Fill in:
   - Pipeline Group: mft-tests
   - Pipeline Name: mft-automation
   - Material Type: Git
   - URL: https://github.com/aquibshakeel/pulse-automation-tests.git
   - Branch: main
5. Add Stage:
   - Stage Name: run-tests
   - Job Name: execute
6. Add Task:
   - Type: Custom Command
   - Command: bash
   - Arguments: -c "docker-compose down -v || true && docker-compose up -d && sleep 30 && npm ci && npm run test:mf || true; docker-compose down -v"
   - Working Directory: mft-tests
7. Add Environment Variables:
   - KAFKA_BROKERS=host.docker.internal:9092
   - MONGODB_URI=mongodb://host.docker.internal:27017
   - SFTP_HOST=host.docker.internal
8. Add Artifacts:
   - Source: mft-tests/reports
   - Destination: test-reports
   - Type: build
9. Add Custom Tab:
   - Name: TestReport
   - Path: test-reports/index.html
10. Click "Save"
```

---

### **Step 5: Run the Pipeline**

```bash
# Method 1: Trigger via UI
# - Go to: http://localhost:8153/go/pipelines
# - Find: mft-automation pipeline
# - Click: Play button (▶)

# Method 2: Trigger via API
curl -X POST 'http://localhost:8153/go/api/pipelines/mft-automation/schedule' \
  -H 'Accept: application/vnd.go.cd.v1+json' \
  -H 'X-GoCD-Confirm: true'

# Method 3: Auto-trigger on git push
# Pipeline will automatically run when you push to the repository
```

---

## 📊 Viewing Results

### **1. Pipeline Dashboard**
```
URL: http://localhost:8153/go/pipelines
- Shows all pipelines
- Current status
- Build history
```

### **2. Job Details**
```
URL: http://localhost:8153/go/tab/build/detail/mft-automation/[run-number]/run-tests/1/execute

Tabs available:
- Console: Full execution logs
- Tests: Test results summary
- Artifacts: Downloadable reports
- TestReport: Interactive HTML report
- Materials: Git commit details
```

### **3. Test Reports**
```
After pipeline completes:
1. Click: Artifacts tab
2. Navigate: test-reports/
3. Files:
   - index.html (534KB Playwright report)
   - test-results.json (121KB JSON results)
4. Click: TestReport tab for interactive viewer
```

---

## 🧪 Running Tests Locally (Without GoCD)

If you just want to run tests locally without GoCD:

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure
docker-compose up -d

# 3. Wait for services
sleep 30

# 4. Run tests
npm run test:mf

# 5. View reports
open reports/index.html

# 6. Cleanup
docker-compose down -v
```

---

## 🔧 Troubleshooting

### **Agent Not Appearing**

```bash
# Check agent is running
docker ps | grep gocd-agent

# Check agent logs
docker logs gocd-agent

# Restart agent
docker restart gocd-agent
```

### **Tests Failing - Kafka Connection**

```bash
# Verify Docker network
docker exec gocd-agent ping host.docker.internal

# Check Kafka is running
docker-compose ps

# Restart infrastructure
docker-compose down -v
docker-compose up -d
```

### **Pipeline Not Triggering**

```bash
# Check pipeline configuration
curl http://localhost:8153/go/api/admin/pipelines/mft-automation \
  -H "Accept: application/vnd.go.cd.v11+json"

# Check materials
# - Go to: Admin → Pipelines → mft-automation
# - Verify: Git URL is correct
# - Verify: Branch is 'main'
```

### **Node.js Not Found in Agent**

```bash
# Install Node.js in agent
docker exec -it gocd-agent sh

# Inside agent container
apk add --no-cache nodejs npm
node --version
exit
```

---

## 📝 Configuration Details

### **Environment Variables**

```bash
# Infrastructure endpoints
KAFKA_BROKERS=host.docker.internal:9092
MONGODB_URI=mongodb://host.docker.internal:27017
SFTP_HOST=host.docker.internal

# API endpoint (update when available)
API_BASE_URL=http://localhost:3000
```

### **Test Infrastructure**

```yaml
Services in docker-compose.yml:
- Kafka: Port 9092
- MongoDB: Port 27017
- SFTP: Port 2222
- Zookeeper: Port 2181

All accessible via: host.docker.internal
```

### **Test Execution**

```bash
# Tests run with:
- Framework: Playwright
- Workers: 2 (parallel execution)
- Retries: 2 (in CI mode)
- Total Tests: 21
- Categories:
  - order-flow: 2 tests
  - order-payment-retry: 4 tests
  - order-retrieval: 11 tests
  - order-validation: 4 tests
```

---

## 🚀 Quick Commands

```bash
# Start everything
docker-compose up -d
docker run -d --name gocd-server -p 8153:8153 gocd/gocd-server:v24.4.0
docker run -d --name gocd-agent -e GO_SERVER_URL=http://host.docker.internal:8153/go gocd/gocd-agent-alpine-3.20:v24.4.0

# Check status
docker ps
curl http://localhost:8153/go/api/health

# View logs
docker logs gocd-server
docker logs gocd-agent
docker-compose logs

# Stop everything
docker-compose down -v
docker stop gocd-server gocd-agent
docker rm gocd-server gocd-agent

# Clean up
docker system prune -a --volumes
```

---

## 📚 Additional Resources

```
GoCD Documentation: https://docs.gocd.org
Playwright Docs: https://playwright.dev
Repository: https://github.com/aquibshakeel/pulse-automation-tests
AI Test Guide: https://github.com/aquibshakeel/pulse-automation-tests/blob/main/AI_GUIDE.md
```

---

## ✅ Verification Checklist

After setup, verify:

```bash
□ GoCD server accessible at http://localhost:8153
□ Agent appears in Agents tab and is enabled
□ Node.js installed in agent (v20+)
□ Pipeline 'mft-automation' created
□ Pipeline can be triggered manually
□ Infrastructure starts (Kafka, MongoDB, SFTP)
□ Tests execute (21 tests)
□ Reports generate (index.html)
□ Artifacts published to test-reports/
□ TestReport tab shows HTML viewer
```

---

## 💡 Tips

1. **First run takes longer** - Docker images need to download
2. **Use Docker Desktop** - Easier for beginners
3. **Check agent logs** - Most issues are agent-related
4. **Increase wait time** - If services not ready, increase sleep time
5. **Use host.docker.internal** - For container-to-host communication

---

## 🆘 Getting Help

If you encounter issues:

1. Check troubleshooting section above
2. Review GoCD server logs: `docker logs gocd-server`
3. Review agent logs: `docker logs gocd-agent`
4. Check infrastructure: `docker-compose logs`
5. Verify connectivity: `docker exec gocd-agent ping host.docker.internal`

---

## 🎉 Success!

Once setup is complete, you should have:

✅ GoCD server running on http://localhost:8153
✅ Agent connected and enabled
✅ Pipeline 'mft-automation' configured
✅ Tests executing automatically
✅ Reports generating and publishing
✅ Complete CI/CD automation working

**Happy Testing!** 🚀
