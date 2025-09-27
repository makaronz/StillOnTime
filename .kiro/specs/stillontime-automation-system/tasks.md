§# Implementation Plan - StillOnTime Film Schedule Automation System

- [x] 1. Set up project structure and development environment

  - Create monorepo structure with backend and frontend directories
  - Initialize Node.js backend with TypeScript, Express, and essential dependencies
  - Initialize React frontend with Vite, TypeScript, and Tailwind CSS
  - Configure Docker containers for development environment
  - Set up environment configuration files and secrets management
  - _Requirements: 8.1, 8.2, 8.7_

- [x] 2. Implement database schema and data access layer
- [x] 2.1 Set up PostgreSQL database with Prisma ORM

  - Install and configure Prisma with PostgreSQL
  - Create database schema for users, emails, schedules, routes, weather, and calendar events
  - Generate Prisma client and configure database connection
  - _Requirements: 1.4, 2.7, 3.7, 4.7, 5.7, 6.7_

- [x] 2.2 Implement data access layer with repository pattern

  - Create base repository interface and implementation
  - Implement user repository with CRUD operations
  - Implement processed email repository with duplicate detection
  - Implement schedule data repository with relationships
  - Write unit tests for all repository operations
  - _Requirements: 1.4, 2.7, 6.7_

- [x] 2.3 Set up Redis caching layer

  - Configure Redis connection and client
  - Implement caching service for weather data and route calculations
  - Add cache invalidation strategies
  - Write tests for caching functionality
  - _Requirements: 5.5, 3.6_

- [x] 3. Implement OAuth 2.0 authentication system
- [x] 3.1 Create OAuth 2.0 service for Google integration

  - Set up Google OAuth 2.0 client configuration
  - Implement authorization URL generation with required scopes
  - Create token exchange and refresh mechanisms
  - Add token storage and retrieval with encryption
  - _Requirements: 8.1, 8.2, 9.1_

- [x] 3.2 Implement authentication middleware and session management

  - Create JWT-based session management
  - Implement authentication middleware for protected routes
  - Add token refresh automation for expired tokens
  - Create logout and token revocation functionality
  - Write comprehensive tests for authentication flows
  - _Requirements: 8.1, 8.2, 9.1_

- [x] 4. Implement core email processing services
- [x] 4.1 Create Gmail API integration service

  - Implement Gmail client with OAuth 2.0 authentication
  - Create email monitoring service with StillOnTime filtering criteria
  - Add duplicate detection using message ID and PDF hash
  - Implement email attachment download functionality
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

- [x] 4.2 Implement PDF parsing service

  - Set up PDF-lib for PDF text extraction
  - Create schedule data parsing with regex patterns
  - Implement OCR fallback for scanned PDFs
  - Add data validation and confidence scoring
  - Create manual correction interface data structures
  - Write comprehensive tests for various PDF formats
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 4.3 Create background job processing system

  - Set up Bull Queue for background job processing
  - Implement email processing job with retry logic
  - Create job monitoring and failure handling
  - Add job scheduling for periodic email checks
  - _Requirements: 1.1, 1.5, 9.6_

- [x] 5. Implement route planning and calculation services
- [x] 5.1 Create Google Maps API integration

  - Set up Google Maps client with API key management
  - Implement route calculation for Dom→Panavision→Location
  - Add real-time traffic data integration
  - Create alternative route suggestions
  - _Requirements: 3.1, 3.2, 3.4, 3.6_

- [x] 5.2 Implement time calculation and buffer management

  - Create configurable time buffer system
  - Implement wake-up time calculation logic
  - Add time validation and reasonableness checks
  - Create buffer adjustment recommendations
  - Write tests for various time scenarios
  - _Requirements: 3.2, 3.3, 3.5, 3.6_

- [x] 6. Implement weather integration service
- [x] 6.1 Create OpenWeatherMap API integration

  - Set up weather API client with error handling
  - Implement weather forecast fetching for locations and dates
  - Create weather warning generation logic
  - Add weather data caching with TTL
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 6.2 Implement weather monitoring and updates

  - Create scheduled weather update jobs
  - Implement weather change notifications
  - Add weather impact analysis for route planning
  - Write tests for weather warning scenarios
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 7. Implement Google Calendar integration
- [x] 7.1 Create Calendar API service

  - Set up Google Calendar client with OAuth 2.0
  - Implement calendar event creation with comprehensive descriptions
  - Add multiple alarm creation functionality
  - Create event update and deletion capabilities
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7.2 Implement calendar event management

  - Create event conflict detection and resolution
  - Implement batch calendar operations
  - Add calendar synchronization status tracking
  - Create manual calendar override functionality
  - Write tests for calendar integration scenarios
  - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7_

