# StillOnTime Film Schedule Automation System Constitution

## Core Principles

### I. Test-Driven Development (NON-NEGOTIABLE)
Every feature MUST follow TDD methodology: Tests written → User approved → Tests fail → Then implement. Red-Green-Refactor cycle strictly enforced. All code changes must be backed by comprehensive test coverage including unit tests, integration tests, and end-to-end tests. Test coverage must exceed 80% for all critical paths.

### II. Security-First Architecture
All external integrations MUST use OAuth 2.0 with PKCE for authentication. API keys MUST be encrypted and stored securely. Email content MUST be processed in memory without persistent storage. PDF files MUST be deleted from temporary storage within 1 hour. All user data MUST comply with GDPR requirements with proper deletion capabilities.

### III. Real-Time Processing Excellence
Email processing MUST complete within 2 minutes of email receipt. PDF parsing MUST complete within 30 seconds for standard documents. Route calculation MUST complete within 15 seconds including API calls. Calendar event creation MUST complete within 10 seconds. System MUST maintain 99% uptime during business hours (6:00-22:00 CET).

### IV. Film Industry Domain Expertise
System MUST understand film production terminology and workflows. Email filtering MUST identify MP2 production emails using industry-specific keywords. Route planning MUST account for film industry time buffers (car change, parking, entry, traffic, morning routine). Weather monitoring MUST provide equipment recommendations based on shooting conditions.

### V. User-Centric Polish
All user interfaces MUST be responsive and accessible (WCAG 2.1 AA compliance). System MUST provide comprehensive error handling with clear user guidance. Manual override capabilities MUST be available for all automated processes. User feedback MUST be incorporated into continuous improvement cycles.

## Development Standards

### Code Quality Requirements
- TypeScript strict mode enabled for all code
- ESLint and Prettier configured and enforced
- All functions must have JSDoc documentation
- Code reviews required for all changes
- No console.log statements in production code

### API Design Standards
- RESTful conventions for all endpoints
- OpenAPI/Swagger documentation for all APIs
- Consistent error response format across all endpoints
- Rate limiting implemented on all public endpoints
- Request/response logging for audit purposes

### Database Standards
- Prisma ORM for all database operations
- Database migrations must be reversible
- All queries must be optimized and indexed
- Connection pooling configured for production
- Regular backup and recovery procedures

## Security & Compliance

### Data Protection
- All personal data encrypted at rest and in transit
- GDPR compliance with data deletion capabilities
- Audit logging for all data access and modifications
- Regular security audits and penetration testing
- Secure token storage and rotation policies

### External Service Integration
- All external API calls must have circuit breakers
- Exponential backoff retry mechanisms for failed requests
- Fallback options when external services are unavailable
- API quota monitoring and management
- Rate limiting to prevent service abuse

## Governance

### Amendment Procedure
Constitution amendments require: (1) Documented rationale for change, (2) Impact assessment on existing codebase, (3) Team review and approval, (4) Migration plan for breaking changes, (5) Update to all dependent templates and documentation.

### Compliance Review
All pull requests must verify compliance with constitution principles. Code reviews must include constitution check. Automated tests must validate security and performance requirements. Regular architecture reviews to ensure continued alignment.

### Version Control
Constitution versioning follows semantic versioning: MAJOR for breaking changes, MINOR for new principles, PATCH for clarifications. All changes must be documented with clear migration paths.

**Version**: 1.0.0 | **Ratified**: 2025-01-09 | **Last Amended**: 2025-01-09