/**
 * Azure OpenAI Service
 * Handles AI-powered extraction of action items from meeting transcripts
 * 
 * Features:
 * - Structured JSON output with validation
 * - Large transcript chunking
 * - Defensive parsing with re-prompting
 * - Content filtering for technical tasks only
 */

import { AzureOpenAI } from "openai";
import { config } from "../config";
import { ActionItem, ActionItemsResponse } from "../models/actionItem";
import {
  createCorrelationContext,
  withErrorHandling,
  ActionAgentError,
} from "../utils/errorHandling";
import { telemetry } from "../utils/telemetry";

// Initialize the Azure OpenAI client
const client = new AzureOpenAI({
  endpoint: config.azureOpenAI.endpoint,
  apiKey: config.azureOpenAI.apiKey,
  apiVersion: config.azureOpenAI.apiVersion,
  deployment: config.azureOpenAI.deployment,
});

/**
 * JSON Schema for action items (used for validation)
 */
const ACTION_ITEM_SCHEMA = {
  type: "object",
  required: ["actionItems"],
  properties: {
    actionItems: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "type", "priority"],
        properties: {
          title: { type: "string", maxLength: 255 },
          assignedTo: { type: "string" },
          type: { type: "string", enum: ["Task", "Bug", "User Story"] },
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
          description: { type: "string" },
          deadline: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
  },
};

/**
 * System prompt for action item extraction
 * Designed to produce consistent, structured JSON output
 */
const SYSTEM_PROMPT = `You are a technical Project Manager AI assistant specialized in analyzing meeting transcripts for software engineering teams.

Your task is to:
1. Identify clear, actionable TECHNICAL tasks from the conversation
2. Determine who is responsible for each task (look for phrases like "I'll do", "assigned to", "can you", names followed by commitments)
3. Classify the type of work:
   - "Bug" - defects, errors, fixes needed
   - "Task" - general technical work, investigations, updates
   - "User Story" - new features, user-facing changes
4. Assess priority based on urgency indicators:
   - "High" - ASAP, blocker, critical, urgent, breaking
   - "Medium" - should, need to, important (default)
   - "Low" - nice to have, eventually, when time permits

STRICT RULES:
- ONLY extract technical/engineering tasks (code changes, bug fixes, deployments, documentation, testing, infrastructure)
- IGNORE small talk, greetings, off-topic discussion, and non-actionable conversation
- IGNORE vague statements without clear action ("we should think about..." without commitment)
- If a task has no clear assignee, use "Unassigned"
- If a deadline is mentioned (by EOD, next week, sprint end, specific date), include it
- Extract SPECIFIC, ACTIONABLE items - titles should be clear enough to be work item titles
- Each task title should be 5-15 words, starting with a verb when possible

Output ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "actionItems": [
    {
      "title": "Fix authentication timeout on login page",
      "assignedTo": "Sarah",
      "type": "Bug",
      "priority": "High",
      "description": "Users are experiencing 30-second timeouts when logging in during peak hours",
      "deadline": "End of sprint"
    }
  ],
  "summary": "Brief 2-3 sentence summary of technical decisions and outcomes"
}

If no technical action items are found, return: {"actionItems": [], "summary": "No technical action items identified in this meeting."}`;

/**
 * Maximum characters per chunk (approximately 25k tokens for GPT-4)
 */
const MAX_CHUNK_LENGTH = 100000;

/**
 * Extracts action items from a meeting transcript using Azure OpenAI
 * @param transcriptText - The raw transcript text from the meeting
 * @returns Structured action items extracted by GPT-4o
 */
