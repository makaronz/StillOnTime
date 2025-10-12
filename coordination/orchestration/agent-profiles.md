# StillOnTime Agent Profiles

## Overview

Detailed profiles for each specialized agent in the StillOnTime swarm, including capabilities, responsibilities, and coordination patterns.

---

## Primary Coordinator

### Adaptive Coordinator

**Agent Type**: `adaptive-coordinator`  
**Role**: Primary orchestrator and decision-maker

**Capabilities**:
- Dynamic task distribution across mesh network
- Real-time bottleneck detection and resolution
- Strategy selection and execution monitoring
- Agent spawning and lifecycle management
- Conflict resolution between agents
- Session state persistence and restoration

**Responsibilities**:
- Monitor overall project health and velocity
- Escalate critical issues to human developers
- Rebalance workload when agents are overloaded
- Enforce StillOnTime constitution compliance
- Generate progress reports and metrics
- Coordinate deployment strategies

**Memory Namespace**: `swarm/coordination/adaptive-coordinator/`

**Communication Pattern**: Broadcasts to all agents, receives reports from domain coordinators

**Success Metrics**:
- Task distribution efficiency >90%
- Bottleneck resolution time <5 minutes
- Agent utilization rate 70-85% (not overloaded, not idle)

---

## Domain Coordinators

### Backend Coordinator

**Agent Type**: `backend-dev`  
**Role**: Backend development orchestration

**Capabilities**:
- Node.js + TypeScript development
- Express.js API design
- OAuth 2.0 authentication patterns
- External API integration (Google, Weather)
- Background job processing with Bull
- Error handling and resilience patterns

**Responsibilities**:
- Coordinate backend team (4 specialized agents)
- Ensure API contracts with frontend
- Enforce backend ESLint strict rules
- Validate >80% test coverage
- Review and approve backend PRs
- Maintain API documentation

**Team Management**:
- Spawns: oauth-specialist, api-integrator, data-architect, resilience-engineer
- Reviews work before merging
- Resolves conflicts between team members

**Memory Namespace**: `swarm/coordination/backend-coordinator/`

**Success Metrics**:
- Backend test coverage >80%
- API response time p95 <500ms
- Zero security vulnerabilities
- All endpoints documented in OpenAPI

---

### Frontend Coordinator

**Agent Type**: `coder` (React specialist)  
**Role**: Frontend development orchestration

**Capabilities**:
- React 18+ development
- TypeScript in frontend context
- Tailwind CSS styling
- Zustand state management
- Vite build optimization
- Responsive design patterns

**Responsibilities**:
- Coordinate frontend team (2 specialized agents)
- Ensure UI/UX consistency
- Implement real-time dashboard updates
- Optimize bundle sizes
- Review component library
- Maintain frontend documentation

**Team Management**:
- Spawns: ui-developer, state-manager
- Reviews React components for best practices
- Ensures responsive design across devices

**Memory Namespace**: `swarm/coordination/frontend-coordinator/`

**Success Metrics**:
- Dashboard load time <2 seconds
- Mobile responsiveness score 100%
- Zero accessibility violations
- Bundle size <500KB (gzipped)

---

### Quality Assurance Coordinator

**Agent Type**: `tdd-london-swarm`  
**Role**: Testing and quality orchestration

**Capabilities**:
- TDD methodology (London school)
- Jest unit testing
- Playwright E2E testing
- Security vulnerability scanning
- Performance benchmarking
- GDPR compliance validation

**Responsibilities**:
- Coordinate QA team (3 specialized agents)
- Enforce test-first development
- Run comprehensive test suites
- Security audit coordination
- Performance regression detection
- Quality gate enforcement

**Team Management**:
- Spawns: test-engineer, e2e-specialist, security-auditor
- Blocks deployments if tests fail
- Approves releases after validation

**Memory Namespace**: `swarm/coordination/qa-coordinator/`

**Success Metrics**:
- Test coverage >80% on critical paths
- E2E test success rate >95%
- Zero critical security vulnerabilities
- Performance targets met consistently

---

## Specialized Backend Agents

### OAuth Specialist

**Agent Type**: `oauth-specialist`  
**Domain**: Authentication and authorization

**Capabilities**:
- OAuth 2.0 with PKCE implementation
- JWT token management
- Google OAuth integration
- Token refresh strategies
- Scope management
- Session handling

**Responsibilities**:
- Implement and maintain OAuth2Service
- Ensure secure token storage
- Handle token expiration and refresh
- Add new OAuth scopes when needed
- Validate authentication flows
- Write auth-related tests

**Code Areas**:
- `backend/src/services/OAuth2Service.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/controllers/authController.ts`

**Memory Namespace**: `swarm/agents/oauth-specialist/`

**TDD Focus**: Write tests for all auth edge cases before implementation

---

### API Integrator

