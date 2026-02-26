# Configuration Page Implementation Checklist

**Quick Reference for Developers**
**Last Updated:** 2025-10-12

---

## Files to Create

### Frontend Components

```bash
frontend/src/components/configuration/
├── OAuthConnectionCard.tsx        # NEW - OAuth status & management
├── LLMProviderCard.tsx            # NEW - LLM provider configuration
├── EmailParsingRulesCard.tsx      # NEW - Email rule management
├── ApiConnectionCard.tsx          # EXISTS - API connection testing
├── NotificationConfigCard.tsx     # EXISTS - Notification preferences
├── AddressConfigCard.tsx          # EXISTS - Address configuration
└── TimeBufferConfigCard.tsx       # EXISTS - Time buffer settings
```

### Frontend Stores

```bash
frontend/src/stores/
├── oauthStore.ts                  # NEW - OAuth state management
├── llmConfigStore.ts              # NEW - LLM provider state
├── emailRulesStore.ts             # NEW - Email rules state
└── configurationStore.ts          # ENHANCE - Add new features
```

### Frontend Services

```bash
frontend/src/services/
├── oauth.ts                       # NEW - OAuth API calls
├── llmConfig.ts                   # NEW - LLM provider API calls
├── emailRules.ts                  # NEW - Email rules API calls
└── configuration.ts               # ENHANCE - Add new methods
```

### Backend Controllers

```bash
backend/src/controllers/
├── auth.controller.ts             # ENHANCE - Add /auth/test endpoint
├── llm.controller.ts              # NEW - LLM provider management
└── email-rules.controller.ts      # NEW - Email rule management
```

### Backend Services

```bash
backend/src/services/
├── oauth2.service.ts              # ENHANCE - Add connection testing
├── llm-provider.service.ts        # NEW - LLM provider operations
├── llm-encryption.service.ts      # NEW - API key encryption
└── email-rules.service.ts         # NEW - Rule matching engine
```

### Backend Routes

```bash
backend/src/routes/
├── auth.routes.ts                 # ENHANCE - Add test route
├── llm.routes.ts                  # NEW - LLM endpoints
└── email-rules.routes.ts          # NEW - Email rule endpoints
```

---

## Database Migrations

### Migration 1: LLM Providers Table

```sql
-- File: backend/src/migrations/YYYYMMDDHHMMSS_create_llm_providers.ts

CREATE TABLE llm_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name VARCHAR(50) NOT NULL CHECK (provider_name IN ('openai', 'anthropic', 'local')),
  encrypted_api_key TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  max_tokens INTEGER DEFAULT 4000 CHECK (max_tokens BETWEEN 100 AND 8000),
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature BETWEEN 0 AND 1),
  endpoint TEXT,
  is_active BOOLEAN DEFAULT false,
  last_tested TIMESTAMP,
  test_status VARCHAR(20) CHECK (test_status IN ('success', 'failed', 'pending')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider_name, model)
);

CREATE INDEX idx_llm_providers_user_id ON llm_providers(user_id);
CREATE INDEX idx_llm_providers_active ON llm_providers(user_id, is_active) WHERE is_active = true;

-- Only one active provider per user
CREATE UNIQUE INDEX idx_one_active_provider_per_user ON llm_providers(user_id) WHERE is_active = true;
```

### Migration 2: Email Parsing Rules Table

```sql
-- File: backend/src/migrations/YYYYMMDDHHMMSS_create_email_parsing_rules.ts

CREATE TABLE email_parsing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  priority_order INTEGER NOT NULL,
  keywords TEXT[] NOT NULL CHECK (array_length(keywords, 1) > 0),
  sender_domains TEXT[],
  subject_contains TEXT[],
  require_attachment BOOLEAN DEFAULT false,
  attachment_types TEXT[],
  auto_process BOOLEAN DEFAULT false,
  notify_channels TEXT[] NOT NULL DEFAULT '{"email"}',
  assign_label VARCHAR(100),
  match_count INTEGER DEFAULT 0,
  last_matched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, priority_order)
);

CREATE INDEX idx_email_rules_user_id ON email_parsing_rules(user_id);
CREATE INDEX idx_email_rules_enabled ON email_parsing_rules(user_id, enabled) WHERE enabled = true;
CREATE INDEX idx_email_rules_priority ON email_parsing_rules(user_id, priority_order);
```

