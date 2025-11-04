/**
 * System Metrics Persistence Service
 * 
 * Ensures chronological integrity when writing system metrics to JSON files.
 * Prevents older timestamps from overwriting newer data and maintains
 * append-only behavior with automatic sorting.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface SystemMetric {
  timestamp: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryFree: number;
  memoryUsagePercent: number;
  memoryEfficiency: number;
  cpuCount: number;
  cpuLoad: number;
  platform: string;
  uptime: number;
}

export interface SystemMetricsPersistenceOptions {
  /** Path to metrics file */
  filePath: string;
  /** Maximum number of entries to keep (0 = unlimited) */
  maxEntries?: number;
  /** Maximum age in milliseconds (0 = unlimited) */
  maxAge?: number;
  /** Enable automatic archival */
  enableArchival?: boolean;
  /** Archive directory path */
  archiveDir?: string;
}

export class SystemMetricsPersistenceService {
  private filePath: string;
  private maxEntries: number;
  private maxAge: number;
  private enableArchival: boolean;
  private archiveDir: string | null;

  constructor(options: SystemMetricsPersistenceOptions) {
    this.filePath = options.filePath;
    this.maxEntries = options.maxEntries || 0;
    this.maxAge = options.maxAge || 0;
    this.enableArchival = options.enableArchival || false;
    this.archiveDir = options.archiveDir || null;
  }

  /**
   * Safely append metrics to file with chronological integrity
   */
  async appendMetrics(newMetrics: SystemMetric[]): Promise<void> {
    try {
      // Read existing metrics
      const existingMetrics = await this.readExistingMetrics();

      // Validate chronological integrity
      const validatedMetrics = this.validateChronologicalIntegrity(
        existingMetrics,
        newMetrics
      );

      // Merge and sort by timestamp
      const mergedMetrics = this.mergeAndSortMetrics(
        existingMetrics,
        validatedMetrics
      );

      // Apply retention policies
      const finalMetrics = this.applyRetentionPolicies(mergedMetrics);

      // Write to file atomically
      await this.writeMetricsAtomically(finalMetrics);

      logger.info('System metrics appended successfully', {
        existingCount: existingMetrics.length,
        newCount: validatedMetrics.length,
        finalCount: finalMetrics.length,
        skippedCount: newMetrics.length - validatedMetrics.length,
      });
    } catch (error) {
      logger.error('Failed to append system metrics', {
        error: error instanceof Error ? error.message : String(error),
        filePath: this.filePath,
      });
      throw error;
    }
  }

  /**
   * Append single metric
   */
  async appendMetric(metric: SystemMetric): Promise<void> {
    await this.appendMetrics([metric]);
  }

