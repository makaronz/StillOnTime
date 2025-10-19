#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

class DatabasePerformanceTest {
  constructor() {
    this.prisma = new PrismaClient();
    this.results = {
      queries: [],
      summary: {
        totalQueries: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        slowQueries: [],
        indexUsage: {}
      }
    };
  }

  async runTests() {
    console.log('🗄️  Running database performance tests...');

    try {
      // Test user queries
      await this.testUserQueries();

      // Test schedule queries
      await this.testScheduleQueries();

      // Test email queries
      await this.testEmailQueries();

      // Test complex queries
      await this.testComplexQueries();

      // Analyze index usage
      await this.analyzeIndexUsage();

      // Generate report
      await this.generateReport();

      console.log('✅ Database performance tests completed');

    } catch (error) {
      console.error('❌ Error running database performance tests:', error.message);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async testUserQueries() {
    console.log('👤 Testing user queries...');

    const queries = [
      {
        name: 'user_lookup_by_id',
        query: () => this.prisma.user.findUnique({ where: { id: 'test-user-id' } })
      },
      {
        name: 'user_lookup_by_email',
        query: () => this.prisma.user.findUnique({ where: { email: 'test@example.com' } })
      },
      {
        name: 'user_create',
        query: () => this.prisma.user.create({
          data: {
            email: `test-${Date.now()}@example.com`,
            googleId: `google-${Date.now()}`,
            name: 'Test User'
          }
        })
      },
      {
        name: 'user_update',
        query: () => this.prisma.user.updateMany({
          where: { email: { contains: 'test' } },
          data: { updatedAt: new Date() }
        })
      }
    ];

    for (const test of queries) {
      await this.runQueryTest(test);
    }
  }

  async testScheduleQueries() {
    console.log('📅 Testing schedule queries...');

    const queries = [
      {
        name: 'schedule_list_user',
        query: () => this.prisma.schedule.findMany({
          where: { userId: 'test-user-id' },
          take: 50,
          orderBy: { shootingDate: 'desc' }
        })
      },
      {
        name: 'schedule_date_range',
        query: () => this.prisma.schedule.findMany({
          where: {
            userId: 'test-user-id',
            shootingDate: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31')
            }
          },
          orderBy: { shootingDate: 'asc' }
        })
      },
      {
        name: 'schedule_location_search',
        query: () => this.prisma.schedule.findMany({
          where: {
            location: {
              contains: 'Studio',
              mode: 'insensitive'
            }
          },
          take: 20
        })
      },
      {
        name: 'schedule_create',
        query: () => this.prisma.schedule.create({
          data: {
            userId: 'test-user-id',
            title: 'Test Schedule',
            shootingDate: new Date(),
            location: 'Test Location',
            status: 'planned'
          }
        })
      }
    ];

    for (const test of queries) {
      await this.runQueryTest(test);
    }
  }

  async testEmailQueries() {
    console.log('📧 Testing email queries...');

    const queries = [
      {
        name: 'email_list_user',
        query: () => this.prisma.processedEmail.findMany({
          where: { userId: 'test-user-id' },
          take: 50,
          orderBy: { processedAt: 'desc' }
        })
      },
      {
        name: 'email_unprocessed',
        query: () => this.prisma.processedEmail.findMany({
          where: {
            userId: 'test-user-id',
            status: 'pending'
          },
          take: 10
        })
      },
      {
        name: 'email_message_lookup',
        query: () => this.prisma.processedEmail.findUnique({
          where: { messageId: 'test-message-id' }
        })
      },
      {
        name: 'email_count_by_status',
        query: () => this.prisma.processedEmail.groupBy({
          by: ['status'],
          where: { userId: 'test-user-id' },
          _count: true
        })
      }
    ];

    for (const test of queries) {
      await this.runQueryTest(test);
    }
  }

  async testComplexQueries() {
    console.log('🔗 Testing complex queries...');

    const queries = [
      {
        name: 'dashboard_stats',
        query: async () => {
          const userId = 'test-user-id';
          const [
            totalEmails,
            totalSchedules,
            recentSchedules,
            upcomingSchedules
          ] = await Promise.all([
            this.prisma.processedEmail.count({ where: { userId } }),
            this.prisma.schedule.count({ where: { userId } }),
            this.prisma.schedule.findMany({
              where: { userId },
              take: 5,
              orderBy: { createdAt: 'desc' }
            }),
            this.prisma.schedule.findMany({
              where: {
                userId,
                shootingDate: { gte: new Date() }
              },
              take: 5,
              orderBy: { shootingDate: 'asc' }
            })
          ]);

          return {
            totalEmails,
            totalSchedules,
            recentSchedules,
            upcomingSchedules
          };
        }
      },
      {
        name: 'schedule_analytics',
        query: () => this.prisma.schedule.groupBy({
          by: ['status'],
          where: {
            userId: 'test-user-id',
            shootingDate: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
          },
          _count: true
        })
      },
      {
        name: 'location_frequency',
        query: async () => {
          const result = await this.prisma.$queryRaw`
            SELECT location, COUNT(*) as count
            FROM "Schedule"
            WHERE "userId" = ${'test-user-id'}
            AND "shootingDate" >= ${new Date(new Date().setMonth(new Date().getMonth() - 12))}
            GROUP BY location
            ORDER BY count DESC
            LIMIT 10
          `;
          return result;
        }
      }
    ];

    for (const test of queries) {
      await this.runQueryTest(test);
    }
  }

  async runQueryTest(test) {
    const iterations = 5;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      try {
        await test.query();
        const endTime = performance.now();
        times.push(endTime - startTime);
      } catch (error) {
        // Log error but continue with timing
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const result = {
      name: test.name,
      iterations,
      avgTime: Math.round(avgTime * 100) / 100,
      minTime: Math.round(minTime * 100) / 100,
      maxTime: Math.round(maxTime * 100) / 100,
      times: times.map(t => Math.round(t * 100) / 100)
    };

    this.results.queries.push(result);
    this.results.summary.totalQueries++;

    // Track slow queries (> 100ms)
    if (avgTime > 100) {
      this.results.summary.slowQueries.push(result);
    }

    console.log(`  ${test.name}: ${avgTime.toFixed(2)}ms (avg)`);
  }

  async analyzeIndexUsage() {
    console.log('📊 Analyzing index usage...');

    try {
      // Get index usage statistics
      const indexStats = await this.prisma.$queryRaw`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `;

      this.results.summary.indexUsage = indexStats;

      // Get table sizes
      const tableSizes = await this.prisma.$queryRaw`
        SELECT
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY size_bytes DESC
      `;

      this.results.summary.tableSizes = tableSizes;

    } catch (error) {
      console.warn('⚠️  Could not analyze index usage:', error.message);
    }
  }

  async generateReport() {
    console.log('📄 Generating database performance report...');

    // Calculate summary statistics
    const responseTimes = this.results.queries.map(q => q.avgTime);
    this.results.summary.avgResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    // Calculate 95th percentile
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    this.results.summary.p95ResponseTime = sortedTimes[p95Index] || 0;

    // Save results
    const outputPath = process.env.PERFORMANCE_RESULTS_DIR || './performance-results';
    if (!require('fs').existsSync(outputPath)) {
      require('fs').mkdirSync(outputPath, { recursive: true });
    }

    const jsonPath = `${outputPath}/database-performance.json`;
    require('fs').writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    const report = this.generateMarkdownReport();
    const reportPath = `${outputPath}/database-performance-report.md`;
    require('fs').writeFileSync(reportPath, report);

    console.log(`📊 Database performance report saved to: ${reportPath}`);
  }

  generateMarkdownReport() {
    const { summary, queries } = this.results;

    const report = [
      '# 🗄️ Database Performance Report',
      '',
      `**Generated**: ${new Date().toISOString()}`,
      '',
      '## 📊 Performance Summary',
      '',
      `- **Total Queries Tested**: ${summary.totalQueries}`,
      `- **Average Response Time**: ${summary.avgResponseTime.toFixed(2)}ms`,
      `- **95th Percentile**: ${summary.p95ResponseTime.toFixed(2)}ms`,
      `- **Slow Queries**: ${summary.slowQueries.length}`,
      '',
      '## 📈 Query Performance',
      '',
      '| Query Name | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Status |',
      '|------------|---------------|---------------|---------------|--------|'
    ];

    queries.forEach(query => {
      const status = query.avgTime > 100 ? '❌ Slow' :
                    query.avgTime > 50 ? '⚠️  Moderate' : '✅ Fast';
      report.push(`| ${query.name} | ${query.avgTime} | ${query.minTime} | ${query.maxTime} | ${status} |`);
    });

    if (summary.slowQueries.length > 0) {
      report.push('', '## ⚠️  Slow Queries', '');
      summary.slowQueries.forEach(query => {
        report.push(`### ${query.name}`);
        report.push(`- **Average Time**: ${query.avgTime}ms`);
        report.push(`- **Min Time**: ${query.minTime}ms`);
        report.push(`- **Max Time**: ${query.maxTime}ms`);
        report.push(`- **Recommendation**: Consider adding indexes or optimizing the query`);
        report.push('');
      });
    }

    if (summary.indexUsage && summary.indexUsage.length > 0) {
      report.push('## 📊 Index Usage', '');
      report.push('| Table | Index | Scans | tuples Read | tuples Fetched |');
      report.push('|-------|-------|-------|-------------|----------------|');

      summary.indexUsage.slice(0, 10).forEach(index => {
        report.push(`| ${index.tablename} | ${index.indexname} | ${index.idx_scan} | ${index.idx_tup_read} | ${index.idx_tup_fetch} |`);
      });
    }

    report.push('## 💡 Recommendations', '');

    if (summary.slowQueries.length > 0) {
      report.push('- **Optimize Slow Queries**: Review and optimize queries with average response time > 100ms');
      report.push('- **Add Missing Indexes**: Consider adding indexes for frequently queried columns');
    }

    if (summary.avgResponseTime > 50) {
      report.push('- **Database Tuning**: Consider PostgreSQL configuration tuning');
    }

    report.push('- **Monitor Query Performance**: Set up regular performance monitoring');
    report.push('- **Use EXPLAIN ANALYZE**: Analyze query execution plans for optimization');

    return report.join('\n');
  }
}

// Main execution
async function main() {
  const tester = new DatabasePerformanceTest();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabasePerformanceTest;