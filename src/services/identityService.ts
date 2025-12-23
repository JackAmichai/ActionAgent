/**
 * Identity Resolution Service
 * Maps names extracted by AI to actual Azure AD users
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { config } from "../config";
import { telemetry } from "../utils/telemetry";
import "isomorphic-fetch";

// Initialize credentials
const credential = new ClientSecretCredential(
  config.azureAd.tenantId,
  config.azureAd.clientId,
  config.azureAd.clientSecret
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});

const graphClient = Client.initWithMiddleware({ authProvider });

/**
 * Resolved user information
 */
export interface ResolvedUser {
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
  id: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  originalName: string;
  resolved: boolean;
  user?: ResolvedUser;
  alternatives?: ResolvedUser[];
  error?: string;
}

/**
 * Cache for resolved users (simple in-memory cache)
 */
const userCache = new Map<string, ResolvedUser[]>();
const CACHE_TTL_MS = 300000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Clears expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > CACHE_TTL_MS) {
      userCache.delete(key);
      cacheTimestamps.delete(key);
    }
  }
}

/**
 * Search for users by display name
 */
async function searchUsersByName(name: string): Promise<ResolvedUser[]> {
  const cacheKey = name.toLowerCase();
  
  // Check cache first
  cleanCache();
  if (userCache.has(cacheKey)) {
    telemetry.debug("User cache hit", { name });
    return userCache.get(cacheKey)!;
  }

  try {
    // Search using filter - exact match first
    const exactResult = await graphClient
      .api("/users")
      .filter(`displayName eq '${escapeODataValue(name)}'`)
      .select("id,displayName,userPrincipalName,mail")
      .top(5)
      .get();

    let users: ResolvedUser[] = exactResult.value.map((u: Record<string, unknown>) => ({
      displayName: u.displayName as string,
      userPrincipalName: u.userPrincipalName as string,
      mail: u.mail as string | null,
      id: u.id as string,
      confidence: "high" as const,
    }));

    // If no exact match, try startswith
    if (users.length === 0) {
      const partialResult = await graphClient
        .api("/users")
        .filter(`startswith(displayName, '${escapeODataValue(name)}')`)
        .select("id,displayName,userPrincipalName,mail")
        .top(5)
        .get();

      users = partialResult.value.map((u: Record<string, unknown>) => ({
        displayName: u.displayName as string,
        userPrincipalName: u.userPrincipalName as string,
        mail: u.mail as string | null,
        id: u.id as string,
        confidence: "medium" as const,
      }));
    }

    // If still no match, try contains via search
    if (users.length === 0) {
      try {
        const searchResult = await graphClient
          .api("/users")
          .header("ConsistencyLevel", "eventual")
          .search(`"displayName:${escapeODataValue(name)}"`)
          .select("id,displayName,userPrincipalName,mail")
          .top(5)
          .get();

        users = searchResult.value.map((u: Record<string, unknown>) => ({
          displayName: u.displayName as string,
          userPrincipalName: u.userPrincipalName as string,
          mail: u.mail as string | null,
          id: u.id as string,
          confidence: "low" as const,
        }));
      } catch {
        // Search might not be available, continue with empty results
        telemetry.debug("User search not available, skipping", { name });
      }
    }

    // Cache results
    userCache.set(cacheKey, users);
    cacheTimestamps.set(cacheKey, Date.now());

    return users;
  } catch (error) {
    telemetry.error("Failed to search users", error as Error, { name });
    return [];
  }
}

/**
 * Escape special characters for OData filter
 */
function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Resolve a single name to an Azure AD user
 */
export async function resolveUser(name: string): Promise<ResolutionResult> {
  if (!name || name.toLowerCase() === "unassigned") {
    return {
      originalName: name,
      resolved: false,
    };
  }

  const timer = telemetry.startTimer("identity.resolve");

  try {
    const users = await searchUsersByName(name);

    if (users.length === 0) {
      timer.stop();
      return {
        originalName: name,
        resolved: false,
        error: "No matching users found",
      };
    }

    if (users.length === 1) {
      timer.stop();
      telemetry.trackSuccess("identity.resolve", { confidence: users[0].confidence });
      return {
        originalName: name,
        resolved: true,
        user: users[0],
      };
    }

    // Multiple matches - return best match with alternatives
    timer.stop();
    telemetry.trackSuccess("identity.resolve", { 
      confidence: users[0].confidence,
      alternatives: String(users.length - 1) 
    });
    
    return {
      originalName: name,
      resolved: true,
      user: users[0],
      alternatives: users.slice(1),
    };
  } catch (error) {
    timer.stop();
    telemetry.trackFailure("identity.resolve", "GraphError");
    return {
      originalName: name,
      resolved: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolve multiple names in batch
 */
export async function resolveUsers(
  names: string[]
): Promise<Map<string, ResolutionResult>> {
  const results = new Map<string, ResolutionResult>();
  const uniqueNames = [...new Set(names.filter((n) => n && n !== "Unassigned"))];

  // Resolve in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(resolveUser));
    
    for (let j = 0; j < batch.length; j++) {
      results.set(batch[j], batchResults[j]);
    }
  }

  return results;
}

/**
 * Get the best identity string for Azure DevOps
 * Returns UPN if resolved, original name if not
 */
export function getDevOpsIdentity(resolution: ResolutionResult): string {
  if (resolution.resolved && resolution.user) {
    return resolution.user.userPrincipalName;
  }
  return resolution.originalName;
}

/**
 * Format resolution for display in Adaptive Card
 */
export function formatResolutionForCard(resolution: ResolutionResult): string {
  if (!resolution.resolved) {
    return `⚠️ ${resolution.originalName} (unresolved)`;
  }

  const user = resolution.user!;
  const icon = user.confidence === "high" ? "✅" : user.confidence === "medium" ? "🔶" : "⚪";
  
  return `${icon} ${user.displayName}`;
}
