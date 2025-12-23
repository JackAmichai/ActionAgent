/**
 * Adaptive Card Templates
 * Rich card templates for Teams bot responses
 * 
 * Features:
 * - Work item summary with links
 * - Identity resolution status indicators
 * - Correlation ID tracking
 * - Processing status cards
 */

import { config } from "../config";
import { ExtendedWorkItemResult } from "../services/devopsService";
import { ResolutionResult } from "../services/identityService";

/**
 * Work item icon based on type
 */
function getWorkItemIcon(type: string): string {
  switch (type.toLowerCase()) {
    case "bug":
      return "🐛";
    case "user story":
      return "📖";
    case "task":
    default:
      return "✔️";
  }
}

/**
 * Priority badge color
 */
function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "high":
    case "critical":
      return "attention";
    case "low":
      return "good";
    default:
      return "accent";
  }
}

/**
 * Format assignee with resolution indicator
 */
function formatAssignee(resolution?: ResolutionResult): string {
  if (!resolution) return "Unassigned";
  if (!resolution.resolved) return `⚠️ ${resolution.originalName} (unresolved)`;

  const user = resolution.user!;
  const icon =
    user.confidence === "high" ? "✅" : user.confidence === "medium" ? "🔶" : "⚪";
  return `${icon} ${user.displayName}`;
}

/**
 * Creates an Adaptive Card summarizing the action items extracted and work items created
 */
export function createSummaryCard(
  workItems: ExtendedWorkItemResult[],
  meetingSubject: string,
  summary?: string,
  correlationId?: string
): object {
  const workItemRows = workItems.map((item) => ({
    type: "Container",
    items: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: getWorkItemIcon(item.type),
                size: "Medium",
              },
            ],
            verticalContentAlignment: "Center",
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: `[#${item.id}](${item.url})`,
                weight: "Bolder",
                color: "Accent",
              },
              {
                type: "TextBlock",
                text: item.title,
                wrap: true,
                spacing: "None",
              },
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    items: [
                      {
                        type: "TextBlock",
                        text: item.type,
                        size: "Small",
                        color: "Accent",
                      },
                    ],
                  },
                  {
                    type: "Column",
                    width: "auto",
                    items: [
                      {
                        type: "TextBlock",
                        text: "•",
                        size: "Small",
                        color: "Light",
                      },
                    ],
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: formatAssignee(item.assigneeResolution),
                        size: "Small",
                        color: "Default",
                      },
                    ],
                  },
                ],
                spacing: "None",
              },
            ],
          },
        ],
      },
    ],
    separator: true,
    spacing: "Small",
  }));

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      // Header
      {
        type: "Container",
        style: "emphasis",
        bleed: true,
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "Image",
                    url: "https://img.icons8.com/fluency/48/000000/task-completed.png",
                    size: "Medium",
                    altText: "ActionAgent",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                verticalContentAlignment: "Center",
                items: [
                  {
                    type: "TextBlock",
                    text: "ActionAgent Summary",
                    weight: "Bolder",
                    size: "Large",
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: meetingSubject,
                    size: "Small",
                    color: "Accent",
                    spacing: "None",
                    wrap: true,
                  },
                ],
              },
            ],
          },
        ],
        padding: "Default",
      },
      // Success message
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: `✅ Created ${workItems.length} work item${workItems.length !== 1 ? "s" : ""} in Azure DevOps`,
            weight: "Bolder",
            color: "Good",
            spacing: "Medium",
            wrap: true,
          },
        ],
      },
      // Summary (if provided)
      ...(summary
        ? [
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: "📋 Meeting Summary",
                  weight: "Bolder",
                  spacing: "Medium",
                },
                {
                  type: "TextBlock",
                  text: summary,
                  wrap: true,
                  size: "Small",
                },
              ],
            },
          ]
        : []),
      // Work items list
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "📝 Work Items Created",
            weight: "Bolder",
            spacing: "Medium",
          },
          ...workItemRows,
        ],
      },
      // Footer with correlation ID
      ...(correlationId
        ? [
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: `Reference: ${correlationId}`,
                  size: "Small",
                  color: "Light",
                  spacing: "Large",
                  horizontalAlignment: "Right",
                },
              ],
            },
          ]
        : []),
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "📊 View in Azure DevOps",
        url: `${config.azureDevOps.orgUrl}/${config.azureDevOps.project}/_workitems`,
      },
      {
        type: "Action.Submit",
        title: "🔄 Process Another Meeting",
        data: {
          action: "listMeetings",
        },
      },
    ],
  };

  return card;
}

/**
 * Creates a card shown while processing is in progress
 */
export function createProcessingCard(
  meetingSubject: string,
  step?: string
): object {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "Image",
                    url: "https://img.icons8.com/fluency/48/000000/loading.png",
                    size: "Small",
                    altText: "Processing",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                verticalContentAlignment: "Center",
                items: [
                  {
                    type: "TextBlock",
                    text: "🔄 Processing Meeting...",
                    weight: "Bolder",
                    size: "Medium",
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: meetingSubject,
                    size: "Small",
                    color: "Accent",
                    spacing: "None",
                    wrap: true,
                  },
                ],
              },
            ],
          },
          {
            type: "TextBlock",
            text: step || "Analyzing transcript and extracting action items...",
            wrap: true,
            spacing: "Medium",
            size: "Small",
          },
          {
            type: "ColumnSet",
            columns: [
              { type: "Column", width: "stretch" },
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "TextBlock",
                    text: "This may take a moment",
                    size: "Small",
                    color: "Light",
                    isSubtle: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Creates an error card when something goes wrong
 */
export function createErrorCard(
  errorMessage: string,
  correlationId?: string,
  suggestions?: string[]
): object {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "Container",
        style: "attention",
        bleed: true,
        items: [
          {
            type: "TextBlock",
            text: "❌ Error Processing Meeting",
            weight: "Bolder",
            size: "Medium",
            color: "Attention",
          },
        ],
        padding: "Default",
      },
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: errorMessage,
            wrap: true,
            spacing: "Medium",
          },
          ...(suggestions && suggestions.length > 0
            ? [
                {
                  type: "TextBlock",
                  text: "**Suggestions:**",
                  weight: "Bolder",
                  spacing: "Medium",
                },
                {
                  type: "TextBlock",
                  text: suggestions.map((s) => `• ${s}`).join("\n"),
                  wrap: true,
                  size: "Small",
                },
              ]
            : []),
          ...(correlationId
            ? [
                {
                  type: "TextBlock",
                  text: `Reference: ${correlationId}`,
                  size: "Small",
                  color: "Light",
                  spacing: "Large",
                },
              ]
            : []),
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "🔄 Try Again",
        data: {
          action: "retry",
        },
      },
      {
        type: "Action.Submit",
        title: "📋 List Meetings",
        data: {
          action: "listMeetings",
        },
      },
    ],
  };
}

