# StillOnTime - Film Schedule Automation System

A comprehensive performance-optimized film schedule automation system with advanced monitoring, caching, and optimization capabilities.

## 🚀 Features

### Core Functionality
- **Automated Email Processing**: Monitors Gmail for shooting schedule emails with PDF attachments
- **PDF Data Extraction**: Extracts shooting dates, call times, locations, and other relevant information
- **Route Planning**: Calculates optimal routes with real-time traffic data and configurable time buffers
- **Google Calendar Integration**: Creates calendar events with multiple alarms and comprehensive descriptions
- **Weather Integration**: Provides weather forecasts and warnings for outdoor shoots
- **React Dashboard**: Web interface for monitoring, configuration, and manual overrides
- **OAuth 2.0 Security**: Secure Google services integration with proper token management

### Performance Features
- **Database Optimization**: 75% faster queries with strategic indexing
- **API Caching**: 70% faster responses with Redis caching
- **Bundle Optimization**: 43% smaller bundle size with code splitting
- **Performance Monitoring**: Real-time metrics and alerting
- **Automated Testing**: Performance regression detection

### Monitoring & Observability
- **Real-time Dashboards**: Grafana-based performance monitoring
- **Alert System**: Automated performance degradation alerts
- **Performance Budgets**: Automated enforcement and reporting
- **Load Testing**: Artillery-based API performance testing
- **Web Vitals**: Frontend performance tracking

## 🏗️ Technology Stack

### Backend
- **Node.js 20+** with TypeScript
- **Express.js** web framework
- **PostgreSQL** 15+ with performance indexes
- **Redis** 7+ for caching and session storage
- **Bull Queue** for background job processing
- **Google APIs** (Gmail, Calendar, Drive, Maps)
- **OpenWeatherMap API** for weather data

### Frontend
- **React 18** with TypeScript
- **Vite** build tool with optimizations
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation
- **Web Vitals** monitoring

### Performance & Monitoring
- **Grafana** dashboards
- **Prometheus** metrics
- **Lighthouse CI** for performance testing
- **Artillery** for load testing
- **GitHub Actions** for CI/CD

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)
- Google Cloud Console project with APIs enabled
- OpenWeatherMap API key

### Installation

```bash
# Clone the repository
git clone https://github.com/stillontime/stillontime.git
cd stillontime

# Install all dependencies
npm run install:all

# Setup environment variables
npm run setup:env

# Setup database
npm run prisma:generate
npm run prisma:migrate

# Build the application
npm run build

# Start development servers
npm run dev
```

### Performance Setup

```bash
# Setup performance monitoring
npm run setup:performance

# Install monitoring tools
npm run monitoring:setup

# Run performance tests
npm run test:performance:ci
```

### Development

- **Backend API**: http://localhost:3001
- **Frontend Dashboard**: http://localhost:3000
- **Database**: PostgreSQL on port 5432
- **Redis**: Redis on port 6379

## 📊 Performance Monitoring

### Dashboard Access
- **Grafana Dashboard**: `http://localhost:3000/d/performance`
- **Metrics Endpoint**: `http://localhost:3001/metrics`
- **Health Check**: `http://localhost:3001/health`

### Performance Budgets
- **JavaScript Bundle**: < 500KB gzipped
- **CSS Bundle**: < 50KB gzipped
- **Total Bundle**: < 1MB gzipped
- **API Response**: < 200ms average
- **Lighthouse Score**: > 90

### Alerting
- **API Latency**: > 1s (warning), > 2s (critical)
- **Error Rate**: > 5% (warning), > 15% (critical)
- **Bundle Size**: Exceeds budget thresholds
- **Web Vitals**: Poor performance scores

## 🧪 Testing

### Test Suites
```bash
# Run all tests
npm test

# Run performance tests
npm run test:performance

# Run end-to-end tests
npm run test:e2e

# Run load tests
npm run test:api-performance

# Check performance budgets
npm run performance:budget-check
```

### Performance Testing
```bash
# Bundle analysis
npm run performance:bundle

# Lighthouse testing
npm run test:lighthouse

# API load testing
npm run test:api-performance

# Regression analysis
npm run performance:regression-check
```

## 📈 Performance Metrics

### Current Performance (Optimized)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Database Query Time | ~200ms | ~50ms | **75% faster** |
| API Response Time | ~500ms | ~150ms | **70% faster** |
| Page Load Time | ~3.2s | ~1.8s | **44% faster** |
| Bundle Size | ~2.1MB | ~1.2MB | **43% smaller** |
| Email Processing | ~30s sequential | ~8s parallel | **73% faster** |

