import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { qdrantService } from './qdrant.service';
import logger from '../utils/logger';
import { config } from '../config/config';
import {
  ProgrammingLanguage,
  CodeExample,
  GeneratedCode,
  CodePattern,
  RAGQueryParams,
  SearchResult
} from '../types/codenet.types';
import { APIError } from '../types';

/**
 * CodeNet RAG Service
 * 
 * Provides Retrieval-Augmented Generation for code using Project CodeNet dataset.
 * Uses LangChain + OpenAI for embeddings and generation.
 */
export class CodeNetRAGService {
  private embeddings: OpenAIEmbeddings;
  private llm: ChatOpenAI;
  private enabled: boolean;

  constructor() {
    this.enabled = config.codenet.enableRAG;
    
    if (!this.enabled) {
      logger.warn('CodeNet RAG is disabled. Set CODENET_ENABLE_RAG=true to enable.');
      return;
    }

    if (!config.apis.openaiApiKey) {
      logger.error('OpenAI API key not configured. CodeNet RAG will not work.');
      this.enabled = false;
      return;
    }

    // Initialize OpenAI embeddings (ada-002)
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apis.openaiApiKey,
      modelName: 'text-embedding-ada-002'
    });

    // Initialize LLM for code generation
    this.llm = new ChatOpenAI({
      openAIApiKey: config.apis.openaiApiKey,
      modelName: 'gpt-4',
      temperature: 0.2, // Lower temperature for more deterministic code
      maxTokens: 2000
    });

    logger.info('CodeNet RAG Service initialized', {
      embeddingsModel: 'text-embedding-ada-002',
      llmModel: 'gpt-4'
    });
  }

  /**
   * Check if RAG service is enabled and ready
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Find similar code examples for a given query
   */
  async findSimilarCode(
    query: string,
    language: ProgrammingLanguage,
    limit: number = 5
  ): Promise<CodeExample[]> {
    if (!this.enabled) {
      throw new APIError('CodeNet RAG is not enabled', 503);
    }

    try {
      logger.debug('Finding similar code', { query, language, limit });

      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Search Qdrant with language filter
      const results = await qdrantService.searchSimilar(
        queryEmbedding,
        limit,
        {
          must: [
            { key: 'language', match: { value: language } }
          ]
        }
      );

      // Transform to CodeExample format
      const examples: CodeExample[] = results.map(result => ({
        problemName: result.document.metadata.problemName,
        language: result.document.language,
        sourceCode: result.document.sourceCode,
        relevanceScore: result.score,
        patterns: result.document.metadata.patterns,
        concepts: result.document.metadata.concepts
      }));

      logger.info('Found similar code examples', {
        query: query.substring(0, 50),
        resultsCount: examples.length,
        topScore: examples[0]?.relevanceScore
      });

      return examples;
    } catch (error) {
      logger.error('Failed to find similar code', { error, query, language });
      throw new APIError('Failed to search for similar code', 500);
    }
  }

  /**
   * Generate code with RAG context
   */
  async generateWithContext(
    task: string,
    language: ProgrammingLanguage,
    existingCode?: string
  ): Promise<GeneratedCode> {
    if (!this.enabled) {
      throw new APIError('CodeNet RAG is not enabled', 503);
    }

    try {
      logger.debug('Generating code with context', { task, language });

      // Find similar examples
      const examples = await this.findSimilarCode(task, language, 5);

      if (examples.length === 0) {
        logger.warn('No similar examples found, generating without context');
      }

      // Build context from examples
      const contextExamples = examples.map((ex, idx) => 
        `Example ${idx + 1} (relevance: ${(ex.relevanceScore * 100).toFixed(1)}%):\n${ex.sourceCode}\n`
      ).join('\n---\n\n');

      // Create prompt
      const prompt = this.buildCodeGenerationPrompt(
        task,
        language,
        contextExamples,
        existingCode
      );

      // Generate code
      const response = await this.llm.invoke(prompt);
      const generatedCode = response.content as string;

      // Extract patterns used
      const patterns = this.extractPatternsFromExamples(examples);

      const result: GeneratedCode = {
        code: this.cleanGeneratedCode(generatedCode),
        language,
        explanation: `Generated using ${examples.length} similar examples from CodeNet`,
        examplesUsed: examples.length,
        patterns,
        confidence: examples.length > 0 ? examples[0].relevanceScore : 0.5
      };

      logger.info('Code generated successfully', {
        task: task.substring(0, 50),
        examplesUsed: examples.length,
        codeLength: result.code.length
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate code', { error, task, language });
      throw new APIError('Failed to generate code with context', 500);
    }
  }

  /**
   * Extract patterns from code context
   */
  async extractPatterns(codeContext: string): Promise<CodePattern[]> {
    if (!this.enabled) {
      throw new APIError('CodeNet RAG is not enabled', 503);
    }

    try {
      logger.debug('Extracting patterns from code context');

      // Generate embedding for code context
      const contextEmbedding = await this.embeddings.embedQuery(codeContext);

      // Search for similar patterns
      const results = await qdrantService.searchSimilar(
        contextEmbedding,
        10 // Get more results for pattern analysis
      );

      // Analyze patterns
      const patternMap = new Map<string, number>();
      const patternExamples = new Map<string, string[]>();

      results.forEach(result => {
        result.document.metadata.patterns.forEach(pattern => {
          patternMap.set(pattern, (patternMap.get(pattern) || 0) + 1);
          
          const examples = patternExamples.get(pattern) || [];
          if (examples.length < 3) { // Keep max 3 examples per pattern
            examples.push(result.document.sourceCode.substring(0, 200));
            patternExamples.set(pattern, examples);
          }
        });
      });

      // Build pattern objects
      const patterns: CodePattern[] = Array.from(patternMap.entries())
        .map(([name, frequency]) => ({
          name,
          category: this.categorizePattern(name),
          description: `Pattern found in ${frequency} similar code examples`,
          frequency,
          examples: patternExamples.get(name) || [],
          languages: ['TypeScript', 'JavaScript', 'Python'] as ProgrammingLanguage[],
          complexity: 'medium' as const,
          useCases: []
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10); // Top 10 patterns

      logger.info('Extracted patterns', {
        patternsCount: patterns.length,
        topPattern: patterns[0]?.name
      });

      return patterns;
    } catch (error) {
      logger.error('Failed to extract patterns', { error });
      throw new APIError('Failed to extract code patterns', 500);
    }
  }

  /**
   * Advanced RAG query with custom parameters
   */
  async queryWithParams(params: RAGQueryParams): Promise<SearchResult[]> {
    if (!this.enabled) {
      throw new APIError('CodeNet RAG is not enabled', 503);
    }

    try {
      const queryEmbedding = await this.embeddings.embedQuery(params.query);

      // Build filters
      const filters: any = { must: [] };

      if (params.language) {
        filters.must.push({ key: 'language', match: { value: params.language } });
      }

      if (params.filters?.complexity) {
        filters.must.push({
          key: 'metadata.complexity',
          match: { value: params.filters.complexity }
        });
      }

      if (params.filters?.minLineCount || params.filters?.maxLineCount) {
        const range: any = {};
        if (params.filters.minLineCount) range.gte = params.filters.minLineCount;
        if (params.filters.maxLineCount) range.lte = params.filters.maxLineCount;
        filters.must.push({ key: 'metadata.lineCount', range });
      }

      const results = await qdrantService.searchSimilar(
        queryEmbedding,
        params.limit || 5,
        filters
      );

      // Filter by minimum score if specified
      if (params.minScore) {
        return results.filter(r => r.score >= params.minScore!);
      }

      return results;
    } catch (error) {
      logger.error('Failed to query with params', { error, params });
      throw new APIError('Failed to execute RAG query', 500);
    }
  }

  /**
   * Build prompt for code generation
   */
  private buildCodeGenerationPrompt(
    task: string,
    language: ProgrammingLanguage,
    contextExamples: string,
    existingCode?: string
  ): string {
    const basePrompt = `You are an expert ${language} programmer. Generate clean, production-ready code for the following task.

Task: ${task}

Language: ${language}

${contextExamples ? `Here are similar high-quality code examples from successful submissions:\n\n${contextExamples}\n` : ''}

${existingCode ? `Existing code context:\n\`\`\`${language.toLowerCase()}\n${existingCode}\n\`\`\`\n` : ''}

Requirements:
1. Generate clean, readable ${language} code
2. Include proper error handling
3. Add helpful comments
4. Follow ${language} best practices
5. Ensure type safety (for TypeScript)
6. Write production-ready code

Generate ONLY the code, no explanations. Use markdown code blocks.`;

    return basePrompt;
  }

  /**
   * Clean generated code (remove markdown, etc.)
   */
  private cleanGeneratedCode(code: string): string {
    // Remove markdown code blocks
    let cleaned = code.replace(/```[\w]*\n/g, '').replace(/```$/g, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  /**
   * Extract unique patterns from examples
   */
  private extractPatternsFromExamples(examples: CodeExample[]): string[] {
    const patternsSet = new Set<string>();
    
    examples.forEach(example => {
      example.patterns.forEach(pattern => patternsSet.add(pattern));
    });
    
    return Array.from(patternsSet);
  }

  /**
   * Categorize pattern by name heuristics
   */
  private categorizePattern(patternName: string): any {
    const name = patternName.toLowerCase();
    
    if (name.includes('async') || name.includes('await') || name.includes('promise')) {
      return 'async-patterns';
    }
    if (name.includes('error') || name.includes('try') || name.includes('catch')) {
      return 'error-handling';
    }
    if (name.includes('test') || name.includes('mock')) {
      return 'testing';
    }
    if (name.includes('cache') || name.includes('optimize')) {
      return 'performance';
    }
    if (name.includes('auth') || name.includes('security')) {
      return 'security';
    }
    if (name.includes('array') || name.includes('map') || name.includes('set')) {
      return 'data-structures';
    }
    
    return 'architecture';
  }
}

// Export singleton instance
export const codenetRAGService = new CodeNetRAGService();

