/**
 * Memory Recovery Controller
 * API endpoints for memory management and recovery
 */

import { Response } from 'express';
import { AppRequest } from '@/types/requests';
import { emergencyMemoryRecoveryService } from '@/services/emergency-memory-recovery.service';
import { memoryRecoveryMiddleware } from '@/middleware/memory-recovery.middleware';
import { databaseConnectionOptimizerService } from '@/services/database-connection-optimizer.service';
import { logger } from '@/utils/logger';

export class MemoryRecoveryController {
  /**
   * Get current memory status
   */
  public async getMemoryStatus(req: AppRequest, res: Response): Promise<void> {
    try {
      const memoryStatus = memoryRecoveryMiddleware.getMemoryStatus();
      const dbHealth = databaseConnectionOptimizerService.getConnectionHealth();
      const recoveryHistory = emergencyMemoryRecoveryService.getRecoveryHistory();

      res.json({
        success: true,
        data: {
          memory: memoryStatus,
          database: dbHealth,
          recovery: {
            history: recoveryHistory,
            lastRecovery: recoveryHistory.length > 0
              ? recoveryHistory[recoveryHistory.length - 1]
              : null
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get memory status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve memory status'
      });
    }
  }

  /**
   * Trigger manual recovery
   */
  public async triggerRecovery(req: AppRequest, res: Response): Promise<void> {
    try {
      const { level = 'critical' } = req.body;

      if (!['critical', 'emergency'].includes(level)) {
        res.status(400).json({
          success: false,
          error: 'Invalid recovery level. Must be "critical" or "emergency"'
        });
        return;
      }

      logger.info(`Manual recovery triggered via API: ${level}`);

      await emergencyMemoryRecoveryService.triggerRecovery(level as 'critical' | 'emergency');

      res.json({
        success: true,
        message: `Recovery triggered successfully`,
        level,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to trigger recovery', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to trigger recovery'
      });
    }
  }

  /**
   * Get recovery history
   */
  public async getRecoveryHistory(req: AppRequest, res: Response): Promise<void> {
    try {
      const history = emergencyMemoryRecoveryService.getRecoveryHistory();

      res.json({
        success: true,
        data: {
          history,
          count: history.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get recovery history', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recovery history'
      });
    }
  }

  /**
   * Update memory thresholds
   */
  public async updateThresholds(req: AppRequest, res: Response): Promise<void> {
    try {
      const { warning, critical, emergency } = req.body;

      const thresholds: any = {};
      if (warning !== undefined) thresholds.warning = warning;
      if (critical !== undefined) thresholds.critical = critical;
      if (emergency !== undefined) thresholds.emergency = emergency;

      // Validate thresholds
      if (thresholds.warning && (thresholds.warning < 50 || thresholds.warning > 100)) {
        res.status(400).json({
          success: false,
          error: 'Warning threshold must be between 50 and 100'
        });
        return;
      }

      if (thresholds.critical && (thresholds.critical < 60 || thresholds.critical > 100)) {
        res.status(400).json({
          success: false,
          error: 'Critical threshold must be between 60 and 100'
        });
        return;
      }

      if (thresholds.emergency && (thresholds.emergency < 70 || thresholds.emergency > 100)) {
        res.status(400).json({
          success: false,
          error: 'Emergency threshold must be between 70 and 100'
        });
        return;
      }

      // Validate threshold ordering
      const currentThresholds = memoryRecoveryMiddleware.getMemoryStatus().thresholds;
      const newThresholds = { ...currentThresholds, ...thresholds };

      if (newThresholds.warning >= newThresholds.critical ||
          newThresholds.critical >= newThresholds.emergency) {
        res.status(400).json({
          success: false,
          error: 'Thresholds must be in ascending order: warning < critical < emergency'
        });
        return;
      }

      memoryRecoveryMiddleware.setThresholds(thresholds);

      logger.info('Memory thresholds updated', { thresholds });

      res.json({
        success: true,
        message: 'Thresholds updated successfully',
        thresholds: newThresholds,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update thresholds', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update thresholds'
      });
    }
  }

  /**
   * Force garbage collection
   */
  public async forceGarbageCollection(req: AppRequest, res: Response): Promise<void> {
    try {
      logger.info('Manual garbage collection triggered via API');

      // Force garbage collection if available
      if (global.gc) {
        global.gc();

        res.json({
          success: true,
          message: 'Garbage collection completed',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Garbage collection not available. Run with --expose-gc flag.'
        });
      }
    } catch (error) {
      logger.error('Failed to force garbage collection', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to force garbage collection'
      });
    }
  }

  /**
   * Clear application caches
   */
  public async clearCaches(req: AppRequest, res: Response): Promise<void> {
    try {
      logger.info('Manual cache clearing triggered via API');

      const clearedCaches: string[] = [];

      // Clear various caches
      try {
        const cacheService = await import('@/services/cache.service');
        if (cacheService.CacheService && cacheService.cacheService) {
          await cacheService.cacheService.flushAll();
          clearedCaches.push('main-cache');
        }
      } catch (error) {
        logger.warn('Failed to clear main cache', { error });
      }

      try {
        const routeCache = await import('@/services/route-cache.service');
        if (routeCache.RouteCacheService && routeCache.routeCacheService) {
          await routeCache.routeCacheService.clearCache();
          clearedCaches.push('route-cache');
        }
      } catch (error) {
        logger.warn('Failed to clear route cache', { error });
      }

      try {
        const weatherCache = await import('@/services/weather-cache.service');
        if (weatherCache.WeatherCacheService && weatherCache.weatherCacheService) {
          await weatherCache.weatherCacheService.clearCache();
          clearedCaches.push('weather-cache');
        }
      } catch (error) {
        logger.warn('Failed to clear weather cache', { error });
      }

      res.json({
        success: true,
        message: 'Caches cleared successfully',
        clearedCaches,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to clear caches', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to clear caches'
      });
    }
  }

  /**
   * Optimize database connections
   */
  public async optimizeDatabaseConnections(req: AppRequest, res: Response): Promise<void> {
    try {
      logger.info('Database connection optimization triggered via API');

      const beforeMetrics = databaseConnectionOptimizerService.getConnectionHealth();

      // Trigger optimization
      await (databaseConnectionOptimizerService as any).optimizeConnections();

      const afterMetrics = databaseConnectionOptimizerService.getConnectionHealth();

      res.json({
        success: true,
        message: 'Database connection optimization completed',
        before: beforeMetrics,
        after: afterMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to optimize database connections', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to optimize database connections'
      });
    }
  }
}

export const memoryRecoveryController = new MemoryRecoveryController();