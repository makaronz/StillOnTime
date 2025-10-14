#!/usr/bin/env ts-node

/**
 * Project CodeNet Preprocessing Script
 * 
 * Processes downloaded source files:
 * - Generates OpenAI embeddings
 * - Extracts metadata (functions, patterns, concepts)
 * - Creates Qdrant-ready documents
 * 
 * Usage:
 *   npm run codenet:preprocess
 */

import fs from 'fs';
import path from 'path';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Simple logger for scripts
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || '')
};

// Simple config
const config = {
  apis: {
    openaiApiKey: process.env.OPENAI_API_KEY || ''
  },
  codenet: {
    datasetPath: process.env.CODENET_DATASET_PATH || path.join(__dirname, '../data/codenet')
  }
};

// Import types from types file
import {
  CodeNetDocument,
  ProgrammingLanguage,
  ComplexityLevel,
  PreprocessingResult
} from '../src/types/codenet.types';

class CodeNetPreprocessor {
  private embeddings: OpenAIEmbeddings;
  private inputDir: string;
  private outputDir: string;

  constructor(inputDir: string, outputDir: string) {
    this.inputDir = inputDir;
    this.outputDir = path.join(inputDir, 'preprocessed');

    if (!config.apis.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apis.openaiApiKey,
      modelName: 'text-embedding-ada-002'
    });

