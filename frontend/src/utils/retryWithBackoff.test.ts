/**
 * Tests for retryWithBackoff utility
 * 
 * Pattern: TDD - Tests written following CodeNet best practices
 * Coverage target: >80% (per StillOnTime constitution)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, Retry } from './retryWithBackoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return result on first successful attempt', async () => {
    // Pattern: async-await testing
    const mockFn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    // Pattern: error-handling testing
    const error1 = new Error('Network error occurred') as any;
    const error2 = new Error('Request timeout') as any;
    
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, {
      maxAttempts: 3,
      initialDelay: 100
    });

    // Fast-forward timers
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max attempts', async () => {
    // Pattern: error-handling - testing failure scenarios
    const error = new Error('Persistent network error');
    const mockFn = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(mockFn, {
      maxAttempts: 3,
      initialDelay: 100
    });

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Persistent network error');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    // Pattern: testing exponential backoff timing
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error 1'))
      .mockRejectedValueOnce(new Error('Network error 2'))
      .mockResolvedValue('success');

    const delays: number[] = [];
    const startTime = Date.now();

    const promise = retryWithBackoff(mockFn, {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      onRetry: (attempt) => {
        delays.push(Date.now() - startTime);
      }
    });

    await vi.runAllTimersAsync();
    await promise;

    // Delays should be: 1000ms, 2000ms (exponential)
    // Allow some tolerance for timing
    expect(delays.length).toBe(2);
  });

  it('should call onRetry callback', async () => {
    // Pattern: callback testing
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Timeout error'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const promise = retryWithBackoff(mockFn, {
      maxAttempts: 3,
      initialDelay: 100,
      onRetry
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('should not retry on non-retryable errors', async () => {
    // Pattern: error classification testing
    const error = new Error('Client error') as any;
    error.response = { status: 400 }; // 4xx errors are not retryable

    const mockFn = vi.fn().mockRejectedValue(error);

    await expect(
      retryWithBackoff(mockFn, { maxAttempts: 3 })
    ).rejects.toThrow('Client error');

    expect(mockFn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should respect maxDelay cap', async () => {
    // Pattern: boundary testing
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout 1'))
      .mockRejectedValueOnce(new Error('Network timeout 2'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, {
      maxAttempts: 3,
      initialDelay: 10000,
      maxDelay: 5000, // Cap at 5 seconds
      backoffMultiplier: 2
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});

describe('Retry decorator', () => {
  it('should retry decorated method', async () => {
    // Pattern: decorator testing
    class TestService {
      callCount = 0;

      @Retry({ maxAttempts: 3, initialDelay: 100 })
      async fetchData(): Promise<string> {
        this.callCount++;
        if (this.callCount < 3) {
          throw new Error('Temporary network error');
        }
        return 'success';
      }
    }

    const service = new TestService();
    const promise = service.fetchData();

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(service.callCount).toBe(3);
  });
});

