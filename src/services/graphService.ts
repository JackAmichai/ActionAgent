/**
 * Microsoft Graph Service
 * Handles authentication and transcript retrieval from Microsoft Graph API
 * 
 * Required Permissions (Application):
 * - OnlineMeetings.Read.All
 * - OnlineMeetingTranscript.Read.All
 * - User.Read.All (for identity resolution)
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { config } from "../config";
import { 
  createCorrelationContext, 
  withErrorHandling, 
  ActionAgentError 
} from "../utils/errorHandling";
import { telemetry } from "../utils/telemetry";
import "isomorphic-fetch";

// Initialize credentials using Client Secret flow
// In production, consider using Managed Identity for enhanced security
const credential = new ClientSecretCredential(
  config.azureAd.tenantId,
  config.azureAd.clientId,
  config.azureAd.clientSecret
);

// Create authentication provider with application-level permissions
const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"], // Application Permissions scope
});

// Initialize the Graph client with middleware
const graphClient = Client.initWithMiddleware({ authProvider });

/**
 * Meeting information returned from Graph
 */
export interface MeetingInfo {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinWebUrl: string;
  organizerId?: string;
}

/**
 * Transcript metadata
 */
export interface TranscriptInfo {
  id: string;
  createdDateTime: string;
  contentUrl: string;
}

/**
 * Retrieves the transcript content for a specific meeting
 * @param meetingId - The unique identifier of the online meeting
 * @param userId - The user ID of the meeting organizer (required for application permissions)
 * @returns The transcript content as plain text
 */
export async function getMeetingTranscript(
  meetingId: string,
  userId: string
): Promise<string> {
  const context = createCorrelationContext("Graph.GetTranscript", { meetingId, userId });
  
  return withErrorHandling(
    async () => {
      telemetry.info("Fetching meeting transcript", { meetingId });
      
      // Step 1: List all transcripts for the meeting
      const transcripts = await graphClient
        .api(`/users/${userId}/onlineMeetings/${meetingId}/transcripts`)
        .get();

      if (!transcripts.value || transcripts.value.length === 0) {
        telemetry.warn("No transcripts found for meeting", { meetingId });
        return "";
      }

      // Get the most recent transcript
      const transcriptId = transcripts.value[0].id;
      telemetry.debug("Found transcript", { transcriptId });

      // Step 2: Fetch the actual transcript content
      // Request text/vtt format which includes timestamps and speaker information
      const content = await graphClient
        .api(
          `/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`
        )
        .query({ $format: "text/vtt" })
        .get();

      // Content may be a string or need to be converted
      const textContent = typeof content === "string" ? content : String(content);
      
      // Parse VTT to extract clean text (remove timestamps and headers)
      const cleanedContent = parseVttToText(textContent);
      
      telemetry.info("Transcript fetched successfully", { 
        meetingId, 
        rawLength: textContent.length,
        cleanedLength: cleanedContent.length 
      });
      
      return cleanedContent;
    },
    context,
    { enableRetry: true }
  );
}

/**
 * Parse VTT format to clean text
 * Removes WEBVTT header, timestamps, and extracts just the spoken text
 */
function parseVttToText(vttContent: string): string {
  if (!vttContent) return "";
  
  const lines = vttContent.split("\n");
  const textLines: string[] = [];
  let currentSpeaker = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip header and empty lines
    if (!trimmed || trimmed === "WEBVTT" || trimmed.startsWith("NOTE")) {
      continue;
    }
    
    // Skip timestamp lines (format: 00:00:00.000 --> 00:00:00.000)
    if (trimmed.includes(" --> ")) {
      continue;
    }
    
    // Skip cue identifiers (typically numeric)
    if (/^\d+$/.test(trimmed)) {
      continue;
    }
    
    // Extract speaker from <v Speaker Name>text</v> format
    const speakerMatch = trimmed.match(/<v ([^>]+)>(.+?)(?:<\/v>)?$/);
    if (speakerMatch) {
      const speaker = speakerMatch[1];
      const text = speakerMatch[2].replace(/<\/v>$/, "");
      
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker;
        textLines.push(`\n${speaker}:`);
      }
      textLines.push(text);
    } else if (trimmed.length > 0) {
      // Regular text line
      textLines.push(trimmed);
    }
  }
  
  return textLines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Gets meeting details including subject and participants
 * @param meetingId - The unique identifier of the online meeting
 * @param userId - The user ID of the meeting organizer
 */
