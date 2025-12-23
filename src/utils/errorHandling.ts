/**
 * Error Handling & Resilience Utilities
 * Provides retry logic, correlation IDs, and standardized error handling
 */

import { v4 as uuidv4 } from "uuid";
import { config } from "../config";

/**
 * Correlation context for tracing requests across services
 */
export interface CorrelationContext {
  correlationId: string;
  operationName: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

/**
 * Creates a new correlation context for tracing
 */
export function createCorrelationContext(
  operationName: string,
  metadata: Record<string, unknown> = {}
): CorrelationContext {
  return {
    correlationId: uuidv4(),
    operationName,
    startTime: Date.now(),
    metadata,
  };
}

/**
 * Logs operation completion with timing
 */
export function logOperationComplete(
  context: CorrelationContext,
  success: boolean,
  additionalInfo?: Record<string, unknown>
): void {
  const duration = Date.now() - context.startTime;
  const status = success ? "✅ SUCCESS" : "❌ FAILED";
  
  console.log(
    `[${context.correlationId}] ${status} ${context.operationName} (${duration}ms)`,
    additionalInfo ? JSON.stringify(additionalInfo) : ""
  );
}

/**
 * Standardized error with correlation ID
 */
export class ActionAgentError extends Error {
  public readonly correlationId: string;
  public readonly operationName: string;
  public readonly isRetryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    context: CorrelationContext,
    options: {
      isRetryable?: boolean;
      statusCode?: number;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = "ActionAgentError";
    this.correlationId = context.correlationId;
    this.operationName = context.operationName;
    this.isRetryable = options.isRetryable ?? false;
    this.statusCode = options.statusCode;
    this.cause = options.cause;
  }

  toUserMessage(): string {
    return `Something went wrong. Reference ID: ${this.correlationId}`;
  }

  toLogMessage(): string {
    return `[${this.correlationId}] ${this.operationName}: ${this.message}`;
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: config.features.maxRetries,
  baseDelayMs: config.features.retryDelayMs,
  maxDelayMs: 30000,
  jitterFactor: 0.2,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterFactor * (Math.random() - 0.5);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ActionAgentError) {
    return error.isRetryable;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for common transient error patterns
    if (
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("service unavailable") ||
      message.includes("gateway timeout")
    ) {
      return true;
    }
    
    // Check for status code in error
    const statusMatch = message.match(/status[:\s]+(\d{3})/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return retryableStatusCodes.includes(status);
    }
  }
  
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: CorrelationContext,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...defaultRetryConfig, ...retryConfig };
  
  if (!config.features.enableRetries) {
    return operation();
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        console.log(
          `[${context.correlationId}] ${context.operationName} succeeded on attempt ${attempt}`
        );
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const shouldRetry = attempt < cfg.maxAttempts && isRetryableError(error);
      
      if (shouldRetry) {
        const delay = calculateBackoffDelay(attempt, cfg);
        console.warn(
          `[${context.correlationId}] ${context.operationName} failed (attempt ${attempt}/${cfg.maxAttempts}), ` +
          `retrying in ${delay}ms: ${lastError.message}`
        );
        await sleep(delay);
      } else {
        console.error(
          `[${context.correlationId}] ${context.operationName} failed permanently after ${attempt} attempt(s): ${lastError.message}`
        );
        break;
      }
    }
  }

  throw new ActionAgentError(
    lastError?.message || "Operation failed after retries",
    context,
    { isRetryable: false, cause: lastError }
  );
}

/**
 * Wraps an async operation with error handling and logging
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: CorrelationContext,
  options: {
    enableRetry?: boolean;
    retryConfig?: Partial<RetryConfig>;
  } = {}
): Promise<T> {
  try {
    const result = options.enableRetry
      ? await withRetry(operation, context, options.retryConfig)
      : await operation();
    
    logOperationComplete(context, true);
    return result;
  } catch (error) {
    logOperationComplete(context, false, { error: String(error) });
    
    if (error instanceof ActionAgentError) {
      throw error;
    }
    
    throw new ActionAgentError(
      error instanceof Error ? error.message : String(error),
      context,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(
  jsonString: string,
  fallback: T
): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    console.warn("Failed to parse JSON, using fallback");
    return fallback;
  }
}
