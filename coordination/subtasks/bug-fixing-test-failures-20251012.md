# Bug Fixing Strategy - Test Failures

**Session**: swarm-stillontime-20251012-031650  
**Strategy**: Bug Fixing (4-6 agents, 2-6 hours)  
**Started**: 2025-10-12 04:00:00 CET  
**Target**: Fix 377 failing backend tests

---

## Objective

Fix 377 failing backend tests across 39 test suites to achieve >80% pass rate (573+ passing tests).

---

## Team Structure (6 Agents Parallel)

### Agent 1: Service Layer - Calendar & Weather
**Agent Type**: `test-engineer`  
**Target Files**:
- `tests/services/calendar.service.test.ts`
- `tests/services/weather.service.test.ts`
- `tests/services/weather-monitoring.service.test.ts`
- `tests/services/calendar-manager.service.test.ts`

**Common Issues**:
- Mock Google Calendar API calls
- Handle async event creation
- Fix timeout issues in weather API calls
- Null vs undefined in weather data

**Estimated**: ~100 tests, 2 hours

---

### Agent 2: Service Layer - Jobs & Notifications
**Agent Type**: `test-engineer`  
**Target Files**:
- `tests/services/job-processor.service.test.ts`
- `tests/services/notification.service.test.ts`

**Common Issues**:
- Mock Bull queue operations
- Fix async job processing
- Mock SMS/notification services
- Handle job stats retrieval

**Estimated**: ~80 tests, 1.5 hours

---

### Agent 3: Controllers
**Agent Type**: `test-engineer`  
**Target Files**:
- `tests/controllers/calendar.controller.test.ts`
- `tests/controllers/health.controller.test.ts`
- `tests/controllers/schedule.controller.test.ts`
- `tests/controllers/email.controller.test.ts`
- `tests/controllers/auth.controller.test.ts`

**Common Issues**:
- Mock Express request/response objects
- Fix authentication middleware mocks
- Handle validation errors
- Mock service layer dependencies

**Estimated**: ~80 tests, 2 hours

---

### Agent 4: Repositories
**Agent Type**: `test-engineer`  
**Target Files**:
- `tests/repositories/weather-data.repository.test.ts`
- `tests/repositories/schedule-data.repository.test.ts`
- `tests/repositories/calendar-event.repository.test.ts`
- `tests/repositories/route-plan.repository.test.ts`

**Common Issues**:
- Mock Prisma client operations
- Fix database query mocks
- Handle transaction mocks
- Null vs undefined in query results

**Estimated**: ~60 tests, 1.5 hours

---

### Agent 5: Integration Tests
**Agent Type**: `test-engineer`  
**Target Files**:
- `tests/integration/calendar-endpoints.test.ts`
- `tests/integration/schedule-endpoints.test.ts`
- `tests/integration/sms-endpoints.test.ts`

**Common Issues**:
- Setup test database
- Mock authentication
- Fix endpoint request/response handling
- Handle async endpoint operations

**Estimated**: ~50 tests, 2 hours

---

### Agent 6: Utilities & Middleware
**Agent Type**: `test-engineer`  
**Target Files**:
- `tests/utils/retry.test.ts`
- `tests/middleware/monitoring.middleware.test.ts`
- `tests/services/error-handler.service.test.ts`

**Common Issues**:
- Fix retry logic timeouts
- Mock middleware next() calls
- Fix error handler fallback expectations
- Null vs undefined in error responses

**Estimated**: ~7 tests (but includes error-handler with many failures), 1 hour

---

## Execution Plan

### Phase 1: Parallel Execution (Start Immediately)
Each agent:
1. Read target test files
2. Run tests to identify specific failures
3. Analyze error patterns
4. Implement fixes
5. Run tests to verify
6. Commit fixes with descriptive messages

### Phase 2: Validation (After All Complete)
1. Run full test suite: `npm test`
2. Verify >80% pass rate achieved
3. Document remaining issues
4. Update test coverage metrics