export async function getMeetingDetails(
  meetingId: string,
  userId: string
): Promise<{
  subject: string;
  startDateTime: string;
  endDateTime: string;
  participants: string[];
  organizerId: string;
}> {
  const context = createCorrelationContext("Graph.GetMeetingDetails", { meetingId });
  
  return withErrorHandling(
    async () => {
      const meeting = await graphClient
        .api(`/users/${userId}/onlineMeetings/${meetingId}`)
        .select("subject,startDateTime,endDateTime,participants")
        .get();

      return {
        subject: meeting.subject || "Untitled Meeting",
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
        participants:
          meeting.participants?.attendees?.map(
            (a: { upn?: string; emailAddress?: { address: string } }) =>
              a.upn || a.emailAddress?.address
          ) || [],
        organizerId: userId,
      };
    },
    context,
    { enableRetry: true }
  );
}

/**
 * Lists recent meetings for a user
 * @param userId - The user ID to list meetings for
 * @param count - Number of recent meetings to retrieve (default: 10)
 */
export async function listRecentMeetings(
  userId: string,
  count: number = 10
): Promise<MeetingInfo[]> {
  const context = createCorrelationContext("Graph.ListMeetings", { userId, count });
  
  return withErrorHandling(
    async () => {
      const meetings = await graphClient
        .api(`/users/${userId}/onlineMeetings`)
        .top(count)
        .orderby("startDateTime desc")
        .select("id,subject,startDateTime,endDateTime,joinWebUrl")
        .get();

      return (meetings.value || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        subject: (m.subject as string) || "Untitled Meeting",
        startDateTime: m.startDateTime as string,
        endDateTime: m.endDateTime as string,
        joinWebUrl: m.joinWebUrl as string,
      }));
    },
    context,
    { enableRetry: true }
  );
}

/**
 * Attempts to resolve a meeting ID from various inputs
 * - Direct meeting ID
 * - Join URL
 * - Chat/conversation context
 */
export async function resolveMeetingId(
  input: string,
  userId: string
): Promise<string | null> {
  const context = createCorrelationContext("Graph.ResolveMeetingId", { input });
  
  return withErrorHandling(
    async () => {
      // If it looks like a meeting ID already, return it
      if (input.match(/^[A-Za-z0-9_-]{20,}$/)) {
        return input;
      }
      
      // Try to extract from join URL
      const joinUrlMatch = input.match(/19%3ameeting_([A-Za-z0-9_-]+)%40/);
      if (joinUrlMatch) {
        return joinUrlMatch[1];
      }
      
      // Try to find meeting by listing recent ones
      telemetry.debug("Attempting to find meeting from recent list");
      const recentMeetings = await listRecentMeetings(userId, 20);
      
      // Look for a match by subject or partial ID
      const match = recentMeetings.find(
        (m) =>
          m.id.includes(input) ||
          m.subject.toLowerCase().includes(input.toLowerCase()) ||
          m.joinWebUrl?.includes(input)
      );
      
      if (match) {
        telemetry.info("Resolved meeting ID", { resolvedId: match.id });
        return match.id;
      }
      
      return null;
    },
    context
  );
}

/**
 * Check if transcript is available for a meeting
 */
export async function hasTranscript(
  meetingId: string,
  userId: string
): Promise<boolean> {
  try {
    const transcripts = await graphClient
      .api(`/users/${userId}/onlineMeetings/${meetingId}/transcripts`)
      .top(1)
      .get();
    
    return transcripts.value && transcripts.value.length > 0;
  } catch {
    return false;
  }
}

/**
 * Handle common Graph API errors with user-friendly messages
 */
export function getGraphErrorMessage(error: unknown): string {
  if (error instanceof ActionAgentError) {
    return error.toUserMessage();
  }
  
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  
  if (message.includes("403") || message.includes("forbidden")) {
    return "Access denied. Please ensure the Application Access Policy is configured for this user.";
  }
  
  if (message.includes("404") || message.includes("not found")) {
    return "Meeting or transcript not found. Ensure transcription was enabled for the meeting.";
  }
  
  if (message.includes("401") || message.includes("unauthorized")) {
    return "Authentication failed. Please check the app registration configuration.";
  }
  
  if (message.includes("429") || message.includes("too many")) {
    return "Rate limit exceeded. Please try again in a moment.";
  }
  
  return "An error occurred accessing Microsoft Graph. Please try again.";
}

export { graphClient };
