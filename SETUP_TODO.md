# ActionAgent Setup TODO List

> **Note**: Complete these tasks from a personal device/account to avoid corporate restrictions.

---

## Phase 1: Prerequisites (Personal Device)

### 1.1 Create Personal Microsoft Account
- [ ] Go to https://account.microsoft.com
- [ ] Create account using personal email (Gmail, etc.)
- [ ] Verify email address
- [ ] **Save credentials securely**

### 1.2 Install Required Tools
- [ ] Install Node.js 18+ from https://nodejs.org
- [ ] Install Git from https://git-scm.com
- [ ] Install VS Code from https://code.visualstudio.com
- [ ] Verify installations:
  ```bash
  node --version   # Should show v18.x or higher
  npm --version    # Should show 9.x or higher
  git --version
  ```

---

## Phase 2: OpenAI Setup (Choose ONE)

### Option A: OpenAI API Direct (Recommended - Easiest)
- [ ] Go to https://platform.openai.com
- [ ] Sign up with personal email
- [ ] Go to Settings → Billing → Add payment method
- [ ] Add $5-10 credit (pay-as-you-go, no subscription)
- [ ] Go to API Keys → Create new secret key
- [ ] **Copy and save the API key** (shown only once!)

**Your values:**
```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o  (or gpt-4o-mini for cheaper)
```