---

## API Endpoints to Implement

### OAuth Enhancement

```typescript
// GET /api/auth/test
// Test current OAuth connection
Response: {
  success: boolean
  connected: boolean
  latency?: number
  error?: string
}
```

### LLM Provider Endpoints

```typescript
// GET /api/llm/providers
// List user's LLM providers
Response: {
  success: true
  data: LLMProvider[]
}

// POST /api/llm/providers
// Add new LLM provider
Body: {
  provider: 'openai' | 'anthropic' | 'local'
  apiKey: string
  model: string
  maxTokens?: number
  temperature?: number
  endpoint?: string
}
Response: {
  success: true
  data: LLMProvider
}

// PUT /api/llm/providers/:id
// Update LLM provider
Body: Partial<LLMProvider>
Response: {
  success: true
  data: LLMProvider
}

// DELETE /api/llm/providers/:id
// Remove LLM provider
Response: {
  success: true
  message: string
}

// POST /api/llm/test/:id
// Test provider connection
Response: {
  success: boolean
  providerName: string
  latency: number
  modelInfo?: object
  error?: string
}

// POST /api/llm/validate-key
// Validate API key without saving
Body: {
  provider: string
  apiKey: string
}
Response: {
  valid: boolean
  error?: string
}
```

### Email Rules Endpoints

```typescript
// GET /api/email/rules
// List user's email rules
Response: {
  success: true
  data: EmailRule[]
}

// POST /api/email/rules
// Create new rule
Body: {
  name: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  keywords: string[]
  senderDomains?: string[]
  conditions: {...}
  actions: {...}
}
Response: {
  success: true
  data: EmailRule
}

// PUT /api/email/rules/:id
// Update rule
Body: Partial<EmailRule>
Response: {
  success: true
  data: EmailRule
}

// DELETE /api/email/rules/:id
// Delete rule
Response: {
  success: true
  message: string
}

// POST /api/email/rules/:id/test
// Test rule against sample email
Body: {
  subject: string
  body: string
  sender: string
  hasAttachment: boolean
}
Response: {
  matched: boolean
  matchedConditions: object
  score: number
  explanation: string
}

// PUT /api/email/rules/reorder
// Reorder rule priority
Body: {
  ruleIds: string[] // Array of IDs in new order
}
Response: {
  success: true
  data: EmailRule[]
}
```

---

## Environment Variables

### Backend `.env`

```bash
# LLM Configuration
ENCRYPTION_SECRET=your-32-byte-random-string-here
LLM_REQUEST_TIMEOUT=30000
LLM_MAX_RETRIES=3

# Rate Limiting
API_KEY_VALIDATION_RATE_LIMIT=10
RULE_TEST_RATE_LIMIT=50
PROVIDER_TEST_RATE_LIMIT=20
```

---

## Testing Requirements

### Unit Tests (Minimum 90% Coverage)

```typescript
// OAuth Store Tests
describe('OAuthStore', () => {
  test('should fetch OAuth status on mount')
  test('should refresh token successfully')
  test('should handle token refresh failure')
  test('should disconnect account')
  test('should reconnect account')
  test('should test connection')
})

// LLM Config Store Tests
describe('LLMConfigStore', () => {
  test('should load providers')
  test('should add new provider')
  test('should update provider')
  test('should delete provider')
  test('should set active provider')
  test('should validate API key')
  test('should test provider connection')
})

// Email Rules Store Tests
describe('EmailRulesStore', () => {
  test('should load rules')
  test('should create rule')
  test('should update rule')
  test('should delete rule')
  test('should reorder rules')
  test('should test rule matching')
})

// Backend Service Tests
describe('LLMProviderService', () => {
  test('should encrypt API key')
  test('should decrypt API key')
  test('should validate OpenAI key')
  test('should validate Anthropic key')
  test('should test provider connection')
})

describe('EmailRulesService', () => {
  test('should match rule by keywords')
  test('should match rule by sender domain')
  test('should respect priority order')
  test('should handle attachment requirements')
})
```

