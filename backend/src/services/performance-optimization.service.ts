/**
 * Production Performance Optimization Service
 * Advanced caching, database optimization, and resource management
 */

import { logger, structuredLogger } from "../utils/logger";
import { CacheService } from "./cache.service";
import { MonitoringService } from "./monitoring.service";
import { prisma } from "../config/database";
import { z } from "zod";
import { performance } from "perf_hooks";
import Bull, { Queue } from "bull";

// Performance optimization schemas
export const PerformanceConfigSchema = z.object({
  caching: z.object({
    enableAggressiveCaching: z.boolean().default(true),
    cachePrewarmInterval: z.number().min(60000).default(300000), // 5 minutes
    intelligentEviction: z.boolean().default(true),
    compressionEnabled: z.boolean().default(true)
  }),
  database: z.object({
    connectionPoolSize: z.number().min(10).max(100).default(20),
    queryTimeout: z.number().min(1000).default(10000),
    enableQueryOptimization: z.boolean().default(true),
    indexOptimization: z.boolean().default(true)
  }),
  processing: z.object({
    maxConcurrentJobs: z.number().min(1).max(20).default(5),
    batchProcessingSize: z.number().min(1).max(100).default(10),
    enableParallelization: z.boolean().default(true),
    resourceThrottling: z.boolean().default(true)
  }),
  memory: z.object({
    heapMemoryThreshold: z.number().min(0.5).max(0.9).default(0.8),
    garbageCollectionOptimization: z.boolean().default(true),
    memoryLeakDetection: z.boolean().default(true)
  })
});

export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  throughput: {
    requestsPerSecond: number;
    emailsProcessedPerMinute: number;
    cacheHitRate: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    databaseConnections: number;
    queueSize: number;
  };
  optimization: {
    cacheEfficiency: number;
    queryOptimizationGains: number;
    parallelizationEfficiency: number;
  };
}

export interface OptimizationRecommendation {
  category: "caching" | "database" | "processing" | "memory";
  priority: "low" | "medium" | "high" | "critical";
  recommendation: string;
  expectedImpact: number; // Percentage improvement
  implementationComplexity: "simple" | "moderate" | "complex";
  estimatedImplementationTime: number; // Hours
}

/**
 * Production Performance Optimization Service
 */
export class PerformanceOptimizationService {
  private cache: CacheService;
  private monitoring: MonitoringService;
  private config: PerformanceConfig;
  private metricsHistory: PerformanceMetrics[] = [];
  private optimizationQueue: Queue;

  // Performance tracking
  private performanceTimers: Map<string, number> = new Map();
  private queryCache: Map<string, any> = new Map();
  private prewarmedCacheKeys: Set<string> = new Set();

  // Resource monitoring
  private resourceMetrics = {
    activeConnections: 0,
    peakMemoryUsage: 0,
    queryExecutionTimes: [] as number[],
    cacheHitRates: [] as number[]
  };

  constructor(
    cache: CacheService,
    monitoring: MonitoringService,
    redisConfig: any
  ) {
    this.cache = cache;
    this.monitoring = monitoring;
    
    // Initialize with production-optimized defaults
    this.config = PerformanceConfigSchema.parse({});
    
    this.optimizationQueue = new Bull("performance-optimization", {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });

    this.initializeOptimizations();
    this.startPerformanceMonitoring();
    this.setupOptimizationJobs();
  }

  /**
   * Update performance configuration
   */
  async updateConfiguration(newConfig: Partial<PerformanceConfig>): Promise<void> {
    try {
      const updatedConfig = PerformanceConfigSchema.parse({
        ...this.config,
        ...newConfig
      });

      this.config = updatedConfig;
      
      structuredLogger.info("Performance configuration updated", {
        config: updatedConfig,
        timestamp: new Date()
      });

      // Apply configuration changes immediately
      await this.applyConfigurationChanges();

    } catch (error) {
      structuredLogger.error("Failed to update performance configuration", {
        error: error.message,
        newConfig
      });
      throw error;
    }
  }

