# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 3.1: Setup
- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools
- [ ] T004 [P] Setup TypeScript strict mode configuration
- [ ] T005 [P] Configure OAuth 2.0 security framework
- [ ] T006 [P] Setup performance monitoring and logging

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T007 [P] Contract test POST /api/users in tests/contract/test_users_post.py
- [ ] T008 [P] Contract test GET /api/users/{id} in tests/contract/test_users_get.py
- [ ] T009 [P] Integration test user registration in tests/integration/test_registration.py
- [ ] T010 [P] Integration test auth flow in tests/integration/test_auth.py
- [ ] T011 [P] Security tests for OAuth 2.0 flow in tests/security/test_oauth.py
- [ ] T012 [P] Performance tests for processing times in tests/performance/test_processing.py

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T013 [P] User model in src/models/user.py
- [ ] T014 [P] UserService CRUD in src/services/user_service.py
- [ ] T015 [P] CLI --create-user in src/cli/user_commands.py
- [ ] T016 POST /api/users endpoint
- [ ] T017 GET /api/users/{id} endpoint
- [ ] T018 Input validation
- [ ] T019 Error handling and logging
- [ ] T020 [P] Film industry domain models in src/models/film_schedule.py

## Phase 3.4: Integration
- [ ] T021 Connect UserService to DB
- [ ] T022 Auth middleware
- [ ] T023 Request/response logging
- [ ] T024 CORS and security headers
- [ ] T025 [P] External API integration with circuit breakers
- [ ] T026 [P] Weather service integration with fallback

## Phase 3.5: Polish
- [ ] T027 [P] Unit tests for validation in tests/unit/test_validation.py
- [ ] T028 Performance tests (<200ms)
- [ ] T029 [P] Update docs/api.md
- [ ] T030 Remove duplication
- [ ] T031 Run manual-testing.md
- [ ] T032 [P] Film industry terminology documentation

## Dependencies
- Tests (T007-T012) before implementation (T013-T020)
- T013 blocks T014, T021
- T016 blocks T018
- Implementation before polish (T027-T032)
- Security setup (T005) before auth tests (T011)
- Performance setup (T006) before performance tests (T012)

## Parallel Example
```
# Launch T007-T012 together:
Task: "Contract test POST /api/users in tests/contract/test_users_post.py"
Task: "Contract test GET /api/users/{id} in tests/contract/test_users_get.py"
Task: "Integration test registration in tests/integration/test_registration.py"
Task: "Integration test auth in tests/integration/test_auth.py"
Task: "Security tests for OAuth 2.0 flow in tests/security/test_oauth.py"
Task: "Performance tests for processing times in tests/performance/test_processing.py"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file → contract test task [P]
   - Each endpoint → implementation task
   
2. **From Data Model**:
   - Each entity → model creation task [P]
   - Relationships → service layer tasks
   
3. **From User Stories**:
   - Each story → integration test [P]
   - Quickstart scenarios → validation tasks

4. **Ordering**:
   - Setup → Tests → Models → Services → Endpoints → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities have model tasks
- [ ] All tests come before implementation
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task