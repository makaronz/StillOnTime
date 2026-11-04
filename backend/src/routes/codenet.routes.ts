import { Router } from 'express';
import { codenetController } from '../controllers/codenet.controller';
import { authenticateToken } from '../middleware/auth.middleware';

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

// Everything below this line requires a valid session token. The routes
// call the LLM (/generate) or mutate the vector store (/initialize), so they
// must not be reachable anonymously. Only the health probe above stays public.
router.use(authenticateToken);

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

// Initialize collection
// NOTE: the comment used to say "admin only" but the app has no role model;
// this is currently any authenticated user. Gate on a role once one exists.
router.post('/initialize', (req, res, next) => 
  codenetController.initialize(req, res, next)
);

export default router;

