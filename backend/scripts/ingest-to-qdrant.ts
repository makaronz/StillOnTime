#!/usr/bin/env ts-node

/**
 * Qdrant Ingestion Script
 * 
 * Loads preprocessed documents and uploads them to Qdrant.
 * 
 * Usage:
 *   npm run codenet:ingest
 */

import fs from 'fs';
import path from 'path';
import { OpenAIEmbeddings } from '@langchain/openai';
import { qdrantService } from '../src/services/qdrant.service';
import { config } from '../src/config/config';
import logger from '../src/utils/logger';
import { CodeNetDocument } from '../src/types/codenet.types';

class QdrantIngestion {
  private embeddings: OpenAIEmbeddings;
  private inputDir: string;

  constructor(inputDir: string) {
    this.inputDir = path.join(inputDir, 'preprocessed');

    if (!config.apis.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apis.openaiApiKey,
      modelName: 'text-embedding-ada-002'
    });
  }

  /**
   * Ingest all preprocessed documents
   */
  async ingestAll(): Promise<void> {
    logger.info('Starting Qdrant ingestion...');

    try {
      // 1. Initialize collection
      logger.info('Initializing Qdrant collection...');
      await qdrantService.initializeCollection();

      // 2. Load preprocessed documents
      logger.info('Loading preprocessed documents...');
      const documents = await this.loadDocuments();
      
      logger.info(`Loaded ${documents.length} documents`);

      if (documents.length === 0) {
        logger.warn('No documents to ingest');
        return;
      }

      // 3. Generate embeddings (if not present)
      logger.info('Generating embeddings...');
      await this.generateEmbeddings(documents);

      // 4. Upload to Qdrant in batches
      logger.info('Uploading to Qdrant...');
      const result = await qdrantService.upsertDocuments(documents, 1000);

      logger.info('Ingestion complete', result);

    } catch (error) {
      logger.error('Ingestion failed', { error });
      throw error;
    }
  }

  /**
   * Load preprocessed documents from disk
   */
  private async loadDocuments(): Promise<CodeNetDocument[]> {
    const files = fs.readdirSync(this.inputDir).filter(f => f.endsWith('.json'));
    const documents: CodeNetDocument[] = [];

    for (const file of files) {
      try {
        const filepath = path.join(this.inputDir, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        const doc = JSON.parse(content) as CodeNetDocument;
        documents.push(doc);
      } catch (error) {
        logger.warn(`Failed to load ${file}`, { error });
      }
    }

    return documents;
  }

  /**
   * Generate embeddings for documents
   */
  private async generateEmbeddings(documents: CodeNetDocument[]): Promise<void> {
    let generated = 0;

    for (const doc of documents) {
      if (!doc.embeddings) {
        try {
          doc.embeddings = await this.embeddings.embedQuery(doc.sourceCode);
          generated++;

          if (generated % 10 === 0) {
            logger.info(`Generated ${generated}/${documents.length} embeddings`);
          }
        } catch (error) {
          logger.error(`Failed to generate embedding for ${doc.id}`, { error });
          doc.embeddings = []; // Empty vector as fallback
        }
      }
    }

    logger.info(`Generated ${generated} new embeddings`);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const inputDir = config.codenet.datasetPath;

  const ingestion = new QdrantIngestion(inputDir);
  await ingestion.ingestAll();
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Ingestion script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Ingestion script failed', { error });
      process.exit(1);
    });
}

export { QdrantIngestion };

