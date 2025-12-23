# ActionAgent 🤖

> **Transform meeting conversations into actionable work items—automatically.**

ActionAgent is a Microsoft Teams bot that parses meeting transcripts after a call ends, extracts actionable technical tasks using Azure OpenAI (GPT-4), and creates work items in Azure DevOps automatically. Built on the "One Microsoft" stack for seamless enterprise integration.

## 🎯 The Problem It Solves

| Pain Point | ActionAgent Solution |
|------------|---------------------|
| ⏰ Hours spent manually reviewing meeting recordings | AI extracts action items in seconds |
| 📝 Action items lost or forgotten after meetings | Automatic work item creation in Azure DevOps |
| 🔄 Manual copy-paste from notes to ticket systems | Direct Graph API → OpenAI → DevOps pipeline |
| 👥 Unclear task ownership after discussions | Intelligent assignee resolution via Azure AD |
| 📊 No visibility into meeting-to-work conversion | Built-in telemetry and metrics |

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

### Data Flow

1. **User triggers** ActionAgent in Teams (`@ActionAgent process <meeting-id>`)
2. **Graph API** retrieves meeting transcript (VTT format)
3. **Azure OpenAI** extracts structured action items with assignees & priorities
4. **Identity Service** resolves assignee names to Azure AD users
5. **DevOps API** creates Bug/Task/User Story work items
6. **Adaptive Card** displays results with links back to user

## ✨ Features

- 🎙️ **Transcript Processing** - Parses VTT transcripts with speaker attribution
- 🧠 **AI Extraction** - GPT-4o identifies action items, assignees, priorities, and deadlines
- 📋 **Work Item Creation** - Creates Bugs, Tasks, or User Stories in Azure DevOps
- 👤 **Identity Resolution** - Maps spoken names to Azure AD users
- 🔄 **Retry Logic** - Exponential backoff for API resilience
- 📊 **Telemetry** - Structured logging and metrics for observability
- 🏥 **Health Endpoints** - `/health`, `/ready`, `/live`, `/metrics` for monitoring
- 🎨 **Adaptive Cards** - Rich Teams UI with actionable buttons

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Azure subscription with:
  - Azure AD app registration
  - Azure OpenAI resource (GPT-4o deployment)
  - Azure Bot Service
- Azure DevOps organization with PAT token
- Microsoft 365 tenant with Teams

### Installation

```powershell
# Clone the repository
git clone https://github.com/JackAmichai/ActionAgent.git
cd ActionAgent

# Install dependencies
npm install

# Copy environment template
Copy-Item .env.sample .env

# Edit .env with your credentials
notepad .env

# Build the project
npm run build

# Start the bot
npm start
```

### Environment Variables

Create a `.env` file with the following:

```env
# Azure AD / Entra ID
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Azure DevOps
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PROJECT=YourProject
AZURE_DEVOPS_PAT=your-personal-access-token

# Bot Framework
BOT_ID=your-bot-id
BOT_PASSWORD=your-bot-password

# Server (optional)
PORT=3978
```

## 📱 Teams Commands

| Command | Description |
|---------|-------------|
| `@ActionAgent process <meeting-id>` | Process transcript and create work items |
| `@ActionAgent list` | List recent meetings with transcripts |
| `@ActionAgent health` | Show bot health status |
| `@ActionAgent help` | Display available commands |

## 🔐 Required Permissions

### Microsoft Graph API (Application)

| Permission | Purpose |
|------------|---------|
| `OnlineMeetings.Read.All` | Read meeting metadata |
| `OnlineMeetingTranscript.Read.All` | Access meeting transcripts |
| `User.Read.All` | Resolve user identities |

> ⚠️ **Important**: These permissions require **admin consent** in your Azure AD tenant.

### Azure DevOps PAT Scopes

- `Work Items (Read & Write)`
- `Project and Team (Read)`

## 🧪 Development

```powershell
# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

### Project Structure

```
src/
├── index.ts              # Entry point with health endpoints
├── config.ts             # Centralized configuration
├── teamsBot.ts           # Bot command handling
├── services/
│   ├── graphService.ts   # Microsoft Graph API client
│   ├── aiService.ts      # Azure OpenAI integration
│   ├── devopsService.ts  # Azure DevOps API client
│   └── identityService.ts # Azure AD user resolution
├── utils/
│   ├── errorHandling.ts  # Retry logic & error types
│   └── telemetry.ts      # Logging & metrics
├── models/
│   └── actionItem.ts     # Type definitions
└── cards/
    └── summaryCard.ts    # Adaptive Card templates

tests/
├── setup.ts              # Test environment setup
├── services/             # Service unit tests
├── utils/                # Utility tests
└── cards/                # Card tests

appPackage/
└── manifest.json         # Teams app manifest
```

## 🚢 Deployment

### Azure Web App

```powershell
# Build the app
npm run build

# Deploy using Azure CLI
az webapp up --name actionagent-bot --resource-group your-rg --runtime "NODE:18-lts"
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3978
CMD ["node", "dist/index.js"]
```

### Teams App Installation

1. Build the Teams package: `npm run package`
2. Upload `appPackage/actionagent.zip` to Teams Admin Center
3. Or sideload for development in Teams

## 📊 Monitoring

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Overall health status |
| `GET /ready` | Readiness probe (K8s) |
| `GET /live` | Liveness probe (K8s) |
| `GET /metrics` | Prometheus-style metrics |

### Example Health Response

```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "metrics": {
    "transcriptsProcessed": 42,
    "actionItemsCreated": 156,
    "workItemsCreated": 156,
    "averageProcessingTime": 4500
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Bot Framework SDK](https://github.com/microsoft/botframework-sdk)
- Powered by [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
- Uses [Adaptive Cards](https://adaptivecards.io/) for rich Teams UI

---

**Made with ❤️ by the ActionAgent team**

*Turn meetings into momentum.*
