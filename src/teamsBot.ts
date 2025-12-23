/**
 * ActionAgent Teams Bot
 * Main bot logic that orchestrates transcript processing and work item creation
 * 
 * Features:
 * - Command handling with Adaptive Cards
 * - Meeting selection and processing
 * - Health checks and status reporting
 * - Comprehensive error handling with user-friendly messages
 */

import {
  TeamsActivityHandler,
  TurnContext,
  CardFactory,
  TeamsInfo,
} from "botbuilder";
import { getMeetingTranscript, getMeetingDetails, listRecentMeetings, getGraphErrorMessage } from "./services/graphService";
import { extractActionItems } from "./services/aiService";
import { createWorkItems, validateConnection, ExtendedWorkItemResult } from "./services/devopsService";
import {
  createSummaryCard,
  createProcessingCard,
  createErrorCard,
  createMeetingListCard,
  createWelcomeCard,
  createHelpCard,
} from "./cards/summaryCard";
import { config } from "./config";
import { createCorrelationContext, ActionAgentError } from "./utils/errorHandling";
import { telemetry } from "./utils/telemetry";

export class ActionAgentBot extends TeamsActivityHandler {
  constructor() {
    super();

    // Handle incoming messages
    this.onMessage(async (context, next) => {
      const text = context.activity.text?.toLowerCase().trim() || "";
      const value = context.activity.value as Record<string, unknown> | undefined;

      // Handle Adaptive Card submissions
      if (value && value.action) {
        await this.handleCardAction(context, value);
        await next();
        return;
      }

      // Command routing
      if (text.includes("process meeting") || text.includes("process this meeting")) {
        await this.handleProcessMeetingCommand(context);
      } else if (text.includes("list meetings") || text.includes("show meetings")) {
        await this.handleListMeetingsCommand(context);
      } else if (text.includes("health") || text.includes("status")) {
        await this.handleHealthCheck(context);
      } else if (text.includes("help")) {
        await this.sendHelpCard(context);
      } else {
        await this.sendWelcomeCard(context);
      }

      await next();
    });

    // Handle when bot is added to a conversation
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded || [];
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await this.sendWelcomeCard(context);
        }
      }
      await next();
    });
  }

  /**
   * Handles the "process meeting" command
   */
  private async handleProcessMeetingCommand(context: TurnContext): Promise<void> {
    const correlationContext = createCorrelationContext("Bot.ProcessMeeting");
    
    try {
      // Get the current user's info
      const member = await TeamsInfo.getMember(
        context,
        context.activity.from.id
      );
      const userId = member.aadObjectId;

      if (!userId) {
        await context.sendActivity({
          attachments: [
            CardFactory.adaptiveCard(
              createErrorCard(
                "Unable to identify user. Please try again.",
                correlationContext.correlationId,
                ["Ensure you're signed in to Teams", "Try refreshing the chat"]
              )
            ),
          ],
        });
        return;
      }

      // Check if a meeting ID was provided in the message
      const meetingIdMatch = context.activity.text?.match(
        /meeting[:\s]+([a-zA-Z0-9-_]+)/i
      );
      
      if (meetingIdMatch) {
        // Process specific meeting
        await this.processMeeting(context, meetingIdMatch[1], userId, correlationContext);
      } else {
        // Show list of recent meetings to choose from
        await this.handleListMeetingsCommand(context);
      }
    } catch (error) {
      telemetry.error("Error in process meeting command", error as Error);
      await this.sendErrorCard(context, error, correlationContext.correlationId);
    }
  }

  /**
   * Handles listing available meetings
   */
  private async handleListMeetingsCommand(context: TurnContext): Promise<void> {
    const correlationContext = createCorrelationContext("Bot.ListMeetings");
    
    try {
      const member = await TeamsInfo.getMember(
        context,
        context.activity.from.id
      );
      const userId = member.aadObjectId;

      if (!userId) {
        await context.sendActivity({
          attachments: [
            CardFactory.adaptiveCard(
              createErrorCard("Unable to identify user.", correlationContext.correlationId)
            ),
          ],
        });
        return;
      }

      await context.sendActivity("📅 Fetching your recent meetings...");

      const meetings = await listRecentMeetings(userId, 5);

      if (meetings.length === 0) {
        await context.sendActivity({
          attachments: [
            CardFactory.adaptiveCard(
              createErrorCard(
                "No recent meetings found.",
                correlationContext.correlationId,
                [
                  "Ensure transcription was enabled during the meeting",
                  "Meetings older than 60 days may not be available",
                  "Check if you have the necessary permissions"
                ]
              )
            ),
          ],
        });
        return;
      }

      await context.sendActivity({
        attachments: [CardFactory.adaptiveCard(createMeetingListCard(meetings))],
      });
    } catch (error) {
      telemetry.error("Error listing meetings", error as Error);
      await this.sendErrorCard(context, error, correlationContext.correlationId);
    }
  }

  /**
   * Handles Adaptive Card action submissions
   */
  private async handleCardAction(
    context: TurnContext,
    value: Record<string, unknown>
  ): Promise<void> {
    const action = value.action as string;
    const meetingId = value.meetingId as string;
    const correlationContext = createCorrelationContext("Bot.CardAction", { action });

    try {
      switch (action) {
        case "processMeeting":
          if (meetingId) {
            const member = await TeamsInfo.getMember(
              context,
              context.activity.from.id
            );
            await this.processMeeting(context, meetingId, member.aadObjectId!, correlationContext);
          } else {
            await context.sendActivity("Please select a meeting first.");
          }
          break;
        case "listMeetings":
          await this.handleListMeetingsCommand(context);
          break;
        case "retry":
          await this.handleListMeetingsCommand(context);
          break;
        case "help":
          await this.sendHelpCard(context);
          break;
        default:
          await context.sendActivity("Unknown action. Type `help` for available commands.");
      }
    } catch (error) {
      await this.sendErrorCard(context, error, correlationContext.correlationId);
    }
  }

  /**
   * Core meeting processing logic
   */
  private async processMeeting(
    context: TurnContext,
    meetingId: string,
    userId: string,
    correlationContext: ReturnType<typeof createCorrelationContext>
  ): Promise<void> {
    const timer = telemetry.startTimer("Bot.ProcessMeeting");
    
    try {
      // Get meeting details
      const meetingDetails = await getMeetingDetails(meetingId, userId);
      telemetry.info("Processing meeting", { 
        subject: meetingDetails.subject,
        correlationId: correlationContext.correlationId 
      });

      // Show processing card
      await context.sendActivity({
        attachments: [
          CardFactory.adaptiveCard(
            createProcessingCard(meetingDetails.subject, "Step 1/4: Fetching transcript...")
          ),
        ],
      });

      // Step 1: Fetch transcript
      const transcript = await getMeetingTranscript(meetingId, userId);

      if (!transcript || transcript.trim().length === 0) {
        timer.stop();
        await context.sendActivity({
          attachments: [
            CardFactory.adaptiveCard(
              createErrorCard(
                "No transcript found for this meeting.",
                correlationContext.correlationId,
                [
                  "Ensure transcription was enabled during the call",
                  "Transcripts may take a few minutes to become available after the meeting ends",
                  "Check Teams admin policies for transcript access"
                ]
              )
            ),
          ],
        });
        return;
      }

      // Step 2: Extract action items with AI
      await context.sendActivity({
        attachments: [
          CardFactory.adaptiveCard(
            createProcessingCard(meetingDetails.subject, "Step 2/4: Analyzing transcript with AI...")
          ),
        ],
      });
      
      const actionItemsResponse = await extractActionItems(transcript);

      if (actionItemsResponse.actionItems.length === 0) {
        timer.stop();
        telemetry.info("No action items found in meeting");
        await context.sendActivity({
          attachments: [
            CardFactory.adaptiveCard(
              createSummaryCard(
                [],
                meetingDetails.subject,
                actionItemsResponse.summary || "No technical action items were identified in this meeting.",
                correlationContext.correlationId
              )
            ),
          ],
        });
        return;
      }

      // Step 3: Create work items in Azure DevOps
      await context.sendActivity({
        attachments: [
          CardFactory.adaptiveCard(
            createProcessingCard(
              meetingDetails.subject, 
              `Step 3/4: Creating ${actionItemsResponse.actionItems.length} work items in Azure DevOps...`
            )
          ),
        ],
      });
      
      const workItems = await createWorkItems(actionItemsResponse.actionItems);

      // Step 4: Send summary card
      timer.stop();
      telemetry.trackSuccess("Bot.ProcessMeeting", { 
        itemsCreated: String(workItems.length) 
      });

      await context.sendActivity({
        attachments: [
          CardFactory.adaptiveCard(
            createSummaryCard(
              workItems,
              meetingDetails.subject,
              actionItemsResponse.summary,
              correlationContext.correlationId
            )
          ),
        ],
      });
    } catch (error) {
      timer.stop();
      telemetry.trackFailure("Bot.ProcessMeeting", "ProcessingError");
      await this.sendErrorCard(context, error, correlationContext.correlationId);
    }
  }

  /**
   * Health check command
   */
  private async handleHealthCheck(context: TurnContext): Promise<void> {
    const timer = telemetry.startTimer("Bot.HealthCheck");
    
    try {
      const adoConnected = await validateConnection();
      
      const healthMetrics = telemetry.getHealthMetrics();
      
      const status = [
        "🔍 **ActionAgent Health Check**",
        "",
        `✅ Bot Framework: Connected`,
        `${adoConnected ? "✅" : "❌"} Azure DevOps: ${adoConnected ? "Connected" : "Disconnected"}`,
        `✅ Azure OpenAI: Configured (${config.azureOpenAI.deployment})`,
        "",
        `**Environment:** ${config.server.environment}`,
        `**Project:** ${config.azureDevOps.project}`,
        `**Uptime:** ${Math.floor(healthMetrics.uptime as number)}s`,
        "",
        "_Type 'process meeting' to analyze a meeting transcript._",
      ];

      timer.stop();
      await context.sendActivity(status.join("\n"));
    } catch (error) {
      timer.stop();
      await context.sendActivity(
        `❌ Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Sends welcome card when bot is added
   */
  private async sendWelcomeCard(context: TurnContext): Promise<void> {
    await context.sendActivity({
      attachments: [CardFactory.adaptiveCard(createWelcomeCard())],
    });
  }

  /**
   * Sends help card with available commands
   */
  private async sendHelpCard(context: TurnContext): Promise<void> {
    await context.sendActivity({
      attachments: [CardFactory.adaptiveCard(createHelpCard())],
    });
  }

  /**
   * Sends error card with appropriate message
   */
  private async sendErrorCard(
    context: TurnContext,
    error: unknown,
    correlationId: string
  ): Promise<void> {
    let message: string;
    let suggestions: string[] = [];

    if (error instanceof ActionAgentError) {
      message = error.toUserMessage();
    } else if (error instanceof Error) {
      message = getGraphErrorMessage(error);
      
      // Add context-specific suggestions
      if (error.message.includes("403") || error.message.includes("forbidden")) {
        suggestions = [
          "Ensure Application Access Policy is configured",
          "Contact your Teams admin to grant transcript access",
          "Run the PowerShell commands from the README"
        ];
      } else if (error.message.includes("transcript")) {
        suggestions = [
          "Enable transcription before the meeting starts",
          "Wait a few minutes after the meeting ends",
          "Check if transcription is enabled in your organization"
        ];
      }
    } else {
      message = "An unexpected error occurred. Please try again.";
    }

    await context.sendActivity({
      attachments: [
        CardFactory.adaptiveCard(
          createErrorCard(message, correlationId, suggestions)
        ),
      ],
    });
  }
}
