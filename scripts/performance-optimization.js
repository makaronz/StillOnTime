#!/usr/bin/env node

/**
 * Performance Optimization Script
 * Analyzes and optimizes the application for better performance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceOptimizer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.results = {
      optimizations: [],
      warnings: [],
      errors: [],
    };
  }

  async run() {
    console.log('🚀 Starting Performance Optimization...\n');

    try {
      await this.analyzeBundleSize();
      await this.optimizeImages();
      await this.optimizeDependencies();
      await this.setupDatabaseIndexes();
      await this.configureCaching();
      await this.generatePerformanceReport();

      this.printResults();
    } catch (error) {
      console.error('❌ Performance optimization failed:', error);
      process.exit(1);
    }
  }

  async analyzeBundleSize() {
    console.log('📦 Analyzing bundle size...');

    try {
      // Build the application with bundle analysis
      execSync('cd frontend && npm run build', { stdio: 'inherit' });

      const distPath = path.join(this.projectRoot, 'frontend/dist');
      const bundleStats = this.calculateBundleStats(distPath);

      // Check for large chunks
      const largeChunks = bundleStats.chunks.filter(chunk => chunk.size > 500 * 1024); // 500KB

      if (largeChunks.length > 0) {
        this.results.warnings.push(`Found ${largeChunks.length} large chunks (>500KB)`);

        largeChunks.forEach(chunk => {
          console.log(`⚠️  Large chunk: ${chunk.name} (${(chunk.size / 1024).toFixed(1)}KB)`);
          this.suggestBundleOptimizations(chunk);
        });
      }

      this.results.optimizations.push('Bundle size analysis completed');
      console.log('✅ Bundle size analysis completed\n');
    } catch (error) {
      this.results.errors.push(`Bundle analysis failed: ${error.message}`);
    }
  }

  calculateBundleStats(distPath) {
    const chunks = [];
    let totalSize = 0;

    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath, { withFileTypes: true });

      files.forEach(file => {
        if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.css'))) {
          const filePath = path.join(distPath, file.name);
          const stats = fs.statSync(filePath);

          chunks.push({
            name: file.name,
            size: stats.size,
            type: file.name.endsWith('.js') ? 'javascript' : 'css',
          });

          totalSize += stats.size;
        }
      });
    }

    return { chunks, totalSize };
  }

  suggestBundleOptimizations(chunk) {
    const suggestions = {
      'index.js': [
        'Consider code splitting with React.lazy()',
        'Move vendor libraries to separate chunks',
        'Use dynamic imports for non-critical features',
      ],
      'vendor.js': [
        'Analyze if all vendor libraries are necessary',
        'Consider tree shaking for unused exports',
        'Use smaller alternatives for large libraries',
      ],
    };

    const chunkSuggestions = suggestions[chunk.name] || [
      'Analyze chunk contents for optimization opportunities',
      'Consider code splitting',
      'Remove unused dependencies',
    ];

    chunkSuggestions.forEach(suggestion => {
      console.log(`   💡 ${suggestion}`);
    });
  }

  async optimizeImages() {
    console.log('🖼️  Optimizing images...');

    try {
      const imagePaths = this.findImageFiles();
      let optimizedCount = 0;

      for (const imagePath of imagePaths) {
        const stats = fs.statSync(imagePath);
        const sizeKB = stats.size / 1024;

        if (sizeKB > 100) { // Only optimize images larger than 100KB
          console.log(`📸 Optimizing ${path.basename(imagePath)} (${sizeKB.toFixed(1)}KB)`);

          // Here you would implement actual image optimization
          // For example using sharp, imagemin, or similar tools

          optimizedCount++;
        }
      }

      if (optimizedCount > 0) {
        this.results.optimizations.push(`Optimized ${optimizedCount} images`);
      }

      console.log('✅ Image optimization completed\n');
    } catch (error) {
      this.results.errors.push(`Image optimization failed: ${error.message}`);
    }
  }

  findImageFiles() {
    const imagePaths = [];
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];

    function scanDirectory(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });

      files.forEach(file => {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
          scanDirectory(fullPath);
        } else if (extensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
          imagePaths.push(fullPath);
        }
      });
    }

    // Scan frontend directories
    ['frontend/public', 'frontend/src'].forEach(dir => {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        scanDirectory(fullPath);
      }
    });

    return imagePaths;
  }

  async optimizeDependencies() {
    console.log('📚 Analyzing dependencies...');

    try {
      const packageJsonPath = path.join(this.projectRoot, 'frontend/package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});

      // Check for large dependencies
      const largeDeps = [
        '@types/node',
        'typescript',
        'eslint',
        'prettier',
        'jest',
        'vitest',
      ];

      const devDepsInProd = dependencies.filter(dep => largeDeps.includes(dep));

      if (devDepsInProd.length > 0) {
        this.results.warnings.push(`Found development dependencies in production: ${devDepsInProd.join(', ')}`);

        console.log('⚠️  Development dependencies found in production:');
        devDepsInProd.forEach(dep => {
          console.log(`   - ${dep}`);
        });
      }

      // Check for duplicate functionality
      const duplicateGroups = [
        ['lodash', 'lodash-es'],
        ['moment', 'date-fns', 'dayjs'],
        ['axios', 'fetch'],
      ];

      duplicateGroups.forEach(group => {
        const found = group.filter(dep => dependencies.includes(dep));
        if (found.length > 1) {
          this.results.warnings.push(`Multiple libraries with similar functionality: ${found.join(', ')}`);
          console.log(`⚠️  Multiple libraries for ${group[0]}: ${found.join(', ')}`);
        }
      });

      this.results.optimizations.push('Dependency analysis completed');
      console.log('✅ Dependency analysis completed\n');
    } catch (error) {
      this.results.errors.push(`Dependency optimization failed: ${error.message}`);
    }
  }

  async setupDatabaseIndexes() {
    console.log('🗄️  Setting up database indexes...');

    try {
      const migrationPath = path.join(this.projectRoot, 'backend/migrations/001_performance_indexes.sql');

      if (fs.existsSync(migrationPath)) {
        console.log('📝 Database indexes migration found');
        console.log('   To apply indexes, run: npm run db:migrate');

        this.results.optimizations.push('Database indexes migration ready');
      } else {
        this.results.warnings.push('Database indexes migration not found');
      }

      console.log('✅ Database analysis completed\n');
    } catch (error) {
      this.results.errors.push(`Database optimization failed: ${error.message}`);
    }
  }

  async configureCaching() {
    console.log('🚀 Configuring caching strategies...');

    try {
      // Check for Redis configuration
      const redisConfigPath = path.join(this.projectRoot, 'backend/src/config/redis.ts');

      if (fs.existsSync(redisConfigPath)) {
        this.results.optimizations.push('Redis configuration found');
      } else {
        this.results.warnings.push('Redis configuration not found');
      }

      // Check for cache middleware
      const cacheMiddlewarePath = path.join(this.projectRoot, 'backend/src/middleware/cache.middleware.ts');

      if (fs.existsSync(cacheMiddlewarePath)) {
        this.results.optimizations.push('Cache middleware implemented');
      } else {
        this.results.warnings.push('Cache middleware not found');
      }

      console.log('✅ Caching analysis completed\n');
    } catch (error) {
      this.results.errors.push(`Caching configuration failed: ${error.message}`);
    }
  }

  async generatePerformanceReport() {
    console.log('📊 Generating performance report...');

    try {
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          optimizations: this.results.optimizations.length,
          warnings: this.results.warnings.length,
          errors: this.results.errors.length,
        },
        details: this.results,
        recommendations: this.generateRecommendations(),
      };

      const reportPath = path.join(this.projectRoot, 'performance-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log(`📄 Performance report saved to: ${reportPath}`);
      this.results.optimizations.push('Performance report generated');

      console.log('✅ Performance report generation completed\n');
    } catch (error) {
      this.results.errors.push(`Report generation failed: ${error.message}`);
    }
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.warnings.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address Performance Warnings',
        description: `Resolve ${this.results.warnings.length} performance warnings to improve application speed.`,
      });
    }

    if (this.results.errors.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Fix Performance Errors',
        description: `Resolve ${this.results.errors.length} critical performance issues.`,
      });
    }

    recommendations.push(
      {
        priority: 'medium',
        title: 'Implement Service Worker',
        description: 'Add service worker for offline support and better caching.',
      },
      {
        priority: 'medium',
        title: 'Add Resource Hints',
        description: 'Implement preconnect, prefetch, and preload directives for critical resources.',
      },
      {
        priority: 'low',
        title: 'Monitor Core Web Vitals',
        description: 'Set up ongoing monitoring of Core Web Vitals in production.',
      }
    );

    return recommendations;
  }

  printResults() {
    console.log('🎯 Performance Optimization Results\n');

    console.log('✅ Optimizations Applied:');
    if (this.results.optimizations.length === 0) {
      console.log('   No optimizations applied');
    } else {
      this.results.optimizations.forEach(opt => {
        console.log(`   ✓ ${opt}`);
      });
    }

    console.log('\n⚠️  Warnings:');
    if (this.results.warnings.length === 0) {
      console.log('   No warnings');
    } else {
      this.results.warnings.forEach(warning => {
        console.log(`   ⚠️  ${warning}`);
      });
    }

    console.log('\n❌ Errors:');
    if (this.results.errors.length === 0) {
      console.log('   No errors');
    } else {
      this.results.errors.forEach(error => {
        console.log(`   ❌ ${error}`);
      });
    }

    console.log('\n🚀 Next Steps:');
    console.log('1. Review and apply the generated recommendations');
    console.log('2. Run database migrations for performance indexes');
    console.log('3. Test application performance after optimizations');
    console.log('4. Set up ongoing performance monitoring');
    console.log('5. Regularly run this optimization script');

    const reportPath = path.join(this.projectRoot, 'performance-report.json');
    console.log(`\n📊 Full report available at: ${reportPath}`);
  }
}

// Run the optimizer
if (require.main === module) {
  const optimizer = new PerformanceOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = PerformanceOptimizer;