/**
 * ActionAgent Demo Script
 * 
 * This script demonstrates the full ActionAgent pipeline WITHOUT requiring:
 * - Microsoft 365 subscription
 * - Teams
 * - Graph API permissions
 * 
 * It uses a mock transcript and shows the AI extraction + DevOps integration.
 * 
 * Usage: npm run demo
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as readline from "readline";

// Load environment variables FIRST
dotenv.config();

// Force demo mode BEFORE importing config-dependent modules
process.env.DEMO_MODE = "true";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(color: string, emoji: string, message: string): void {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function divider(): void {
  console.log("\n" + "═".repeat(60) + "\n");
}

/**
 * Parse VTT format to clean text
 */
function parseVttToText(vttContent: string): string {
  if (!vttContent) return "";
  
  const lines = vttContent.split("\n");
  const textLines: string[] = [];
  let currentSpeaker = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip headers and timestamps
    if (!trimmed || trimmed === "WEBVTT" || trimmed.startsWith("NOTE")) {
      continue;
    }
    if (trimmed.includes(" --> ")) {
      continue;
    }
    if (/^\d+$/.test(trimmed)) {
      continue;
    }
    
    // Extract speaker and text
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
      textLines.push(trimmed);
    }
  }
  
  return textLines.join(" ").replace(/\s+/g, " ").trim();
}

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runDemo(): Promise<void> {
  console.log(`
${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗       ║
║    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║       ║
║    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║       ║
║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║       ║
║    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║       ║
║    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝       ║
║                      AGENT                                ║
║                                                           ║
║         AI-Powered Meeting → DevOps Automation           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}
`);

  log(colors.yellow, "🎭", "DEMO MODE - No Microsoft 365 subscription required\n");

  // Step 1: Load mock transcript
  divider();
  log(colors.blue, "📄", "STEP 1: Loading mock meeting transcript...");
  
  const transcriptPath = path.join(__dirname, "..", "tests", "fixtures", "mock_transcript.vtt");
  
  if (!fs.existsSync(transcriptPath)) {
    log(colors.red, "❌", `Transcript not found at: ${transcriptPath}`);
    log(colors.yellow, "💡", "Make sure you're running from the project root directory");
    process.exit(1);
  }
  
  const vttContent = fs.readFileSync(transcriptPath, "utf-8");
  const transcript = parseVttToText(vttContent);
  
  log(colors.green, "✅", "Transcript loaded successfully!");
  console.log(`\n${colors.cyan}--- Transcript Preview ---${colors.reset}`);
  console.log(transcript.substring(0, 500) + "...\n");

  // Step 2: Import services (after env is loaded)
  log(colors.blue, "🔌", "Loading services...");
  
  let extractActionItems: typeof import("./services/aiService").extractActionItems;
  let createWorkItems: typeof import("./services/devopsService").createWorkItems;
  
  try {
    const aiService = await import("./services/aiService");
    const devopsService = await import("./services/devopsService");
    extractActionItems = aiService.extractActionItems;
    createWorkItems = devopsService.createWorkItems;
    log(colors.green, "✅", "Services loaded!");
  } catch (error) {
    log(colors.red, "❌", `Failed to load services: ${error}`);
    log(colors.yellow, "💡", "Check your .env file has AZURE_OPENAI_* and AZURE_DEVOPS_* variables");
    process.exit(1);
  }

  // Step 3: Extract action items using GPT-4o
  divider();
  log(colors.blue, "🧠", "STEP 2: Extracting action items with GPT-4o...");
  log(colors.magenta, "⏳", "Analyzing transcript for technical tasks...\n");
  
  let actionItemsResult;
  const startTime = Date.now();
  
  try {
    actionItemsResult = await extractActionItems(transcript);
  } catch (error) {
    log(colors.red, "❌", `Azure OpenAI extraction failed: ${error}`);
    log(colors.yellow, "💡", "Check your AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY");
    process.exit(1);
  }
  
  const duration = Date.now() - startTime;
  
  log(colors.green, "✅", `Extracted ${actionItemsResult.actionItems.length} action items in ${duration}ms`);
  
  console.log(`\n${colors.cyan}--- Extracted Action Items ---${colors.reset}`);
  actionItemsResult.actionItems.forEach((item, index) => {
    console.log(`
${colors.bright}${index + 1}. ${item.title}${colors.reset}
   Type: ${item.type}
   Assigned To: ${item.assignedTo || "Unassigned"}
   Priority: ${item.priority}
   ${item.description ? `Description: ${item.description}` : ""}`);
  });

  if (actionItemsResult.summary) {
    console.log(`\n${colors.cyan}--- AI Summary ---${colors.reset}`);
    console.log(actionItemsResult.summary);
  }

  // Step 4: Ask about creating work items
  divider();
  log(colors.blue, "📝", "STEP 3: Create work items in Azure DevOps");
  
  const askUser = await promptUser(`\n${colors.yellow}Do you want to create these ${actionItemsResult.actionItems.length} work items in Azure DevOps? (y/n): ${colors.reset}`);
  
  if (askUser.toLowerCase() !== "y") {
    log(colors.yellow, "⏭️", "Skipping work item creation (dry run)");
    divider();
    printSummary(actionItemsResult.actionItems, []);
    return;
  }

  log(colors.magenta, "⏳", "Creating work items...\n");
  
  let workItemResults;
  try {
    workItemResults = await createWorkItems(actionItemsResult.actionItems, false);
  } catch (error) {
    log(colors.red, "❌", `Azure DevOps creation failed: ${error}`);
    log(colors.yellow, "💡", "Check your AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PAT, and AZURE_DEVOPS_PROJECT");
    divider();
    printSummary(actionItemsResult.actionItems, []);
    return;
  }
  
  console.log(`\n${colors.cyan}--- Created Work Items ---${colors.reset}`);
  workItemResults.forEach((wi) => {
    console.log(`${colors.green}✅ #${wi.id}: ${wi.title}${colors.reset}`);
    console.log(`   ${colors.blue}${wi.url}${colors.reset}`);
  });

  // Summary
  divider();
  printSummary(actionItemsResult.actionItems, workItemResults);
}

interface ActionItem {
  title: string;
  type: string;
  assignedTo?: string;
  priority: string;
  description?: string;
}

interface WorkItemResult {
  id: number;
  title: string;
  url: string;
}

function printSummary(actionItems: ActionItem[], workItemResults: WorkItemResult[]): void {
  console.log(`
${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════════════════════╗
║                     DEMO COMPLETE                         ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}

${colors.green}✅ Action Items Extracted: ${actionItems.length}${colors.reset}
${workItemResults.length > 0 ? `${colors.green}✅ Work Items Created: ${workItemResults.length}${colors.reset}` : `${colors.yellow}⏭️ Work Item Creation: Skipped${colors.reset}`}

${colors.bright}What ActionAgent Does:${colors.reset}
1. 📄 Fetches meeting transcripts from Microsoft Graph API
2. 🧠 Uses GPT-4o to extract actionable technical tasks
3. 📝 Creates work items in Azure DevOps automatically
4. 💬 Posts a summary back to the Teams chat

${colors.cyan}Ready for production?${colors.reset}
- Get a Microsoft 365 subscription (free developer program or Business Basic trial)
- Set DEMO_MODE=false in .env
- Run: ${colors.yellow}npm start${colors.reset} to launch the Teams bot

${colors.magenta}Questions? See README.md for setup instructions.${colors.reset}
`);
}

// Run the demo
runDemo().catch((error) => {
  console.error(`\n${colors.red}❌ Demo failed: ${error.message}${colors.reset}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
