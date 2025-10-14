#!/usr/bin/env ts-node

/**
 * Project CodeNet Dataset Downloader
 * 
 * Downloads and filters CodeNet dataset for RAG purposes.
 * Focuses on TypeScript, JavaScript, and Python submissions.
 * 
 * Usage:
 *   npm run codenet:download
 *   ts-node scripts/download-codenet.ts --limit 1000
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/config';
import logger from '../src/utils/logger';
import { ProgrammingLanguage, SubmissionStatus } from '../src/types/codenet.types';

interface DownloadOptions {
  limit: number;
  languages: ProgrammingLanguage[];
  status: SubmissionStatus;
  minLines: number;
  maxLines: number;
  outputDir: string;
}

const defaultOptions: DownloadOptions = {
  limit: parseInt(process.env.CODENET_MAX_EXAMPLES || '10000', 10),
  languages: ['TypeScript', 'JavaScript', 'Python'],
  status: 'Accepted',
  minLines: 50,
  maxLines: 500,
  outputDir: config.codenet.datasetPath
};

/**
 * CodeNet Downloader
 */
class CodeNetDownloader {
  private options: DownloadOptions;
  private metadataUrl = 'https://dax-cdn.cdn.appdomain.cloud/dax-project-codenet/1.0.0';

  constructor(options: DownloadOptions) {
    this.options = options;
  }

  /**
   * Main download process
   */
  async download(): Promise<void> {
    logger.info('Starting CodeNet dataset download', {
      limit: this.options.limit,
      languages: this.options.languages,
      status: this.options.status
    });

    try {
      // 1. Create directory structure
      await this.createDirectories();

      // 2. Download metadata
      logger.info('Downloading metadata from IBM DAX...');
      await this.downloadMetadata();

      // 3. Parse and filter metadata
      logger.info('Filtering submissions...');
      const filteredSubmissions = await this.filterSubmissions();

      logger.info(`Filtered to ${filteredSubmissions.length} submissions`);

      // 4. Download source files
      logger.info('Downloading source files...');
      await this.downloadSourceFiles(filteredSubmissions);

      logger.info('Download complete!', {
        totalDownloaded: filteredSubmissions.length
      });

    } catch (error) {
      logger.error('Download failed', { error });
      throw error;
    }
  }

  /**
   * Create directory structure
   */
  private async createDirectories(): Promise<void> {
    const dirs = [
      this.options.outputDir,
      path.join(this.options.outputDir, 'metadata'),
      path.join(this.options.outputDir, 'javascript'),
      path.join(this.options.outputDir, 'typescript'),
      path.join(this.options.outputDir, 'python'),
      path.join(this.options.outputDir, 'preprocessed')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Download metadata CSV files
   */
  private async downloadMetadata(): Promise<void> {
    // In real implementation, download from IBM DAX
    // For PoC, we'll create a mock metadata file
    
    logger.warn('Using mock metadata for PoC. In production, download from IBM DAX.');
    
    const mockMetadata = this.generateMockMetadata();
    const metadataPath = path.join(this.options.outputDir, 'metadata', 'submissions.csv');
    
    fs.writeFileSync(metadataPath, mockMetadata);
    logger.info(`Mock metadata saved to ${metadataPath}`);
  }

  /**
   * Generate mock metadata for testing
   */
  private generateMockMetadata(): string {
    const headers = 'submission_id,problem_id,user_id,submission_time,language,original_language,filename_ext,status,cpu_time,memory,code_size,accuracy\n';
    
    const languages = ['JavaScript', 'TypeScript', 'Python'];
    const problems = ['p00001', 'p00002', 'p00003', 'p00004', 'p00005'];
    
    let rows = headers;
    for (let i = 0; i < this.options.limit; i++) {
      const lang = languages[i % languages.length];
      const problem = problems[i % problems.length];
      const ext = lang === 'JavaScript' ? 'js' : lang === 'TypeScript' ? 'ts' : 'py';
      
      rows += `s${100000000 + i},${problem},u${200000000 + i},${Date.now()},${lang},${lang},${ext},Accepted,50,15000,${100 + i},4/4\n`;
    }
    
    return rows;
  }

  /**
   * Filter submissions based on criteria
   */
  private async filterSubmissions(): Promise<any[]> {
    const metadataPath = path.join(this.options.outputDir, 'metadata', 'submissions.csv');
    const content = fs.readFileSync(metadataPath, 'utf-8');
    
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    const submissions = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        submissionId: values[0],
        problemId: values[1],
        userId: values[2],
        submissionTime: values[3],
        language: values[4],
        originalLanguage: values[5],
        filenameExt: values[6],
        status: values[7],
        cpuTime: parseInt(values[8], 10),
        memory: parseInt(values[9], 10),
        codeSize: parseInt(values[10], 10),
        accuracy: values[11]
      };
    });