- [x] 8. Create notification and summary system
- [x] 8.1 Implement notification service

  - Create multi-channel notification system (email, SMS, push)
  - Implement notification preferences management
  - Add notification delivery tracking
  - Create notification templates for different scenarios
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

- [x] 8.2 Create comprehensive summary generation

  - Implement Polish language summary templates
  - Create timeline generation with all relevant times
  - Add weather and warning integration in summaries
  - Implement summary history storage and retrieval
  - Write tests for summary generation accuracy
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

- [x] 9. Implement REST API endpoints
- [x] 9.1 Create authentication and user management endpoints

  - Implement OAuth 2.0 login/logout endpoints
  - Create user profile and preferences endpoints
  - Add user configuration management endpoints
  - Implement API authentication middleware
  - _Requirements: 7.5, 8.3, 8.4, 8.5_

- [x] 9.2 Create email processing and monitoring endpoints

  - Implement manual email processing trigger endpoints
  - Create email processing status and history endpoints
  - Add email reprocessing functionality
  - Implement processing statistics endpoints
  - _Requirements: 7.1, 7.4, 7.6, 10.1_

- [x] 9.3 Create schedule and calendar management endpoints

  - Implement schedule data CRUD endpoints
  - Create calendar event management endpoints
  - Add route plan retrieval and modification endpoints
  - Implement weather data endpoints
  - _Requirements: 7.2, 7.3, 10.2, 10.3_

- [x] 10. Implement React frontend dashboard
- [x] 10.1 Create authentication and routing components

  - Implement OAuth 2.0 login flow in React
  - Create protected route components
  - Add user authentication state management
  - Implement logout and session management
  - _Requirements: 7.5, 8.1_

- [x] 10.2 Create main dashboard components

  - Implement real-time system status display
  - Create recent activity timeline component
  - Add upcoming schedules display
  - Implement manual processing trigger buttons
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 10.3 Create configuration management interface

  - Implement address configuration with Google Maps integration
  - Create time buffer configuration with presets
  - Add notification preferences management
  - Implement API connection status display
  - _Requirements: 7.5, 8.3, 8.4, 8.6_

- [x] 10.4 Create processing history and analytics interface

  - Implement searchable email processing history
  - Create schedule details view with edit capabilities
  - Add error management and retry interface
  - Implement analytics charts and statistics
  - _Requirements: 7.6, 9.6, 10.1, 10.2, 10.3_

- [x] 11. **CRITICAL SECURITY FIXES** (Based on Code Analysis - COMPLETED)
- [x] 11.1 Fix critical security vulnerabilities

  - **CRITICAL**: Remove default JWT secret fallback in config.ts (Line 29)
  - **CRITICAL**: Remove default database credentials from config.ts (Line 27)
  - **HIGH**: Require all production environment variables without fallbacks
  - **MEDIUM**: Validate API keys on startup and fail fast if missing
  - **MEDIUM**: Review and tighten rate limiting for authentication endpoints
  - _Security Priority: CRITICAL - Must be completed before production deployment_

- [x] 11.2 Improve type safety and code quality

  - Replace all 17 instances of `any` type with proper TypeScript interfaces
  - Fix type safety issues in notification.service.ts:550 (getNestedValue function)
  - Fix loose typing in schedule.controller.ts:69 (dynamic query conditions)
  - Fix repository type issues in backend/src/repositories/\*.ts
  - _Code Quality Priority: HIGH - Improves maintainability and prevents runtime errors_

- [x] 11.3 Complete TODO implementations and technical debt cleanup

  - Implement SMS provider integration (notification.service.ts:425)
  - Implement push notification service (notification.service.ts:453)
  - Complete notification integration (weather-monitoring.service.ts:576)
  - Standardize language to English-only in codebase (remove Polish strings)
  - _Technical Debt Priority: MEDIUM - Completes planned features_

