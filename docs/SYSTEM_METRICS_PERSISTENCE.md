# System Metrics Persistence - Chronological Integrity Protection

## Problem

System metrics data was being replaced with older timestamps instead of being appended, causing:
- Loss of recent performance data
- Broken chronological integrity
- Impact on monitoring, alerting, and trend analysis

## Solution

The `SystemMetricsPersistenceService` ensures:
1. **Chronological integrity**: Only metrics with timestamps newer than existing data are appended
2. **Append-only behavior**: Data is never replaced, only appended
3. **Automatic sorting**: Metrics are sorted by timestamp before writing
4. **Retention policies**: Configurable max entries and max age
5. **Automatic archival**: Old metrics can be archived to separate files

## Usage

### Basic Usage

```typescript
import { SystemMetricsPersistenceService } from './services/system-metrics-persistence.service';

const service = new SystemMetricsPersistenceService({
  filePath: '.claude-flow/metrics/system-metrics.json',
});

// Append single metric
await service.appendMetric({
  timestamp: Date.now(),
  memoryTotal: 38654705664,
  memoryUsed: 34847506432,
  memoryFree: 3807199232,
  memoryUsagePercent: 90.15,
  memoryEfficiency: 9.85,
  cpuCount: 14,
  cpuLoad: 0.58,
  platform: 'darwin',
  uptime: 50286,
});

// Append multiple metrics
await service.appendMetrics([
  { timestamp: 1234567890, ... },
  { timestamp: 1234567900, ... },
]);
```

### With Retention Policies

```typescript
const service = new SystemMetricsPersistenceService({
  filePath: '.claude-flow/metrics/system-metrics.json',
  maxEntries: 10080, // 7 days of minute-by-minute data
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  enableArchival: true,
  archiveDir: '.claude-flow/metrics/archive',
});
```

### Using the CLI Script

```bash
# Write metrics from JSON string
ts-node scripts/system-metrics-writer.ts \
  .claude-flow/metrics/system-metrics.json \
  '[{"timestamp": 1234567890, "memoryTotal": 38654705664, ...}]'

# Or from file
METRICS=$(cat metrics.json)
ts-node scripts/system-metrics-writer.ts \
  .claude-flow/metrics/system-metrics.json \
  "$METRICS"
```

## Safety Features

### 1. Chronological Validation

The service automatically rejects metrics with timestamps older than the latest existing metric:

```typescript
// If latest timestamp is 1762230519627
// This will be rejected:
await service.appendMetric({
  timestamp: 1762225640946, // Older than latest
  ...
});

// This will be accepted:
await service.appendMetric({
  timestamp: 1762230520000, // Newer than latest
  ...
});
```

### 2. Atomic Writes

Metrics are written atomically using a temporary file + rename pattern:

```
1. Write to .claude-flow/metrics/system-metrics.json.tmp
2. Validate JSON format
3. Rename temp file to final file (atomic operation)
```

### 3. Duplicate Prevention

Metrics with identical timestamps are automatically deduplicated.

### 4. Automatic Sorting

All metrics are sorted by timestamp before writing, ensuring chronological order.

## Integration with Claude-Flow

If you're using claude-flow MCP tools to write metrics, you can:

1. **Use the service as a wrapper**:
   ```typescript
   // In your claude-flow hook
   import { SystemMetricsPersistenceService } from './services/system-metrics-persistence.service';
   
   const service = new SystemMetricsPersistenceService({
     filePath: '.claude-flow/metrics/system-metrics.json',
   });
   
   // Wrap your metrics collection
   const metrics = await collectSystemMetrics();
   await service.appendMetrics(metrics);
   ```

2. **Use the CLI script as a post-hook**:
   ```bash
   # After claude-flow collects metrics
   npx ts-node scripts/system-metrics-writer.ts \
     .claude-flow/metrics/system-metrics.json \
     "$(cat /tmp/claude-flow-metrics.json)"
   ```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filePath` | string | **required** | Path to metrics JSON file |
| `maxEntries` | number | 0 (unlimited) | Maximum number of entries to keep |
| `maxAge` | number | 0 (unlimited) | Maximum age in milliseconds |
| `enableArchival` | boolean | false | Enable automatic archival |
| `archiveDir` | string | null | Directory for archived metrics |

## Retention Policies

### Max Entries

Keeps only the most recent N entries:

```typescript
const service = new SystemMetricsPersistenceService({
  filePath: '.claude-flow/metrics/system-metrics.json',
  maxEntries: 10080, // Keep last 10080 entries (7 days)
});
```

### Max Age

Removes entries older than specified age:

```typescript
const service = new SystemMetricsPersistenceService({
  filePath: '.claude-flow/metrics/system-metrics.json',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

### Archival

Old entries are moved to archive files:

```typescript
const service = new SystemMetricsPersistenceService({
  filePath: '.claude-flow/metrics/system-metrics.json',
  maxEntries: 10080,
  enableArchival: true,
  archiveDir: '.claude-flow/metrics/archive',
});
```

Archived files are named: `system-metrics-YYYY-MM-DD.json`

## Error Handling

The service includes comprehensive error handling:

- **File read errors**: Returns empty array if file doesn't exist
- **Invalid JSON**: Logs error and throws
- **Write failures**: Rolls back temporary file
- **Archival failures**: Logs but doesn't break main flow

## Logging

All operations are logged with structured logging:

```typescript
logger.info('System metrics appended successfully', {
  existingCount: 100,
  newCount: 5,
  finalCount: 105,
  skippedCount: 0,
});
```

## Testing

To test the service:

```typescript
import { SystemMetricsPersistenceService } from './services/system-metrics-persistence.service';

describe('SystemMetricsPersistenceService', () => {
  it('should reject older timestamps', async () => {
    const service = new SystemMetricsPersistenceService({
      filePath: '/tmp/test-metrics.json',
    });

    // Add initial metric
    await service.appendMetric({
      timestamp: 1000,
      // ... other fields
    });

    // Try to add older metric
    await service.appendMetric({
      timestamp: 500, // Older!
      // ... other fields
    });

    const count = await service.getMetricsCount();
    expect(count).toBe(1); // Only first metric accepted
  });
});
```

## Migration

If you have existing metrics with chronological issues:

1. **Backup existing file**:
   ```bash
   cp .claude-flow/metrics/system-metrics.json \
      .claude-flow/metrics/system-metrics.json.backup
   ```

2. **Sort and deduplicate**:
   ```typescript
   import { readFileSync, writeFileSync } from 'fs';
   
   const metrics = JSON.parse(
     readFileSync('.claude-flow/metrics/system-metrics.json', 'utf-8')
   );
   
   // Sort by timestamp
   metrics.sort((a, b) => a.timestamp - b.timestamp);
   
   // Remove duplicates
   const unique = metrics.filter((m, i, arr) => 
     i === 0 || arr[i-1].timestamp !== m.timestamp
   );
   
   writeFileSync(
     '.claude-flow/metrics/system-metrics.json',
     JSON.stringify(unique, null, 2)
   );
   ```

3. **Use service going forward**: All new writes will be protected.

## Best Practices

1. **Always use the service** for writing metrics (never direct file writes)
2. **Enable archival** for long-term data retention
3. **Set reasonable retention** based on your monitoring needs
4. **Monitor skipped metrics** in logs to catch timestamp issues early
5. **Regular backups** of metrics files for disaster recovery