export async function extractActionItems(
  transcriptText: string
): Promise<ActionItemsResponse> {
  const context = createCorrelationContext("AI.ExtractActionItems", {
    transcriptLength: transcriptText.length,
  });

  return withErrorHandling(
    async () => {
      telemetry.info("Extracting action items from transcript", {
        length: transcriptText.length,
      });

      // Handle large transcripts by chunking
      if (transcriptText.length > MAX_CHUNK_LENGTH) {
        return await processLargeTranscript(transcriptText, context);
      }

      const result = await callOpenAI(transcriptText);
      const parsed = parseAndValidateResponse(result, context);

      telemetry.info("Action items extracted", {
        count: parsed.actionItems.length,
      });

      return parsed;
    },
    context,
    { enableRetry: true }
  );
}

/**
 * Process large transcripts by chunking and merging results
 */
async function processLargeTranscript(
  transcriptText: string,
  context: ReturnType<typeof createCorrelationContext>
): Promise<ActionItemsResponse> {
  telemetry.info("Processing large transcript in chunks", {
    totalLength: transcriptText.length,
  });

  // Split into chunks at sentence boundaries
  const chunks = splitIntoChunks(transcriptText, MAX_CHUNK_LENGTH);
  telemetry.debug("Split transcript into chunks", { chunkCount: chunks.length });

  const allItems: ActionItem[] = [];
  const summaries: string[] = [];

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    telemetry.debug(`Processing chunk ${i + 1}/${chunks.length}`);

    const chunkPrompt = `[Part ${i + 1} of ${chunks.length}]\n\n${chunks[i]}`;
    const result = await callOpenAI(chunkPrompt);
    const parsed = parseAndValidateResponse(result, context);

    allItems.push(...parsed.actionItems);
    if (parsed.summary) {
      summaries.push(parsed.summary);
    }
  }

  // Deduplicate items by similar titles
  const dedupedItems = deduplicateItems(allItems);

  // Generate consolidated summary
  const consolidatedSummary =
    summaries.length > 0
      ? await generateConsolidatedSummary(summaries)
      : undefined;

  return {
    actionItems: dedupedItems,
    summary: consolidatedSummary,
  };
}

/**
 * Split text into chunks at sentence boundaries
 */