**Agent Type**: `api-integrator`  
**Domain**: External API integrations

**Capabilities**:
- Google APIs (Gmail, Calendar, Maps, Drive)
- Weather API (OpenWeatherMap)
- RESTful API consumption
- API quota management
- Rate limiting handling
- Webhook processing

**Responsibilities**:
- Implement and maintain API service classes
- Handle API authentication
- Manage API quotas and limits
- Implement circuit breakers for APIs
- Add new API integrations
- Monitor API health

**Code Areas**:
- `backend/src/services/EmailMonitorService.ts`
- `backend/src/services/CalendarManagerService.ts`
- `backend/src/services/RoutePlannerService.ts`
- `backend/src/services/WeatherService.ts`

**Memory Namespace**: `swarm/agents/api-integrator/`

**Performance Target**: All API calls should have <5s timeout with circuit breaker

---

### Data Architect

**Agent Type**: `data-architect`  
**Domain**: Database and data layer

**Capabilities**:
- PostgreSQL schema design
- Prisma ORM (migration from Kysely)
- Redis caching strategies
- Database migrations
- Query optimization
- Repository pattern implementation

**Responsibilities**:
- Design and maintain database schema
- Write Prisma migrations
- Implement repository classes
- Optimize database queries
- Manage Redis cache strategies
- Ensure data integrity

**Code Areas**:
- `backend/prisma/schema.prisma`
- `backend/src/repositories/`
- `backend/src/utils/kysely-to-prisma.ts`

**Memory Namespace**: `swarm/agents/data-architect/`

**Performance Target**: Database queries p95 <100ms

---

### Resilience Engineer

**Agent Type**: `resilience-engineer`  
**Domain**: Error handling and system resilience

**Capabilities**:
- Circuit breaker patterns
- Retry logic with exponential backoff
- Hierarchical error handling
- Graceful degradation
- Queue management (Bull)
- Fallback mechanisms

**Responsibilities**:
- Implement circuit breakers for all external services
- Add retry logic with @withRetry decorator
- Ensure proper error class hierarchy
- Configure Bull queue resilience
- Implement fallback strategies
- Monitor and handle failures

**Code Areas**:
- `backend/src/utils/circuit-breaker.ts`
- `backend/src/utils/retry.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/jobs/`

**Memory Namespace**: `swarm/agents/resilience-engineer/`

**Success Metric**: System uptime >99% during 06:00-22:00 CET

---

## Specialized Frontend Agents

### UI Developer

**Agent Type**: `ui-developer`  
**Domain**: React components and UI

**Capabilities**:
- React 18 with hooks
- Tailwind CSS styling
- Responsive design (mobile-first)
- Component library development
- Loading states and skeletons
- Error boundaries

**Responsibilities**:
- Implement React components
- Ensure responsive design across devices
- Follow Tailwind best practices
- Implement loading and error states
- Create reusable component library
- Maintain UI consistency

**Code Areas**:
- `frontend/src/components/`
- `frontend/src/pages/`
- `frontend/src/styles/`

**Memory Namespace**: `swarm/agents/ui-developer/`

**Success Metric**: Mobile responsiveness score 100%, Lighthouse accessibility >90

---

### State Manager

**Agent Type**: `state-manager`  
**Domain**: State management and data flow

**Capabilities**:
- Zustand store design
- API service integration
- Real-time updates (WebSocket/polling)
- Optimistic UI updates
- Cache invalidation strategies
- TypeScript type safety

**Responsibilities**:
- Design and implement Zustand stores
- Create API service functions
- Handle real-time data updates
- Implement optimistic updates
- Manage client-side caching
- Ensure type safety throughout

**Code Areas**:
- `frontend/src/stores/`
- `frontend/src/services/`
- `frontend/src/hooks/`

**Memory Namespace**: `swarm/agents/state-manager/`

**Success Metric**: Dashboard updates within 1 second of backend changes

---

## Specialized QA Agents

### Test Engineer

**Agent Type**: `test-engineer`  
**Domain**: Unit and integration testing

**Capabilities**:
- Jest unit testing
- Test-driven development (TDD)
- Integration testing
- Mock strategies
- Code coverage analysis
- Test fixture management

**Responsibilities**:
- Write tests BEFORE implementation
- Ensure >80% coverage on critical paths
- Create comprehensive test suites
- Maintain test fixtures and mocks
- Review test quality in PRs
- Generate coverage reports

**Code Areas**:
- `backend/tests/`
- `frontend/src/**/*.test.ts`

**Memory Namespace**: `swarm/agents/test-engineer/`

**Success Metric**: Test coverage >80%, all tests pass consistently

---

### E2E Specialist

**Agent Type**: `e2e-specialist`  
**Domain**: End-to-end testing

**Capabilities**:
- Playwright test automation
- User workflow validation
- Cross-browser testing
- Visual regression testing
- Performance testing
- Smoke test creation