### Option B: Azure Free Trial
- [ ] Sign OUT of Azure if logged into work account
- [ ] Go to https://azure.microsoft.com/free
- [ ] Sign in with PERSONAL Microsoft account
- [ ] Complete free trial signup (requires credit card, won't charge)
- [ ] Get $200 free credit for 30 days

**Then create Azure OpenAI resource:**
- [ ] Go to https://portal.azure.com
- [ ] Search "Azure OpenAI" → Create
- [ ] Fill in:
  - Subscription: Your free trial
  - Resource group: Create new → "actionagent-rg"
  - Region: East US (or nearest)
  - Name: "actionagent-openai"
  - Pricing: Standard S0
- [ ] Click Review + Create → Create
- [ ] Wait for deployment (2-3 minutes)

**Deploy a model:**
- [ ] Go to your Azure OpenAI resource
- [ ] Click "Go to Azure OpenAI Studio"
- [ ] Deployments → Create new deployment
- [ ] Select: gpt-4o (or gpt-4o-mini)
- [ ] Deployment name: "gpt-4o"
- [ ] Click Create

**Get credentials:**
- [ ] In Azure Portal → Your OpenAI resource
- [ ] Keys and Endpoint → Copy KEY 1
- [ ] Copy Endpoint URL

**Your values:**
```
AZURE_OPENAI_ENDPOINT=https://actionagent-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

### Option C: Azure for Students (If Applicable)
- [ ] Go to https://azure.microsoft.com/free/students
- [ ] Verify with .edu email or student ID
- [ ] Get $100 credit without credit card
- [ ] Follow same steps as Option B above

---

## Phase 3: Azure DevOps Setup (Free)

### 3.1 Create Azure DevOps Account
- [ ] Go to https://dev.azure.com
- [ ] Sign in with personal Microsoft account
- [ ] Create a new organization:
  - Organization name: Choose something unique (e.g., "yourname-projects")
- [ ] Create a new project:
  - Project name: "ActionAgentDemo"
  - Visibility: Private
  - Work item process: Agile (recommended) or Scrum

### 3.2 Generate Personal Access Token (PAT)
- [ ] In Azure DevOps, click User Settings (gear icon top right)
- [ ] Select "Personal access tokens"
- [ ] Click "New Token"
- [ ] Fill in:
  - Name: "ActionAgent"
  - Expiration: 90 days (or custom)
  - Scopes: Click "Custom defined", then:
    - [x] Work Items → Read & Write
- [ ] Click Create
- [ ] **COPY THE TOKEN NOW** (shown only once!)

**Your values:**
```
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org-name
AZURE_DEVOPS_PAT=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_DEVOPS_PROJECT=ActionAgentDemo
```

---

## Phase 4: Clone and Configure Project

### 4.1 Clone Repository
```bash
git clone https://github.com/JackAmichai/ActionAgent.git
cd ActionAgent
npm install
```

### 4.2 Create Environment File
- [ ] Copy `.env.sample` to `.env`
- [ ] Fill in your values from above

**For OpenAI Direct (Option A):**
```env
DEMO_MODE=true

# OpenAI Direct (not Azure)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# Azure DevOps
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PAT=your-pat-here
AZURE_DEVOPS_PROJECT=ActionAgentDemo

# Leave Azure OpenAI blank
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_NAME=
```

**For Azure OpenAI (Option B/C):**
```env
DEMO_MODE=true

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o

# Azure DevOps
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PAT=your-pat-here
AZURE_DEVOPS_PROJECT=ActionAgentDemo

# Leave OpenAI Direct blank
OPENAI_API_KEY=
```

---

## Phase 5: Run the Demo

### 5.1 Build and Test
```bash
npm run build      # Compile TypeScript
npm test           # Run tests (77 should pass)
```

### 5.2 Run Interactive Demo
```bash
npm run demo
```

**Expected flow:**
1. Shows ASCII banner
2. Parses sample transcript
3. Extracts action items using GPT-4o
4. Asks if you want to create work items in DevOps
5. If yes, creates real work items in your Azure DevOps project

### 5.3 Verify in Azure DevOps
- [ ] Go to https://dev.azure.com/your-org/ActionAgentDemo
- [ ] Click "Boards" → "Work Items"
- [ ] You should see the created tasks!

---

## ✅ Success Checklist

After completing all phases, verify:

- [ ] `npm run build` completes without errors
- [ ] `npm test` shows 77 passing tests
- [ ] `npm run demo` runs successfully
- [ ] Action items appear in Azure DevOps
- [ ] GPT-4o correctly extracts tasks from transcript

---

## 🔧 Troubleshooting

### "Invalid API Key" error
- Double-check you copied the full key
- For OpenAI: Key starts with `sk-`
- For Azure: Key is 32 characters hex

### "Project not found" in DevOps
- Verify AZURE_DEVOPS_ORG_URL matches exactly
- Verify AZURE_DEVOPS_PROJECT is the project NAME (not URL)
- Check PAT has Work Items Read & Write scope

### "Model not found" in Azure OpenAI
- Ensure you deployed a model in Azure OpenAI Studio
- AZURE_OPENAI_DEPLOYMENT_NAME must match deployment name exactly

### Build errors
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

---

# 💰 Optional: Paid Paths for Real Data

> These require Microsoft 365 Business licenses and are **not needed for demo mode**.

---

## Option 1: Microsoft 365 Business Basic ($6/user/month)

**What you get:**
- Real Teams meetings with transcription
- Microsoft Graph API access
- Production bot hosting

**Setup:**
1. Go to https://www.microsoft.com/microsoft-365/business
2. Purchase M365 Business Basic license
3. Set up custom domain or use onmicrosoft.com
4. Enable Teams meeting transcription:
   - Teams Admin Center → Meetings → Meeting policies
   - Enable "Transcription"

**Additional .env values needed:**
```env
DEMO_MODE=false
MICROSOFT_APP_ID=your-app-registration-id
MICROSOFT_APP_PASSWORD=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

---

## Option 2: Azure Bot Service (Pay-as-you-go)

**What you get:**
- Production bot infrastructure
- Teams channel integration
- Scalable messaging

**Costs:**
- Free tier: 10,000 messages/month
- Standard: $0.50 per 1,000 messages

**Setup:**
1. Azure Portal → Create "Azure Bot"
2. Connect to Teams channel
3. Deploy your bot code to Azure App Service

---

## Option 3: Full Production Stack

**Complete infrastructure for enterprise use:**

| Service | Cost | Purpose |
|---------|------|---------|
| M365 Business Basic | $6/user/month | Teams + Graph API |
| Azure OpenAI | ~$0.01/1K tokens | AI extraction |
| Azure Bot Service | $0.50/1K messages | Bot hosting |
| Azure App Service | ~$13/month (B1) | Code hosting |
| Application Insights | Free tier | Monitoring |

**Total estimated cost:** ~$25-50/month for light usage

---

## Option 4: Enterprise (Deloitte IT Request)

If you want this running on corporate infrastructure:

1. Submit IT request for:
   - Azure subscription access
   - M365 Developer tenant
   - Azure AD app registration permissions

2. Required approvals:
   - Security review for Graph API permissions
   - Data classification for meeting transcripts
   - Bot Framework registration

3. Compliance considerations:
   - Meeting data retention policies
   - GDPR/privacy for transcript processing
   - Azure OpenAI data processing agreement

---

## Cost Comparison Summary

| Path | Setup Time | Monthly Cost | Data Reality |
|------|------------|--------------|--------------|
| **Demo Mode** | 30 min | $0-5 | Sample transcripts |
| **OpenAI + DevOps** | 1 hour | $5-10 | Real AI, real work items |
| **M365 Business** | 2-3 hours | $30-50 | Real meetings + transcripts |
| **Full Production** | 1-2 days | $50-100 | Enterprise-ready |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTION AGENT SETUP                       │
├─────────────────────────────────────────────────────────────┤
│  OPENAI (pick one):                                         │
│    platform.openai.com     → OPENAI_API_KEY                 │
│    portal.azure.com        → AZURE_OPENAI_* (3 values)      │
│                                                             │
│  DEVOPS (free):                                             │
│    dev.azure.com           → AZURE_DEVOPS_* (3 values)      │
│                                                             │
│  COMMANDS:                                                  │
│    npm install             → Install dependencies           │
│    npm run build           → Compile TypeScript             │
│    npm test                → Run 77 tests                   │
│    npm run demo            → Interactive demo               │
│                                                             │
│  HELP:                                                      │
│    github.com/JackAmichai/ActionAgent                       │
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: December 23, 2025*
