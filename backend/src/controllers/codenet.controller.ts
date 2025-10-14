import { Request, Response, NextFunction } from 'express';
import { codenetRAGService } from '../services/codenet-rag.service';
import { qdrantService } from '../services/qdrant.service';
import logger from '../utils/logger';
import { APIError } from '../types';
import { ProgrammingLanguage } from '../types/codenet.types';

/**
 * CodeNet Controller
 * 
 * REST API endpoints for CodeNet RAG functionality
 */
export class CodeNetController {
  /**
   * GET /api/codenet/search
   * Search for similar code examples
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, language, limit } = req.query;

      if (!query || typeof query !== 'string') {
        throw new APIError('Query parameter is required', 400);
      }

      if (!language || typeof language !== 'string') {
        throw new APIError('Language parameter is required', 400);
      }

      const validLanguages: ProgrammingLanguage[] = ['TypeScript', 'JavaScript', 'Python'];
      if (!validLanguages.includes(language as ProgrammingLanguage)) {
        throw new APIError(
          `Invalid language. Must be one of: ${validLanguages.join(', ')}`,
          400
        );
      }

      const resultLimit = limit ? parseInt(limit as string, 10) : 5;
      if (resultLimit < 1 || resultLimit > 20) {
        throw new APIError('Limit must be between 1 and 20', 400);
      }

      logger.info('CodeNet search request', { query, language, limit: resultLimit });

      const examples = await codenetRAGService.findSimilarCode(
        query,
        language as ProgrammingLanguage,
        resultLimit
      );

      res.json({
        success: true,
        query,
        language,
        resultsCount: examples.length,
        examples
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/codenet/generate
   * Generate code with RAG context
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { task, language, existingCode } = req.body;

      if (!task || typeof task !== 'string') {
        throw new APIError('Task is required', 400);
      }

      if (!language || typeof language !== 'string') {
        throw new APIError('Language is required', 400);
      }

      const validLanguages: ProgrammingLanguage[] = ['TypeScript', 'JavaScript', 'Python'];
      if (!validLanguages.includes(language as ProgrammingLanguage)) {
        throw new APIError(
          `Invalid language. Must be one of: ${validLanguages.join(', ')}`,
          400
        );
      }

      if (existingCode && typeof existingCode !== 'string') {
        throw new APIError('Existing code must be a string', 400);
      }

      logger.info('CodeNet generate request', { task: task.substring(0, 50), language });

      const result = await codenetRAGService.generateWithContext(
        task,
        language as ProgrammingLanguage,
        existingCode
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/codenet/patterns
   * Get common code patterns
   */
  async getPatterns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { codeContext } = req.query;

      if (!codeContext || typeof codeContext !== 'string') {
        throw new APIError('Code context is required', 400);
      }

      logger.info('CodeNet patterns request');

      const patterns = await codenetRAGService.extractPatterns(codeContext);

      res.json({
        success: true,
        patternsCount: patterns.length,
        patterns
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/codenet/stats
   * Get dataset statistics
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('CodeNet stats request');

      const collectionInfo = await qdrantService.getCollectionInfo();

      res.json({
        success: true,
        collection: collectionInfo.name,
        vectorsCount: collectionInfo.vectors_count || 0,
        pointsCount: collectionInfo.points_count || 0,
        status: collectionInfo.status,
        enabled: codenetRAGService.isEnabled()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/codenet/health
   * Health check for CodeNet service
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const qdrantHealthy = await qdrantService.healthCheck();
      const ragEnabled = codenetRAGService.isEnabled();

      const healthy = qdrantHealthy && ragEnabled;

      res.status(healthy ? 200 : 503).json({
        success: healthy,
        qdrant: qdrantHealthy,
        ragEnabled,
        status: healthy ? 'healthy' : 'degraded'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/codenet/initialize
   * Initialize Qdrant collection (admin only)
   */
  async initialize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.warn('Initializing Qdrant collection');

      await qdrantService.initializeCollection();

      res.json({
        success: true,
        message: 'Qdrant collection initialized successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const codenetController = new CodeNetController();

