import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './config';
import logger from '../utils/logger';
import { CircuitBreaker } from '../utils/circuit-breaker';

/**
 * Qdrant Vector Database Configuration
 * 
 * Provides connection to Qdrant for Project CodeNet RAG functionality.
 * Includes circuit breaker for resilience.
 */

interface QdrantConfig {
  url: string;
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
}

export const qdrantConfig: QdrantConfig = {
  url: config.qdrantUrl || 'http://localhost:6333',
  collectionName: 'codenet_examples',
  vectorSize: 1536, // OpenAI ada-002 embeddings
  distance: 'Cosine'
};

// Circuit breaker configuration for Qdrant
const qdrantCircuitBreaker = new CircuitBreaker('qdrant', {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  monitoringPeriod: 10000 // 10 seconds
});

/**
 * Initialize Qdrant client with circuit breaker protection
 */
export const createQdrantClient = (): QdrantClient => {
  try {
    const client = new QdrantClient({ url: qdrantConfig.url });
    
    logger.info('Qdrant client initialized', {
      url: qdrantConfig.url,
      collection: qdrantConfig.collectionName
    });
    
    return client;
  } catch (error) {
    logger.error('Failed to initialize Qdrant client', { error });
    throw error;
  }
};

/**
 * Execute Qdrant operation with circuit breaker protection
 */
export const executeQdrantOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  return qdrantCircuitBreaker.execute(async () => {
    try {
      logger.debug(`Executing Qdrant operation: ${operationName}`);
      const result = await operation();
      logger.debug(`Qdrant operation completed: ${operationName}`);
      return result;
    } catch (error) {
      logger.error(`Qdrant operation failed: ${operationName}`, { error });
      throw error;
    }
  });
};

/**
 * Collection schema for CodeNet examples
 */
export const collectionSchema = {
  vectors: {
    size: qdrantConfig.vectorSize,
    distance: qdrantConfig.distance
  },
  optimizers_config: {
    deleted_threshold: 0.2,
    vacuum_min_vector_number: 1000,
    default_segment_number: 2,
    indexing_threshold: 10000
  }
};

/**
 * Payload indexes for efficient filtering
 */
export const payloadIndexes = [
  { field_name: 'language', field_schema: 'keyword' },
  { field_name: 'problemId', field_schema: 'keyword' },
  { field_name: 'metadata.complexity', field_schema: 'keyword' },
  { field_name: 'metadata.lineCount', field_schema: 'integer' },
  { field_name: 'metadata.patterns', field_schema: 'keyword' },
  { field_name: 'metadata.concepts', field_schema: 'keyword' },
  { field_name: 'qualityScore', field_schema: 'float' }
];

export default {
  qdrantConfig,
  createQdrantClient,
  executeQdrantOperation,
  collectionSchema,
  payloadIndexes,
  circuitBreaker: qdrantCircuitBreaker
};

