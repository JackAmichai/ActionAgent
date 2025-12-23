/**
 * Azure DevOps Service
 * Handles work item creation in Azure DevOps
 * 
 * Features:
 * - Configurable project, area, and iteration paths
 * - Identity resolution integration
 * - Batch work item creation with rate limiting
 * - Comprehensive error handling
 */

import * as azdev from "azure-devops-node-api";
import { config, priorityMap } from "../config";
import { ActionItem, WorkItemResult } from "../models/actionItem";
import { resolveUser, getDevOpsIdentity, ResolutionResult } from "./identityService";
import {
  createCorrelationContext,
  withErrorHandling,
  ActionAgentError,
} from "../utils/errorHandling";
import { telemetry } from "../utils/telemetry";

// Type for patch document operations
interface PatchOperation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

// Initialize the Azure DevOps connection
const authHandler = azdev.getPersonalAccessTokenHandler(config.azureDevOps.pat);
const connection = new azdev.WebApi(config.azureDevOps.orgUrl, authHandler);

// Rate limiting: max concurrent work item creations
const MAX_CONCURRENT = 5;
const DELAY_BETWEEN_BATCHES_MS = 500;

/**
 * Extended work item result with identity resolution info
 */
export interface ExtendedWorkItemResult extends WorkItemResult {
  assigneeResolution?: ResolutionResult;
  correlationId: string;
}

/**
 * Creates a single work item in Azure DevOps
 * @param task - The action item to create as a work item
 * @param resolveIdentities - Whether to resolve assignee names to AAD users
 * @returns The created work item details
 */
export async function createWorkItem(
  task: ActionItem,
  resolveIdentities: boolean = true
): Promise<ExtendedWorkItemResult> {
  const context = createCorrelationContext("DevOps.CreateWorkItem", {
    title: task.title,
    type: task.type,
  });

  return withErrorHandling(
    async () => {
      const timer = telemetry.startTimer("DevOps.CreateWorkItem");

      // Resolve identity if enabled
      let assigneeResolution: ResolutionResult | undefined;
      let assigneeIdentity = task.assignedTo;

      if (resolveIdentities && task.assignedTo && task.assignedTo !== "Unassigned") {
        try {
          assigneeResolution = await resolveUser(task.assignedTo);
          if (assigneeResolution.resolved) {
            assigneeIdentity = getDevOpsIdentity(assigneeResolution);
            telemetry.debug("Resolved assignee identity", {
              original: task.assignedTo,
              resolved: assigneeIdentity,
            });
          }
        } catch (error) {
          telemetry.warn("Failed to resolve identity, using original name", {
            name: task.assignedTo,
            error: String(error),
          });
        }
      }

      const workItemTracking = await connection.getWorkItemTrackingApi();

      // Build the patch document for work item creation
      const patchDocument = buildPatchDocument(task, assigneeIdentity, context.correlationId);

      // Map action item type to Azure DevOps work item type
      const workItemType = mapWorkItemType(task.type);

      const workItem = await workItemTracking.createWorkItem(
        undefined, // customHeaders
        patchDocument,
        config.azureDevOps.project,
        workItemType,
        false, // validateOnly
        false // bypassRules
      );

      timer.stop();

      if (!workItem || !workItem.id) {
        throw new ActionAgentError(
          "Failed to create work item - no ID returned",
          context
        );
      }

      telemetry.info(`Created work item #${workItem.id}`, {
        title: task.title,
        type: workItemType,
      });
      telemetry.trackSuccess("DevOps.CreateWorkItem", { type: workItemType });

      return {
        id: workItem.id,
        url:
          workItem._links?.html?.href ||
          `${config.azureDevOps.orgUrl}/${config.azureDevOps.project}/_workitems/edit/${workItem.id}`,
        title: task.title,
        type: workItemType,
        assigneeResolution,
        correlationId: context.correlationId,
      };
    },
    context,
    { enableRetry: true }
  );
}

/**
 * Build the patch document for work item creation
 */
function buildPatchDocument(
  task: ActionItem,
  assigneeIdentity: string,
  correlationId: string
): PatchOperation[] {
  const patchDocument: PatchOperation[] = [
    {
      op: "add",
      path: "/fields/System.Title",
      value: task.title,
    },
    {
      op: "add",
      path: "/fields/System.Description",
      value: formatDescription(task, correlationId),
    },
    {
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: priorityMap[task.priority] || 2,
    },
    {
      op: "add",
      path: "/fields/System.Tags",
      value: "ActionAgent; AI-Generated",
    },
  ];

  // Add assigned to if specified and not "Unassigned"
  if (assigneeIdentity && assigneeIdentity !== "Unassigned") {
    patchDocument.push({
      op: "add",
      path: "/fields/System.AssignedTo",
      value: assigneeIdentity,
    });
  } else if (config.azureDevOps.triageUser) {
    // Assign to triage user if no assignee
    patchDocument.push({
      op: "add",
      path: "/fields/System.AssignedTo",
      value: config.azureDevOps.triageUser,
    });
  }

  // Add area path if configured
  if (config.azureDevOps.defaultAreaPath) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.AreaPath",
      value: config.azureDevOps.defaultAreaPath,
    });
  }

  // Add iteration path if configured
  if (config.azureDevOps.defaultIterationPath) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.IterationPath",
      value: config.azureDevOps.defaultIterationPath,
    });
  }

  // Add deadline as Target Date if specified
  if (task.deadline) {
    const parsedDate = parseDeadline(task.deadline);
    if (parsedDate) {
      patchDocument.push({
        op: "add",
        path: "/fields/Microsoft.VSTS.Scheduling.TargetDate",
        value: parsedDate.toISOString(),
      });
    }
  }

  return patchDocument;
}

