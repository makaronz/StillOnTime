#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');

// Performance budgets (in bytes)
const BUDGETS = {
  js: parseInt(process.env.BUDGET_JS) || 500000,  // 500KB
  css: parseInt(process.env.BUDGET_CSS) || 50000,  // 50KB
  images: parseInt(process.env.BUDGET_IMAGES) || 300000, // 300KB
  total: parseInt(process.env.BUDGET_TOTAL) || 1000000, // 1MB
};

// Read bundle stats
const statsPath = path.join(process.env.PERFORMANCE_RESULTS_DIR || './performance-results', 'bundle-stats.json');
const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, 'utf8')) : {};

// Analyze bundle sizes
function analyzeBundleSize(stats) {
  const analysis = {
    total: 0,
    chunks: [],
    assets: [],
    warnings: [],
    recommendations: []
  };

  if (stats.chunks) {
    stats.chunks.forEach(chunk => {
      const size = chunk.size || 0;
      analysis.total += size;

      analysis.chunks.push({
        name: chunk.id || chunk.names?.[0] || 'unknown',
        size: size,
        sizeFormatted: formatBytes(size),
        type: getChunkType(chunk)
      });

      // Check against budgets
      if (chunk.names?.[0]?.includes('.js') && size > BUDGETS.js) {
        analysis.warnings.push(`JavaScript chunk ${chunk.names[0]} exceeds budget: ${formatBytes(size)} > ${formatBytes(BUDGETS.js)}`);
        analysis.recommendations.push(`Consider code splitting or lazy loading for ${chunk.names[0]}`);
      }

      if (chunk.names?.[0]?.includes('.css') && size > BUDGETS.css) {
        analysis.warnings.push(`CSS chunk ${chunk.names[0]} exceeds budget: ${formatBytes(size)} > ${formatBytes(BUDGETS.css)}`);
        analysis.recommendations.push(`Consider purging unused CSS or critical CSS for ${chunk.names[0]}`);
      }
    });
  }

  if (stats.assets) {
    stats.assets.forEach(asset => {
      const size = asset.size || 0;

      analysis.assets.push({
        name: asset.name,
        size: size,
        sizeFormatted: formatBytes(size),
        type: getAssetType(asset.name)
      });

      if (isImageAsset(asset.name) && size > BUDGETS.images) {
        analysis.warnings.push(`Image ${asset.name} exceeds budget: ${formatBytes(size)} > ${formatBytes(BUDGETS.images)}`);
        analysis.recommendations.push(`Consider optimizing ${asset.name} with compression or format conversion`);
      }
    });
  }

  // Check total budget
  if (analysis.total > BUDGETS.total) {
    analysis.warnings.push(`Total bundle size exceeds budget: ${formatBytes(analysis.total)} > ${formatBytes(BUDGETS.total)}`);
    analysis.recommendations.push('Consider overall bundle optimization techniques');
  }

  return analysis;
}

// Helper functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getChunkType(chunk) {
  if (chunk.names?.[0]?.includes('.js')) return 'javascript';
  if (chunk.names?.[0]?.includes('.css')) return 'css';
  if (chunk.names?.[0]?.includes('.map')) return 'sourcemap';
  return 'unknown';
}

function getAssetType(filename) {
  const ext = path.extname(filename);
  switch (ext) {
    case '.js': return 'javascript';
    case '.css': return 'css';
    case '.png': case '.jpg': case '.jpeg': case '.gif': case '.svg': case '.webp': return 'image';
    case '.woff': case '.woff2': case '.ttf': case '.eot': return 'font';
    default: return 'other';
  }
}

function isImageAsset(filename) {
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  return imageExts.includes(path.extname(filename));
}