### Integration Tests

```typescript
// OAuth Flow
test('Complete OAuth connection flow')
test('OAuth token refresh flow')
test('OAuth disconnect flow')

// LLM Provider Management
test('Add and activate LLM provider')
test('Test provider connection')
test('Switch active provider')
test('Delete provider')

// Email Rules
test('Create and test email rule')
test('Reorder rule priority')
test('Rule matching against real emails')
```

### E2E Tests (Playwright)

```typescript
test('User can connect OAuth account', async ({ page }) => {
  // Test OAuth flow
})

test('User can configure LLM provider', async ({ page }) => {
  // Test LLM configuration
})

test('User can create and test email rule', async ({ page }) => {
  // Test email rule creation
})
```

---

## Accessibility Checklist

### WCAG 2.1 AA Requirements

- [ ] All interactive elements have keyboard focus indicators
- [ ] Tab order is logical and intuitive
- [ ] Form fields have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Status updates use `aria-live` regions
- [ ] Color contrast ratios meet 4.5:1 minimum
- [ ] Touch targets are minimum 44x44px
- [ ] Skip links provided for navigation
- [ ] ARIA roles and labels are appropriate
- [ ] Screen reader testing completed

### Testing Tools

```bash
# Automated accessibility testing
npm run test:a11y

# Manual testing
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS)
- TalkBack (Android)
- Axe DevTools browser extension
```

---

## Security Checklist

### API Key Security

- [ ] API keys encrypted with AES-256-GCM
- [ ] Unique salt per API key
- [ ] Frontend never stores plaintext keys
- [ ] Backend never returns plaintext keys
- [ ] Secure deletion on provider removal
- [ ] Rate limiting on validation endpoints

### Input Validation

- [ ] Zod schemas for all inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized outputs)
- [ ] CSRF tokens on state-changing operations
- [ ] File upload validation (if applicable)

### Authentication & Authorization

- [ ] All endpoints require authentication
- [ ] Users can only access their own data
- [ ] Session management secure
- [ ] JWT tokens properly validated

---

## Performance Checklist

### Frontend Optimization

- [ ] Code splitting for configuration components
- [ ] Lazy loading for tab content
- [ ] Debounced auto-save (1 second)
- [ ] Optimistic UI updates
- [ ] Request deduplication
- [ ] Cache configuration data (5 minutes)

### Backend Optimization

- [ ] Database indexes on foreign keys
- [ ] Query optimization (avoid N+1)
- [ ] Connection pooling configured
- [ ] Rate limiting implemented
- [ ] Response compression enabled

### Lighthouse Targets

- [ ] Performance: >90
- [ ] Accessibility: 100
- [ ] Best Practices: >90
- [ ] SEO: >90

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Linting errors resolved
- [ ] Type errors resolved
- [ ] Code review completed

### Security

- [ ] Security audit completed
- [ ] Vulnerability scan passed
- [ ] API keys not in version control
- [ ] Environment variables documented
- [ ] Rate limiting tested
- [ ] Input validation tested

### Accessibility

- [ ] Automated a11y tests passing
- [ ] Screen reader testing completed
- [ ] Keyboard navigation verified
- [ ] Color contrast verified
- [ ] Focus management tested

### Performance

- [ ] Lighthouse audit passed
- [ ] Load time <3 seconds
- [ ] Time to Interactive <5 seconds
- [ ] Bundle size optimized
- [ ] Database queries optimized

### Documentation

