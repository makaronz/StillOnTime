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
  private baseUrl = 'https://dax-cdn.cdn.appdomain.cloud/dax-project-codenet/1.0.0';
  private dataUrl = 'https://dax-cdn.cdn.appdomain.cloud/dax-project-codenet/1.0.0/data';
  private metadataUrl = 'https://dax-cdn.cdn.appdomain.cloud/dax-project-codenet/1.0.0/metadata';

  constructor(options: DownloadOptions) {
    this.options = options;
  }

  /**
   * Main download process
   */
  async download(): Promise<void> {
    logger.info('Starting CodeNet dataset download from IBM DAX', {
      limit: this.options.limit,
      languages: this.options.languages,
      status: this.options.status,
      baseUrl: this.baseUrl
    });

    try {
      // 1. Create directory structure
      await this.createDirectories();

      // 2. Download problem list
      logger.info('Downloading problem list from IBM DAX...');
      const problems = await this.downloadProblemList();
      logger.info(`Found ${problems.length} problems in CodeNet`);

      // 3. Download metadata for selected problems
      logger.info('Downloading problem metadata...');
      const problemsToProcess = problems.slice(0, Math.min(100, problems.length)); // Start with first 100 problems
      const allSubmissions = await this.downloadProblemMetadata(problemsToProcess);

      // 4. Filter submissions
      logger.info('Filtering submissions...');
      const filteredSubmissions = this.filterSubmissionsData(allSubmissions);
      logger.info(`Filtered to ${filteredSubmissions.length} submissions from ${allSubmissions.length} total`);

      // Limit to requested amount
      const submissionsToDownload = filteredSubmissions.slice(0, this.options.limit);
      logger.info(`Will download ${submissionsToDownload.length} source files`);

      // 5. Download source files
      logger.info('Downloading source files from IBM DAX...');
      await this.downloadSourceFilesFromDAX(submissionsToDownload);

      logger.info('Download complete!', {
        totalDownloaded: submissionsToDownload.length,
        totalFiltered: filteredSubmissions.length,
        totalProcessed: allSubmissions.length
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
   * Download problem list from IBM DAX
   */
  private async downloadProblemList(): Promise<string[]> {
    try {
      const url = `${this.metadataUrl}/problem_list.csv`;
      logger.info(`Downloading problem list from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 30000,
        responseType: 'text'
      });

      const lines = response.data.split('\n').filter((line: string) => line.trim());
      const problems = lines.slice(1).map((line: string) => line.split(',')[0]); // First column is problem_id

      return problems.filter((p: string) => p.startsWith('p'));
    } catch (error) {
      logger.error('Failed to download problem list', { error });
      throw new Error('Failed to download problem list from IBM DAX');
    }
  }

  /**
   * Download metadata for multiple problems
   */
  private async downloadProblemMetadata(problems: string[]): Promise<any[]> {
    const allSubmissions: any[] = [];
    let processedCount = 0;

    for (const problemId of problems) {
      try {
        const url = `${this.metadataUrl}/${problemId}.csv`;
        logger.debug(`Downloading metadata for ${problemId}...`);

        const response = await axios.get(url, {
          timeout: 30000,
          responseType: 'text'
        });

        const submissions = this.parseMetadataCSV(response.data, problemId);
        allSubmissions.push(...submissions);
        
        processedCount++;
        if (processedCount % 10 === 0) {
          logger.info(`Downloaded metadata for ${processedCount}/${problems.length} problems`);
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.warn(`Failed to download metadata for ${problemId}`, { error });
        // Continue with other problems
      }
    }

    logger.info(`Downloaded metadata for ${processedCount} problems, found ${allSubmissions.length} submissions`);
    return allSubmissions;
  }

  /**
   * Parse metadata CSV content
   */
  private parseMetadataCSV(csvContent: string, problemId: string): any[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const submissions = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;

      const submission: any = {
        problemId,
        submissionId: values[0],
        userId: values[1],
        submissionTime: values[2],
        language: values[3],
        originalLanguage: values[4],
        filenameExt: values[5],
        status: values[6],
        cpuTime: parseInt(values[7], 10) || 0,
        memory: parseInt(values[8], 10) || 0,
        codeSize: parseInt(values[9], 10) || 0,
        accuracy: values[10] || ''
      };

      submissions.push(submission);
    }

    return submissions;
  }

  /**
   * Filter submissions based on criteria
   */
  private filterSubmissionsData(submissions: any[]): any[] {
    // Language mapping from CodeNet to our target languages
    const languageMap: Record<string, ProgrammingLanguage> = {
      'JavaScript': 'JavaScript',
      'JavaScript (Node.js)': 'JavaScript',
      'Node.js': 'JavaScript',
      'TypeScript': 'TypeScript',
      'Python': 'Python',
      'Python3': 'Python',
      'Python2': 'Python',
      'PyPy3': 'Python',
      'PyPy2': 'Python'
    };

    const filtered = submissions.filter(sub => {
      // Language filter - map to our target languages
      const mappedLanguage = languageMap[sub.language];
      if (!mappedLanguage || !this.options.languages.includes(mappedLanguage)) {
        return false;
      }

      // Status filter - only "Accepted" submissions
      if (sub.status !== this.options.status) {
        return false;
      }

      // Code size filter (approximate lines: ~50 chars per line)
      const estimatedLines = Math.floor(sub.codeSize / 50);
      if (estimatedLines < this.options.minLines || estimatedLines > this.options.maxLines) {
        return false;
      }

      // Quality filter - skip very small or very large files
      if (sub.codeSize < 100 || sub.codeSize > 25000) {
        return false;
      }

      return true;
    });

    // Sort by code size (prefer mid-range complexity)
    filtered.sort((a, b) => {
      const aDistance = Math.abs(a.codeSize - 5000);
      const bDistance = Math.abs(b.codeSize - 5000);
      return aDistance - bDistance;
    });

    return filtered;
  }

  /**
   * Download source files from IBM DAX
   */
  private async downloadSourceFilesFromDAX(submissions: any[]): Promise<void> {
    let downloaded = 0;
    let failed = 0;

    for (const submission of submissions) {
      try {
        await this.downloadSourceFileFromDAX(submission);
        downloaded++;

        if (downloaded % 50 === 0) {
          logger.info(`Downloaded ${downloaded}/${submissions.length} files (${failed} failed)`);
        }

        // Rate limiting - wait 200ms between downloads
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        failed++;
        logger.warn(`Failed to download ${submission.submissionId}`, { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.info(`Download complete: ${downloaded} successful, ${failed} failed`);
  }

  /**
   * Download single source file from IBM DAX
   */
  private async downloadSourceFileFromDAX(submission: any): Promise<void> {
    const problemId = submission.problemId;
    const language = submission.language;
    const submissionId = submission.submissionId;
    
    // IBM DAX URL structure: /data/{problem_id}/{language}/{submission_id}.{ext}
    const url = `${this.dataUrl}/${problemId}/${language}/${submissionId}.${submission.filenameExt}`;

    try {
      logger.debug(`Downloading: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        responseType: 'text'
      });

      const sourceCode = response.data;

      // Map language to our directory structure
      const languageMap: Record<string, string> = {
        'JavaScript': 'javascript',
        'JavaScript (Node.js)': 'javascript',
        'Node.js': 'javascript',
        'TypeScript': 'typescript',
        'Python': 'python',
        'Python3': 'python',
        'Python2': 'python',
        'PyPy3': 'python',
        'PyPy2': 'python'
      };

      const langDir = languageMap[language] || language.toLowerCase();
      const filename = `${submissionId}.${submission.filenameExt}`;
      const filepath = path.join(this.options.outputDir, langDir, filename);

      // Save to file
      fs.writeFileSync(filepath, sourceCode);

      // Save metadata
      const metadataPath = path.join(this.options.outputDir, 'metadata', `${submissionId}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(submission, null, 2));

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Source file not found: ${url}`);
        } else if (error.code === 'ECONNABORTED') {
          throw new Error(`Download timeout: ${url}`);
        }
      }
      throw error;
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

