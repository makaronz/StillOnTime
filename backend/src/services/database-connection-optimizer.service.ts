/**
 * Database Connection Optimizer Service
 * Prevents connection leaks and optimizes database performance
 */

import { logger } from '@/utils/logger';
import { Pool, PoolClient } from 'pg';
import { db, pool } from '@/config/database';

interface ConnectionMetrics {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingClients: number;
  maxConnections: number;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastCheck: Date;
  errorCount: number;
  lastError?: string;
}

export class DatabaseConnectionOptimizerService {
  private connectionHealth: ConnectionHealth = {
    isHealthy: false,
    lastCheck: new Date(),
    errorCount: 0
  };

  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_ERROR_COUNT = 5;
  private readonly CONNECTION_TIMEOUT = 10000; // 10 seconds
  private readonly IDLE_TIMEOUT = 30000; // 30 seconds

  constructor() {
    this.startConnectionMonitoring();
    this.setupConnectionCleanup();
  }

  /**
   * Start monitoring database connections
   */
  private startConnectionMonitoring(): void {
    setInterval(async () => {
      await this.checkConnectionHealth();
      await this.optimizeConnections();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Setup automatic connection cleanup
   */
  private setupConnectionCleanup(): void {
    // Clean up connections on process exit
    process.on('beforeExit', async () => {
      await this.cleanupConnections();
    });

    process.on('SIGINT', async () => {
      await this.cleanupConnections();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanupConnections();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception, cleaning up connections', { error });
      await this.cleanupConnections();
      process.exit(1);
    });
  }

  /**
   * Check database connection health
   */
  private async checkConnectionHealth(): Promise<void> {
    try {
      const startTime = Date.now();

      // Simple health query
      await pool.query('SELECT 1');

      const responseTime = Date.now() - startTime;

      // Update health status
      this.connectionHealth = {
        isHealthy: true,
        lastCheck: new Date(),
        errorCount: 0
      };

      logger.debug('Database health check passed', {
        responseTime: `${responseTime}ms`,
        metrics: this.getConnectionMetrics()
      });

    } catch (error) {
      this.connectionHealth.errorCount++;
      this.connectionHealth.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.connectionHealth.lastCheck = new Date();

      if (this.connectionHealth.errorCount >= this.MAX_ERROR_COUNT) {
        this.connectionHealth.isHealthy = false;
        logger.error('Database connection marked as unhealthy', {
          errorCount: this.connectionHealth.errorCount,
          lastError: this.connectionHealth.lastError
        });

        await this.handleUnhealthyConnection();
      } else {
        logger.warn('Database health check failed', {
          errorCount: this.connectionHealth.errorCount,
          error: this.connectionHealth.lastError
        });
      }
    }
  }

  /**
   * Get connection pool metrics
   */
  private getConnectionMetrics(): ConnectionMetrics {
    const poolMetrics = pool as any;

    return {
      totalConnections: pool.totalCount || 0,
      idleConnections: pool.idleCount || 0,
      activeConnections: pool.waitingCount || 0,
      waitingClients: pool.waitingCount || 0,
      maxConnections: pool.options?.max || 20
    };
  }

  /**
   * Optimize connection pool
   */
  private async optimizeConnections(): Promise<void> {
    const metrics = this.getConnectionMetrics();

    // Log current metrics
    logger.debug('Database connection metrics', metrics);

    // Check for connection leaks
    if (metrics.idleConnections > metrics.maxConnections * 0.8) {
      logger.warn('High number of idle connections detected', {
        idleConnections: metrics.idleConnections,
        maxConnections: metrics.maxConnections
      });

      await this.cleanupIdleConnections();
    }

    // Check for too many waiting clients
    if (metrics.waitingClients > 5) {
      logger.warn('Many clients waiting for connections', {
        waitingClients: metrics.waitingClients
      });

      await this.handleConnectionPressure();
    }
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    try {
      logger.info('Cleaning up idle database connections...');

      // Force cleanup of idle connections
      const poolInstance = pool as any;
      if (poolInstance.pool && poolInstance.pool._removeAll) {
        poolInstance.pool._removeAll();
      }

      // Reset error count on successful cleanup
      this.connectionHealth.errorCount = Math.max(0, this.connectionHealth.errorCount - 1);

    } catch (error) {
      logger.error('Failed to cleanup idle connections', { error });
    }
  }

  /**
   * Handle connection pressure (too many waiting clients)
   */
  private async handleConnectionPressure(): Promise<void> {
    try {
      logger.warn('Handling database connection pressure...');

      // Temporarily increase pool size if possible
      const poolInstance = pool as any;
      if (poolInstance.options && poolInstance.options.max < 30) {
        const oldMax = poolInstance.options.max;
        poolInstance.options.max = Math.min(oldMax + 5, 30);

        logger.info('Temporarily increased connection pool size', {
          oldSize: oldMax,
          newSize: poolInstance.options.max
        });

        // Reset after 5 minutes
        setTimeout(() => {
          poolInstance.options.max = oldMax;
          logger.info('Reset connection pool size to original', {
            size: oldMax
          });
        }, 5 * 60 * 1000);
      }

    } catch (error) {
      logger.error('Failed to handle connection pressure', { error });
    }
  }

  /**
   * Handle unhealthy database connection
   */
  private async handleUnhealthyConnection(): Promise<void> {
    try {
      logger.error('Attempting to recover unhealthy database connection...');

      // Close existing pool
      await pool.end();

      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Reconnect would be handled by the application restart
      logger.info('Database connection pool closed, application restart may be required');

    } catch (error) {
      logger.error('Failed to recover unhealthy database connection', { error });
    }
  }

  /**
   * Clean up all connections before shutdown
   */
  private async cleanupConnections(): Promise<void> {
    try {
      logger.info('Cleaning up database connections before shutdown...');

      // Close all connections in the pool
      await pool.end();

      // Destroy database instance
      if (db && typeof db.destroy === 'function') {
        await db.destroy();
      }

      logger.info('Database connections cleaned up successfully');

    } catch (error) {
      logger.error('Error during connection cleanup', { error });
    }
  }

  /**
   * Get connection health status
   */
  public getConnectionHealth(): ConnectionHealth & { metrics: ConnectionMetrics } {
    return {
      ...this.connectionHealth,
      metrics: this.getConnectionMetrics()
    };
  }

  /**
   * Execute query with connection timeout and retry logic
   */
  public async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    options: { retries?: number; timeout?: number } = {}
  ): Promise<T> {
    const { retries = 3, timeout = this.CONNECTION_TIMEOUT } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();

        // Execute query with timeout
        const result = await Promise.race([
          pool.query(query, params),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ]);

        const executionTime = Date.now() - startTime;

        logger.debug('Query executed successfully', {
          query: query.substring(0, 100),
          executionTime: `${executionTime}ms`,
          attempt
        });

        return result;

      } catch (error) {
        logger.warn(`Query attempt ${attempt} failed`, {
          query: query.substring(0, 100),
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (attempt === retries) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    throw new Error('All query attempts failed');
  }

  /**
   * Create a transaction with proper cleanup
   */
  public async executeTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');

      return result;

    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction', { rollbackError });
        }
      }

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}

// Export singleton instance
export const databaseConnectionOptimizerService = new DatabaseConnectionOptimizerService();