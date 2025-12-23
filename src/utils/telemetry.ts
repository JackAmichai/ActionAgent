/**
 * Telemetry & Observability Service
 * Provides logging, metrics, and tracing for ActionAgent operations
 */

import { config } from "../config";

/**
 * Metric types for tracking
 */
export interface Metric {
  name: string;
  value: number;
  unit: "ms" | "count" | "bytes";
  tags: Record<string, string>;
  timestamp: Date;
}

/**
 * Operation timing tracker
 */
export interface OperationTimer {
  stop: () => number;
  addTag: (key: string, value: string) => void;
}

/**
 * In-memory metrics store (replace with Application Insights in production)
 */
class TelemetryService {
  private metrics: Metric[] = [];
  private readonly maxMetrics = 1000;

  /**
   * Log levels
   */
  private readonly levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: keyof typeof this.levels): boolean {
    return this.levels[level] >= this.levels[config.server.logLevel];
  }

  /**
   * Structured logging
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data) : "");
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(`[INFO] ${message}`, data ? JSON.stringify(data) : "");
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${message}`, data ? JSON.stringify(data) : "");
    }
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(
        `[ERROR] ${message}`,
        error ? `\n${error.stack}` : "",
        data ? JSON.stringify(data) : ""
      );
    }
  }

  /**
   * Track a metric
   */
  trackMetric(
    name: string,
    value: number,
    unit: Metric["unit"] = "count",
    tags: Record<string, string> = {}
  ): void {
    if (!config.features.enableTelemetry) return;

    const metric: Metric = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date(),
    };

    this.metrics.push(metric);

    // Rotate old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.debug(`Metric: ${name}`, { value, unit, tags });
  }

  /**
   * Start timing an operation
   */
  startTimer(
    operationName: string,
    initialTags: Record<string, string> = {}
  ): OperationTimer {
    const startTime = Date.now();
    const tags = { ...initialTags };

    return {
      stop: () => {
        const duration = Date.now() - startTime;
        this.trackMetric(`${operationName}.duration`, duration, "ms", tags);
        return duration;
      },
      addTag: (key: string, value: string) => {
        tags[key] = value;
      },
    };
  }

  /**
   * Track a successful operation
   */
  trackSuccess(operationName: string, tags: Record<string, string> = {}): void {
    this.trackMetric(`${operationName}.success`, 1, "count", tags);
  }

  /**
   * Track a failed operation
   */
  trackFailure(
    operationName: string,
    errorType: string,
    tags: Record<string, string> = {}
  ): void {
    this.trackMetric(`${operationName}.failure`, 1, "count", {
      ...tags,
      errorType,
    });
  }

  /**
   * Track rate limit hit
   */
  trackRateLimit(service: string): void {
    this.trackMetric("rate_limit.hit", 1, "count", { service });
    this.warn(`Rate limit hit for ${service}`);
  }

  /**
   * Get metrics summary for a time window
   */
  getMetricsSummary(windowMs: number = 300000): Record<string, unknown> {
    const cutoff = new Date(Date.now() - windowMs);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    const summary: Record<string, { count: number; total: number; avg: number }> = {};

    for (const metric of recentMetrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = { count: 0, total: 0, avg: 0 };
      }
      summary[metric.name].count++;
      summary[metric.name].total += metric.value;
      summary[metric.name].avg =
        summary[metric.name].total / summary[metric.name].count;
    }

    return summary;
  }

  /**
   * Health check metrics
   */
  getHealthMetrics(): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      environment: config.server.environment,
      metricsCount: this.metrics.length,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }
}

// Export singleton instance
export const telemetry = new TelemetryService();

/**
 * Decorator-style wrapper for tracking operation metrics
 */
export async function trackOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  tags: Record<string, string> = {}
): Promise<T> {
  const timer = telemetry.startTimer(operationName, tags);

  try {
    const result = await operation();
    timer.stop();
    telemetry.trackSuccess(operationName, tags);
    return result;
  } catch (error) {
    timer.stop();
    telemetry.trackFailure(
      operationName,
      error instanceof Error ? error.name : "UnknownError",
      tags
    );
    throw error;
  }
}
