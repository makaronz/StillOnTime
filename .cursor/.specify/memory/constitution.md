# StillOnTime Film Schedule Automation - Constitution

**Project**: StillOnTime Film Schedule Automation System  
**Version**: 2.0.0  
**Ratified**: October 12, 2025  
**Last Amended**: October 14, 2025  
**Amendment**: Added CodeNet RAG & Pattern-Driven Development gate

---

## Preamble

This constitution establishes non-negotiable principles for the StillOnTime project—a film production automation system that processes shooting schedules, calculates routes, integrates with Google Calendar, and provides weather forecasts.

**Core Mission**: Automate tedious production logistics while maintaining film industry standards and manual override capabilities.

**Guiding Principles**:
1. Security and compliance above convenience
2. Real-time performance for production environments
3. Test-driven development ensures reliability
4. Pattern-driven development from proven examples
5. Film industry domain expertise preserved
6. Resilience and graceful degradation

---

## Core Principles

### I. Security & Compliance (NON-NEGOTIABLE)

**Rationale**: Film productions handle sensitive scheduling data, crew information, and location details. GDPR compliance is mandatory for EU operations.

#### 1.1 OAuth 2.0 with PKCE
- **Required For**: All Google API integrations (Gmail, Calendar, Drive, Maps)
- **Implementation**: [OAuth2Service](mdc:backend/src/services/oauth2.service.ts)
- **Flow**: Authorization Code with PKCE (Proof Key for Code Exchange)
- **Token Storage**: Encrypted in database; never in localStorage
- **Token Refresh**: Automatic before expiry; proactive validation
- **Scope Management**: Minimal scopes; request additional as needed

#### 1.2 Secrets Management
- **Environment Variables Only**: All secrets in `.env` files
- **No Hardcoding**: Zero plaintext keys, tokens, or passwords in code
- **Encryption**: Database encryption at rest; encrypted backups
- **Key Rotation**: Support for periodic API key rotation
- **Audit**: Log all secret access (without revealing values)

#### 1.3 GDPR Compliance
- **Data Deletion**: User can delete all personal data on request
- **Email Content**: Never persist email body content; extract metadata only
- **Temp PDFs**: Delete within 1 hour of processing
- **Right to Export**: Users can export their data in JSON format
- **Consent**: Explicit consent for data processing and Google API access
- **Logging**: Sanitize PII from all logs

#### 1.4 API Resilience
- **Circuit Breakers**: All external APIs protected by [CircuitBreaker](mdc:backend/src/utils/circuit-breaker.ts)
- **Exponential Backoff**: Retry with increasing delays (1s, 2s, 4s, 8s, max 30s)
- **Fallbacks**: Graceful degradation (e.g., cached weather if API unavailable)
- **Timeout**: All external calls have max 10s timeout
- **Rate Limiting**: Respect API quotas; implement client-side rate limiting

#### 1.5 Additional Security
- **Input Validation**: express-validator on all endpoints
- **Rate Limiting**: Global (100 req/min), Auth (10 req/min), per-user quotas
- **CSRF Protection**: Enabled for all POST/PUT/DELETE
- **HTTPS Only**: Production enforces HTTPS; no HTTP fallback
- **Secure Cookies**: httpOnly, sameSite=strict, secure flag in production
- **SQL Injection**: Prisma ORM prevents; no raw SQL without parameterization
- **XSS Protection**: React automatic escaping; CSP headers

---

### II. Real-Time Performance (NON-NEGOTIABLE)

**Rationale**: Film crews operate on tight schedules. Late notifications or slow route calculations can cause production delays costing thousands of dollars per minute.

#### 2.1 Performance Targets

| Operation | Target | Measurement | Consequences if Exceeded |
|-----------|--------|-------------|--------------------------|
| **Email Processing** | ≤ 2 min | End-to-end (fetch → calendar event) | Crew may miss schedule updates |
| **PDF Parsing** | ≤ 30 sec | Per document | Delays email processing pipeline |
| **Route Calculation** | ≤ 15 sec | With real-time traffic | Crew gets outdated route info |
| **Calendar Event** | ≤ 10 sec | Google Calendar API | User waits on loading screen |
| **Dashboard Load** | ≤ 2 sec | Initial React render | Poor UX; perceived as broken |
| **API Response** | p95 < 500ms | All endpoints | Frontend feels sluggish |