// Generate analysis report
function generateReport(analysis) {
  const report = [
    '# 📦 Bundle Size Analysis',
    '',
    `**Total Bundle Size**: ${formatBytes(analysis.total)} of ${formatBytes(BUDGETS.total)}`,
    '',
    '## Performance Budget Status',
    '',
    `| Asset Type | Budget | Actual | Status |`,
    `|------------|--------|--------|--------|`,
    `| JavaScript | ${formatBytes(BUDGETS.js)} | ${getActualSize(analysis.chunks, 'javascript')} | ${getStatus(analysis.chunks, 'javascript', BUDGETS.js)} |`,
    `| CSS | ${formatBytes(BUDGETS.css)} | ${getActualSize(analysis.chunks, 'css')} | ${getStatus(analysis.chunks, 'css', BUDGETS.css)} |`,
    `| Images | ${formatBytes(BUDGETS.images)} | ${getActualSize(analysis.assets, 'image')} | ${getStatus(analysis.assets, 'image', BUDGETS.images)} |`,
    `| **Total** | ${formatBytes(BUDGETS.total)} | ${formatBytes(analysis.total)} | ${analysis.total <= BUDGETS.total ? '✅ PASS' : '❌ FAIL'} |`,
    '',
  ];

  if (analysis.chunks.length > 0) {
    report.push('## 📋 Bundle Chunks');
    report.push('');
    report.push('| Chunk Name | Type | Size |');
    report.push('|------------|------|------|');

    analysis.chunks.forEach(chunk => {
      report.push(`| ${chunk.name} | ${chunk.type} | ${chunk.sizeFormatted} |`);
    });
    report.push('');
  }

  if (analysis.assets.length > 0) {
    report.push('## 🎨 Assets');
    report.push('');
    report.push('| Asset Name | Type | Size |');
    report.push('|------------|------|------|');

    analysis.assets.forEach(asset => {
      report.push(`| ${asset.name} | ${asset.type} | ${asset.sizeFormatted} |`);
    });
    report.push('');
  }

  if (analysis.warnings.length > 0) {
    report.push('## ⚠️ Warnings');
    report.push('');
    analysis.warnings.forEach(warning => {
      report.push(`- ${warning}`);
    });
    report.push('');
  }

  if (analysis.recommendations.length > 0) {
    report.push('## 💡 Recommendations');
    report.push('');
    analysis.recommendations.forEach(rec => {
      report.push(`- ${rec}`);
    });
    report.push('');
  }

  // Performance tips
  report.push('## 🚀 Performance Tips');
  report.push('');
  report.push('- Consider lazy loading for non-critical components');
  report.push('- Use dynamic imports for route-based code splitting');
  report.push('- Implement tree shaking to remove unused code');
  report.push('- Optimize images with modern formats (WebP, AVIF)');
  report.push('- Use compression for text-based assets');
  report.push('- Consider purging unused CSS with PurgeCSS');

  return report.join('\n');
}

function getActualSize(items, type) {
  const total = items
    .filter(item => item.type === type)
    .reduce((sum, item) => sum + item.size, 0);
  return formatBytes(total);
}

function getStatus(items, type, budget) {
  const total = items
    .filter(item => item.type === type)
    .reduce((sum, item) => sum + item.size, 0);
  return total <= budget ? '✅ PASS' : '❌ FAIL';
}

// Main execution
function main() {
  try {
    const analysis = analyzeBundleSize(stats);
    const report = generateReport(analysis);

    // Save analysis
    const analysisPath = path.join(process.env.PERFORMANCE_RESULTS_DIR || './performance-results', 'bundle-analysis.md');
    fs.writeFileSync(analysisPath, report);

    // Save JSON data for other tools
    const jsonPath = path.join(process.env.PERFORMANCE_RESULTS_DIR || './performance-results', 'bundle-analysis.json');
    fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));

    console.log('✅ Bundle size analysis completed');
    console.log(`📊 Total bundle size: ${formatBytes(analysis.total)}`);
    console.log(`📁 Analysis saved to: ${analysisPath}`);

    // Exit with error code if budget exceeded
    if (analysis.total > BUDGETS.total) {
      console.log('❌ Performance budget exceeded');
      process.exit(1);
    }

    console.log('✅ Performance budget passed');

  } catch (error) {
    console.error('❌ Error analyzing bundle size:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeBundleSize, generateReport };