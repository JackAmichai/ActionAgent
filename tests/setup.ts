// Test setup file
// Set up environment variables for tests
process.env.AZURE_TENANT_ID = 'test-tenant-id';
process.env.AZURE_CLIENT_ID = 'test-client-id';
process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
process.env.AZURE_OPENAI_KEY = 'test-openai-key';
process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o';
process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/test-org';
process.env.AZURE_DEVOPS_PAT = 'test-pat';
process.env.AZURE_DEVOPS_PROJECT = 'TestProject';
process.env.BOT_ID = 'test-bot-id';
process.env.BOT_PASSWORD = 'test-bot-password';
process.env.NODE_ENV = 'test';
process.env.ENABLE_TELEMETRY = 'false';
process.env.ENABLE_RETRIES = 'false';

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