#### 2.2 Uptime Requirements
- **Target**: 99% during 06:00–22:00 CET (production hours)
- **Acceptable Downtime**: 1% = ~9 minutes/day during production hours
- **After Hours**: Best effort (maintenance window allowed)
- **Monitoring**: Real-time health checks every 30 seconds
- **Alerting**: Immediate notification on downtime >1 minute

#### 2.3 Optimization Strategies
- **Caching**: Redis for routes (1h TTL), weather (24h TTL)
- **Parallel Processing**: Promise.all() for independent operations
- **Database Indexing**: All frequently queried columns
- **Connection Pooling**: Reuse database connections (max 20)
- **CDN**: Static assets served from CDN in production
- **Code Splitting**: Frontend lazy-loads routes

---

### III. TDD & Code Quality (NON-NEGOTIABLE)

**Rationale**: Film production systems must be reliable. Bugs in schedule processing or route calculations can cause expensive production delays.

#### 3.1 Test-Driven Development
- **Red-Green-Refactor**: Mandatory cycle for all features
- **Tests First**: Write failing tests before implementation
- **No Implementation Without Tests**: Code without tests is rejected
- **Test Types**:
  - Unit tests: Services, utilities, pure functions
  - Integration tests: API endpoints, database operations
  - E2E tests: Complete user workflows (Playwright)

#### 3.2 Coverage Requirements
- **Critical Paths**: >80% coverage mandatory
  - Email processing pipeline
  - PDF parsing and data extraction
  - Route calculation logic
  - Calendar event creation
  - OAuth token management
- **General Code**: >60% coverage recommended
- **Tools**: Jest (backend), Vitest (frontend), Playwright (E2E)

#### 3.3 TypeScript Standards
- **Strict Mode**: Enabled in all tsconfig.json files
- **Explicit Return Types**: All exported functions must declare return type
- **No `any`**: Use proper types or `unknown` with type guards
- **Backend Linting**: Extra strict (explicit return types mandatory)
- **Frontend Linting**: Standard React/TypeScript rules

#### 3.4 Code Quality Tools
- **Linting**: ESLint with project-specific rules
- **Formatting**: Prettier (run in CI/CD)
- **Type Checking**: TypeScript compiler in strict mode
- **Pre-commit Hooks**: Lint + type check before commit

---

### IV. CodeNet RAG & Pattern-Driven Development (NON-NEGOTIABLE)

**Rationale**: Leverage 14M+ validated code examples from IBM Project CodeNet to ensure best practices, reduce bugs, and accelerate development.

#### 4.1 Mandatory RAG Consultation
- **Before Implementation**: Query CodeNet RAG for similar code in target language
- **Languages Covered**: TypeScript, JavaScript, Python
- **Minimum Examples**: Retrieve top-5 similar examples
- **Pattern Analysis**: Extract patterns and their frequencies
- **Application**: Apply patterns found in >50% of examples

#### 4.2 Pattern Compliance Requirements

| Pattern | Frequency in CodeNet | When to Apply |
|---------|---------------------|---------------|
| **async-await** | 82% | All async operations |
| **error-handling** | 78% | All external calls, risky operations |
| **retry-logic** | 65% | All external API calls |
| **circuit-breaker** | 58% | All external services |
| **functional-programming** | 55% | Data transformations |
| **promises** | 70% | Async operations |

#### 4.3 RAG API Endpoints
```bash
# Required usage before implementation
GET /api/codenet/search?query={task}&language={lang}&limit=5
POST /api/codenet/generate {"task": "...", "language": "..."}
GET /api/codenet/patterns?codeContext={code}
```

#### 4.4 Exemption Protocol
When CodeNet RAG is unavailable:
1. Document exemption: `CODENET_EXEMPTION: [reason]`
2. Reference pattern documentation
3. Apply documented patterns manually
4. Maintain same quality standards

**Example**:
```typescript
// CODENET_EXEMPTION: RAG service offline
// Reason: Backend not running during development
// Patterns Applied: async-await (82%), error-handling (78%), retry-logic (65%)
// Reference: docs/PROJECT_CODENET_INTEGRATION.md
```