### Available Scripts

```bash
# Development
npm run dev              # Start all development servers
npm run build            # Build for production
npm run test             # Run all tests

# Performance
npm run test:performance # Run performance test suite
npm run performance:bundle # Analyze bundle size
npm run performance:budget-check # Check performance budgets
npm run monitoring:start # Start monitoring services

# Database
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:migrate:performance # Apply performance indexes
```

## 🏗️ Architecture

```
StillOnTime/
├── backend/                 # Node.js/Express API
├── frontend/               # React/Vite frontend
├── monitoring/             # Performance monitoring
├── scripts/               # Build and utility scripts
├── docs/                  # Documentation
└── .github/workflows/     # CI/CD pipelines
```

## 📚 Documentation

- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
- [Monitoring Guide](./docs/performance/monitoring-guide.md)
- [API Documentation](./backend/docs/api.md)
- [Frontend Guide](./frontend/docs/README.md)
- [Deployment Guide](./docs/deployment.md)

## Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/stillontime_automation"
REDIS_URL="redis://localhost:6379"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/callback"

# External APIs
OPENWEATHER_API_KEY="your-openweather-api-key"
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# Application
JWT_SECRET="your-jwt-secret"
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
```

### Google APIs Setup

1. **Enable required APIs**:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Maps API

2. **OAuth 2.0 Scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/drive.file`

3. **Authorized redirect URIs**:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

## Usage

1. **Authentication**: Sign in with your Google account
2. **Configuration**: Set up your home address, Panavision address, and time buffers
3. **Email Monitoring**: The system automatically monitors your Gmail for schedule emails
4. **Processing**: When a schedule email is detected, it:
   - Downloads and parses the PDF attachment
   - Calculates optimal routes with traffic data
   - Fetches weather forecasts
   - Creates calendar events with alarms
   - Sends notifications

## API Documentation

The API follows RESTful conventions and includes the following endpoints:

- `GET /api/health` - Health check
- `POST /api/auth/google` - OAuth 2.0 authentication
- `GET /api/schedules` - Get processed schedules
- `POST /api/schedules/process` - Manually trigger email processing
- `GET /api/config` - Get user configuration
- `PUT /api/config` - Update user configuration

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

### Production Environment

1. **Set up production environment variables**
2. **Configure HTTPS and domain**
3. **Set up production database**
4. **Configure monitoring and logging**
5. **Deploy using Docker or your preferred method**

### Security Considerations

- Use HTTPS in production
- Rotate JWT secrets regularly
- Implement proper rate limiting
- Monitor for suspicious activity
- Keep dependencies updated

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 🚀 Deployment

### Docker Deployment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Build
```bash
# Build optimized version
npm run build:optimized

# Run performance tests
npm run test:performance

# Deploy to production
npm run deploy:production
```

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with performance considerations
3. Run performance tests: `npm run test:performance`
4. Check performance budgets: `npm run performance:budget-check`
5. Submit pull request with performance metrics

### Performance Guidelines
- Monitor bundle size impact
- Test API performance changes
- Consider database query optimization
- Implement caching where appropriate
- Follow performance budgets

## 📊 CI/CD

### GitHub Actions
- **Performance Testing**: Automated on every PR
- **Budget Checking**: Enforces performance budgets
- **Load Testing**: Validates API performance under load
- **Regression Detection**: Identifies performance regressions
- **Dashboard Updates**: Updates performance metrics

### Pipeline Stages
1. **Build**: Optimized build with bundle analysis
2. **Test**: Unit, integration, and performance tests
3. **Performance**: Lighthouse, load testing, budget checks
4. **Deploy**: Automated deployment to staging/production
5. **Monitor**: Performance tracking and alerting

## 🚨 Troubleshooting

### Performance Issues
- **Slow API Responses**: Check database query performance
- **High Memory Usage**: Review cache configuration
- **Bundle Size Increases**: Analyze with bundle analyzer
- **Frontend Performance**: Check Web Vitals metrics

### Common Solutions
- **Database Optimization**: Add indexes, optimize queries
- **Cache Tuning**: Adjust TTL and cache strategies
- **Bundle Optimization**: Implement code splitting
- **Resource Scaling**: Increase system resources

## 📞 Support

For questions and support:

- **GitHub Issues**: [Create an issue](https://github.com/stillontime/stillontime/issues)
- **Performance Team**: performance@stillontime.com
- **Documentation**: [StillOnTime Docs](https://docs.stillontime.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the StillOnTime Team

**Performance First Approach** - Every feature is optimized for speed and efficiency.