- [ ] API documentation updated
- [ ] Component documentation completed
- [ ] User guide updated
- [ ] Deployment guide updated
- [ ] Rollback procedures documented

---

## Rollout Plan

### Phase 1: OAuth Enhancement (Week 1)

**Tasks:**
- [ ] Create OAuthConnectionCard component
- [ ] Implement oauthStore
- [ ] Add OAuth service methods
- [ ] Backend /api/auth/test endpoint
- [ ] Write unit tests
- [ ] Integration tests
- [ ] Code review
- [ ] Deploy to staging

**Success Criteria:**
- OAuth connection test works
- Token refresh UI functional
- All tests passing

### Phase 2: LLM Configuration (Week 2)

**Tasks:**
- [ ] Database migration
- [ ] Backend encryption service
- [ ] LLM provider endpoints
- [ ] Frontend LLMProviderCard
- [ ] llmConfigStore implementation
- [ ] Provider testing logic
- [ ] Unit tests
- [ ] Integration tests
- [ ] Security audit
- [ ] Deploy to staging

**Success Criteria:**
- Can add/edit/delete providers
- API keys encrypted properly
- Connection testing works
- All tests passing

### Phase 3: Email Rules (Week 3)

**Tasks:**
- [ ] Database migration
- [ ] Email rules backend
- [ ] Rule matching engine
- [ ] EmailParsingRulesCard
- [ ] emailRulesStore
- [ ] Drag-and-drop functionality
- [ ] Rule testing interface
- [ ] Unit tests
- [ ] Integration tests
- [ ] Deploy to staging

**Success Criteria:**
- Can create/edit/delete rules
- Rule matching works correctly
- Priority ordering functional
- All tests passing

### Phase 4: Polish & Production (Week 4)

**Tasks:**
- [ ] User preferences enhancements
- [ ] Full accessibility audit
- [ ] Performance optimization
- [ ] E2E test suite
- [ ] User acceptance testing
- [ ] Documentation updates
- [ ] Production deployment
- [ ] Monitoring setup

**Success Criteria:**
- All acceptance criteria met
- Zero critical bugs
- Performance targets met
- Monitoring active

---

## Monitoring & Alerts

### Metrics to Track

```typescript
// Configuration usage
- OAuth connection success rate
- OAuth token refresh success rate
- LLM provider test success rate
- LLM response time (p50, p95, p99)
- Email rule match accuracy
- Configuration save success rate

// User engagement
- Active configurations by user
- Most used LLM providers
- Email rules per user
- Configuration page visits
```

### Alert Thresholds

```yaml
alerts:
  oauth_failure_rate:
    threshold: >5%
    severity: high

  llm_test_failure_rate:
    threshold: >10%
    severity: medium

  api_key_decryption_failure:
    threshold: >0
    severity: critical

  configuration_save_failure:
    threshold: >5%
    severity: medium
```

---

## Troubleshooting Guide

### Common Issues

**Issue:** OAuth token refresh fails
**Solution:**
1. Check Google OAuth credentials
2. Verify refresh token in database
3. Check token expiry date
4. Review backend logs for errors

**Issue:** API key decryption fails
**Solution:**
1. Verify ENCRYPTION_SECRET environment variable
2. Check encrypted key format (salt:iv:authTag:ciphertext)
3. Review migration for token format issues
4. Re-authenticate if necessary

**Issue:** Email rules not matching
**Solution:**
1. Test rule against sample email
2. Check keyword case sensitivity
3. Verify sender domain format
4. Review rule priority order
5. Check attachment requirements

---

## Support Resources

- **Full Design Document:** `/docs/configuration-page-design.md`
- **Visual Mockups:** `/docs/configuration-page-mockups.md`
- **API Reference:** `/docs/API_REFERENCE.md`
- **Security Guide:** `/docs/SECURITY_AUDIT_REPORT.md`
- **Testing Guide:** `/docs/testing-strategy.md`

---

**Questions?**
Contact: Technical Lead or Frontend Architect
