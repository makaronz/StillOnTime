/**
 * Memory Recovery Routes
 * API endpoints for memory management and recovery operations
 */

import { Router } from 'express';
import { memoryRecoveryController } from '@/controllers/memory-recovery.controller';
import { rateLimit } from 'express-rate-limit';
import { logger } from '@/utils/logger';

const router = Router();

// Rate limiting for recovery operations
const recoveryRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // Maximum 5 recovery operations per minute
  message: {
    success: false,
    error: 'Too many recovery requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/memory/status - Get current memory status
router.get('/status', memoryRecoveryController.getMemoryStatus.bind(memoryRecoveryController));

// GET /api/memory/history - Get recovery history
router.get('/history', memoryRecoveryController.getRecoveryHistory.bind(memoryRecoveryController));

// POST /api/memory/recovery/trigger - Trigger manual recovery
router.post('/recovery/trigger',
  recoveryRateLimit,
  memoryRecoveryController.triggerRecovery.bind(memoryRecoveryController)
);

// POST /api/memory/gc - Force garbage collection
router.post('/gc',
  recoveryRateLimit,
  memoryRecoveryController.forceGarbageCollection.bind(memoryRecoveryController)
);

// POST /api/memory/clear-caches - Clear application caches
router.post('/clear-caches',
  recoveryRateLimit,
  memoryRecoveryController.clearCaches.bind(memoryRecoveryController)
);

// POST /api/memory/optimize-db - Optimize database connections
router.post('/optimize-db',
  recoveryRateLimit,
  memoryRecoveryController.optimizeDatabaseConnections.bind(memoryRecoveryController)
);

// PUT /api/memory/thresholds - Update memory thresholds
router.put('/thresholds', memoryRecoveryController.updateThresholds.bind(memoryRecoveryController));

// Log route access
router.use((req, res, next) => {
  logger.debug('Memory recovery API accessed', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

export default router;