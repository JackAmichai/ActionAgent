/**
 * ActionAgent - Entry Point
 * Microsoft Teams Bot for extracting action items from meetings
 * 
 * Stack:
 * - Microsoft Graph API for meeting transcripts
 * - Azure OpenAI (GPT-4o) for intelligent task extraction
 * - Azure DevOps API for work item creation
 * - Bot Framework SDK for Teams integration
 */

import * as restify from "restify";
import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from "botbuilder";
import { ActionAgentBot } from "./teamsBot";
import { config, validateConfig } from "./config";
import { telemetry } from "./utils/telemetry";

// Validate configuration at startup
try {
  validateConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Bot Framework Authentication Configuration
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: config.bot.id,
  MicrosoftAppPassword: config.bot.password,
  MicrosoftAppType: config.bot.type,
  MicrosoftAppTenantId: config.azureAd.tenantId,
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(
  null,
  credentialsFactory
);

const adapter = new CloudAdapter(botFrameworkAuthentication);

// Error handler
adapter.onTurnError = async (context, error) => {
  telemetry.error("[onTurnError] Unhandled error", error);

  // Send error message to user
  try {
    await context.sendActivity(
      "⚠️ Sorry, something went wrong. The error has been logged. Please try again or type `help` for assistance."
    );
  } catch (sendError) {
    telemetry.error("Failed to send error message to user", sendError as Error);
  }

  // In production, log to Application Insights
  // appInsights.defaultClient.trackException({ exception: error });
};

// Create the bot
const bot = new ActionAgentBot();

// Create HTTP server
const server = restify.createServer({
  name: "ActionAgent",
  version: "1.0.0",
});

// Middleware
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser());

// CORS for development
server.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Listen for incoming requests at /api/messages
server.post("/api/messages", async (req, res) => {
  const timer = telemetry.startTimer("HTTP.BotMessage");
  try {
    await adapter.process(req, res, (context) => bot.run(context));
    timer.stop();
  } catch (error) {
    timer.stop();
    telemetry.error("Error processing bot message", error as Error);
    res.send(500, { error: "Internal server error" });
  }
});

// Health check endpoint
server.get("/health", (req, res, next) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: config.server.environment,
    metrics: telemetry.getHealthMetrics(),
  };
  res.send(200, health);
  next();
});

// Readiness probe for Kubernetes/Azure
server.get("/ready", (req, res, next) => {
  res.send(200, { ready: true });
  next();
});

// Liveness probe
server.get("/live", (req, res, next) => {
  res.send(200, { alive: true });
  next();
});

// Metrics endpoint (for monitoring)
server.get("/metrics", (req, res, next) => {
  res.send(200, telemetry.getMetricsSummary());
  next();
});

// Start server
server.listen(config.server.port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖 ActionAgent is running!                                 ║
║                                                              ║
║   Environment: ${config.server.environment.padEnd(42)}║
║   Port: ${String(config.server.port).padEnd(50)}║
║   DevOps Project: ${config.azureDevOps.project.padEnd(38)}║
║   OpenAI Model: ${config.azureOpenAI.deployment.padEnd(40)}║
║                                                              ║
║   Endpoints:                                                 ║
║   • Bot:     http://localhost:${config.server.port}/api/messages              ║
║   • Health:  http://localhost:${config.server.port}/health                    ║
║   • Metrics: http://localhost:${config.server.port}/metrics                   ║
║                                                              ║
║   Use ngrok or Teams Toolkit to expose to Teams.             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  telemetry.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    telemetry.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  telemetry.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    telemetry.info("Server closed");
    process.exit(0);
  });
});