  /**
   * Read existing metrics from file
   */
  private async readExistingMetrics(): Promise<SystemMetric[]> {
    try {
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      const metrics = JSON.parse(fileContent) as SystemMetric[];

      if (!Array.isArray(metrics)) {
        logger.warn('Metrics file does not contain array, initializing', {
          filePath: this.filePath,
        });
        return [];
      }

      // Sort existing metrics by timestamp (safety check)
      return metrics.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, return empty array
        logger.info('Metrics file does not exist, will create new one', {
          filePath: this.filePath,
        });
        return [];
      }
      throw error;
    }
  }

  /**
   * Validate chronological integrity of new metrics
   * Returns only metrics that are chronologically valid (newer than existing)
   */
  private validateChronologicalIntegrity(
    existing: SystemMetric[],
    newMetrics: SystemMetric[]
  ): SystemMetric[] {
    if (existing.length === 0) {
      // No existing data, all new metrics are valid
      return newMetrics;
    }

    // Get the latest timestamp from existing metrics
    const latestTimestamp = existing[existing.length - 1]?.timestamp || 0;

    // Filter out metrics with timestamps older than or equal to latest
    const validMetrics = newMetrics.filter((metric) => {
      if (metric.timestamp <= latestTimestamp) {
        logger.warn('Skipping metric with older timestamp', {
          metricTimestamp: metric.timestamp,
          latestTimestamp,
          difference: latestTimestamp - metric.timestamp,
        });
        return false;
      }
      return true;
    });

    // Warn if any metrics were skipped
    const skippedCount = newMetrics.length - validMetrics.length;
    if (skippedCount > 0) {
      logger.warn('Skipped metrics with older timestamps', {
        skippedCount,
        totalNewMetrics: newMetrics.length,
        latestTimestamp,
      });
    }

    return validMetrics;
  }

  /**
   * Merge and sort metrics by timestamp
   */
  private mergeAndSortMetrics(
    existing: SystemMetric[],
    newMetrics: SystemMetric[]
  ): SystemMetric[] {
    // Merge arrays
    const merged = [...existing, ...newMetrics];

    // Sort by timestamp (ascending)
    merged.sort((a, b) => a.timestamp - b.timestamp);

    // Remove duplicates (same timestamp)
    const unique = merged.filter((metric, index, array) => {
      return (
        index === 0 || array[index - 1].timestamp !== metric.timestamp
      );
    });

    return unique;
  }

  /**
   * Apply retention policies (max entries, max age)
   */
  private applyRetentionPolicies(
    metrics: SystemMetric[]
  ): SystemMetric[] {
    let filtered = [...metrics];

    // Apply max age filter
    if (this.maxAge > 0 && metrics.length > 0) {
      const cutoffTime = Date.now() - this.maxAge;
      filtered = filtered.filter((metric) => metric.timestamp >= cutoffTime);

      const archivedCount = metrics.length - filtered.length;
      if (archivedCount > 0) {
        logger.info('Archived old metrics based on max age', {
          archivedCount,
          maxAge: this.maxAge,
        });
      }
    }

    // Apply max entries filter
    if (this.maxEntries > 0 && filtered.length > this.maxEntries) {
      const toArchive = filtered.slice(0, filtered.length - this.maxEntries);
      filtered = filtered.slice(-this.maxEntries);

      if (this.enableArchival && toArchive.length > 0) {
        this.archiveMetrics(toArchive).catch((error) => {
          logger.error('Failed to archive metrics', { error });
        });
      }

      logger.info('Truncated metrics based on max entries', {
        removedCount: metrics.length - filtered.length,
        maxEntries: this.maxEntries,
        finalCount: filtered.length,
      });
    }

    return filtered;
  }

  /**
   * Write metrics atomically (using temporary file + rename)
   */
  private async writeMetricsAtomically(metrics: SystemMetric[]): Promise<void> {
    const tempPath = `${this.filePath}.tmp`;

    try {
      // Ensure directory exists
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file
      const content = JSON.stringify(metrics, null, 2);
      await fs.writeFile(tempPath, content, 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Archive old metrics to separate file
   */
  private async archiveMetrics(metrics: SystemMetric[]): Promise<void> {
    if (!this.archiveDir || metrics.length === 0) {
      return;
    }

    try {
      // Ensure archive directory exists
      await fs.mkdir(this.archiveDir, { recursive: true });

      // Create archive filename with date
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const archivePath = join(this.archiveDir, `system-metrics-${dateStr}.json`);

      // Read existing archive or create new
      let archivedMetrics: SystemMetric[] = [];
      try {
        const existingArchive = await fs.readFile(archivePath, 'utf-8');
        archivedMetrics = JSON.parse(existingArchive) as SystemMetric[];
      } catch {
        // Archive doesn't exist, start fresh
      }

      // Merge and sort
      const merged = [...archivedMetrics, ...metrics].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      // Write archive
      await fs.writeFile(
        archivePath,
        JSON.stringify(merged, null, 2),
        'utf-8'
      );

      logger.info('Metrics archived successfully', {
        archivePath,
        archivedCount: metrics.length,
        totalInArchive: merged.length,
      });
    } catch (error) {
      logger.error('Failed to archive metrics', {
        error: error instanceof Error ? error.message : String(error),
        archiveDir: this.archiveDir,
      });
      // Don't throw - archiving failure shouldn't break main flow
    }
  }

  /**
   * Get latest timestamp from existing metrics
   */
  async getLatestTimestamp(): Promise<number> {
    const existing = await this.readExistingMetrics();
    if (existing.length === 0) {
      return 0;
    }
    return existing[existing.length - 1].timestamp;
  }

  /**
   * Get metrics count
   */
  async getMetricsCount(): Promise<number> {
    const existing = await this.readExistingMetrics();
    return existing.length;
  }
}