  /**
   * Intelligent query optimization with caching
   */
  async optimizedQuery<T>(
    queryKey: string,
    queryFunction: () => Promise<T>,
    cacheOptions: {
      ttl?: number;
      tags?: string[];
      compressionEnabled?: boolean;
    } = {}
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      // Check intelligent cache first
      if (this.config.caching.enableAggressiveCaching) {
        const cached = await this.getIntelligentCache(queryKey, cacheOptions.tags);
        if (cached !== null) {
          this.recordCacheHit(queryKey, performance.now() - startTime);
          return cached;
        }
      }

      // Execute query with optimization
      const result = await this.executeOptimizedQuery(queryFunction);
      
      // Cache result with intelligent TTL
      if (this.config.caching.enableAggressiveCaching) {
        await this.setIntelligentCache(
          queryKey,
          result,
          this.calculateOptimalTTL(queryKey, cacheOptions.ttl),
          cacheOptions
        );
      }

      const executionTime = performance.now() - startTime;
      this.recordQueryExecution(queryKey, executionTime);

      return result;

    } catch (error) {
      structuredLogger.error("Optimized query failed", {
        queryKey,
        error: error.message,
        executionTime: performance.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Batch processing optimization
   */
  async optimizedBatchProcessing<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize?: number;
      concurrency?: number;
      retryOnFailure?: boolean;
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = this.config.processing.batchProcessingSize,
      concurrency = this.config.processing.maxConcurrentJobs,
      retryOnFailure = true
    } = options;

    const batches = this.createOptimalBatches(items, batchSize);
    const results: R[] = [];

    structuredLogger.info("Starting optimized batch processing", {
      totalItems: items.length,
      batchCount: batches.length,
      batchSize,
      concurrency
    });

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += concurrency) {
      const currentBatches = batches.slice(i, i + concurrency);
      
      const batchPromises = currentBatches.map(async (batch, index) => {
        const batchStartTime = performance.now();
        
        try {
          const batchResult = await processor(batch);
          
          structuredLogger.debug("Batch processed successfully", {
            batchIndex: i + index,
            itemsProcessed: batch.length,
            processingTime: performance.now() - batchStartTime
          });
          
          return batchResult;
        } catch (error) {
          if (retryOnFailure) {
            structuredLogger.warn("Batch processing failed, retrying", {
              batchIndex: i + index,
              error: error.message
            });
            
            // Retry with smaller batch size
            const smallerBatches = this.createOptimalBatches(batch, Math.ceil(batch.length / 2));
            const retryResults: R[] = [];
            
            for (const smallBatch of smallerBatches) {
              try {
                const retryResult = await processor(smallBatch);
                retryResults.push(...retryResult);
              } catch (retryError) {
                structuredLogger.error("Batch retry failed", {
                  batchIndex: i + index,
                  error: retryError.message
                });
                throw retryError;
              }
            }
            
            return retryResults;
          }
          throw error;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(batchResult => results.push(...batchResult));
    }

    return results;
  }

  /**
   * Memory optimization and leak detection
   */
  async optimizeMemoryUsage(): Promise<{
    beforeOptimization: NodeJS.MemoryUsage;
    afterOptimization: NodeJS.MemoryUsage;
    optimizationsApplied: string[];
  }> {
    const beforeMemory = process.memoryUsage();
    const optimizationsApplied: string[] = [];

    try {
      // Clear expired cache entries
      if (this.config.memory.garbageCollectionOptimization) {
        await this.cache.cleanup();
        optimizationsApplied.push("cache_cleanup");
      }

      // Clear query cache if memory usage is high
      const memoryUsagePercent = beforeMemory.heapUsed / beforeMemory.heapTotal;
      if (memoryUsagePercent > this.config.memory.heapMemoryThreshold) {
        this.queryCache.clear();
        optimizationsApplied.push("query_cache_clear");
      }

      // Trigger garbage collection if enabled
      if (this.config.memory.garbageCollectionOptimization && global.gc) {
        global.gc();
        optimizationsApplied.push("garbage_collection");
      }

      // Clear old metrics history
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-500);
        optimizationsApplied.push("metrics_history_trim");
      }

      const afterMemory = process.memoryUsage();

      structuredLogger.info("Memory optimization completed", {
        beforeMemory,
        afterMemory,
        optimizationsApplied,
        memoryReduced: beforeMemory.heapUsed - afterMemory.heapUsed
      });

      return {
        beforeOptimization: beforeMemory,
        afterOptimization: afterMemory,
        optimizationsApplied
      };

    } catch (error) {
      structuredLogger.error("Memory optimization failed", {
        error: error.message,
        beforeMemory
      });
      throw error;
    }
  }

  /**
   * Generate performance optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const currentMetrics = await this.getCurrentPerformanceMetrics();
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze cache performance
    if (currentMetrics.throughput.cacheHitRate < 0.8) {
      recommendations.push({
        category: "caching",
        priority: "high",
        recommendation: "Increase cache TTL and implement cache prewarming for frequently accessed data",
        expectedImpact: 25,
        implementationComplexity: "moderate",
        estimatedImplementationTime: 4
      });
    }

    // Analyze database performance
    if (currentMetrics.responseTime.p95 > 500) {
      recommendations.push({
        category: "database",
        priority: "critical",
        recommendation: "Optimize slow queries and add missing indexes",
        expectedImpact: 40,
        implementationComplexity: "complex",
        estimatedImplementationTime: 8
      });
    }

    // Analyze memory usage
    if (currentMetrics.resources.memoryUsage > 0.8) {
      recommendations.push({
        category: "memory",
        priority: "high",
        recommendation: "Implement memory leak detection and optimize object lifecycle",
        expectedImpact: 20,
        implementationComplexity: "moderate",
        estimatedImplementationTime: 6
      });
    }

    // Analyze processing efficiency
    if (currentMetrics.optimization.parallelizationEfficiency < 0.7) {
      recommendations.push({
        category: "processing",
        priority: "medium",
        recommendation: "Increase parallel processing and optimize batch sizes",
        expectedImpact: 30,
        implementationComplexity: "simple",
        estimatedImplementationTime: 2
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get current performance metrics
   */
  async getCurrentPerformanceMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date(),
      responseTime: {
        p50: this.calculatePercentile(this.resourceMetrics.queryExecutionTimes, 0.5),
        p95: this.calculatePercentile(this.resourceMetrics.queryExecutionTimes, 0.95),
        p99: this.calculatePercentile(this.resourceMetrics.queryExecutionTimes, 0.99),
        average: this.resourceMetrics.queryExecutionTimes.reduce((a, b) => a + b, 0) / this.resourceMetrics.queryExecutionTimes.length || 0
      },
      throughput: {
        requestsPerSecond: this.calculateRequestsPerSecond(),
        emailsProcessedPerMinute: this.calculateEmailsProcessedPerMinute(),
        cacheHitRate: this.calculateCacheHitRate()
      },
      resources: {
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to milliseconds
        memoryUsage: memoryUsage.heapUsed / memoryUsage.heapTotal,
        databaseConnections: this.resourceMetrics.activeConnections,
        queueSize: await this.optimizationQueue.getJobCounts().then(counts => counts.waiting || 0)
      },
      optimization: {
        cacheEfficiency: this.calculateCacheEfficiency(),
        queryOptimizationGains: this.calculateQueryOptimizationGains(),
        parallelizationEfficiency: this.calculateParallelizationEfficiency()
      }
    };
  }

  /**
   * Initialize performance optimizations
   */
  private async initializeOptimizations(): Promise<void> {
    // Set up database connection pool optimization
    await this.optimizeDatabaseConnections();
    
    // Initialize intelligent caching
    await this.initializeIntelligentCaching();
    
    // Set up memory monitoring
    this.setupMemoryMonitoring();
    
    structuredLogger.info("Performance optimizations initialized", {
      config: this.config
    });
  }

  /**
   * Intelligent cache management
   */
  private async getIntelligentCache(key: string, tags?: string[]): Promise<any> {
    try {
      const cached = await this.cache.get(key);
      if (cached !== null) {
        // Update cache access patterns for intelligent eviction
        await this.updateCacheAccessPattern(key);
      }
      return cached;
    } catch (error) {
      return null;
    }
  }

  private async setIntelligentCache(
    key: string,
    value: any,
    ttl: number,
    options: any
  ): Promise<void> {
    try {
      if (options.compressionEnabled && this.config.caching.compressionEnabled) {
        // Implement compression for large objects
        value = await this.compressData(value);
      }
      
      await this.cache.set(key, value, ttl);
      
      if (options.tags) {
        await this.cache.tag(key, options.tags);
      }
    } catch (error) {
      structuredLogger.warn("Failed to set intelligent cache", {
        key,
        error: error.message
      });
    }
  }

  /**
   * Helper methods for performance calculations
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }

  private calculateRequestsPerSecond(): number {
    // Implementation would track requests over time
    return 0; // Placeholder
  }

  private calculateEmailsProcessedPerMinute(): number {
    // Implementation would track email processing rate
    return 0; // Placeholder
  }

  private calculateCacheHitRate(): number {
    if (this.resourceMetrics.cacheHitRates.length === 0) return 0;
    return this.resourceMetrics.cacheHitRates.reduce((a, b) => a + b, 0) / this.resourceMetrics.cacheHitRates.length;
  }

  private calculateCacheEfficiency(): number {
    // Implementation would calculate cache efficiency metrics
    return 0.85; // Placeholder
  }

  private calculateQueryOptimizationGains(): number {
    // Implementation would calculate query optimization improvements
    return 0.15; // Placeholder
  }

  private calculateParallelizationEfficiency(): number {
    // Implementation would calculate parallelization efficiency
    return 0.75; // Placeholder
  }

  /**
   * Database connection optimization
   */
  private async optimizeDatabaseConnections(): Promise<void> {
    try {
      // Configure Prisma connection pool
      const poolSize = this.config.database.connectionPoolSize;
      
      structuredLogger.info("Optimizing database connections", {
        poolSize,
        queryTimeout: this.config.database.queryTimeout
      });
      
      // Monitor active connections
      this.resourceMetrics.activeConnections = poolSize;
      
    } catch (error) {
      structuredLogger.error("Database optimization failed", {
        error: error.message
      });
    }
  }

  /**
   * Initialize intelligent caching system
   */
  private async initializeIntelligentCaching(): Promise<void> {
    try {
      // Prewarm critical cache keys
      const criticalKeys = [
        'system:weather:locations',
        'system:routes:common',
        'system:calendar:templates'
      ];
      
      for (const key of criticalKeys) {
        this.prewarmedCacheKeys.add(key);
      }
      
      // Set up cache prewarming interval
      setInterval(async () => {
        await this.prewarmCriticalCaches();
      }, this.config.caching.cachePrewarmInterval);
      
      structuredLogger.info("Intelligent caching initialized", {
        prewarmedKeys: criticalKeys.length,
        prewarmInterval: this.config.caching.cachePrewarmInterval
      });
      
    } catch (error) {
      structuredLogger.error("Cache initialization failed", {
        error: error.message
      });
    }
  }

  /**
   * Set up memory monitoring
   */
  private setupMemoryMonitoring(): void {
    if (!this.config.memory.memoryLeakDetection) return;
    
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      // Track peak memory usage
      if (memoryUsage.heapUsed > this.resourceMetrics.peakMemoryUsage) {
        this.resourceMetrics.peakMemoryUsage = memoryUsage.heapUsed;
      }
      
      // Auto-optimize if memory usage is high
      if (heapPercent > this.config.memory.heapMemoryThreshold) {
        structuredLogger.warn("High memory usage detected, triggering optimization", {
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(heapPercent * 100)
        });
        
        this.optimizeMemoryUsage().catch(error => {
          structuredLogger.error("Auto memory optimization failed", {
            error: error.message
          });
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Collect metrics every minute
    setInterval(async () => {
      try {
        const metrics = await this.getCurrentPerformanceMetrics();
        this.metricsHistory.push(metrics);
        
        // Keep only last 24 hours of metrics (1440 minutes)
        if (this.metricsHistory.length > 1440) {
          this.metricsHistory = this.metricsHistory.slice(-1440);
        }
        
        // Log performance summary every 5 minutes
        if (this.metricsHistory.length % 5 === 0) {
          structuredLogger.info("Performance metrics summary", {
            responseTimeP95: metrics.responseTime.p95,
            cacheHitRate: metrics.throughput.cacheHitRate,
            memoryUsage: metrics.resources.memoryUsage,
            queueSize: metrics.resources.queueSize
          });
        }
        
      } catch (error) {
        structuredLogger.error("Performance monitoring failed", {
          error: error.message
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Set up optimization jobs
   */
  private setupOptimizationJobs(): void {
    // Memory optimization job
    this.optimizationQueue.add(
      'memory-optimization',
      {},
      {
        repeat: { cron: '0 */2 * * *' }, // Every 2 hours
        removeOnComplete: 5,
        removeOnFail: 3
      }
    );
    
    // Cache cleanup job
    this.optimizationQueue.add(
      'cache-cleanup',
      {},
      {
        repeat: { cron: '0 3 * * *' }, // Daily at 3 AM
        removeOnComplete: 5,
        removeOnFail: 3
      }
    );
    
    // Performance analysis job
    this.optimizationQueue.add(
      'performance-analysis',
      {},
      {
        repeat: { cron: '0 6 * * 0' }, // Weekly on Sunday at 6 AM
        removeOnComplete: 3,
        removeOnFail: 2
      }
    );
    
    // Process optimization jobs
    this.optimizationQueue.process('memory-optimization', async () => {
      return this.optimizeMemoryUsage();
    });
    
    this.optimizationQueue.process('cache-cleanup', async () => {
      return this.cache.cleanup();
    });
    
    this.optimizationQueue.process('performance-analysis', async () => {
      const recommendations = await this.generateOptimizationRecommendations();
      structuredLogger.info("Weekly performance analysis completed", {
        recommendationCount: recommendations.length,
        criticalIssues: recommendations.filter(r => r.priority === 'critical').length
      });
      return recommendations;
    });
  }

  /**
   * Apply configuration changes
   */
  private async applyConfigurationChanges(): Promise<void> {
    try {
      // Restart monitoring with new intervals
      if (this.config.caching.cachePrewarmInterval) {
        await this.initializeIntelligentCaching();
      }
      
      // Update memory monitoring thresholds
      if (this.config.memory.memoryLeakDetection) {
        this.setupMemoryMonitoring();
      }
      
      structuredLogger.info("Configuration changes applied successfully", {
        timestamp: new Date()
      });
      
    } catch (error) {
      structuredLogger.error("Failed to apply configuration changes", {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute optimized query with monitoring
   */
  private async executeOptimizedQuery<T>(queryFunction: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.performanceTimers.set(queryId, startTime);
    
    try {
      const result = await queryFunction();
      const executionTime = performance.now() - startTime;
      
      this.resourceMetrics.queryExecutionTimes.push(executionTime);
      
      // Keep only last 1000 execution times
      if (this.resourceMetrics.queryExecutionTimes.length > 1000) {
        this.resourceMetrics.queryExecutionTimes = this.resourceMetrics.queryExecutionTimes.slice(-1000);
      }
      
      return result;
      
    } finally {
      this.performanceTimers.delete(queryId);
    }
  }

  /**
   * Calculate optimal TTL based on access patterns
   */
  private calculateOptimalTTL(key: string, defaultTTL?: number): number {
    // Implement intelligent TTL calculation based on:
    // - Key access frequency
    // - Data volatility
    // - System load
    
    const baseTTL = defaultTTL || 300000; // 5 minutes default
    
    // Extend TTL for frequently accessed items
    if (this.prewarmedCacheKeys.has(key)) {
      return baseTTL * 2;
    }
    
    // Shorter TTL during high load
    const currentLoad = this.performanceTimers.size;
    if (currentLoad > 50) {
      return Math.max(baseTTL * 0.5, 60000); // Minimum 1 minute
    }
    
    return baseTTL;
  }

  /**
   * Record cache hit for analytics
   */
  private recordCacheHit(key: string, responseTime: number): void {
    this.resourceMetrics.cacheHitRates.push(1); // Hit = 1
    
    // Keep only last 1000 cache operations
    if (this.resourceMetrics.cacheHitRates.length > 1000) {
      this.resourceMetrics.cacheHitRates = this.resourceMetrics.cacheHitRates.slice(-1000);
    }
  }

  /**
   * Record query execution for analytics
   */
  private recordQueryExecution(key: string, executionTime: number): void {
    this.resourceMetrics.queryExecutionTimes.push(executionTime);
    
    // Cache miss
    this.resourceMetrics.cacheHitRates.push(0); // Miss = 0
    
    // Keep metrics bounded
    if (this.resourceMetrics.queryExecutionTimes.length > 1000) {
      this.resourceMetrics.queryExecutionTimes = this.resourceMetrics.queryExecutionTimes.slice(-1000);
    }
  }

  /**
   * Update cache access patterns for intelligent eviction
   */
  private async updateCacheAccessPattern(key: string): Promise<void> {
    try {
      // Track access frequency and recency
      const accessData = {
        key,
        timestamp: Date.now(),
        frequency: 1
      };
      
      // Store access pattern in cache for analysis
      await this.cache.set(`access_pattern:${key}`, accessData, 86400000); // 24 hours
      
    } catch (error) {
      // Fail silently for access pattern tracking
      structuredLogger.debug("Failed to update cache access pattern", {
        key,
        error: error.message
      });
    }
  }

  /**
   * Compress data for cache storage
   */
  private async compressData(data: any): Promise<any> {
    try {
      // Simple JSON compression - in production, use proper compression library
      const jsonString = JSON.stringify(data);
      
      // Only compress if data is large enough to benefit
      if (jsonString.length > 1024) {
        // Placeholder for actual compression implementation
        // In production: use zlib, brotli, or similar
        return {
          compressed: true,
          data: jsonString,
          originalSize: jsonString.length
        };
      }
      
      return data;
      
    } catch (error) {
      structuredLogger.warn("Data compression failed, storing uncompressed", {
        error: error.message
      });
      return data;
    }
  }

  /**
   * Prewarm critical caches
   */
  private async prewarmCriticalCaches(): Promise<void> {
    try {
      const prewarmedCount = this.prewarmedCacheKeys.size;
      
      structuredLogger.debug("Prewarming critical caches", {
        cacheCount: prewarmedCount
      });
      
      // Implementation would fetch and cache critical data
      // This is a placeholder for the actual prewarming logic
      
    } catch (error) {
      structuredLogger.error("Cache prewarming failed", {
        error: error.message
      });
    }
  }
}