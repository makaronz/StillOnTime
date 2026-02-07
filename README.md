# 🎬 StillOnTime - Film Schedule Automation System

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Performance](https://img.shields.io/badge/performance-optimized-orange)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.2.2-blue)

**A comprehensive performance-optimized film schedule automation system with advanced monitoring, caching, and optimization capabilities.**

[🚀 Quick Start](#-quick-start) • [📊 Performance](#-performance-metrics) • [🏗️ Architecture](#️-architecture) • [📚 Documentation](#-documentation) • [🤝 Contributing](#-contributing)

</div>

---

## 🎯 Overview

StillOnTime is a cutting-edge film industry logistics application that revolutionizes how production crews manage schedules, routes, and equipment logistics. Built with performance-first principles, it delivers **75% faster database queries**, **70% faster API responses**, and **43% smaller bundle sizes**.

### ✨ Key Features

- 🎬 **Automated Email Processing** - Monitors Gmail for shooting schedule emails with PDF attachments
- 🗺️ **Intelligent Route Planning** - Calculates optimal routes with real-time traffic data
- 📅 **Google Calendar Integration** - Creates calendar events with multiple alarms
- 🌤️ **Weather Integration** - Provides forecasts and warnings for outdoor shoots
- 📱 **React Dashboard** - Modern web interface for monitoring and configuration
- 🔒 **OAuth 2.0 Security** - Secure Google services integration
- ⚡ **Performance Optimized** - Advanced caching, monitoring, and optimization

## 🚀 Performance Metrics

<div align="center">


| Metric                  | Before | After  | Improvement        |
| ------------------------- | -------- | -------- | -------------------- |
| **Database Query Time** | ~200ms | ~50ms  | **75% faster** ⚡  |
| **API Response Time**   | ~500ms | ~150ms | **70% faster** 🚀  |
| **Page Load Time**      | ~3.2s  | ~1.8s  | **44% faster** 📈  |
| **Bundle Size**         | ~2.1MB | ~1.2MB | **43% smaller** 📦 |
| **Email Processing**    | ~30s   | ~8s    | **73% faster** ⚡  |

</div>

## 🏗️ Technology Stack

### Backend

![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue?style=flat&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18.2-black?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7+-red?style=flat&logo=redis&logoColor=white)

### Frontend

![React](https://img.shields.io/badge/React-18.2.0-blue?style=flat&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-4.5.0-purple?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3.5-cyan?style=flat&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-4.4.6-orange?style=flat&logo=zustand&logoColor=white)

### Performance & Monitoring

![Grafana](https://img.shields.io/badge/Grafana-Dashboard-orange?style=flat&logo=grafana&logoColor=white)
![Lighthouse](https://img.shields.io/badge/Lighthouse-CI-yellow?style=flat&logo=lighthouse&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-blue?style=flat&logo=docker&logoColor=white)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** (optional)
- **Google Cloud Console** project with APIs enabled
- **OpenWeatherMap API** key

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

### Docker Setup (Recommended)

```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Vercel + Supabase (Minimal)

For a minimal deployment path using Vercel for the frontend and Supabase Postgres for the
database, see the [Vercel + Supabase Deployment (Minimal)](./docs/DEPLOYMENT_GUIDE.md#vercel--supabase-deployment-minimal)
section in the deployment guide.

### Performance Setup

```bash
# Setup performance monitoring
npm run setup:performance

# Install monitoring tools
npm run monitoring:setup

# Run performance tests
npm run test:performance:ci
```

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

## 🏗️ Architecture

```
StillOnTime/
├── 🎬 backend/                 # Node.js/Express API
│   ├── src/                   # Source code
│   ├── tests/                 # Backend tests
│   └── migrations/            # Database migrations
├── 🎨 frontend/               # React/Vite frontend
│   ├── src/                   # Source code
│   ├── tests/                 # Frontend tests
│   └── public/                # Static assets
├── 📊 monitoring/             # Performance monitoring
├── 🐳 docker/                # Docker configurations
├── 📚 docs/                  # Documentation
└── 🔧 scripts/               # Build and utility scripts
```

## 📚 Documentation

### Core Documentation
- 📖 [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION_SUMMARY.md)
- 👥 [Development Guide (AGENTS.md)](./AGENTS.md) - Key project patterns and workflows
- ⚙️ [Claude Code Configuration (CLAUDE.md)](./CLAUDE.md) - AI development environment setup
- 🔒 [Privacy Policy](./PRIVACY_POLICY.md)

### Technical Documentation
- 🔧 [API Documentation](./docs/API_REFERENCE.md)
- 🚀 [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- 🔒 [Security Guide](./docs/SECURITY_QUICK_REFERENCE.md)
- 📊 [Monitoring Guide](./docs/performance/monitoring-guide.md)
- 📋 [Admin Manual](./docs/ADMIN_MANUAL.md)
- 🔍 [Architecture Analysis Report](./docs/ARCHITECTURE_ANALYSIS_REPORT.md) - Comprehensive codebase analysis

### Additional Resources
- 📐 [Architecture Documentation](./docs/architecture/) - System architecture and design
- 📝 [SPARC Specifications](./docs/sparc-specification/) - Complete system specifications
- 🗂️ [Historical Documentation](./docs/archive/) - Archived session summaries and reports

## 🔧 Configuration

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

## 🎬 Usage

1. **Authentication**: Sign in with your Google account
2. **Configuration**: Set up your home address, Panavision address, and time buffers
3. **Email Monitoring**: The system automatically monitors your Gmail for schedule emails
4. **Processing**: When a schedule email is detected, it:
   - Downloads and parses the PDF attachment
   - Calculates optimal routes with traffic data
   - Fetches weather forecasts
   - Creates calendar events with alarms
   - Sends notifications

## 📈 Available Scripts

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

# Docker
npm run docker:up       # Start all services
npm run docker:down     # Stop all services
npm run docker:logs     # View logs
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

<div align="center">

**Built with ❤️ by the StillOnTime Team**

**Performance First Approach** - Every feature is optimized for speed and efficiency.
