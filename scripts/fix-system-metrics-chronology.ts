#!/usr/bin/env ts-node
/**
 * Fix System Metrics Chronology Script
 * 
 * Fixes existing system-metrics.json file by:
 * 1. Sorting all metrics by timestamp
 * 2. Removing duplicates
 * 3. Ensuring chronological integrity
 * 
 * Usage:
 *   ts-node scripts/fix-system-metrics-chronology.ts [metrics-file]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { SystemMetric } from '../backend/src/services/system-metrics-persistence.service';
import { join } from 'path';

const METRICS_FILE = process.argv[2] || '.claude-flow/metrics/system-metrics.json';

async function fixChronology(): Promise<void> {
  try {
    console.log('Fixing system metrics chronology...');
    console.log('File:', METRICS_FILE);

    // Check if file exists
    if (!existsSync(METRICS_FILE)) {
      console.error(`Error: File not found: ${METRICS_FILE}`);
      process.exit(1);
    }

    // Read existing metrics
    console.log('Reading existing metrics...');
    const fileContent = readFileSync(METRICS_FILE, 'utf-8');
    let metrics: SystemMetric[];

    try {
      metrics = JSON.parse(fileContent);
    } catch (error) {
      console.error('Error: Invalid JSON format');
      console.error(error);
      process.exit(1);
    }

    if (!Array.isArray(metrics)) {
      console.error('Error: Metrics file does not contain an array');
      process.exit(1);
    }

    const originalCount = metrics.length;
    console.log(`Found ${originalCount} metrics`);

    // Get timestamps before fix
    const timestampsBefore = metrics.map(m => m.timestamp);
    const minBefore = Math.min(...timestampsBefore);
    const maxBefore = Math.max(...timestampsBefore);

    console.log('Before fix:');
    console.log(`  Min timestamp: ${minBefore} (${new Date(minBefore).toISOString()})`);
    console.log(`  Max timestamp: ${maxBefore} (${new Date(maxBefore).toISOString()})`);

    // Create backup
    const backupPath = `${METRICS_FILE}.backup-${Date.now()}`;
    console.log(`Creating backup: ${backupPath}`);
    writeFileSync(backupPath, fileContent, 'utf-8');

    // Sort by timestamp
    console.log('Sorting metrics by timestamp...');
    metrics.sort((a, b) => a.timestamp - b.timestamp);

    // Remove duplicates (same timestamp)
    console.log('Removing duplicates...');
    const uniqueMetrics: SystemMetric[] = [];
    const seenTimestamps = new Set<number>();

    for (const metric of metrics) {
      if (!seenTimestamps.has(metric.timestamp)) {
        seenTimestamps.add(metric.timestamp);
        uniqueMetrics.push(metric);
      }
    }

    const duplicatesRemoved = metrics.length - uniqueMetrics.length;
    console.log(`Removed ${duplicatesRemoved} duplicate entries`);

    // Get timestamps after fix
    const timestampsAfter = uniqueMetrics.map(m => m.timestamp);
    const minAfter = Math.min(...timestampsAfter);
    const maxAfter = Math.max(...timestampsAfter);

    console.log('After fix:');
    console.log(`  Min timestamp: ${minAfter} (${new Date(minAfter).toISOString()})`);
    console.log(`  Max timestamp: ${maxAfter} (${new Date(maxAfter).toISOString()})`);
    console.log(`  Total metrics: ${uniqueMetrics.length}`);

    // Check for chronological issues
    let chronologicalIssues = 0;
    for (let i = 1; i < uniqueMetrics.length; i++) {
      if (uniqueMetrics[i].timestamp <= uniqueMetrics[i - 1].timestamp) {
        chronologicalIssues++;
      }
    }

    if (chronologicalIssues > 0) {
      console.warn(`Warning: Found ${chronologicalIssues} chronological issues`);
    } else {
      console.log('✓ Chronological integrity verified');
    }

    // Write fixed metrics
    console.log('Writing fixed metrics...');
    writeFileSync(
      METRICS_FILE,
      JSON.stringify(uniqueMetrics, null, 2),
      'utf-8'
    );

    console.log('\n✓ Fix completed successfully!');
    console.log(`  Backup saved to: ${backupPath}`);
    console.log(`  Original count: ${originalCount}`);
    console.log(`  Final count: ${uniqueMetrics.length}`);
    console.log(`  Duplicates removed: ${duplicatesRemoved}`);
    console.log(`  Chronological issues: ${chronologicalIssues}`);

    process.exit(0);
  } catch (error) {
    console.error('Error fixing chronology:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixChronology().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { fixChronology };