    logger.info('Preprocessor initialized', {
      inputDir,
      outputDir: this.outputDir
    });
  }

  /**
   * Process all downloaded files
   */
  async processAll(): Promise<void> {
    logger.info('Starting preprocessing...');

    const languages: ProgrammingLanguage[] = ['TypeScript', 'JavaScript', 'Python'];
    let totalProcessed = 0;
    let totalSuccessful = 0;

    for (const lang of languages) {
      const langDir = path.join(this.inputDir, lang.toLowerCase());
      
      if (!fs.existsSync(langDir)) {
        logger.warn(`Directory not found: ${langDir}`);
        continue;
      }

      const files = fs.readdirSync(langDir);
      logger.info(`Processing ${files.length} ${lang} files`);

      for (const file of files) {
        totalProcessed++;
        
        try {
          const result = await this.processFile(langDir, file, lang);
          
          if (result.success) {
            totalSuccessful++;
            await this.saveDocument(result.document);
          }

          if (totalProcessed % 50 === 0) {
            logger.info(`Processed ${totalProcessed} files (${totalSuccessful} successful)`);
          }

        } catch (error) {
          logger.error(`Failed to process ${file}`, { error });
        }
      }
    }

    logger.info('Preprocessing complete', {
      totalProcessed,
      totalSuccessful,
      failed: totalProcessed - totalSuccessful
    });
  }

  /**
   * Process single file
   */
  private async processFile(
    dir: string,
    filename: string,
    language: ProgrammingLanguage
  ): Promise<PreprocessingResult> {
    const startTime = Date.now();

    try {
      // Read source code
      const filepath = path.join(dir, filename);
      const sourceCode = fs.readFileSync(filepath, 'utf-8');

      // Extract submission ID from filename
      const submissionId = filename.split('.')[0];

      // Generate embeddings
      const embeddings = await this.embeddings.embedQuery(sourceCode);

      // Extract metadata
      const metadata = this.extractMetadata(sourceCode, language);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(sourceCode, metadata);

      // Create document
      const document: CodeNetDocument = {
        id: submissionId,
        problemId: 'p00001', // TODO: Extract from metadata
        language,
        sourceCode,
        embeddings,
        metadata,
        qualityScore
      };

      return {
        document,
        success: true,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Processing failed', { filename, error });
      return {
        document: {} as CodeNetDocument,
        success: false,
        errors: [String(error)],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Extract metadata from source code
   */
  private extractMetadata(sourceCode: string, language: ProgrammingLanguage): any {
    const lines = sourceCode.split('\n');
    const lineCount = lines.length;

    // Extract patterns
    const patterns: string[] = [];
    if (sourceCode.includes('async') || sourceCode.includes('await')) {
      patterns.push('async-await');
    }
    if (sourceCode.includes('try') && sourceCode.includes('catch')) {
      patterns.push('error-handling');
    }
    if (sourceCode.includes('Promise')) {
      patterns.push('promises');
    }
    if (sourceCode.match(/\bmap\b|\bfilter\b|\breduce\b/)) {
      patterns.push('functional-programming');
    }

    // Extract concepts
    const concepts: string[] = [];
    if (sourceCode.includes('sort') || sourceCode.includes('sorted')) {
      concepts.push('sorting');
    }
    if (sourceCode.includes('for') || sourceCode.includes('while')) {
      concepts.push('iteration');
    }
    if (sourceCode.match(/recursion|recursive/i)) {
      concepts.push('recursion');
    }

    // Extract imports/requires
    const imports = this.extractImports(sourceCode, language);

    // Extract functions
    const functions = this.extractFunctions(sourceCode, language);

    // Check for comments
    const commentLines = lines.filter(line => 
      line.trim().startsWith('//') || 
      line.trim().startsWith('#') ||
      line.trim().startsWith('/*')
    ).length;
    const hasComments = commentLines > 0;
    const commentDensity = commentLines / lineCount;

    // Determine complexity
    const complexity = this.determineComplexity(lineCount, patterns.length);

    return {
      problemName: 'Sample Problem',
      complexity,
      lineCount,
      patterns,
      concepts,
      imports,
      functions,
      hasComments,
      commentDensity
    };
  }

  /**
   * Extract imports from code
   */
  private extractImports(code: string, language: ProgrammingLanguage): string[] {
    const imports: string[] = [];

    if (language === 'TypeScript' || language === 'JavaScript') {
      const importMatches = code.matchAll(/import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        imports.push(match[1]);
      }
      const requireMatches = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const match of requireMatches) {
        imports.push(match[1]);
      }
    } else if (language === 'Python') {
      const importMatches = code.matchAll(/(?:from\s+(\S+)\s+)?import\s+([^;\n]+)/g);
      for (const match of importMatches) {
        imports.push(match[1] || match[2]);
      }
    }

    return [...new Set(imports)];
  }

  /**
   * Extract function names from code
   */
  private extractFunctions(code: string, language: ProgrammingLanguage): string[] {
    const functions: string[] = [];

    if (language === 'TypeScript' || language === 'JavaScript') {
      const functionMatches = code.matchAll(/(?:function|async\s+function)\s+(\w+)\s*\(/g);
      for (const match of functionMatches) {
        functions.push(match[1]);
      }
      const arrowMatches = code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g);
      for (const match of arrowMatches) {
        functions.push(match[1]);
      }
    } else if (language === 'Python') {
      const defMatches = code.matchAll(/def\s+(\w+)\s*\(/g);
      for (const match of defMatches) {
        functions.push(match[1]);
      }
    }

    return [...new Set(functions)];
  }

  /**
   * Determine code complexity
   */
  private determineComplexity(lineCount: number, patternCount: number): ComplexityLevel {
    if (lineCount < 100 && patternCount < 3) {
      return 'low';
    } else if (lineCount > 300 || patternCount > 5) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(code: string, metadata: any): number {
    let score = 0.5; // Base score

    // Bonus for comments
    if (metadata.hasComments) score += 0.1;
    if (metadata.commentDensity > 0.1) score += 0.1;

    // Bonus for patterns
    score += Math.min(metadata.patterns.length * 0.05, 0.2);

    // Bonus for reasonable length
    if (metadata.lineCount >= 50 && metadata.lineCount <= 300) {
      score += 0.1;
    }

    // Bonus for error handling
    if (metadata.patterns.includes('error-handling')) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Save document to file
   */
  private async saveDocument(document: CodeNetDocument): Promise<void> {
    const filename = `${document.id}.json`;
    const filepath = path.join(this.outputDir, filename);

    // Remove embeddings from saved file to reduce size (we'll regenerate)
    const { embeddings, ...documentWithoutEmbeddings } = document;

    fs.writeFileSync(filepath, JSON.stringify(documentWithoutEmbeddings, null, 2));
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const inputDir = config.codenet.datasetPath;
  const outputDir = path.join(inputDir, 'preprocessed');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const preprocessor = new CodeNetPreprocessor(inputDir, outputDir);
  await preprocessor.processAll();
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Preprocessing script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Preprocessing script failed', { error });
      process.exit(1);
    });
}

export { CodeNetPreprocessor };

