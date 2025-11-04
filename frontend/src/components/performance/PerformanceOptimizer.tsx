import React, { memo, useMemo, useCallback, useState, useEffect } from "react";
import { debounce } from "lodash-es";

/**
 * Performance monitoring and optimization utilities for React components
 */

// Web Vitals monitoring
export const useWebVitals = () => {
  const [vitals, setVitals] = useState({
    lcp: 0,
    fid: 0,
    cls: 0,
    fcp: 0,
    ttfb: 0,
  });

  useEffect(() => {
    // Import web-vitals library dynamically
    import("web-vitals").then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric: any) => setVitals(prev => ({ ...prev, cls: metric.value })));
      getFID((metric: any) => setVitals(prev => ({ ...prev, fid: metric.value })));
      getFCP((metric: any) => setVitals(prev => ({ ...prev, fcp: metric.value })));
      getLCP((metric: any) => setVitals(prev => ({ ...prev, lcp: metric.value })));
      getTTFB((metric: any) => setVitals(prev => ({ ...prev, ttfb: metric.value })));
    });
  }, []);

  return vitals;
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      if (renderTime > 16) { // More than one frame
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }

      // Send metrics to backend
      if (typeof window !== "undefined" && typeof window.fetch === "function") {
        fetch("/api/performance/component-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            component: componentName,
            renderTime,
            timestamp: Date.now(),
          }),
        }).catch(() => {
          // Silently ignore errors
        });
      }
    };
  });
};

// Memoized component wrapper
export const withPerformanceOptimization = function <P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
    // Custom comparison function for shallow equality
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);

    if (prevKeys.length !== nextKeys.length) {
      return false;
    }

    return prevKeys.every(key => {
      const prevValue = prevProps[key as keyof P];
      const nextValue = nextProps[key as keyof P];

      if (Array.isArray(prevValue) && Array.isArray(nextValue)) {
        return prevValue.length === nextValue.length &&
               prevValue.every((item: any, index: number) => item === nextValue[index]);
      }

      return prevValue === nextValue;
    });
  });

  const WrappedComponent = (props: P) => {
    usePerformanceMonitor(componentName);
    return <MemoizedComponent {...(props as any)} />;
  };

  WrappedComponent.displayName = `withPerformanceOptimization(${componentName})`;
  return WrappedComponent;
};

// Virtual scroll hook for large lists
export const useVirtualScroll = (
  items: any[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  const handleScroll = useCallback(
    debounce((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, 16), // Debounce to ~60fps
    []
  );

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    visibleRange,
  };
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options.threshold, options.rootMargin, hasIntersected]);

  return { isIntersecting, hasIntersected };
};

// Lazy loading component
export const LazyLoad: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
}> = memo(({ children, fallback = null, rootMargin = "50px", threshold = 0.1 }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(ref, { rootMargin, threshold });

  return (
    <div ref={ref}>
      {hasIntersected ? children : fallback}
    </div>
  );
});

LazyLoad.displayName = "LazyLoad";

// Debounced search hook
export const useDebouncedSearch = (
  initialValue: string = "",
  delay: number = 300
) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, delay]);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
  };
};

// Optimized image component with lazy loading
export const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: "lazy" | "eager";
  placeholder?: string;
}> = memo(({ src, alt, width, height, className, loading = "lazy", placeholder }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const { hasIntersected } = useIntersectionObserver(imgRef, {
    rootMargin: "50px",
    threshold: 0.1,
  });

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  return (
    <div
      ref={imgRef}
      className={`relative ${className || ""}`}
      style={{ width, height }}
    >
      {hasIntersected && (
        <>
          {!isLoaded && placeholder && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse">
              <img
                src={placeholder}
                alt=""
                className="w-full h-full object-cover blur-sm"
              />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <span className="text-gray-500 text-sm">Failed to load image</span>
            </div>
          )}
        </>
      )}
    </div>
  );
});

OptimizedImage.displayName = "OptimizedImage";

// Performance metrics display component
export const PerformanceMetrics: React.FC = memo(() => {
  const vitals = useWebVitals();
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const getScoreColor = (value: number, thresholds: { good: number; poor: number }) => {
    if (value <= thresholds.good) return "text-green-600";
    if (value <= thresholds.poor) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700"
      >
        Performance
      </button>
      {isVisible && (
        <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-64">
          <h3 className="font-semibold text-sm mb-2">Web Vitals</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>LCP:</span>
              <span className={getScoreColor(vitals.lcp, { good: 2500, poor: 4000 })}>
                {vitals.lcp.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>FID:</span>
              <span className={getScoreColor(vitals.fid, { good: 100, poor: 300 })}>
                {vitals.fid.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>CLS:</span>
              <span className={getScoreColor(vitals.cls, { good: 0.1, poor: 0.25 })}>
                {vitals.cls.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>FCP:</span>
              <span className={getScoreColor(vitals.fcp, { good: 1800, poor: 3000 })}>
                {vitals.fcp.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>TTFB:</span>
              <span className={getScoreColor(vitals.ttfb, { good: 800, poor: 1800 })}>
                {vitals.ttfb.toFixed(0)}ms
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PerformanceMetrics.displayName = "PerformanceMetrics";

// Bundle size analyzer
export const BundleAnalyzer: React.FC = memo(() => {
  const [bundleInfo, setBundleInfo] = useState<any>(null);

  useEffect(() => {
    // Analyze bundle size if in development
    if (process.env.NODE_ENV === "development") {
      import("../../utils/bundle-analyzer").then(analyzer => {
        analyzer.getBundleInfo().then(setBundleInfo);
      });
    }
  }, []);

  if (!bundleInfo || process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
      <h3 className="font-semibold text-sm mb-2">Bundle Analysis</h3>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Total Size:</span>
          <span>{(bundleInfo.totalSize / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div className="flex justify-between">
          <span>Chunks:</span>
          <span>{bundleInfo.chunks.length}</span>
        </div>
        <div className="mt-2">
          <div className="font-medium mb-1">Largest Chunks:</div>
          {bundleInfo.chunks
            .sort((a: any, b: any) => b.size - a.size)
            .slice(0, 5)
            .map((chunk: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span className="truncate">{chunk.name}</span>
                <span>{(chunk.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});

BundleAnalyzer.displayName = "BundleAnalyzer";

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function
  debounce: function <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function
  throttle: function <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Memoize expensive computations
  memoize: function <T extends (...args: any[]) => any>(func: T): T {
    const cache = new Map();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },

  // Batch DOM updates
  batchUpdate: (callback: () => void) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  },

  // Measure performance
  measure: function <T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  },
};

export default {
  useWebVitals,
  usePerformanceMonitor,
  withPerformanceOptimization,
  useVirtualScroll,
  useIntersectionObserver,
  LazyLoad,
  OptimizedImage,
  PerformanceMetrics,
  BundleAnalyzer,
  performanceUtils,
};