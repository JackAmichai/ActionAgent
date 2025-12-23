/**
 * Unit tests for Error Handling & Telemetry utilities
 */
import {
  createCorrelationContext,
  logOperationComplete,
  ActionAgentError,
  withRetry,
  withErrorHandling,
  safeJsonParse,
  CorrelationContext,
} from '../../src/utils/errorHandling';

import { telemetry, trackOperation } from '../../src/utils/telemetry';

describe('Correlation Context', () => {
  it('should create context with correlation ID', () => {
    const context = createCorrelationContext('TestOperation');

    expect(context.correlationId).toBeDefined();
    expect(typeof context.correlationId).toBe('string');
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it('should include operation name', () => {
    const context = createCorrelationContext('TestOperation');
    expect(context.operationName).toBe('TestOperation');
  });

  it('should set start time', () => {
    const before = Date.now();
    const context = createCorrelationContext('Test');
    const after = Date.now();

    expect(context.startTime).toBeGreaterThanOrEqual(before);
    expect(context.startTime).toBeLessThanOrEqual(after);
  });

  it('should include metadata', () => {
    const context = createCorrelationContext('Test', { key: 'value' });
    expect(context.metadata).toEqual({ key: 'value' });
  });

  it('should generate unique correlation IDs', () => {
    const context1 = createCorrelationContext('Test1');
    const context2 = createCorrelationContext('Test2');

    expect(context1.correlationId).not.toBe(context2.correlationId);
  });
});

describe('logOperationComplete', () => {
  it('should log success with timing', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const context = createCorrelationContext('TestOp');
    logOperationComplete(context, true);

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('SUCCESS');
    expect(logCall).toContain('TestOp');
    logSpy.mockRestore();
  });

  it('should log failure with timing', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const context = createCorrelationContext('FailOp');
    logOperationComplete(context, false);

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('FAILED');
    logSpy.mockRestore();
  });
});

describe('ActionAgentError', () => {
  it('should create error with context', () => {
    const context = createCorrelationContext('TestOperation');
    const error = new ActionAgentError('Test error message', context);

    expect(error.message).toBe('Test error message');
    expect(error.correlationId).toBe(context.correlationId);
    expect(error.operationName).toBe('TestOperation');
    expect(error.name).toBe('ActionAgentError');
  });

  it('should set retryable flag', () => {
    const context = createCorrelationContext('Test');
    const retryableError = new ActionAgentError('Error', context, { isRetryable: true });
    const nonRetryableError = new ActionAgentError('Error', context, { isRetryable: false });

    expect(retryableError.isRetryable).toBe(true);
    expect(nonRetryableError.isRetryable).toBe(false);
  });

  it('should default to non-retryable', () => {
    const context = createCorrelationContext('Test');
    const error = new ActionAgentError('Error', context);

    expect(error.isRetryable).toBe(false);
  });

  it('should include status code when provided', () => {
    const context = createCorrelationContext('Test');
    const error = new ActionAgentError('Error', context, { statusCode: 500 });

    expect(error.statusCode).toBe(500);
  });

  it('should include cause when provided', () => {
    const context = createCorrelationContext('Test');
    const cause = new Error('Original error');
    const error = new ActionAgentError('Wrapped error', context, { cause });

    expect(error.cause).toBe(cause);
  });

  it('should generate user-friendly message', () => {
    const context = createCorrelationContext('Test');
    const error = new ActionAgentError('Internal error', context);

    const userMessage = error.toUserMessage();
    expect(userMessage).toContain('Reference ID');
    expect(userMessage).toContain(context.correlationId);
  });

  it('should generate log message', () => {
    const context = createCorrelationContext('Test');
    const error = new ActionAgentError('Test error', context);

    const logMessage = error.toLogMessage();
    expect(logMessage).toContain(context.correlationId);
    expect(logMessage).toContain('Test');
    expect(logMessage).toContain('Test error');
  });
});

describe('withRetry', () => {
  let context: CorrelationContext;

  beforeEach(() => {
    context = createCorrelationContext('RetryTest');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await withRetry(fn, context);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should execute the operation', async () => {
    let executed = false;
    const fn = jest.fn().mockImplementation(async () => {
      executed = true;
      return 'done';
    });

    await withRetry(fn, context);

    expect(executed).toBe(true);
  });

  it('should not retry non-retryable ActionAgentError', async () => {
    const nonRetryableError = new ActionAgentError('Not retryable', context, { isRetryable: false });
    const fn = jest.fn().mockRejectedValue(nonRetryableError);

    await expect(withRetry(fn, context, { maxAttempts: 3, baseDelayMs: 10 }))
      .rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw on permanent failure', async () => {
    // Non-retryable error pattern
    const fn = jest.fn().mockRejectedValue(new Error('Invalid configuration'));

    await expect(withRetry(fn, context, { maxAttempts: 1, baseDelayMs: 10 }))
      .rejects.toThrow();
  });
});

