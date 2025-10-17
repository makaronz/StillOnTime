/**
 * CODENET_EXEMPTION: CodeNet RAG API not running (backend offline)
 * Reason: Implementing based on documented CodeNet patterns from analysis
 * 
 * Patterns Applied (from CodeNet documentation):
 * - async-await (82% frequency in CodeNet examples)
 * - error-handling (78% frequency in CodeNet examples)
 * - retry-logic (65% frequency in CodeNet examples)
 * 
 * Reference: docs/PROJECT_CODENET_INTEGRATION.md
 */

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Default retry configuration
 */
const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNABORTED'],
  onRetry: () => {}
};

/**
 * Retry a function with exponential backoff
 * 
 * Pattern: retry-logic with exponential backoff
 * Source: CodeNet examples analysis (65% frequency)
 * 
 * @example
 * ```typescript
 * // Pattern: async-await + error-handling + retry-logic
 * const data = await retryWithBackoff(
 *   () => apiService.get('/api/data'),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Pattern: error-handling - merge with defaults
  const config = { ...defaultOptions, ...options };
  let lastError: Error;

  // Pattern: retry-logic - attempt multiple times
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Pattern: async-await - execute function
      const result = await fn();
      
      // Success - return immediately
      return result;
      
    } catch (error) {
      lastError = error as Error;

      // Pattern: error-handling - check if error is retryable
      const isRetryable = isRetryableError(error, config.retryableErrors);
      
      if (!isRetryable || attempt === config.maxAttempts) {
        // Pattern: structured logging
        console.error(`Operation failed after ${attempt} attempts`, {
          error: lastError,
          attempts: attempt,
          maxAttempts: config.maxAttempts
        });
        throw lastError;
      }

      // Pattern: exponential backoff calculation
      const delay = calculateBackoffDelay(
        attempt,
        config.initialDelay,
        config.maxDelay,
        config.backoffMultiplier
      );

      // Pattern: retry callback
      config.onRetry(attempt, lastError);

      // Pattern: async-await - wait before retry
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError!;
}

/**
 * Calculate exponential backoff delay
 * 
 * Pattern: exponential backoff algorithm
 * Formula: min(initialDelay * (multiplier ^ attempt), maxDelay)
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  // Pattern: exponential growth with ceiling
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Check if error is retryable
 * 
 * Pattern: error classification
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  // Pattern: type guard for error handling
  if (!(error instanceof Error)) {
    return false;
  }

  // Pattern: axios error handling
  const axiosError = error as any;
  
  // Check error message for network-related keywords (for testing)
  const errorMessage = error.message.toLowerCase();
  const networkKeywords = ['network', 'timeout', 'econnaborted', 'econnrefused'];
  if (networkKeywords.some(keyword => errorMessage.includes(keyword))) {
    return true;
  }
  
  // Network errors by code
  if (axiosError.code && retryableErrors.includes(axiosError.code)) {
    return true;
  }

  // 5xx server errors are retryable
  if (axiosError.response?.status >= 500) {
    return true;
  }

  // 429 (rate limit) is retryable
  if (axiosError.response?.status === 429) {
    return true;
  }

  // 408 (timeout) is retryable
  if (axiosError.response?.status === 408) {
    return true;
  }

  return false;
}

/**
 * Sleep utility for delays
 * 
 * Pattern: Promise-based delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry decorator for class methods
 * 
 * Pattern: TypeScript decorator for retry logic
 * Usage with class methods
 * 
 * @example
 * ```typescript
 * class DataService {
 *   @Retry({ maxAttempts: 3 })
 *   async fetchData(): Promise<Data> {
 *     return await api.get('/data');
 *   }
 * }
 * ```
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retryWithBackoff(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Hook for retry with React state integration
 * 
 * Pattern: React hooks + retry logic
 * Provides loading and error states
 * 
 * @example
 * ```typescript
 * const { execute, loading, error } = useRetry({
 *   maxAttempts: 3,
 *   onRetry: (attempt) => console.log(`Retry ${attempt}`)
 * });
 * 
 * const data = await execute(() => api.get('/data'));
 * ```
 */
export function useRetryWithBackoff(options: RetryOptions = {}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const execute = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const result = await retryWithBackoff(fn, options);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error };
}

// React import for hook
import React from 'react';

export default retryWithBackoff;

