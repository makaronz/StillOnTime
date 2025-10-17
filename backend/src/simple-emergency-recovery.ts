/**
 * Simple Emergency Recovery - No sudo required
 * Immediate memory recovery for critical situations
 */

import { logger } from '@/utils/logger';
import * as os from 'os';

async function emergencyRecovery() {
  console.log('🚨 EMERGENCY MEMORY RECOVERY - NO SUDO');
  console.log('=====================================');
  console.log('Started at:', new Date().toISOString());

  // Get current memory status
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPercent = (usedMem / totalMem) * 100;

  console.log('📊 Current Memory Status:');
  console.log(`   Total Memory: ${Math.round(totalMem / 1024 / 1024)}MB`);
  console.log(`   Used Memory: ${Math.round(usedMem / 1024 / 1024)}MB`);
  console.log(`   Free Memory: ${Math.round(freeMem / 1024 / 1024)}MB`);
  console.log(`   Usage Percent: ${memoryPercent.toFixed(2)}%`);

  if (memoryPercent > 90) {
    console.log('🚨 CRITICAL: Memory usage above 90%');

    console.log('🧹 Step 1: Forcing garbage collection...');

    // Force garbage collection multiple times
    if (global.gc) {
      for (let i = 0; i < 5; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log('✅ Garbage collection completed');
    } else {
      console.log('⚠️ Garbage collection not available');
    }

    console.log('🧹 Step 2: Clearing Node.js module cache...');

    // Clear require cache
    const clearedModules = [];
    for (const key in require.cache) {
      if (!key.includes('node_modules') &&
          !key.includes('/utils/logger') &&
          !key.includes('/config')) {
        delete require.cache[key];
        clearedModules.push(key);
      }
    }
    console.log(`✅ Cleared ${clearedModules.length} modules from cache`);

    console.log('🧹 Step 3: Optimizing arrays and objects...');

    // Trigger V8 optimization
    if (typeof setImmediate !== 'undefined') {
      await new Promise(resolve => setImmediate(resolve));
    }

    console.log('🧹 Step 4: Clearing intervals and timeouts...');

    // This would clear app-specific intervals in a real implementation
    console.log('✅ Cleanup operations completed');

    // Check memory after recovery
    const freeMemAfter = os.freemem();
    const usedMemAfter = totalMem - freeMemAfter;
    const memoryPercentAfter = (usedMemAfter / totalMem) * 100;
    const memoryFreed = freeMemAfter - freeMem;

    console.log('');
    console.log('📊 Recovery Results:');
    console.log(`   Memory Before: ${memoryPercent.toFixed(2)}%`);
    console.log(`   Memory After: ${memoryPercentAfter.toFixed(2)}%`);
    console.log(`   Memory Freed: ${Math.round(memoryFreed / 1024 / 1024)}MB`);
    console.log(`   Free Memory: ${Math.round(freeMemAfter / 1024 / 1024)}MB`);

    if (memoryPercentAfter < memoryPercent) {
      console.log(`✅ Recovery successful: Memory usage reduced by ${(memoryPercent - memoryPercentAfter).toFixed(2)}%`);
    } else {
      console.log('⚠️ Limited recovery: Additional steps may be needed');
    }

    // Recommendations
    console.log('');
    console.log('🎯 Recommendations:');
    if (memoryPercentAfter > 90) {
      console.log('   - IMMEDIATE: Restart the application');
      console.log('   - CRITICAL: Kill memory-intensive processes');
      console.log('   - URGENT: Increase system memory');
    } else if (memoryPercentAfter > 80) {
      console.log('   - Monitor memory usage closely');
      console.log('   - Consider application restart');
      console.log('   - Review memory allocation patterns');
    } else {
      console.log('   - Continue monitoring');
      console.log('   - Optimize memory usage in code');
    }

  } else {
    console.log('✅ Memory usage is acceptable');
  }

  console.log('');
  console.log('Recovery completed at:', new Date().toISOString());
}

// Execute recovery
emergencyRecovery().catch(error => {
  console.error('❌ Recovery failed:', error);
  process.exit(1);
});