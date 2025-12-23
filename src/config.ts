/**
 * Centralized Configuration Module
 * All environment variables and settings are validated and exported from here
 * 
 * NEVER access process.env directly in other files - always use this module
 */

import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Environment variable validation
 */
function requireEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(
      `❌ Missing required environment variable: ${name}\n` +
      `   Please copy .env.sample to .env and fill in all values.`
    );
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Azure AD / Entra ID Configuration
 */
export const azureAd = {
  tenantId: requireEnv("AZURE_TENANT_ID"),
  clientId: requireEnv("AZURE_CLIENT_ID"),
  clientSecret: requireEnv("AZURE_CLIENT_SECRET"),
} as const;

/**
 * Azure OpenAI Configuration
 */
export const azureOpenAI = {
  endpoint: requireEnv("AZURE_OPENAI_ENDPOINT"),
  apiKey: requireEnv("AZURE_OPENAI_KEY"),
  deployment: optionalEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"),
  apiVersion: optionalEnv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview"),
  maxTokens: parseInt(optionalEnv("AZURE_OPENAI_MAX_TOKENS", "4000"), 10),
  temperature: parseFloat(optionalEnv("AZURE_OPENAI_TEMPERATURE", "0.3")),
} as const;

/**
 * Azure DevOps Configuration
 */
export const azureDevOps = {
  orgUrl: requireEnv("AZURE_DEVOPS_ORG_URL"),
  pat: requireEnv("AZURE_DEVOPS_PAT"),
  project: optionalEnv("AZURE_DEVOPS_PROJECT", "Engineering"),
  defaultWorkItemType: optionalEnv("AZURE_DEVOPS_DEFAULT_TYPE", "Task"),
  defaultAreaPath: optionalEnv("AZURE_DEVOPS_AREA_PATH", ""),
  defaultIterationPath: optionalEnv("AZURE_DEVOPS_ITERATION_PATH", ""),
  triageUser: optionalEnv("AZURE_DEVOPS_TRIAGE_USER", ""),
} as const;

/**
 * Bot Framework Configuration
 */
export const bot = {
  id: requireEnv("BOT_ID"),
  password: requireEnv("BOT_PASSWORD"),
  type: optionalEnv("BOT_TYPE", "MultiTenant") as "MultiTenant" | "SingleTenant",
} as const;

/**
 * Server Configuration
 */
export const server = {
  port: parseInt(optionalEnv("PORT", "3978"), 10),
  environment: optionalEnv("NODE_ENV", "development"),
  logLevel: optionalEnv("LOG_LEVEL", "info") as "debug" | "info" | "warn" | "error",
} as const;

/**
 * Feature Flags
 */
export const features = {
  enableTelemetry: optionalEnv("ENABLE_TELEMETRY", "true") === "true",
  enableRetries: optionalEnv("ENABLE_RETRIES", "true") === "true",
  maxRetries: parseInt(optionalEnv("MAX_RETRIES", "3"), 10),
  retryDelayMs: parseInt(optionalEnv("RETRY_DELAY_MS", "1000"), 10),
} as const;

/**
 * Priority Mapping: Text → Azure DevOps integer values
 * ADO Priority: 1 = Highest, 4 = Lowest
 */
export const priorityMap: Record<string, number> = {
  Critical: 1,
  High: 1,
  Medium: 2,
  Normal: 2,
  Low: 3,
  Lowest: 4,
};

/**
 * Validate all configuration at startup
 */
export function validateConfig(): void {
  console.log("🔧 Validating configuration...");
  
  // Force evaluation of all required configs
  const configs = [azureAd, azureOpenAI, azureDevOps, bot, server];
  
  console.log(`✅ Configuration validated successfully`);
  console.log(`   Environment: ${server.environment}`);
  console.log(`   Azure DevOps Project: ${azureDevOps.project}`);
  console.log(`   OpenAI Deployment: ${azureOpenAI.deployment}`);
}

/**
 * Export all config as a single object for convenience
 */
export const config = {
  azureAd,
  azureOpenAI,
  azureDevOps,
  bot,
  server,
  features,
  priorityMap,
} as const;

export default config;
