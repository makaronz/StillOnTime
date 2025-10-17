/**
 * Emergency Memory Recovery Service
 * Critical system recovery for memory exhaustion scenarios
 */

import { logger } from '@/utils/logger';
import * as os from 'os';
import * as v8 from 'v8';

interface MemoryMetrics {
  systemTotal: number;
  systemUsed: number;
  systemFree: number;
  systemUsagePercent: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  rss: number;
}

interface RecoveryAction {
  name: string;
  executed: boolean;
  timestamp: Date;
  memoryBefore: number;
  memoryAfter: number;
  freed: number;
}

export class EmergencyMemoryRecoveryService {
  private isRecoveryInProgress = false;
  private lastRecoveryTime = 0;
  private recoveryCooldown = 30000; // 30 seconds
  private criticalThreshold = 90; // 90% memory usage triggers recovery
  private emergencyThreshold = 95; // 95% triggers aggressive recovery
  private recoveryHistory: RecoveryAction[] = [];

  constructor() {
    this.startMemoryMonitoring();
  }

  /**
   * Get current memory metrics
   */
  private getMemoryMetrics(): MemoryMetrics {
    const systemMemory = this.getSystemMemory();
    const nodeMemory = process.memoryUsage();

    return {
      systemTotal: systemMemory.total,
      systemUsed: systemMemory.used,
      systemFree: systemMemory.free,
      systemUsagePercent: systemMemory.usagePercent,
      heapTotal: nodeMemory.heapTotal,
      heapUsed: nodeMemory.heapUsed,
      external: nodeMemory.external,
      rss: nodeMemory.rss
    };
  }