- [x] 11.4 Refactor large service files and improve architecture

  - Refactor schedule.controller.ts (926 lines) - break into smaller, focused controllers
  - Refactor job-processor.service.ts (830 lines) - extract job handlers into separate classes
  - Refactor summary.service.ts (805 lines) - separate summary generation logic
  - Implement service composition pattern for better maintainability
  - _Architecture Priority: MEDIUM - Improves code maintainability and testability_

- [ ] 12. Complete notification service integrations
- [ ] 12.1 Implement SMS notification provider integration

  - Integrate with SMS provider (Twilio, AWS SNS, or similar)
  - Add SMS configuration and validation in user settings
  - Implement SMS delivery tracking and error handling
  - Write tests for SMS notification functionality
  - _Requirements: 6.1, 6.2, 6.6_

- [ ] 12.2 Implement push notification service integration

  - Integrate with push notification service (FCM, APNs, or similar)
  - Add push token management and device registration
  - Implement push notification delivery tracking
  - Write tests for push notification functionality
  - _Requirements: 6.1, 6.2, 6.6_

- [x] 13. Enhance error handling and resilience
- [x] 13.1 Implement comprehensive error recovery mechanisms

  - Add circuit breaker pattern for external API calls
  - Implement exponential backoff with jitter for retries
  - Create fallback mechanisms for critical service failures
  - Add comprehensive error logging and monitoring
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 13.2 Implement advanced monitoring and alerting

  - Set up application performance monitoring (APM)
  - Create custom metrics and dashboards
  - Implement automated alerting for critical failures
  - Add health check endpoints with detailed service status
  - _Requirements: 7.7, 9.6_

- [ ] 14. Expand testing coverage and quality assurance
- [ ] 14.1 Complete unit test coverage for all services

  - Achieve 90%+ code coverage for all service classes
  - Add comprehensive edge case testing
  - Implement property-based testing for data validation
  - Create performance benchmarks for critical operations
  - _Requirements: All requirements validation_

- [ ] 14.2 Implement end-to-end testing suite

  - Create full workflow tests from email to calendar event
  - Add browser automation tests for frontend functionality
  - Implement load testing for concurrent user scenarios
  - Create chaos engineering tests for resilience validation
  - _Requirements: All requirements validation_

- [ ] 14.3 Add missing API documentation and monitoring

  - Implement OpenAPI/Swagger documentation for all endpoints (missing from current codebase)
  - Add comprehensive test coverage metrics and reporting
  - Implement performance monitoring with metrics collection
  - Add dependency vulnerability scanning with npm audit
  - Create API versioning strategy for future compatibility
  - _Documentation Priority: HIGH - Required for production readiness_

- [ ] 15. Optimize performance and scalability
- [ ] 15.1 Implement advanced caching strategies

  - Add intelligent cache warming for frequently accessed data
  - Implement distributed caching for multi-instance deployments
  - Add cache analytics and optimization recommendations
  - Create cache invalidation strategies for real-time updates
  - _Requirements: 5.5, 3.6, 7.7_

- [ ] 15.2 Optimize database performance and queries

  - Add database query optimization and indexing analysis
  - Implement connection pooling optimization
  - Add database performance monitoring and alerting
  - Create database backup and recovery automation
  - _Requirements: 1.4, 2.7, 6.7, 8.7_

- [ ] 16. Prepare production deployment infrastructure
- [ ] 16.1 Create production-ready Docker configuration

  - Build optimized production Docker images
  - Implement multi-stage builds for smaller image sizes
  - Add security scanning and vulnerability assessment
  - Create container orchestration configuration (Kubernetes/Docker Swarm)
  - _Requirements: 8.7_

- [ ] 16.2 Implement CI/CD pipeline and deployment automation

  - Set up automated testing and deployment pipeline
  - Implement blue-green deployment strategy
  - Add automated rollback mechanisms
  - Create environment-specific configuration management
  - _Requirements: 8.7_

- [ ] 17. Create comprehensive documentation
- [ ] 17.1 Generate API documentation and developer guides

  - Create OpenAPI/Swagger documentation for all endpoints
  - Write comprehensive developer onboarding guide
  - Document OAuth 2.0 setup and troubleshooting procedures
  - Create architecture decision records (ADRs)
  - _Requirements: 8.7_

- [ ] 17.2 Create user documentation and training materials

  - Write detailed user manual for dashboard functionality
  - Create video tutorials for key features and workflows
  - Document troubleshooting guide for common user issues
  - Create configuration best practices guide
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
