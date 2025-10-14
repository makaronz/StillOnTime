import { Router } from 'express';
import { codenetController } from '../controllers/codenet.controller';

const router = Router();

/**
 * CodeNet API Routes
 * 
 * Endpoints for Project CodeNet RAG functionality
 */

// Health check
router.get('/health', (req, res, next) => 
  codenetController.healthCheck(req, res, next)
);

// Search similar code
router.get('/search', (req, res, next) => 
  codenetController.search(req, res, next)
);

// Generate code with RAG context
router.post('/generate', (req, res, next) => 
  codenetController.generate(req, res, next)
);

// Get code patterns
router.get('/patterns', (req, res, next) => 
  codenetController.getPatterns(req, res, next)
);

// Get dataset statistics
router.get('/stats', (req, res, next) => 
  codenetController.getStats(req, res, next)
);

// Initialize collection (admin only)
router.post('/initialize', (req, res, next) => 
  codenetController.initialize(req, res, next)
);

export default router;