  /**
   * Get system memory information
   */
  private getSystemMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent
    };
  }

  /**
   * Start continuous memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const metrics = this.getMemoryMetrics();

      if (metrics.systemUsagePercent >= this.emergencyThreshold && !this.isRecoveryInProgress) {
        logger.error('🚨 EMERGENCY MEMORY THRESHOLD REACHED', {
          usagePercent: metrics.systemUsagePercent.toFixed(2),
          freeMemory: `${(metrics.systemFree / 1024 / 1024).toFixed(0)}MB`
        });

        this.executeEmergencyRecovery();
      } else if (metrics.systemUsagePercent >= this.criticalThreshold && !this.isRecoveryInProgress) {
        logger.warn('⚠️ CRITICAL MEMORY USAGE DETECTED', {
          usagePercent: metrics.systemUsagePercent.toFixed(2),
          freeMemory: `${(metrics.systemFree / 1024 / 1024).toFixed(0)}MB`
        });

        this.executeCriticalRecovery();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Execute emergency recovery procedures (95%+ memory usage)
   */
  private async executeEmergencyRecovery(): Promise<void> {
    if (this.isRecoveryInProgress ||
        Date.now() - this.lastRecoveryTime < this.recoveryCooldown) {
      return;
    }

    this.isRecoveryInProgress = true;
    const metricsBefore = this.getMemoryMetrics();

    logger.error('🚨 STARTING EMERGENCY MEMORY RECOVERY', {
      memoryUsage: `${metricsBefore.systemUsagePercent.toFixed(2)}%`,
      freeMemory: `${(metricsBefore.systemFree / 1024 / 1024).toFixed(0)}MB`
    });

    try {
      // Aggressive garbage collection
      await this.aggressiveGarbageCollection();

      // Force memory cleanup
      await this.forceMemoryCleanup();

      // Clear caches aggressively
      await this.clearAllCaches();

      // Reduce connection pools
      await this.reduceConnectionPools();

      const metricsAfter = this.getMemoryMetrics();
      const memoryFreed = metricsBefore.systemUsed - metricsAfter.systemUsed;

      this.recordRecoveryAction({
        name: 'EMERGENCY_RECOVERY',
        executed: true,
        timestamp: new Date(),
        memoryBefore: metricsBefore.systemUsed,
        memoryAfter: metricsAfter.systemUsed,
        freed: memoryFreed
      });

      logger.info('✅ EMERGENCY RECOVERY COMPLETED', {
        memoryFreed: `${(memoryFreed / 1024 / 1024).toFixed(0)}MB`,
        newUsage: `${metricsAfter.systemUsagePercent.toFixed(2)}%`,
        freeMemory: `${(metricsAfter.systemFree / 1024 / 1024).toFixed(0)}MB`
      });

    } catch (error) {
      logger.error('❌ EMERGENCY RECOVERY FAILED', { error });
    } finally {
      this.isRecoveryInProgress = false;
      this.lastRecoveryTime = Date.now();
    }
  }

  /**
   * Execute critical recovery procedures (90%+ memory usage)
   */
  private async executeCriticalRecovery(): Promise<void> {
    if (this.isRecoveryInProgress ||
        Date.now() - this.lastRecoveryTime < this.recoveryCooldown) {
      return;
    }

    this.isRecoveryInProgress = true;
    const metricsBefore = this.getMemoryMetrics();

    logger.warn('⚠️ STARTING CRITICAL MEMORY RECOVERY', {
      memoryUsage: `${metricsBefore.systemUsagePercent.toFixed(2)}%`,
      freeMemory: `${(metricsBefore.systemFree / 1024 / 1024).toFixed(0)}MB`
    });

    try {
      // Standard garbage collection
      await this.performGarbageCollection();

      // Clear moderate caches
      await this.clearNonEssentialCaches();

      const metricsAfter = this.getMemoryMetrics();
      const memoryFreed = metricsBefore.systemUsed - metricsAfter.systemUsed;

      this.recordRecoveryAction({
        name: 'CRITICAL_RECOVERY',
        executed: true,
        timestamp: new Date(),
        memoryBefore: metricsBefore.systemUsed,
        memoryAfter: metricsAfter.systemUsed,
        freed: memoryFreed
      });

      logger.info('✅ CRITICAL RECOVERY COMPLETED', {
        memoryFreed: `${(memoryFreed / 1024 / 1024).toFixed(0)}MB`,
        newUsage: `${metricsAfter.systemUsagePercent.toFixed(2)}%`,
        freeMemory: `${(metricsAfter.systemFree / 1024 / 1024).toFixed(0)}MB`
      });

    } catch (error) {
      logger.error('❌ CRITICAL RECOVERY FAILED', { error });
    } finally {
      this.isRecoveryInProgress = false;
      this.lastRecoveryTime = Date.now();
    }
  }

  /**
   * Perform aggressive garbage collection
   */
  private async aggressiveGarbageCollection(): Promise<void> {
    logger.info('🔄 Performing aggressive garbage collection...');

    // Force multiple garbage collection cycles
    for (let i = 0; i < 5; i++) {
      if (global.gc) {
        global.gc();
      }

      // V8 garbage collection
      if (v8 && typeof v8.getHeapStatistics === 'function') {
        v8.writeHeapSnapshot();
      }

      // Small delay between collections
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Perform standard garbage collection
   */
  private async performGarbageCollection(): Promise<void> {
    logger.info('🔄 Performing garbage collection...');

    if (global.gc) {
      global.gc();
    }

    // Force V8 optimization
    if (v8 && typeof v8.getHeapStatistics === 'function') {
      v8.getHeapStatistics();
    }
  }

  /**
   * Force aggressive memory cleanup
   */
  private async forceMemoryCleanup(): Promise<void> {
    logger.info('🧹 Forcing aggressive memory cleanup...');

    // Clear Node.js internal caches
    if (require && require.cache) {
      const modules = Object.keys(require.cache);
      for (const module of modules) {
        if (!module.includes('node_modules')) {
          delete require.cache[module];
        }
      }
    }

    // Trigger async cleanup
    await new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Clear all caches aggressively
   */
  private async clearAllCaches(): Promise<void> {
    logger.info('🗑️ Clearing all caches...');

    try {
      // Import and clear service caches
      const cacheService = await import('@/services/cache.service');
      if (cacheService.CacheService && cacheService.cacheService) {
        await cacheService.cacheService.flushAll();
      }

      // Clear route cache
      const routeCache = await import('@/services/route-cache.service');
      if (routeCache.RouteCacheService && routeCache.routeCacheService) {
        await routeCache.routeCacheService.clearCache();
      }

      // Clear weather cache
      const weatherCache = await import('@/services/weather-cache.service');
      if (weatherCache.WeatherCacheService && weatherCache.weatherCacheService) {
        await weatherCache.weatherCacheService.clearCache();
      }

    } catch (error) {
      logger.warn('Some cache services could not be cleared', { error });
    }
  }

  /**
   * Clear non-essential caches
   */
  private async clearNonEssentialCaches(): Promise<void> {
    logger.info('🗑️ Clearing non-essential caches...');

    try {
      // Clear only non-critical caches
      const routeCache = await import('@/services/route-cache.service');
      if (routeCache.RouteCacheService && routeCache.routeCacheService) {
        await routeCache.routeCacheService.clearCache();
      }

    } catch (error) {
      logger.warn('Some non-essential caches could not be cleared', { error });
    }
  }

  /**
   * Reduce database connection pools
   */
  private async reduceConnectionPools(): Promise<void> {
    logger.info('🔌 Reducing database connection pools...');

    try {
      // Import database module and reduce pool size
      const db = await import('@/config/database');
      if (db.pool) {
        // Close idle connections
        db.pool.removeAllListeners('error');
        db.pool.removeAllListeners('connect');

        // Force disconnect idle connections
        const pool = db.pool as any;
        if (pool.pool && pool.pool._removeAll) {
          pool.pool._removeAll();
        }
      }
    } catch (error) {
      logger.warn('Could not reduce database connection pools', { error });
    }
  }

  /**
   * Record recovery action for tracking
   */
  private recordRecoveryAction(action: RecoveryAction): void {
    this.recoveryHistory.push(action);

    // Keep only last 50 recovery actions
    if (this.recoveryHistory.length > 50) {
      this.recoveryHistory = this.recoveryHistory.slice(-50);
    }
  }

  /**
   * Get recovery history
   */
  public getRecoveryHistory(): RecoveryAction[] {
    return [...this.recoveryHistory];
  }

  /**
   * Get current memory status
   */
  public getMemoryStatus(): {
    current: MemoryMetrics;
    isCritical: boolean;
    isEmergency: boolean;
    lastRecovery: RecoveryAction | null;
  } {
    const current = this.getMemoryMetrics();
    const isCritical = current.systemUsagePercent >= this.criticalThreshold;
    const isEmergency = current.systemUsagePercent >= this.emergencyThreshold;
    const lastRecovery = this.recoveryHistory.length > 0
      ? this.recoveryHistory[this.recoveryHistory.length - 1]
      : null;

    return {
      current,
      isCritical,
      isEmergency,
      lastRecovery
    };
  }

  /**
   * Manual trigger for recovery (for testing/admin)
   */
  public async triggerRecovery(level: 'critical' | 'emergency' = 'critical'): Promise<void> {
    logger.info(`🔧 Manual recovery triggered: ${level}`);

    if (level === 'emergency') {
      await this.executeEmergencyRecovery();
    } else {
      await this.executeCriticalRecovery();
    }
  }
}

// Export singleton instance
export const emergencyMemoryRecoveryService = new EmergencyMemoryRecoveryService();