/**
 * Creates a card listing available meetings to process
 */
export function createMeetingListCard(
  meetings: Array<{ id: string; subject: string; startDateTime: string }>
): object {
  const meetingChoices = meetings.map((m) => ({
    title: `${m.subject || "Untitled Meeting"} (${new Date(m.startDateTime).toLocaleDateString()})`,
    value: m.id,
  }));

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "📅 Select a Meeting to Process",
            weight: "Bolder",
            size: "Medium",
            wrap: true,
          },
          {
            type: "TextBlock",
            text: "Choose a recent meeting with transcription enabled:",
            wrap: true,
            spacing: "Small",
            size: "Small",
          },
        ],
      },
      {
        type: "Container",
        items: [
          {
            type: "Input.ChoiceSet",
            id: "meetingId",
            style: "expanded",
            choices: meetingChoices,
            isRequired: true,
          },
        ],
        spacing: "Medium",
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "🚀 Process Selected Meeting",
        style: "positive",
        data: {
          action: "processMeeting",
        },
      },
    ],
  };
}

/**
 * Creates a welcome card for new users
 */
export function createWelcomeCard(): object {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "Container",
        style: "emphasis",
        bleed: true,
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "Image",
                    url: "https://img.icons8.com/fluency/96/000000/bot.png",
                    size: "Medium",
                    altText: "ActionAgent Bot",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                verticalContentAlignment: "Center",
                items: [
                  {
                    type: "TextBlock",
                    text: "👋 Welcome to ActionAgent!",
                    weight: "Bolder",
                    size: "Large",
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: "Your AI-powered meeting assistant",
                    size: "Small",
                    color: "Accent",
                    spacing: "None",
                  },
                ],
              },
            ],
          },
        ],
        padding: "Default",
      },
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "I help you capture action items from Teams meetings and automatically create work items in Azure DevOps.",
            wrap: true,
            spacing: "Medium",
          },
          {
            type: "TextBlock",
            text: "**Getting Started:**",
            weight: "Bolder",
            spacing: "Medium",
          },
          {
            type: "TextBlock",
            text: "1️⃣ Enable transcription in your Teams meeting\n2️⃣ After the meeting, type `process meeting`\n3️⃣ I'll analyze the transcript and create work items!",
            wrap: true,
            size: "Small",
          },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "📅 Show Recent Meetings",
        data: {
          action: "listMeetings",
        },
      },
      {
        type: "Action.Submit",
        title: "❓ Help",
        data: {
          action: "help",
        },
      },
    ],
  };
}

/**
 * Creates a help card with available commands
 */
export function createHelpCard(): object {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "📚 ActionAgent Commands",
            weight: "Bolder",
            size: "Large",
          },
        ],
      },
      {
        type: "Container",
        items: [
          {
            type: "FactSet",
            facts: [
              {
                title: "process meeting",
                value: "Analyze a meeting and create work items",
              },
              {
                title: "list meetings",
                value: "Show recent meetings to choose from",
              },
              {
                title: "health",
                value: "Check service connectivity status",
              },
              {
                title: "help",
                value: "Display this help message",
              },
            ],
          },
        ],
        spacing: "Medium",
      },
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "**💡 Tips:**",
            weight: "Bolder",
            spacing: "Medium",
          },
          {
            type: "TextBlock",
            text: "• Ensure meeting transcription is enabled before the meeting\n• I work best with technical discussions\n• Work items are tagged with 'ActionAgent' for easy filtering\n• Names mentioned in the meeting are auto-resolved to team members",
            wrap: true,
            size: "Small",
          },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "📅 Show Meetings",
        data: {
          action: "listMeetings",
        },
      },
    ],
  };
}

/**
 * Export a sample card JSON for documentation
 */
export const SAMPLE_SUMMARY_CARD = {
  type: "AdaptiveCard",
  version: "1.5",
  body: [
    {
      type: "TextBlock",
      text: "ActionAgent Summary - Sprint Planning",
      weight: "Bolder",
      size: "Large",
    },
    {
      type: "TextBlock",
      text: "✅ Created 3 work items in Azure DevOps",
      color: "Good",
    },
    {
      type: "FactSet",
      facts: [
        { title: "#123", value: "Fix login timeout bug - 🐛 Bug (High)" },
        { title: "#124", value: "Update API documentation - ✔️ Task (Medium)" },
        { title: "#125", value: "Add user profile feature - 📖 User Story (Medium)" },
      ],
    },
  ],
  actions: [
    {
      type: "Action.OpenUrl",
      title: "View in Azure DevOps",
      url: "https://dev.azure.com/org/project/_workitems",
    },
  ],
};