#### 4.5 Pattern Documentation
- **Auto-generated**: systemPatterns.md from CodeNet analysis
- **Update Frequency**: Weekly or after major dataset updates
- **Content**: Pattern frequencies, use cases, examples
- **Reference**: Primary source for exemptions

---

### V. Film Industry Domain (NON-NEGOTIABLE)

**Rationale**: StillOnTime serves film production crews. Domain-specific knowledge is critical for usability and adoption.

#### 5.1 Production Terminology
- **Call Sheets**: Not "schedules" or "plans"
- **Crew Positions**: Properly named (DP, 1st AD, Gaffer, Key Grip, etc.)
- **Locations**: Use production location names, not generic addresses
- **Timing**: Industry standard time formats (e.g., "06:00 crew call")
- **Equipment**: Proper names (C-stands, apple boxes, flags, etc.)

#### 5.2 Time Buffers (Required in Route Calculations)

| Buffer Type | Duration | Applies When |
|-------------|----------|--------------|
| **Morning Routine** | 30 min | First location of day |
| **Car Change** | 15 min | Between home and Panavision |
| **Parking** | 10 min | All locations |
| **Entry to Panavision** | 5 min | Panavision location only |
| **Traffic Buffer** | 15 min | All routes |
| **Equipment Loading** | 20 min | Before leaving for location |

**Implementation**: [TimeCalculationService](mdc:backend/src/services/time-calculation.service.ts)

#### 5.3 Weather Integration
- **Forecast Source**: OpenWeatherMap API
- **Update Frequency**: Every 6 hours
- **Warnings**: Rain, extreme temperatures, high winds
- **Equipment Recommendations**:
  - Rain: Rain gear, rain covers for cameras
  - Heat >30°C: Shade, cooling, hydration
  - Cold <5°C: Heating, hand warmers
  - Wind >25 km/h: Stabilization equipment

#### 5.4 Multi-Location Shoots
- **Support**: Multiple locations per day
- **Routing**: Home → Panavision → Location 1 → Location 2 → ...
- **Travel Time**: Calculated with traffic for each segment
- **Alerts**: Notify if timing becomes impossible

#### 5.5 Manual Overrides
- **All Automation**: Can be manually adjusted
- **UI Controls**: Edit times, locations, routes, weather
- **Notifications**: User control over SMS settings
- **Flexibility**: System suggests, user decides

---

### VI. Architecture & Resilience (MANDATORY)

**Rationale**: External dependencies (Gmail, Google Calendar, Weather API) can fail. System must degrade gracefully.

#### 6.1 Monorepo Structure
```
StillOnTime/
├── backend/          # Node.js + TypeScript + Express
├── frontend/         # React + TypeScript + Vite
├── e2e-tests/        # Playwright tests
├── coordination/     # Swarm agent coordination
├── docs/             # Technical documentation
└── docker-compose.yml
```

#### 6.2 Resilience Components
- **Circuit Breakers**: [circuit-breaker.ts](mdc:backend/src/utils/circuit-breaker.ts)
  - Failure threshold: 5 consecutive failures
  - Reset timeout: 60 seconds
  - Monitor interval: 10 seconds
- **Retry Logic**: [@withRetry decorator](mdc:backend/src/utils/retry.ts)
  - Max attempts: 3
  - Backoff: Exponential (1s, 2s, 4s)
  - Initial delay: 1000ms
- **Hierarchical Errors**: [errorHandler.ts](mdc:backend/src/middleware/errorHandler.ts)
  - APIError, BusinessLogicError, ValidationError
  - Automatic HTTP status mapping
  - Structured JSON logging

