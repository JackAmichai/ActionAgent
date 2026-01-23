import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
  TurnContext,
} from 'botbuilder';
import { ActionAgentBot } from './teamsBot';
import { config } from './config';
import { telemetry } from './utils/telemetry';

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

export const adapter = new CloudAdapter(botFrameworkAuthentication);

// Error handler
adapter.onTurnError = async (context: TurnContext, error: Error) => {
  telemetry.error('[onTurnError] Unhandled error', error);

  // Send error message to user
  try {
    await context.sendActivity(
      '⚠️ Sorry, something went wrong. The error has been logged. Please try again or type `help` for assistance.'
    );
  } catch (sendError) {
    telemetry.error('Failed to send error message to user', sendError as Error);
  }
};

export const bot = new ActionAgentBot();
