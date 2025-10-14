#!/usr/bin/env ts-node

/**
 * System Patterns Generator
 * 
 * Analyzes CodeNet submissions to extract patterns and generate
 * systemPatterns.md documentation.
 * 
 * Usage:
 *   npm run codenet:patterns
 */

import fs from 'fs';
import path from 'path';
import { config } from '../src/config/config';
import logger from '../src/utils/logger';
import { CodeNetDocument, CodePattern } from '../src/types/codenet.types';

class SystemPatternsGenerator {
  private inputDir: string;
  private outputFile: string;

  constructor(inputDir: string, outputFile: string) {
    this.inputDir = path.join(inputDir, 'preprocessed');
    this.outputFile = outputFile;
  }

  /**
   * Analyze documents and generate patterns
   */
  async generate(): Promise<void> {
    logger.info('Generating system patterns documentation...');

    try {
      // 1. Load documents
      const documents = await this.loadDocuments();
      logger.info(`Analyzing ${documents.length} documents`);

      // 2. Extract patterns
      const patterns = this.extractPatterns(documents);
      logger.info(`Extracted ${patterns.length} patterns`);

      // 3. Generate markdown
      const markdown = this.generateMarkdown(patterns, documents);

      // 4. Write to file
      fs.writeFileSync(this.outputFile, markdown);
      logger.info(`Patterns documentation written to ${this.outputFile}`);

    } catch (error) {
      logger.error('Pattern generation failed', { error });
      throw error;
    }
  }

  /**
   * Load preprocessed documents
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
        logger.warn(`Failed to load ${file}`);
      }
    }

    return documents.slice(0, 1000); // Analyze top 1000
  }

  /**
   * Extract patterns from documents
   */
  private extractPatterns(documents: CodeNetDocument[]): CodePattern[] {
    const patternMap = new Map<string, { count: number; examples: string[] }>();

    // Count pattern frequency
    documents.forEach(doc => {
      doc.metadata.patterns.forEach(pattern => {
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, { count: 0, examples: [] });
        }

        const entry = patternMap.get(pattern)!;
        entry.count++;
        
        if (entry.examples.length < 3) {
          entry.examples.push(doc.sourceCode.substring(0, 200));
        }
      });
    });

    // Convert to CodePattern objects
    const patterns: CodePattern[] = Array.from(patternMap.entries())
      .map(([name, data]) => ({
        name,
        category: this.categorizePattern(name),
        description: `Found in ${data.count} submissions (${((data.count / documents.length) * 100).toFixed(1)}%)`,
        frequency: data.count,
        examples: data.examples,
        languages: ['TypeScript', 'JavaScript', 'Python'] as any,
        complexity: 'medium' as const,
        useCases: this.generateUseCases(name)
      }))
      .sort((a, b) => b.frequency - a.frequency);

    return patterns;
  }

  /**
   * Generate markdown documentation
   */
  private generateMarkdown(patterns: CodePattern[], documents: CodeNetDocument[]): string {
    const totalDocs = documents.length;
    const byLanguage = this.groupByLanguage(documents);
    const byComplexity = this.groupByComplexity(documents);

    return `# System Patterns (from CodeNet Analysis)

**Generated**: ${new Date().toISOString()}
**Source**: Project CodeNet Dataset
**Documents Analyzed**: ${totalDocs}

## Dataset Statistics

### By Language
${Object.entries(byLanguage).map(([lang, count]) => 
  `- **${lang}**: ${count} submissions (${((count / totalDocs) * 100).toFixed(1)}%)`
).join('\n')}

### By Complexity
${Object.entries(byComplexity).map(([complexity, count]) => 
  `- **${complexity}**: ${count} submissions (${((count / totalDocs) * 100).toFixed(1)}%)`
).join('\n')}

## Top Patterns

${patterns.slice(0, 20).map((pattern, idx) => `
### ${idx + 1}. ${pattern.name}

**Category**: ${pattern.category}
**Frequency**: ${pattern.frequency} occurrences (${((pattern.frequency / totalDocs) * 100).toFixed(1)}%)
**Description**: ${pattern.description}

**Use Cases**:
${pattern.useCases.map(uc => `- ${uc}`).join('\n')}

**Example**:
\`\`\`
${pattern.examples[0] || 'No example available'}
\`\`\`
`).join('\n---\n')}

## Pattern Categories

${this.generateCategorySummary(patterns)}

---

**Note**: This documentation was automatically generated from CodeNet dataset analysis.
Update frequency: Weekly
`;
  }

  /**
   * Group documents by language
   */
  private groupByLanguage(documents: CodeNetDocument[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    documents.forEach(doc => {
      groups[doc.language] = (groups[doc.language] || 0) + 1;
    });

    return groups;
  }

  /**
   * Group documents by complexity
   */
  private groupByComplexity(documents: CodeNetDocument[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    documents.forEach(doc => {
      const complexity = doc.metadata.complexity;
      groups[complexity] = (groups[complexity] || 0) + 1;
    });

    return groups;
  }

  /**
   * Generate category summary
   */
  private generateCategorySummary(patterns: CodePattern[]): string {
    const categories = new Map<string, number>();
    
    patterns.forEach(p => {
      categories.set(p.category, (categories.get(p.category) || 0) + 1);
    });

    return Array.from(categories.entries())
      .map(([category, count]) => `- **${category}**: ${count} patterns`)
      .join('\n');
  }

  /**
   * Categorize pattern
   */
  private categorizePattern(name: string): any {
    const lower = name.toLowerCase();
    
    if (lower.includes('async') || lower.includes('promise')) return 'async-patterns';
    if (lower.includes('error') || lower.includes('try')) return 'error-handling';
    if (lower.includes('test')) return 'testing';
    if (lower.includes('cache') || lower.includes('optim')) return 'performance';
    if (lower.includes('auth') || lower.includes('security')) return 'security';
    if (lower.includes('array') || lower.includes('map')) return 'data-structures';
    
    return 'architecture';
  }

  /**
   * Generate use cases for pattern
   */
  private generateUseCases(patternName: string): string[] {
    const useCases: string[] = [];

    if (patternName.includes('async')) {
      useCases.push('API calls and external service integration');
      useCases.push('Database operations');
      useCases.push('File I/O operations');
    } else if (patternName.includes('error')) {
      useCases.push('Robust error handling in production code');
      useCases.push('Graceful degradation of services');
      useCases.push('User-friendly error messages');
    } else if (patternName.includes('functional')) {
      useCases.push('Data transformation pipelines');
      useCases.push('Array/collection operations');
      useCases.push('Immutable data manipulation');
    } else {
      useCases.push('General-purpose programming');
      useCases.push('Code organization');
    }

    return useCases;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const inputDir = config.codenet.datasetPath;
  const outputFile = path.join(
    __dirname,
    '../../coordination/orchestration/systemPatterns.md'
  );

  // Create directory if it doesn't exist
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const generator = new SystemPatternsGenerator(inputDir, outputFile);
  await generator.generate();
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Pattern generation script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Pattern generation script failed', { error });
      process.exit(1);
    });
}

export { SystemPatternsGenerator };