function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  // Split by sentences (rough approximation)
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      // If single sentence is too long, split by words
      if (sentence.length > maxLength) {
        const words = sentence.split(" ");
        let wordChunk = "";
        for (const word of words) {
          if (wordChunk.length + word.length > maxLength) {
            chunks.push(wordChunk.trim());
            wordChunk = "";
          }
          wordChunk += word + " ";
        }
        if (wordChunk.trim()) {
          currentChunk = wordChunk;
        }
      } else {
        currentChunk = sentence + " ";
      }
    } else {
      currentChunk += sentence + " ";
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Call OpenAI API with the transcript
 */
async function callOpenAI(transcriptText: string): Promise<string> {
  const timer = telemetry.startTimer("AI.OpenAICall");

  try {
    const result = await client.chat.completions.create({
      model: config.azureOpenAI.deployment,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Please analyze the following meeting transcript and extract all technical action items:\n\n${transcriptText}`,
        },
      ],
      temperature: config.azureOpenAI.temperature,
      max_tokens: config.azureOpenAI.maxTokens,
      response_format: { type: "json_object" },
    });

    timer.stop();
    telemetry.trackSuccess("AI.OpenAICall");

    return result.choices[0]?.message?.content || "{}";
  } catch (error) {
    timer.stop();
    telemetry.trackFailure("AI.OpenAICall", "APIError");
    throw error;
  }
}

/**
 * Parse and validate the AI response
 * Handles both { actionItems: [...] } and direct [...] formats
 */
function parseAndValidateResponse(
  content: string,
  context: ReturnType<typeof createCorrelationContext>
): ActionItemsResponse {
  try {
    const parsed = JSON.parse(content);

    // Handle both response formats
    let actionItems: ActionItem[];
    let summary: string | undefined;

    if (Array.isArray(parsed)) {
      // Direct array format
      actionItems = parsed;
    } else if (parsed.actionItems && Array.isArray(parsed.actionItems)) {
      // Object with actionItems property
      actionItems = parsed.actionItems;
      summary = parsed.summary;
    } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
      // Alternative property name
      actionItems = parsed.tasks;
      summary = parsed.summary;
    } else {
      telemetry.warn("Unexpected AI response format", { parsed });
      return { actionItems: [] };
    }

    // Validate and sanitize each item
    const validatedItems: ActionItem[] = actionItems
      .filter(
        (item) =>
          item &&
          typeof item.title === "string" &&
          item.title.trim().length > 0
      )
      .map((item) => ({
        title: sanitizeTitle(item.title),
        assignedTo: item.assignedTo || "Unassigned",
        type: validateWorkItemType(item.type),
        priority: validatePriority(item.priority),
        description: item.description || "",
        deadline: item.deadline || undefined,
      }));

    return {
      actionItems: validatedItems,
      summary,
    };
  } catch (error) {
    telemetry.error("Failed to parse AI response", error as Error, { content });
    throw new ActionAgentError(
      "Failed to parse AI response as JSON",
      context,
      { cause: error as Error }
    );
  }
}

/**
 * Sanitize title for Azure DevOps
 */
function sanitizeTitle(title: string): string {
  return title
    .trim()
    .substring(0, 255)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Validates and normalizes work item type
 */
function validateWorkItemType(type: string): "Task" | "Bug" | "User Story" {
  const normalized = type?.toLowerCase();
  if (normalized === "bug" || normalized === "defect" || normalized === "fix") {
    return "Bug";
  }
  if (
    normalized === "user story" ||
    normalized === "story" ||
    normalized === "feature"
  ) {
    return "User Story";
  }
  return "Task";
}

/**
 * Validates and normalizes priority
 */
function validatePriority(priority: string): "High" | "Medium" | "Low" {
  const normalized = priority?.toLowerCase();
  if (
    normalized === "high" ||
    normalized === "critical" ||
    normalized === "urgent" ||
    normalized === "1"
  ) {
    return "High";
  }
  if (normalized === "low" || normalized === "minor" || normalized === "3") {
    return "Low";
  }
  return "Medium";
}

/**
 * Deduplicate items by similar titles
 */
function deduplicateItems(items: ActionItem[]): ActionItem[] {
  const seen = new Map<string, ActionItem>();

  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!seen.has(key)) {
      seen.set(key, item);
    } else {
      // Keep the one with more info
      const existing = seen.get(key)!;
      if (
        (item.description?.length || 0) > (existing.description?.length || 0)
      ) {
        seen.set(key, item);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Generate a consolidated summary from chunk summaries
 */
async function generateConsolidatedSummary(
  summaries: string[]
): Promise<string> {
  if (summaries.length === 1) {
    return summaries[0];
  }

  try {
    const result = await client.chat.completions.create({
      model: config.azureOpenAI.deployment,
      messages: [
        {
          role: "system",
          content:
            "Consolidate these meeting summaries into a single 2-3 sentence technical summary.",
        },
        { role: "user", content: summaries.join("\n\n") },
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    return result.choices[0]?.message?.content || summaries[0];
  } catch {
    return summaries.join(" ");
  }
}

/**
 * Generates a meeting summary without extracting specific action items
 * Useful for quick overviews
 */
export async function generateMeetingSummary(
  transcriptText: string
): Promise<string> {
  const context = createCorrelationContext("AI.GenerateSummary");

  return withErrorHandling(
    async () => {
      const result = await client.chat.completions.create({
        model: config.azureOpenAI.deployment,
        messages: [
          {
            role: "system",
            content:
              "You are a meeting summarizer. Create a concise 3-5 bullet point summary of the key technical decisions and outcomes from this meeting. Focus on what was decided, not what was discussed.",
          },
          { role: "user", content: transcriptText.substring(0, MAX_CHUNK_LENGTH) },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      return result.choices[0]?.message?.content || "No summary available.";
    },
    context,
    { enableRetry: true }
  );
}

export { client, ACTION_ITEM_SCHEMA };