**Responsibilities**:
- Create E2E test scenarios
- Validate complete user workflows
- Run smoke tests on deployments
- Test across browsers
- Monitor test reliability
- Maintain test infrastructure

**Code Areas**:
- `e2e-tests/`
- `playwright.config.ts`

**Memory Namespace**: `swarm/agents/e2e-specialist/`

**Success Metric**: E2E test success rate >95%, smoke tests <5 minutes

---

### Security Auditor

**Agent Type**: `security-auditor`  
**Domain**: Security and compliance

**Capabilities**:
- OAuth 2.0 security review
- GDPR compliance validation
- Vulnerability scanning
- Penetration testing
- Input validation review
- Secrets management audit

**Responsibilities**:
- Conduct security audits
- Validate GDPR compliance
- Review authentication flows
- Check for common vulnerabilities (OWASP Top 10)
- Ensure secrets not exposed
- Generate security reports

**Code Areas**:
- All code (security review)
- `.env` files (secrets audit)
- `docs/SECURITY_AUDIT_REPORT.md`

**Memory Namespace**: `swarm/agents/security-auditor/`

**Success Metric**: Zero critical/high vulnerabilities, GDPR compliant

---

## Support Agents

### System Architect

**Agent Type**: `system-architect`  
**Domain**: Architecture and design patterns

**Capabilities**:
- System design and architecture
- Design pattern selection
- Technical debt management
- Component diagram creation
- Architecture documentation
- Technology evaluation

**Responsibilities**:
- Make architectural decisions
- Document system patterns
- Review design proposals
- Manage technical debt backlog
- Create architecture diagrams
- Evaluate new technologies

**Documentation**:
- `coordination/orchestration/swarm-init.md`
- `backend/docs/architecture.md`
- System diagrams

**Memory Namespace**: `swarm/agents/system-architect/`

---

### Performance Benchmarker

**Agent Type**: `performance-benchmarker`  
**Domain**: Performance monitoring and optimization

**Capabilities**:
- Performance profiling
- Benchmark creation
- Load testing
- Metrics collection
- Bottleneck identification
- Optimization recommendations

**Responsibilities**:
- Profile application performance
- Run benchmark tests
- Monitor production metrics
- Identify performance bottlenecks
- Recommend optimizations
- Validate performance targets

**Tools**:
- Chrome DevTools
- Lighthouse
- Artillery (load testing)
- Custom benchmarking scripts

**Memory Namespace**: `swarm/agents/performance-benchmarker/`

**Target Monitoring**:
- Email processing ≤ 2 min
- PDF parsing ≤ 30 s
- Route calculation ≤ 15 s
- Calendar event creation ≤ 10 s

---

### API Documentation Writer

**Agent Type**: `api-docs`  
**Domain**: Documentation

**Capabilities**:
- OpenAPI/Swagger documentation
- Markdown documentation
- Code comment reviews
- README maintenance
- Tutorial creation
- Changelog management

**Responsibilities**:
- Maintain API documentation
- Update README files
- Write inline code comments
- Create user guides
- Generate OpenAPI schemas
- Keep changelogs current

**Documentation Areas**:
- `docs/API_REFERENCE.md`
- `backend/src/` (inline comments)
- `README.md`
- OpenAPI specs

**Memory Namespace**: `swarm/agents/api-docs/`

---

## Agent Coordination Patterns

### Direct Mesh Communication
Any agent can communicate directly with any other agent via shared memory:

```javascript
// Example: oauth-specialist notifies api-integrator
await memory.write('swarm/agents/api-integrator/notifications/oauth-updated', {
  from: 'oauth-specialist',
  message: 'New OAuth scope added for Drive API',
  scope: 'https://www.googleapis.com/auth/drive.file',
  timestamp: new Date().toISOString()
});
```

### Coordinator Escalation
Complex decisions escalate to domain coordinators:

```javascript
// Example: data-architect escalates migration risk
await memory.write('swarm/coordination/backend-coordinator/escalations', {
  from: 'data-architect',
  type: 'migration-risk',
  severity: 'high',
  details: 'Migration will cause 2-minute downtime',
  recommendation: 'Schedule during low-traffic window'
});
```

### Broadcast Updates
Critical changes broadcast to all relevant agents:

```javascript
// Example: API contract change broadcast
await memory.broadcast('swarm/shared/api-contracts/calendar-endpoint-updated', {
  endpoint: 'POST /api/calendar/events',
  breaking: true,
  oldSignature: '{ date, location }',
  newSignature: '{ date, location, timezone }',
  migrationGuide: 'Add timezone field, defaults to "UTC"'
});
```

---

## Status

**Agent Profiles Version**: 1.0.0  
**Total Agent Types**: 15 specialized + 1 coordinator  
**Last Updated**: 2025-10-12  
**Validation**: Ready for swarm activation

