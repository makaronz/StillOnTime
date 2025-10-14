/**
 * TypeScript types for Project CodeNet RAG integration
 */

export type ProgrammingLanguage = 'TypeScript' | 'JavaScript' | 'Python';
export type ComplexityLevel = 'low' | 'medium' | 'high';
export type SubmissionStatus = 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Memory Limit Exceeded' | 'Compile Error' | 'Runtime Error';

/**
 * Document structure for storage in Qdrant
 */
export interface CodeNetDocument {
  id: string; // submission_id (e.g., s300682070)
  problemId: string; // problem_id (e.g., p00001)
  language: ProgrammingLanguage;
  sourceCode: string;
  embeddings?: number[]; // 1536-dim vector from OpenAI
  metadata: CodeMetadata;
  qualityScore: number; // 0-1 score based on heuristics
}

/**
 * Metadata for code examples
 */
export interface CodeMetadata {
  problemName: string;
  complexity: ComplexityLevel;
  lineCount: number;
  patterns: string[]; // e.g., ['async-await', 'error-handling', 'recursion']
  concepts: string[]; // e.g., ['dynamic-programming', 'graph-traversal']
  imports: string[]; // Imported libraries/modules
  functions: string[]; // Function names extracted
  hasComments: boolean;
  commentDensity: number; // Ratio of comment lines to code lines
}

/**
 * Filter criteria for dataset download
 */
export interface CodeNetFilter {
  languages: ProgrammingLanguage[];
  status: SubmissionStatus;
  lineCountMin: number;
  lineCountMax: number;
  minQualityScore: number;
  excludeObfuscated: boolean;
  maxPerProblem: number; // Max submissions to keep per problem
}

/**
 * Search result from Qdrant
 */
export interface SearchResult {
  id: string;
  score: number; // Similarity score (0-1)
  document: CodeNetDocument;
}

/**
 * Code example for RAG retrieval
 */
export interface CodeExample {
  problemName: string;
  language: ProgrammingLanguage;
  sourceCode: string;
  relevanceScore: number;
  patterns: string[];
  concepts: string[];
}

/**
 * Generated code with context
 */
export interface GeneratedCode {
  code: string;
  language: ProgrammingLanguage;
  explanation: string;
  examplesUsed: number;
  patterns: string[];
  confidence: number;
}

/**
 * Code pattern extracted from analysis
 */
export interface CodePattern {
  name: string;
  category: PatternCategory;
  description: string;
  frequency: number; // How often it appears in dataset
  examples: string[]; // Code snippets demonstrating pattern
  languages: ProgrammingLanguage[];
  complexity: ComplexityLevel;
  useCases: string[];
}

export type PatternCategory = 
  | 'architecture'
  | 'error-handling'
  | 'async-patterns'
  | 'data-structures'
  | 'algorithms'
  | 'testing'
  | 'performance'
  | 'security';

/**
 * Dataset statistics
 */
export interface DatasetStats {
  totalDocuments: number;
  byLanguage: Record<ProgrammingLanguage, number>;
  byComplexity: Record<ComplexityLevel, number>;
  averageQualityScore: number;
  topPatterns: Array<{ pattern: string; count: number }>;
  topConcepts: Array<{ concept: string; count: number }>;
}

/**
 * RAG query parameters
 */
export interface RAGQueryParams {
  query: string;
  language?: ProgrammingLanguage;
  limit?: number;
  minScore?: number;
  filters?: {
    complexity?: ComplexityLevel;
    patterns?: string[];
    concepts?: string[];
    minLineCount?: number;
    maxLineCount?: number;
  };
}

/**
 * Preprocessing result
 */
export interface PreprocessingResult {
  document: CodeNetDocument;
  success: boolean;
  errors?: string[];
  processingTime: number; // milliseconds
}

/**
 * Batch ingestion progress
 */
export interface IngestionProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining: number; // seconds
}

/**
 * Qdrant filter for searches
 */
export interface QdrantFilter {
  must?: Array<{
    key: string;
    match?: { value: string | number | boolean };
    range?: { gte?: number; lte?: number };
  }>;
  should?: Array<{
    key: string;
    match?: { value: string | number | boolean };
  }>;
}

/**
 * Problem metadata from CodeNet CSV
 */
export interface ProblemMetadata {
  problemId: string;
  name: string;
  timeLimit: number;
  memoryLimit: number;
  rating?: number;
  tags?: string[];
}

/**
 * Submission metadata from CodeNet CSV
 */
export interface SubmissionMetadata {
  submissionId: string;
  problemId: string;
  userId: string;
  submissionTime: number;
  language: string;
  originalLanguage: string;
  filenameExt: string;
  status: SubmissionStatus;
  cpuTime: number;
  memory: number;
  codeSize: number;
  accuracy?: string;
}