#### 6.3 Caching Strategy
- **Redis**: [cache.service.ts](mdc:backend/src/services/cache.service.ts)
- **Namespaces**: `route:`, `weather:`, `user:`, `codenet:`
- **TTL**:
  - Routes: 1 hour (traffic changes)
  - Weather: 24 hours (forecast updates)
  - CodeNet queries: 24 hours (code examples don't change)
  - User config: Session duration

#### 6.4 Background Processing
- **Queue**: Bull (Redis-backed)
- **Jobs**: Email processing, PDF parsing, route calculation
- **Concurrency**: Configurable (default: 5 concurrent jobs)
- **Retry**: Automatic on failure (max 3 attempts)
- **Monitoring**: Job status, queue depth, processing time

---

### VII. Data Layer Standards (MANDATORY)

#### 7.1 Database (PostgreSQL + Prisma)
- **ORM**: Prisma only; no raw SQL except for complex queries
- **Migrations**: Prisma migrations; reversible; tested in staging
- **Repositories**: Type-safe repositories in [repositories/](mdc:backend/src/repositories)
- **Transactions**: Use Prisma transactions for multi-table operations
- **Indexes**: All foreign keys, frequently queried columns
- **Connection Pool**: Max 20, timeout 10s

#### 7.2 Redis Caching
- **Namespacing**: Always use namespaced keys
- **TTL**: All cached data must have expiration
- **Invalidation**: Clear cache on related data updates
- **Fallback**: Graceful degradation if Redis unavailable
- **No PII**: Encrypt personal data before caching

#### 7.3 Vector Database (Qdrant)
- **Purpose**: CodeNet RAG embeddings storage
- **Collection**: `codenet_examples` (1536-dim vectors)
- **Indexing**: Language, patterns, complexity, quality score
- **Resilience**: Circuit breaker protection
- **Backup**: Weekly collection snapshots

---

### VIII. API Design Standards (MANDATORY)

#### 8.1 RESTful Principles
- **Resource-oriented**: URLs represent resources (nouns, not verbs)
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (remove)
- **Status Codes**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)
- **Idempotency**: PUT and DELETE must be idempotent

#### 8.2 Request/Response Format
```typescript
// Standard success response
{
  "success": true,
  "data": {...},
  "timestamp": "2025-10-14T12:00:00Z"
}

// Standard error response  
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-10-14T12:00:00Z",
  "suggestion": "How to fix (optional)"
}
```

#### 8.3 Authentication
- **JWT Tokens**: Signed with HS256; 24h expiry
- **Bearer Auth**: `Authorization: Bearer {token}` header
- **Refresh Tokens**: Automatic refresh before expiry
- **Session Management**: Track active sessions; allow logout

#### 8.4 Rate Limiting
- **Global**: 100 requests/minute per IP
- **Auth Endpoints**: 10 requests/minute per IP
- **Per-User**: 1000 requests/hour when authenticated
- **Response Headers**: Include rate limit info in headers

#### 8.5 Documentation
- **OpenAPI/Swagger**: All endpoints documented
- **Examples**: Request/response examples for each endpoint
- **Error Codes**: All possible error responses documented
- **Changelog**: API version history maintained

---

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.2+ (strict mode)
- **Framework**: Express.js 4.18+
- **Database**: PostgreSQL 15+ (via Prisma 5.6+)
- **Cache**: Redis 7+
- **Vector DB**: Qdrant 1.7+
- **Queue**: Bull 4.12+
- **Testing**: Jest 29+

### Frontend
- **Framework**: React 18+
- **Language**: TypeScript 5.2+
- **Build**: Vite 5+
- **Styling**: Tailwind CSS 3+
- **State**: Zustand
- **Routing**: React Router 6+
- **Testing**: Vitest + Playwright

### External Services
- **Google APIs**: Gmail, Calendar, Drive, Maps
- **Weather**: OpenWeatherMap API
- **SMS**: Twilio (optional)
- **AI**: OpenAI (GPT-4, ada-002 embeddings)

---

## Development Workflow

### 1. Feature Development
1. Create feature branch: `001-feature-name`
2. Write specification in `/specs/001-feature-name/spec.md`
3. Create implementation plan: `/specs/001-feature-name/plan.md`
4. Research unknowns: `/specs/001-feature-name/research.md`
5. Design contracts: `/specs/001-feature-name/contracts/`
6. **Check CodeNet RAG**: Query for similar implementations
7. Write failing tests (TDD)
8. Implement following CodeNet patterns
9. Verify tests pass
10. Document in AGENTS.md or CLAUDE.md
11. Code review
12. Merge to main

### 2. Bug Fixing
1. Create failing test reproducing bug
2. **Check CodeNet RAG**: Query for similar error handling patterns
3. Fix with appropriate patterns
4. Verify test passes
5. Add regression test
6. Document in memory bank

