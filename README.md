# MFT Automation Tests - GoCD Pipeline

Automated testing suite for MFT (Mutual Fund Transfer) order management with GoCD CI/CD integration.

## 🚀 Quick Start with GoCD

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- GoCD Server & Agent

### Setup GoCD Pipeline

1. **Start GoCD:**
```bash
./scripts/setup-gocd-local.sh
```

2. **Enable Agent:**
- Go to: http://localhost:8153/go/agents
- Check the agent checkbox
- Click "Enable"

3. **Run Pipeline:**
- Go to: http://localhost:8153/go/pipelines
- Find: `mft-automation` pipeline
- Click: ▶️ Play button

## 📊 Test Suite

- **21 MFT Tests** covering:
  - Order flow (2 tests)
  - Payment retry (4 tests)
  - Order retrieval (11 tests)
  - Validation (4 tests)

## 🏗️ Infrastructure

- Kafka (port 9092)
- MongoDB (port 27017)
- SFTP Server (port 2222)
- Zookeeper (port 2181)

## 📝 Manual Testing

Run tests locally without GoCD:
```bash
npm install
docker-compose up -d
npm run test:mf
```

## 🔗 Links

- **GoCD Dashboard:** http://localhost:8153/go/pipelines
- **GitHub:** https://github.com/aquibshakeel/pulse-automation-tests