describe('withErrorHandling', () => {
  let context: CorrelationContext;

  beforeEach(() => {
    context = createCorrelationContext('ErrorHandlingTest');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return result on success', async () => {
    const fn = jest.fn().mockResolvedValue('result');

    const result = await withErrorHandling(fn, context);

    expect(result).toBe('result');
  });

  it('should wrap generic errors in ActionAgentError', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Generic error'));

    await expect(withErrorHandling(fn, context))
      .rejects.toThrow(ActionAgentError);
  });

  it('should preserve ActionAgentError', async () => {
    const originalError = new ActionAgentError('Original', context, { statusCode: 400 });
    const fn = jest.fn().mockRejectedValue(originalError);

    await expect(withErrorHandling(fn, context))
      .rejects.toThrow(originalError);
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse('{"key": "value"}', {});

    expect(result).toEqual({ key: 'value' });
  });

  it('should return fallback for invalid JSON', () => {
    const fallback = { default: true };
    const result = safeJsonParse('not valid json', fallback);

    expect(result).toBe(fallback);
  });

  it('should handle empty string', () => {
    const fallback = { default: true };
    const result = safeJsonParse('', fallback);

    expect(result).toBe(fallback);
  });

  it('should handle arrays', () => {
    const result = safeJsonParse<number[]>('[1, 2, 3]', []);

    expect(result).toEqual([1, 2, 3]);
  });
});

describe('Telemetry Service', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logging methods', () => {
    it('should have debug method', () => {
      expect(() => telemetry.debug('test message')).not.toThrow();
    });

    it('should have info method', () => {
      expect(() => telemetry.info('test message')).not.toThrow();
    });

    it('should have warn method', () => {
      expect(() => telemetry.warn('test message')).not.toThrow();
    });

    it('should have error method', () => {
      expect(() => telemetry.error('test message')).not.toThrow();
    });

    it('should accept data object', () => {
      expect(() => telemetry.info('message', { key: 'value' })).not.toThrow();
    });
  });

  describe('metric tracking', () => {
    it('should track metric without throwing', () => {
      expect(() => telemetry.trackMetric('test.metric', 100)).not.toThrow();
    });

    it('should track metric with unit', () => {
      expect(() => telemetry.trackMetric('test.duration', 500, 'ms')).not.toThrow();
    });

    it('should track metric with tags', () => {
      expect(() => telemetry.trackMetric('test.count', 1, 'count', { env: 'test' })).not.toThrow();
    });

    it('should track success', () => {
      expect(() => telemetry.trackSuccess('operation')).not.toThrow();
    });

    it('should track failure', () => {
      expect(() => telemetry.trackFailure('operation', 'TestError')).not.toThrow();
    });

    it('should track rate limit', () => {
      expect(() => telemetry.trackRateLimit('TestService')).not.toThrow();
    });
  });

  describe('timer', () => {
    it('should create timer', () => {
      const timer = telemetry.startTimer('test.operation');

      expect(timer).toBeDefined();
      expect(typeof timer.stop).toBe('function');
      expect(typeof timer.addTag).toBe('function');
    });

    it('should return duration on stop', () => {
      const timer = telemetry.startTimer('test.operation');
      
      // Small delay to ensure non-zero duration
      const duration = timer.stop();

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should allow adding tags', () => {
      const timer = telemetry.startTimer('test.operation');
      
      expect(() => timer.addTag('key', 'value')).not.toThrow();
      timer.stop();
    });
  });

  describe('metrics summary', () => {
    it('should return metrics summary', () => {
      const summary = telemetry.getMetricsSummary();

      expect(typeof summary).toBe('object');
    });

    it('should return health metrics', () => {
      const health = telemetry.getHealthMetrics();

      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('memoryUsage');
    });
  });
});

describe('trackOperation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return operation result', async () => {
    const result = await trackOperation('test.op', async () => 'result');

    expect(result).toBe('result');
  });

  it('should rethrow errors', async () => {
    await expect(trackOperation('test.op', async () => {
      throw new Error('Test error');
    })).rejects.toThrow('Test error');
  });
});