### 3. Swarm Coordination
- **Session ID**: `swarm-stillontime-20251012-031650`
- **Agents**: 15 specialized (backend-dev, coder, tdd-london-swarm, etc.)
- **Memory**: Hierarchical swarm memory in `/coordination/memory_bank/`
- **Strategies**: 6 execution strategies (feature dev, bug fix, performance, security, E2E, deployment)
- **Hooks**: Pre-task, during-task, post-task for coordination

---

## Quality Gates

### Gate 1: Constitution Compliance (Pre-Implementation)
- [ ] No plaintext secrets
- [ ] Circuit breakers for external APIs
- [ ] Performance targets identified
- [ ] Test strategy defined
- [ ] Film domain terminology preserved

### Gate 2: CodeNet RAG Check (Pre-Implementation)
- [ ] Similar code queried from CodeNet
- [ ] Patterns analyzed (top-5 examples)
- [ ] Patterns with >50% frequency identified
- [ ] Implementation plan includes patterns
- [ ] Exemption documented if RAG unavailable

### Gate 3: TDD Validation (Implementation)
- [ ] Tests written first
- [ ] Tests failing initially
- [ ] Implementation makes tests pass
- [ ] Coverage >80% for critical paths
- [ ] No skipped or disabled tests

### Gate 4: Code Review (Pre-Merge)
- [ ] All constitution gates passed
- [ ] CodeNet patterns applied
- [ ] Tests passing
- [ ] Linting passing
- [ ] Documentation updated
- [ ] No console.log in production code

---

## Governance

### Amendment Process
1. **Proposal**: Document proposed change with rationale
2. **Review**: System architect + lead developers review
3. **Impact Analysis**: Identify affected code and workflows
4. **Approval**: Requires unanimous approval
5. **Migration**: Create migration plan if existing code affected
6. **Documentation**: Update all references to constitution

### Compliance Enforcement
- **CI/CD**: Automated checks for common violations
- **Code Review**: Manual verification of constitution compliance
- **Pre-commit Hooks**: Linting, type checking, test execution
- **Pull Requests**: Constitution checklist required
- **Monitoring**: Track metrics related to performance gates

### Exemptions
- **Process**: Document in code with `CONSTITUTION_EXEMPTION: [gate] [reason]`
- **Approval**: System architect approval required
- **Tracking**: Maintain exemptions log
- **Review**: Quarterly review of all exemptions
- **Remediation**: Plan to eliminate exemptions over time

---

## Monitoring & Metrics

### Performance Metrics
- Email processing time (p50, p95, p99)
- API response times per endpoint
- Database query performance
- Redis cache hit rates
- External API latency

### Quality Metrics
- Test coverage percentage
- Test pass rate
- Linting errors count
- TypeScript errors count
- CodeNet pattern compliance rate

### Business Metrics
- Active users count
- Emails processed per day
- Calendar events created
- Routes calculated
- System uptime percentage

---

## References

### Internal Documentation
- **Architecture**: [coordination/orchestration/swarm-init.md](mdc:coordination/orchestration/swarm-init.md)
- **API Reference**: [docs/API_REFERENCE.md](mdc:docs/API_REFERENCE.md)
- **Development Guide**: [AGENTS.md](mdc:AGENTS.md) or [CLAUDE.md](mdc:CLAUDE.md)
- **CodeNet Integration**: [docs/PROJECT_CODENET_INTEGRATION.md](mdc:docs/PROJECT_CODENET_INTEGRATION.md)
- **Swarm Coordination**: [coordination/orchestration/swarm-strategies.md](mdc:coordination/orchestration/swarm-strategies.md)

### External References
- **Project CodeNet**: https://github.com/IBM/Project_CodeNet
- **Google APIs**: https://developers.google.com/apis-explorer
- **Prisma**: https://www.prisma.io/docs
- **LangChain**: https://js.langchain.com/docs

---

**Version**: 2.0.0  
**Ratified**: 2025-10-12  
**Last Amended**: 2025-10-14  
**Next Review**: 2025-11-14 (monthly)

---

**This constitution supersedes all other practices, guidelines, and conventions. Deviations must be explicitly justified and approved.**
