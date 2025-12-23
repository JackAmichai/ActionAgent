/**
 * ActionItem Model - Represents a task extracted from meeting transcripts
 */
export interface ActionItem {
  title: string;
  assignedTo: string;
  type: "Task" | "Bug" | "User Story";
  priority: "High" | "Medium" | "Low";
  description?: string;
  deadline?: string;
}

/**
 * Response from AI service containing extracted action items
 */
export interface ActionItemsResponse {
  actionItems: ActionItem[];
  summary?: string;
}

/**
 * Azure DevOps work item creation result
 */
export interface WorkItemResult {
  id: number;
  url: string;
  title: string;
  type: string;
}

/**
 * Meeting context from Teams
 */
export interface MeetingContext {
  meetingId: string;
  chatId: string;
  organizerId: string;
  subject?: string;
  startTime?: Date;
  endTime?: Date;
}
