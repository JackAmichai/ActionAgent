#  ActionAgent

> **AI-powered Teams bot that transforms meeting conversations into Azure DevOps work items**

[![Build Status](https://github.com/JackAmichai/ActionAgent/actions/workflows/ci.yml/badge.svg)](https://github.com/JackAmichai/ActionAgent/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 💡 The Problem

Engineers agree to tasks during meetings but forget to log them:

> *"Sarah, can you fix that login bug?"*  
> *"Mike, update the API docs by Friday"*  
> *"We need unit tests for the payment module"*

These commitments vanish into thin air. **ActionAgent captures them automatically.**

---

## ✨ The Solution

ActionAgent listens to your Teams meetings and:

1. **📝 Captures** - Fetches the meeting transcript via Microsoft Graph
2. **🧠 Analyzes** - Uses GPT-4o to extract technical tasks with owners and priorities
3. **📋 Creates** - Automatically generates work items in Azure DevOps
4. **💬 Reports** - Posts a summary card back to the Teams chat

**Result**: Zero tasks slip through the cracks.

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Microsoft      │────▶│   ActionAgent    │────▶│  Azure DevOps   │
│  Teams          │     │   Bot Service    │     │  Work Items     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            ┌──────────────┐     ┌──────────────┐
            │ MS Graph API │     │ Azure OpenAI │
            │ (Transcripts)│     │ (GPT-4o)     │
            └──────────────┘     └──────────────┘
```

---

## 🚀 Quick Start

### 🎭 Demo Mode (No M365 Required!)

Test the full AI + DevOps pipeline **without** a Microsoft 365 subscription:

```bash
# 1. Clone the repo
git clone https://github.com/JackAmichai/ActionAgent.git
cd ActionAgent

# 2. Install dependencies
npm install

# 3. Create .env file (only OpenAI + DevOps required for demo)
cp .env.sample .env

# 4. Edit .env with your credentials:
#    - AZURE_OPENAI_ENDPOINT
#    - AZURE_OPENAI_KEY
#    - AZURE_DEVOPS_ORG_URL
#    - AZURE_DEVOPS_PAT
#    - AZURE_DEVOPS_PROJECT

# 5. Run the interactive demo
npm run demo
```

The demo uses a mock meeting transcript and shows:
- ✅ GPT-4o extracting action items with assignees & priorities
- ✅ Work items being created in Azure DevOps
- ✅ Full pipeline working end-to-end

---

## 📋 Prerequisites

| Component | Demo Mode | Full Mode | How to Get |
|-----------|:---------:|:---------:|------------|
| Node.js 18+ | ✅ | ✅ | [nodejs.org](https://nodejs.org) |
| Azure OpenAI | ✅ | ✅ | [Azure Portal](https://portal.azure.com) |
| Azure DevOps | ✅ | ✅ | [dev.azure.com](https://dev.azure.com) |
| Microsoft 365 | ❌ | ✅ | [Business Basic Trial](https://www.microsoft.com/microsoft-365/business/microsoft-365-business-basic) |
| Azure AD App | ❌ | ✅ | Azure Portal |

---

## 🔧 Environment Variables

Create a `.env` file:

```bash
# Demo Mode - bypass M365 requirements
DEMO_MODE=true

# Azure OpenAI (REQUIRED)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Azure DevOps (REQUIRED)
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PAT=your-personal-access-token
AZURE_DEVOPS_PROJECT=Engineering

# Azure AD (Required for Full Mode only)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-secret

# Bot Framework (Required for Full Mode only)
BOT_ID=your-client-id
BOT_PASSWORD=your-secret
```

---

## 🎯 Commands

### Demo Mode
```bash
npm run demo    # Interactive demo with mock transcript
```

### Full Mode (requires M365)
```bash
npm start       # Start the Teams bot
npm run dev     # Development mode with ts-node
```

### Development
```bash
npm test              # Run tests
npm run test:coverage # Run tests with coverage
npm run build         # Compile TypeScript
npm run lint          # Lint code
```

---

## 📖 How to Get Azure Resources

### 1. Azure OpenAI

1. Go to [Azure Portal](https://portal.azure.com)
2. Create an **Azure OpenAI** resource
3. Deploy the **gpt-4o** model
4. Copy the **Endpoint** and **Key**

### 2. Azure DevOps

1. Go to [dev.azure.com](https://dev.azure.com)
2. Create an organization and project
3. Go to **User Settings** → **Personal Access Tokens**
4. Create a PAT with **Work Items: Read & Write** scope

### 3. Microsoft 365 (Full Mode Only)

**Option A:** [M365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program) (free, but limited availability)

**Option B:** [M365 Business Basic Trial](https://www.microsoft.com/microsoft-365/business/microsoft-365-business-basic) (free 30 days)

---

## 📁 Project Structure

```
src/
├── index.ts              # Entry point, REST server
├── config.ts             # Centralized configuration (supports demo mode)
├── teamsBot.ts           # Bot command handling
├── demo.ts               # Interactive demo script
├── services/
│   ├── graphService.ts   # Microsoft Graph API
│   ├── aiService.ts      # Azure OpenAI integration
│   ├── devopsService.ts  # Azure DevOps API
│   └── identityService.ts# User identity resolution
├── utils/
│   ├── errorHandling.ts  # Retry logic, error types
│   └── telemetry.ts      # Logging and metrics
├── models/
│   └── actionItem.ts     # Type definitions
└── cards/
    └── summaryCard.ts    # Adaptive Card templates

tests/
├── setup.ts              # Test environment
├── fixtures/
│   └── mock_transcript.vtt # Sample meeting transcript
├── utils/
│   └── utils.test.ts     # Utility tests
└── cards/
    └── cards.test.ts     # Card tests
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**77 tests** covering:
- Error handling & retry logic
- Telemetry service
- Adaptive Card generation

---

## 🔒 Security

- All secrets via environment variables
- Client Credentials flow for Graph API
- PAT for Azure DevOps (recommend Service Principal for production)
- No PII logged
- Correlation IDs for tracing

---

## 🛣️ Roadmap

- [ ] `callEnded` webhook for automatic triggering
- [ ] Azure Key Vault integration
- [ ] User disambiguation dialog
- [ ] Managed Identity support
- [ ] Application Insights telemetry

---

## 📜 License

MIT © Jack Amichai

---

## 🙏 Acknowledgments

Built with the **"One Microsoft"** stack:
- Microsoft Teams + Bot Framework
- Microsoft Graph API
- Azure OpenAI (GPT-4o)
- Azure DevOps

*Turn meetings into momentum.*