/**
 * Parse deadline string to Date
 */
function parseDeadline(deadline: string): Date | null {
  const lower = deadline.toLowerCase();
  const now = new Date();

  // Handle relative deadlines
  if (lower.includes("eod") || lower.includes("end of day") || lower.includes("today")) {
    const eod = new Date(now);
    eod.setHours(23, 59, 59, 999);
    return eod;
  }

  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    return tomorrow;
  }

  if (lower.includes("next week")) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }

  if (lower.includes("end of sprint") || lower.includes("sprint end")) {
    // Assume 2-week sprints ending on Friday
    const endOfSprint = new Date(now);
    const daysUntilFriday = (5 - endOfSprint.getDay() + 7) % 7 || 7;
    endOfSprint.setDate(endOfSprint.getDate() + daysUntilFriday);
    return endOfSprint;
  }

  // Try to parse as a date
  const parsed = new Date(deadline);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Creates multiple work items from a list of action items with rate limiting
 * @param tasks - Array of action items to create
 * @param resolveIdentities - Whether to resolve assignee names to AAD users
 * @returns Array of created work item results
 */
export async function createWorkItems(
  tasks: ActionItem[],
  resolveIdentities: boolean = true
): Promise<ExtendedWorkItemResult[]> {
  const context = createCorrelationContext("DevOps.BatchCreate", {
    count: tasks.length,
  });

  telemetry.info("Creating work items in batch", { count: tasks.length });

  const results: ExtendedWorkItemResult[] = [];
  const errors: Array<{ task: ActionItem; error: Error }> = [];

  // Process in batches to avoid rate limiting
  for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
    const batch = tasks.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map((task) => createWorkItem(task, resolveIdentities))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        errors.push({ task: batch[j], error: result.reason });
        telemetry.error(
          "Failed to create work item",
          result.reason,
          { title: batch[j].title }
        );
      }
    }

    // Delay between batches
    if (i + MAX_CONCURRENT < tasks.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS)
      );
    }
  }

  if (errors.length > 0) {
    telemetry.warn(
      `Batch creation completed with errors: ${results.length} succeeded, ${errors.length} failed`
    );
  } else {
    telemetry.info(`Batch creation completed: ${results.length} work items created`);
  }

  return results;
}

/**
 * Maps ActionItem type to Azure DevOps work item type
 * Adjust these mappings based on your process template (Agile, Scrum, Basic)
 */
function mapWorkItemType(type: ActionItem["type"]): string {
  switch (type) {
    case "Bug":
      return "Bug";
    case "User Story":
      return "User Story"; // Use "Product Backlog Item" for Scrum template
    case "Task":
    default:
      return config.azureDevOps.defaultWorkItemType;
  }
}

/**
 * Formats the work item description with AI generation notice and correlation ID
 */
function formatDescription(task: ActionItem, correlationId: string): string {
  let description = `<div><strong>🤖 Generated by ActionAgent AI</strong></div>`;
  description += `<hr/>`;

  if (task.description) {
    description += `<p>${escapeHtml(task.description)}</p>`;
  }

  description += `<br/><table>`;
  description += `<tr><td><strong>Priority:</strong></td><td>${task.priority}</td></tr>`;
  description += `<tr><td><strong>Original Assignee:</strong></td><td>${escapeHtml(task.assignedTo)}</td></tr>`;

  if (task.deadline) {
    description += `<tr><td><strong>Deadline:</strong></td><td>${escapeHtml(task.deadline)}</td></tr>`;
  }

  description += `</table>`;
  description += `<br/><p><em>This work item was automatically created from a Teams meeting transcript.</em></p>`;
  description += `<p style="color: #888; font-size: 10px;">Correlation ID: ${correlationId}</p>`;

  return description;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Gets work item details by ID
 */
export async function getWorkItem(workItemId: number): Promise<unknown> {
  const workItemTracking = await connection.getWorkItemTrackingApi();
  return workItemTracking.getWorkItem(workItemId);
}

/**
 * Validates connection to Azure DevOps
 * Useful for health checks
 */
export async function validateConnection(): Promise<boolean> {
  try {
    const coreApi = await connection.getCoreApi();
    const projects = await coreApi.getProjects();
    return projects.length > 0;
  } catch (error) {
    telemetry.error("Azure DevOps connection validation failed", error as Error);
    return false;
  }
}

/**
 * Get list of available work item types in the project
 */
export async function getWorkItemTypes(): Promise<string[]> {
  try {
    const workItemTracking = await connection.getWorkItemTrackingApi();
    const types = await workItemTracking.getWorkItemTypes(config.azureDevOps.project);
    return types.map((t) => t.name || "").filter(Boolean);
  } catch (error) {
    telemetry.error("Failed to get work item types", error as Error);
    return [];
  }
}

export { connection };
