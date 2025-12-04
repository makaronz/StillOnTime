#!/usr/bin/env ts-node
/**
 * System Metrics Writer Script
 * 
 * Safe wrapper for writing system metrics to JSON files with
 * chronological integrity protection.
 * 
 * Usage:
 *   ts-node scripts/system-metrics-writer.ts <metrics-file> <metrics-json>
 * 
 * Example:
 *   ts-node scripts/system-metrics-writer.ts \
 *     .claude-flow/metrics/system-metrics.json \
 *     '[{"timestamp": 1234567890, "memoryTotal": 38654705664, ...}]'
 */

import { SystemMetricsPersistenceService } from '../backend/src/services/system-metrics-persistence.service';
import { SystemMetric } from '../backend/src/services/system-metrics-persistence.service';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const METRICS_FILE_PATH = process.argv[2] || '.claude-flow/metrics/system-metrics.json';
const METRICS_JSON = process.argv[3];

// Default retention: 7 days of data, max 10080 entries (1 per minute)
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const DEFAULT_MAX_ENTRIES = 10080; // 7 days * 24 hours * 60 minutes

async function main(): Promise<void> {
  try {
    // Validate input
    if (!METRICS_JSON) {
      console.error('Error: Metrics JSON data is required');
      console.error('Usage: ts-node scripts/system-metrics-writer.ts <file-path> <metrics-json>');
      process.exit(1);
    }

    // Parse metrics JSON
    let metrics: SystemMetric[];
    try {
      metrics = JSON.parse(METRICS_JSON);
    } catch (error) {
      console.error('Error: Invalid JSON format for metrics data');
      console.error(error);
      process.exit(1);
    }

    // Validate metrics structure
    if (!Array.isArray(metrics)) {
      console.error('Error: Metrics must be an array');
      process.exit(1);
    }

    // Ensure directory exists
    const dir = METRICS_FILE_PATH.substring(0, METRICS_FILE_PATH.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Initialize persistence service
    const service = new SystemMetricsPersistenceService({
      filePath: METRICS_FILE_PATH,
      maxEntries: DEFAULT_MAX_ENTRIES,
      maxAge: DEFAULT_MAX_AGE,
      enableArchival: true,
      archiveDir: join(dir, 'archive'),
    });

    // Get current state
    const beforeCount = await service.getMetricsCount();
    const latestTimestamp = await service.getLatestTimestamp();

    console.log('Current metrics state:', {
      file: METRICS_FILE_PATH,
      existingCount: beforeCount,
      latestTimestamp: latestTimestamp,
      latestTimestampDate: new Date(latestTimestamp).toISOString(),
      newMetricsCount: metrics.length,
    });

    // Append metrics
    await service.appendMetrics(metrics);

    // Get final state
    const afterCount = await service.getMetricsCount();
    const newLatestTimestamp = await service.getLatestTimestamp();

    console.log('Metrics written successfully:', {
      beforeCount,
      afterCount,
      added: afterCount - beforeCount,
      newLatestTimestamp: newLatestTimestamp,
      newLatestTimestampDate: new Date(newLatestTimestamp).toISOString(),
    });

    process.exit(0);
  } catch (error) {
    console.error('Error writing system metrics:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
