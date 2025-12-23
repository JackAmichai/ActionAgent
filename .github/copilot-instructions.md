# ActionAgent - Copilot Instructions

## Project Overview
ActionAgent is a Microsoft Teams bot that uses Azure OpenAI to process meeting transcripts and automatically create Azure DevOps work items.

## Tech Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Bot Framework SDK 4.x
- **APIs**: Microsoft Graph API, Azure OpenAI, Azure DevOps REST API
- **Authentication**: Azure AD (Entra ID) with Client Credentials

## Project Structure
```
src/
├── index.ts              # Application entry point
├── teamsBot.ts           # Main bot logic
├── services/
│   ├── graphService.ts   # Microsoft Graph API client
│   ├── aiService.ts      # Azure OpenAI integration
│   └── devopsService.ts  # Azure DevOps API client
├── models/
│   └── actionItem.ts     # Type definitions
└── cards/
    └── summaryCard.ts    # Adaptive Card templates
```

## Key Patterns
- Use async/await for all API calls
- Environment variables for all secrets (never hardcode)
- Structured JSON responses from OpenAI
- Adaptive Cards for rich Teams responses

## Required Permissions
- `OnlineMeetings.Read.All` (Application)
- `OnlineMeetingTranscript.Read.All` (Application)
- Admin consent required for all Graph permissions