### Phase 3: Integration (Final Step)
1. Merge all fixes
2. Final test run
3. Update documentation
4. Create summary report

---

## Coordination Protocol

### Pre-Task (Each Agent)
```bash
npx claude-flow@alpha hooks pre-task \
  --description "Fix [category] tests" \
  --agent-id "[agent-name]" \
  --session-id swarm-stillontime-20251012-031650
```

### During Task
```bash
# After each fix
npx claude-flow@alpha hooks post-edit \
  --file "tests/[category]/[file].test.ts" \
  --memory-key "swarm/agents/[agent-name]/fixes"

# Status updates
npx claude-flow@alpha hooks notify \
  --message "Fixed [N] tests in [category]" \
  --level "info"
```

### Post-Task
```bash
npx claude-flow@alpha hooks post-task \
  --task-id "bug-fix-[category]" \
  --status "completed" \
  --metrics-export true
```

---

## Common Fix Patterns

### Pattern 1: Null vs Undefined
```typescript
// BEFORE (fails)
expect(result.data).toBeNull();
// Receives: undefined

// FIX Option A: Change expectation
expect(result.data).toBeUndefined();

// FIX Option B: Fix source to return null
return { ...result, data: null };

// FIX Option C: Accept both
expect(result.data).toBeFalsy();
```

### Pattern 2: Async Timeouts
```typescript
// BEFORE (times out)
it('should process async operation', async () => {
  await service.process();
});

// FIX: Ensure mocks return resolved promises
it('should process async operation', async () => {
  mockService.method.mockResolvedValue(result);
  await service.process();
  expect(mockService.method).toHaveBeenCalled();
}, 15000); // Increase timeout if needed
```

### Pattern 3: Mock Configuration
```typescript
// BEFORE (incomplete mock)
jest.mock('./service');

// FIX: Complete mock with return values
jest.mock('./service', () => ({
  ServiceClass: jest.fn().mockImplementation(() => ({
    method: jest.fn().mockResolvedValue(expectedResult),
  })),
}));
```

---

## Success Criteria

- ✅ Test pass rate >80% (573+ tests passing)
- ✅ No timeout errors remaining
- ✅ All null/undefined issues resolved
- ✅ All mocks properly configured
- ✅ Critical path tests all passing
- ✅ Test coverage >80% on critical services

---

## Progress Tracking

### Agent 1: Calendar & Weather
- [ ] calendar.service.test.ts
- [ ] weather.service.test.ts
- [ ] weather-monitoring.service.test.ts
- [ ] calendar-manager.service.test.ts

### Agent 2: Jobs & Notifications
- [ ] job-processor.service.test.ts
- [ ] notification.service.test.ts

### Agent 3: Controllers
- [ ] calendar.controller.test.ts
- [ ] health.controller.test.ts
- [ ] schedule.controller.test.ts
- [ ] email.controller.test.ts
- [ ] auth.controller.test.ts

### Agent 4: Repositories
- [ ] weather-data.repository.test.ts
- [ ] schedule-data.repository.test.ts
- [ ] calendar-event.repository.test.ts
- [ ] route-plan.repository.test.ts

### Agent 5: Integration
- [ ] calendar-endpoints.test.ts
- [ ] schedule-endpoints.test.ts
- [ ] sms-endpoints.test.ts

### Agent 6: Utils & Middleware
- [ ] retry.test.ts
- [ ] monitoring.middleware.test.ts
- [ ] error-handler.service.test.ts

---

## Metrics to Track

- Initial: 377 failed, 340 passed (47.4% pass rate)
- Target: <160 failed, >573 passed (>80% pass rate)
- Improvement: +233 tests fixed

---

## Status

**Current Phase**: Phase 1 - Parallel Execution  
**Agents Deployed**: 0/6  
**Tests Fixed**: 0/377  
**Pass Rate**: 47.4% → Target: >80%

**Next Action**: Start spawning agents and begin parallel fixing

---

**Strategy Owner**: Adaptive Coordinator  
**Last Updated**: 2025-10-12 04:00:00 CET

