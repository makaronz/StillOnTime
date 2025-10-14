import { QdrantClient } from '@qdrant/js-client-rest';
import {
  createQdrantClient,
  executeQdrantOperation,
  qdrantConfig,
  collectionSchema,
  payloadIndexes
} from '../config/qdrant.config';
import logger from '../utils/logger';
import {
  CodeNetDocument,
  SearchResult,
  QdrantFilter,
  IngestionProgress
} from '../types/codenet.types';
import { APIError } from '../utils/errors';

/**
 * Qdrant Vector Database Service
 * 
 * Handles all interactions with Qdrant for Project CodeNet RAG.
 * Includes circuit breaker protection and retry logic.
 */
export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;

  constructor() {
    this.client = createQdrantClient();
    this.collectionName = qdrantConfig.collectionName;
  }

  /**
   * Initialize collection if it doesn't exist
   */
  async initializeCollection(): Promise<void> {
    return executeQdrantOperation(async () => {
      try {
        // Check if collection exists
        const collections = await this.client.getCollections();
        const exists = collections.collections?.some(
          c => c.name === this.collectionName
        );

        if (exists) {
          logger.info(`Collection ${this.collectionName} already exists`);
          return;
        }

        // Create collection
        await this.client.createCollection(this.collectionName, {
          vectors: collectionSchema.vectors,
          optimizers_config: collectionSchema.optimizers_config
        });

        logger.info(`Collection ${this.collectionName} created successfully`);

        // Create payload indexes for efficient filtering
        for (const index of payloadIndexes) {
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: index.field_name,
            field_schema: index.field_schema as any
          });

          logger.debug(`Created index for ${index.field_name}`);
        }

        logger.info('Payload indexes created successfully');
      } catch (error) {
        logger.error('Failed to initialize collection', { error });
        throw new APIError(
          'Failed to initialize Qdrant collection',
          'EXTERNAL_SERVICE_UNAVAILABLE' as any,
          'Qdrant',
          500
        );
      }
    }, 'initializeCollection');
  }

  /**
   * Upsert documents in batch
   */
  async upsertDocuments(
    documents: CodeNetDocument[],
    batchSize: number = 1000
  ): Promise<IngestionProgress> {
    const totalBatches = Math.ceil(documents.length / batchSize);
    let processed = 0;
    let successful = 0;
    let failed = 0;

    logger.info(`Starting batch upload of ${documents.length} documents`, {
      batchSize,
      totalBatches
    });

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;

      try {
        await this.upsertBatch(batch);
        successful += batch.length;
        logger.debug(`Batch ${currentBatch}/${totalBatches} completed`, {
          documentsInBatch: batch.length
        });
      } catch (error) {
        failed += batch.length;
        logger.error(`Batch ${currentBatch}/${totalBatches} failed`, {
          error,
          documentsInBatch: batch.length
        });
      }

      processed += batch.length;
    }

    const result: IngestionProgress = {
      total: documents.length,
      processed,
      successful,
      failed,
      currentBatch: totalBatches,
      totalBatches,
      estimatedTimeRemaining: 0
    };

    logger.info('Batch upload completed', result);
    return result;
  }

  /**
   * Upsert single batch of documents
   */
  private async upsertBatch(documents: CodeNetDocument[]): Promise<void> {
    return executeQdrantOperation(async () => {
      // Filter out documents without valid embeddings
      const validDocuments = documents.filter(doc => {
        const isValid = doc.embeddings && 
          Array.isArray(doc.embeddings) && 
          doc.embeddings.length === 1536; // OpenAI ada-002 dimension
        
        if (!isValid) {
          logger.debug(`Invalid embeddings for doc ${doc.id}`, {
            hasEmbeddings: !!doc.embeddings,
            isArray: Array.isArray(doc.embeddings),
            length: doc.embeddings?.length || 0
          });
        }
        return isValid;
      });

      if (validDocuments.length === 0) {
        logger.warn('No valid documents with embeddings in batch');
        return;
      }

      if (validDocuments.length < documents.length) {
        logger.warn(`Skipping ${documents.length - validDocuments.length} documents without embeddings`);
      }

      logger.info(`Upserting ${validDocuments.length} valid documents`);

      // Convert string IDs to UUIDs (v5 for deterministic generation)
      const { v5: uuidv5 } = await import('uuid');
      const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Standard namespace UUID

      const points = validDocuments.map(doc => ({
        id: uuidv5(doc.id, namespace), // Generate UUID from string ID
        vector: doc.embeddings!,
        payload: {
          originalId: doc.id, // Store original ID in payload
          problemId: doc.problemId,
          language: doc.language,
          sourceCode: doc.sourceCode,
          metadata: doc.metadata,
          qualityScore: doc.qualityScore
        }
      }));

      // Debug first point structure
      if (points.length > 0) {
        logger.debug('First point structure', {
          id: points[0].id,
          vectorLength: points[0].vector.length,
          payloadKeys: Object.keys(points[0].payload)
        });
      }

      // Upsert with points array (Qdrant v1.15+ format)
      await this.client.upsert(this.collectionName, {
        points,
        wait: true
      });
    }, 'upsertBatch');
  }

  /**
   * Search for similar code examples
   */
  async searchSimilar(
    queryVector: number[],
    limit: number = 5,
    filters?: QdrantFilter
  ): Promise<SearchResult[]> {
    return executeQdrantOperation(async () => {
      try {
        const searchRequest: any = {
          vector: queryVector,
          limit,
          with_payload: true,
          with_vector: false
        };

        // Add filters if provided
        if (filters) {
          searchRequest.filter = this.buildQdrantFilter(filters);
        }

        const results = await this.client.search(
          this.collectionName,
          searchRequest
        );

        return results.map(result => ({
          id: result.id as string,
          score: result.score || 0,
          document: {
            id: result.id as string,
            problemId: result.payload?.problemId as string,
            language: result.payload?.language as any,
            sourceCode: result.payload?.sourceCode as string,
            metadata: result.payload?.metadata as any,
            qualityScore: result.payload?.qualityScore as number
          }
        }));
      } catch (error) {
        logger.error('Search failed', { error, limit, hasFilters: !!filters });
        throw new APIError('Failed to search Qdrant', 'EXTERNAL_SERVICE_UNAVAILABLE' as any, 'Qdrant', 500);
      }
    }, 'searchSimilar');
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<CodeNetDocument | null> {
    return executeQdrantOperation(async () => {
      try {
        const result = await this.client.retrieve(this.collectionName, {
          ids: [id],
          with_payload: true,
          with_vector: false
        });

        if (result.length === 0) {
          return null;
        }

        const point = result[0];
        return {
          id: point.id as string,
          problemId: point.payload?.problemId as string,
          language: point.payload?.language as any,
          sourceCode: point.payload?.sourceCode as string,
          metadata: point.payload?.metadata as any,
          qualityScore: point.payload?.qualityScore as number
        };
      } catch (error) {
        logger.error('Failed to get document', { error, id });
        throw new APIError('Failed to retrieve document from Qdrant', 'EXTERNAL_SERVICE_UNAVAILABLE' as any, 'Qdrant', 500);
      }
    }, 'getDocument');
  }

  /**
   * Get collection statistics
   */
  async getCollectionInfo(): Promise<any> {
    return executeQdrantOperation(async () => {
      try {
        return await this.client.getCollection(this.collectionName);
      } catch (error) {
        logger.error('Failed to get collection info', { error });
        throw new APIError('Failed to get collection info', 'EXTERNAL_SERVICE_UNAVAILABLE' as any, 'Qdrant', 500);
      }
    }, 'getCollectionInfo');
  }

  /**
   * Delete collection (use with caution!)
   */
  async deleteCollection(): Promise<void> {
    return executeQdrantOperation(async () => {
      try {
        await this.client.deleteCollection(this.collectionName);
        logger.warn(`Collection ${this.collectionName} deleted`);
      } catch (error) {
        logger.error('Failed to delete collection', { error });
        throw new APIError('Failed to delete collection', 'EXTERNAL_SERVICE_UNAVAILABLE' as any, 'Qdrant', 500);
      }
    }, 'deleteCollection');
  }

  /**
   * Build Qdrant filter from our simplified format
   */
  private buildQdrantFilter(filters: QdrantFilter): any {
    const qdrantFilter: any = {};

    if (filters.must && filters.must.length > 0) {
      qdrantFilter.must = filters.must.map(condition => {
        if (condition.match) {
          return {
            key: condition.key,
            match: condition.match
          };
        }
        if (condition.range) {
          return {
            key: condition.key,
            range: condition.range
          };
        }
        return null;
      }).filter(Boolean);
    }

    if (filters.should && filters.should.length > 0) {
      qdrantFilter.should = filters.should.map(condition => ({
        key: condition.key,
        match: condition.match
      }));
    }

    return qdrantFilter;
  }

  /**
   * Health check - verify Qdrant is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      logger.error('Qdrant health check failed', { error });
      return false;
    }
  }
}

// Export singleton instance
export const qdrantService = new QdrantService();