    // Filter by criteria
    return submissions.filter(sub => {
      // Language filter
      if (!this.options.languages.includes(sub.language as ProgrammingLanguage)) {
        return false;
      }

      // Status filter
      if (sub.status !== this.options.status) {
        return false;
      }

      // Code size filter (approximate lines)
      const estimatedLines = Math.floor(sub.codeSize / 50);
      if (estimatedLines < this.options.minLines || estimatedLines > this.options.maxLines) {
        return false;
      }

      return true;
    }).slice(0, this.options.limit);
  }

  /**
   * Download source files
   */
  private async downloadSourceFiles(submissions: any[]): Promise<void> {
    let downloaded = 0;
    
    for (const submission of submissions) {
      try {
        await this.downloadSourceFile(submission);
        downloaded++;
        
        if (downloaded % 100 === 0) {
          logger.info(`Downloaded ${downloaded}/${submissions.length} files`);
        }
      } catch (error) {
        logger.warn(`Failed to download ${submission.submissionId}`, { error });
      }
    }
    
    logger.info(`Downloaded ${downloaded} source files successfully`);
  }

  /**
   * Download single source file
   */
  private async downloadSourceFile(submission: any): Promise<void> {
    // In real implementation, download from IBM DAX
    // For PoC, generate mock source files
    
    const mockCode = this.generateMockSourceCode(submission.language, submission.problemId);
    
    const langDir = submission.language.toLowerCase();
    const filename = `${submission.submissionId}.${submission.filenameExt}`;
    const filepath = path.join(this.options.outputDir, langDir, filename);
    
    fs.writeFileSync(filepath, mockCode);
  }

  /**
   * Generate mock source code for testing
   */
  private generateMockSourceCode(language: string, problemId: string): string {
    if (language === 'TypeScript') {
      return `// Solution for ${problemId}
interface Solution {
  solve(input: string): string;
}

class ProblemSolver implements Solution {
  solve(input: string): string {
    // Implementation with async/await pattern
    const processData = async (data: string): Promise<string> => {
      try {
        const result = await this.processAsync(data);
        return result.trim();
      } catch (error) {
        console.error('Processing error:', error);
        throw error;
      }
    };

    return processData(input).toString();
  }

  private async processAsync(data: string): Promise<string> {
    // Simulated async processing
    return new Promise(resolve => {
      setTimeout(() => resolve(data.toUpperCase()), 100);
    });
  }
}

export default new ProblemSolver();
`;
    } else if (language === 'JavaScript') {
      return `// Solution for ${problemId}
function solve(input) {
  // Error handling pattern
  try {
    const data = parseInput(input);
    const result = processData(data);
    return formatOutput(result);
  } catch (error) {
    console.error('Solving error:', error);
    throw error;
  }
}

function parseInput(input) {
  return input.split('\\n').map(line => line.trim());
}

function processData(data) {
  // Array manipulation pattern
  return data
    .filter(item => item.length > 0)
    .map(item => item.toUpperCase())
    .reduce((acc, val) => acc + val, '');
}

function formatOutput(result) {
  return result.trim();
}

module.exports = { solve };
`;
    } else { // Python
      return `# Solution for ${problemId}
from typing import List, Optional

class ProblemSolver:
    """Solver for CodeNet problem"""
    
    def __init__(self):
        self.cache = {}
    
    def solve(self, input_data: str) -> str:
        """Main solving function with error handling"""
        try:
            data = self.parse_input(input_data)
            result = self.process_data(data)
            return self.format_output(result)
        except Exception as e:
            print(f"Error solving: {e}")
            raise
    
    def parse_input(self, input_data: str) -> List[str]:
        """Parse input with list comprehension pattern"""
        return [line.strip() for line in input_data.split('\\n') if line.strip()]
    
    def process_data(self, data: List[str]) -> str:
        """Process data with functional patterns"""
        result = ''.join(
            item.upper() 
            for item in data 
            if len(item) > 0
        )
        return result
    
    def format_output(self, result: str) -> str:
        """Format output"""
        return result.strip()

if __name__ == '__main__':
    solver = ProblemSolver()
    result = solver.solve(input())
    print(result)
`;
    }
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = { ...defaultOptions };

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--limit':
        options.limit = parseInt(value, 10);
        break;
      case '--output':
        options.outputDir = value;
        break;
    }
  }

  const downloader = new CodeNetDownloader(options);
  await downloader.download();
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Download script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Download script failed', { error });
      process.exit(1);
    });
}

export { CodeNetDownloader, DownloadOptions };

