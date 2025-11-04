import { renderHook } from '@testing-library/react';
import { useWebVitals, usePerformanceMonitor, performanceUtils } from '../PerformanceOptimizer';

// Mock performance.now
const mockPerformanceNow = jest.fn();
Object.defineProperty(global.performance, 'now', {
  value: mockPerformanceNow,
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

describe('PerformanceOptimizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
  });

  describe('useWebVitals', () => {
    it('should return initial vitals with zero values', () => {
      const { result } = renderHook(() => useWebVitals());

      expect(result.current).toEqual({
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
      });
    });
  });

  describe('usePerformanceMonitor', () => {
    it('should monitor render performance', () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(25);

      const { unmount } = renderHook(() => usePerformanceMonitor('TestComponent'));

      // Should not warn for fast renders
      expect(console.warn).not.toHaveBeenCalled();

      unmount();

      // Should warn for slow renders (>16ms)
      expect(console.warn).toHaveBeenCalledWith(
        'Slow render detected in TestComponent: 25.00ms'
      );
    });

    it('should send metrics to backend', () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(25);

      const { unmount } = renderHook(() => usePerformanceMonitor('TestComponent'));
      unmount();

      expect(fetch).toHaveBeenCalledWith('/api/performance/component-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: 'TestComponent',
          renderTime: 25,
          timestamp: expect.any(Number),
        }),
      });
    });
  });

  describe('performanceUtils', () => {
    it('should debounce function calls', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = performanceUtils.debounce(mockFn, 100);

      debouncedFn('test1');
      debouncedFn('test2');
      debouncedFn('test3');

      // Should not call immediately
      expect(mockFn).not.toHaveBeenCalled();

      setTimeout(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('test3');
        done();
      }, 150);
    });

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = performanceUtils.throttle(mockFn, 100);

      throttledFn('test1');
      throttledFn('test2');
      throttledFn('test3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test1');
    });

    it('should memoize expensive computations', () => {
      const expensiveFn = jest.fn((x: number) => x * 2);
      const memoizedFn = performanceUtils.memoize(expensiveFn);

      const result1 = memoizedFn(5);
      const result2 = memoizedFn(5);
      const result3 = memoizedFn(10);

      expect(expensiveFn).toHaveBeenCalledTimes(2);
      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(result3).toBe(20);
    });

    it('should measure performance', () => {
      const testFn = () => 'test result';
      mockPerformanceNow.mockReturnValueOnce(100).mockReturnValueOnce(150);

      const result = performanceUtils.measure('test operation', testFn);

      expect(result).toBe('test result');
      expect(console.log).toHaveBeenCalledWith('test operation: 50.00ms');
    });
  });
});