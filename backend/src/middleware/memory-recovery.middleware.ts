/**
 * Memory Recovery Middleware
 * Automatic memory management and recovery for Express.js
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { emergencyMemoryRecoveryService } from '@/services/emergency-memory-recovery.service';

interface MemoryThresholds {
  warning: number;  // 75%
  critical: number; // 90%
  emergency: number; // 95%
}

export class MemoryRecoveryMiddleware {
  private thresholds: MemoryThresholds = {
    warning: 75,
    critical: 90,
    emergency: 95
  };

  private requestCount = 0;
  private lastCleanup = 0;
  private readonly cleanupInterval = 60000; // 1 minute

  /**
   * Middleware function for memory monitoring
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.requestCount++;

      // Check memory every 100 requests
      if (this.requestCount % 100 === 0) {
        this.checkMemoryUsage();
      }

      // Periodic cleanup
      if (Date.now() - this.lastCleanup > this.cleanupInterval) {
        this.performPeriodicCleanup();
        this.lastCleanup = Date.now();
      }

      // Add memory headers for monitoring
      const memoryUsage = process.memoryUsage();
      const systemMemory = this.getSystemMemory();

      res.setHeader('X-Memory-Usage', JSON.stringify({
        heap: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        systemPercent: systemMemory.usagePercent.toFixed(2)
      }));

      next();
    };
  }

  /**
   * Check memory usage and trigger recovery if needed
   */
  private checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    const systemMemory = this.getSystemMemory();

    logger.debug('Memory usage check', {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      systemUsage: `${systemMemory.usagePercent.toFixed(2)}%`
    });

    if (systemMemory.usagePercent >= this.thresholds.emergency) {
      logger.error('🚨 EMERGENCY: Memory usage critical', {
        systemUsage: `${systemMemory.usagePercent.toFixed(2)}%`,
        freeMemory: `${Math.round(systemMemory.free / 1024 / 1024)}MB`
      });

      emergencyMemoryRecoveryService.triggerRecovery('emergency');

    } else if (systemMemory.usagePercent >= this.thresholds.critical) {
      logger.warn('⚠️ CRITICAL: Memory usage high', {
        systemUsage: `${systemMemory.usagePercent.toFixed(2)}%`,
        freeMemory: `${Math.round(systemMemory.free / 1024 / 1024)}MB`
      });

      emergencyMemoryRecoveryService.triggerRecovery('critical');

    } else if (systemMemory.usagePercent >= this.thresholds.warning) {
      logger.info('⚠️ WARNING: Memory usage elevated', {
        systemUsage: `${systemMemory.usagePercent.toFixed(2)}%`,
        freeMemory: `${Math.round(systemMemory.free / 1024 / 1024)}MB`
      });
    }
  }

  /**
   * Get system memory information
   */
  private getSystemMemory() {
    const os = require('os');
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
   * Perform periodic cleanup
   */
  private performPeriodicCleanup(): void {
    logger.debug('Performing periodic memory cleanup...');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear Node.js module cache for non-essential modules
    this.clearModuleCache();

    // Trigger async cleanup
    setImmediate(() => {
      // This will be executed on the next event loop cycle
      logger.debug('Async cleanup completed');
    });
  }

  /**
   * Clear non-essential module cache
   */
  private clearModuleCache(): void {
    try {
      const cache = require.cache;
      const modulesToClear = [];

      for (const key in cache) {
        // Don't clear node_modules or essential modules
        if (!key.includes('node_modules') &&
            !key.includes('/utils/') &&
            !key.includes('/config/') &&
            !key.includes('/services/')) {
          modulesToClear.push(key);
        }
      }

      // Clear selected modules
      modulesToClear.forEach(key => {
        delete cache[key];
      });

      if (modulesToClear.length > 0) {
        logger.debug(`Cleared ${modulesToClear.length} modules from cache`);
      }

    } catch (error) {
      logger.warn('Failed to clear module cache', { error });
    }
  }

  /**
   * Set custom memory thresholds
   */
  public setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Memory thresholds updated', this.thresholds);
  }

  /**
   * Get current memory status
   */
  public getMemoryStatus() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = this.getSystemMemory();
    const recoveryStatus = emergencyMemoryRecoveryService.getMemoryStatus();

    return {
      process: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      system: {
        total: Math.round(systemMemory.total / 1024 / 1024),
        used: Math.round(systemMemory.used / 1024 / 1024),
        free: Math.round(systemMemory.free / 1024 / 1024),
        usagePercent: systemMemory.usagePercent.toFixed(2)
      },
      thresholds: this.thresholds,
      recovery: recoveryStatus,
      requestCount: this.requestCount
    };
  }
}

// Export singleton instance
export const memoryRecoveryMiddleware = new MemoryRecoveryMiddleware();