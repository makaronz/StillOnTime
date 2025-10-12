# Configuration Page Design - Executive Summary

**Document:** Configuration Page UI/UX Design
**Date:** 2025-10-12
**Status:** Ready for Implementation

---

## Overview

Comprehensive design for StillOnTime configuration page managing OAuth connections, LLM provider settings, email parsing rules, and user preferences. The design prioritizes **accessibility (WCAG 2.1 AA)**, **security**, and **progressive disclosure** to prevent overwhelming users.

---

## Key Features

### 1. OAuth Connection Management

**Status:** Enhancement of existing authentication
**Location:** `frontend/src/components/configuration/OAuthConnectionCard.tsx` (NEW)

**Core Capabilities:**
- Real-time connection status with visual indicators
- Token expiry tracking and manual refresh
- One-click disconnect with confirmation
- Re-authentication flow for expired tokens
- Connection testing with immediate feedback

**Visual States:**
- ✓ Connected (green) - Shows account info, scopes, expiry
- ⚠️ Needs Re-auth (yellow) - Clear call-to-action
- ✗ Disconnected (red) - Benefits list + connect button

### 2. LLM Provider Configuration

**Status:** NEW Feature
**Location:** `frontend/src/components/configuration/LLMProviderCard.tsx` (NEW)

**Supported Providers:**
- OpenAI (GPT-4, GPT-3.5-turbo)
- Anthropic (Claude 3 Opus, Sonnet)
- Local Models (Ollama, custom endpoints)

**Security Features:**
- API keys encrypted with AES-256-GCM before storage
- Frontend only shows masked keys (●●●●●●●●sk-abc123)
- Never transmit plaintext keys in responses
- Secure deletion with token revocation

**Configuration Options:**
- Model selection (dropdown)
- Max tokens (100-8000 range)
- Temperature (0-1 slider)
- Custom endpoints (for local models)
- Connection testing before save

### 3. Email Parsing Rules

**Status:** NEW Feature
**Location:** `frontend/src/components/configuration/EmailParsingRulesCard.tsx` (NEW)

**Rule Components:**
- **Keywords:** Match any/all logic
- **Sender Domains:** Whitelist filtering
- **Priority Levels:** Urgent, High, Medium, Low
- **Conditions:** Attachment requirements, subject filters
- **Actions:** Auto-process, notification channels, labeling

**Advanced Features:**
- Drag-and-drop priority reordering
- Live rule testing with sample emails
- Default StillOnTime keywords (read-only)
- Match statistics and analytics

### 4. Enhanced User Preferences

**Status:** Enhancement of existing components
**Additions:**
- Timezone and locale settings
- Default LLM provider selection
- Processing automation options
- Notification scheduling

---

## Component Hierarchy

```
ConfigurationPage (Enhanced)
├── NavigationTabs (NEW)
│   ├── OAuth & Connections
│   ├── LLM Configuration
│   ├── Email Rules
│   └── User Preferences
└── TabContent
    ├── OAuthConnectionCard (NEW)
    ├── LLMProviderCard (NEW)
    ├── EmailParsingRulesCard (NEW)
    ├── ApiConnectionCard (EXISTS)
    ├── NotificationConfigCard (EXISTS)
    ├── AddressConfigCard (EXISTS)
    └── TimeBufferConfigCard (EXISTS)
```

---

## State Management

### New Stores to Create

**1. OAuth Store** (`oauthStore.ts`)
```typescript
interface OAuthStore {
  oauthStatus: OAuthStatus | null
  checkOAuthStatus(): Promise<void>
  refreshToken(): Promise<void>
  disconnectAccount(): Promise<void>
  reconnectAccount(): Promise<void>
  testConnection(): Promise<boolean>
}
```

**2. LLM Config Store** (`llmConfigStore.ts`)
```typescript
interface LLMConfigStore {
  providers: LLMProvider[]
  activeProvider: string | null
  loadProviders(): Promise<void>
  addProvider(provider): Promise<void>
  testProvider(id: string): Promise<TestResult>
  validateApiKey(provider, key): Promise<boolean>
}
```

**3. Email Rules Store** (`emailRulesStore.ts`)
```typescript
interface EmailRulesStore {
  rules: EmailRule[]
  loadRules(): Promise<void>
  addRule(rule): Promise<void>
  reorderRules(rules): Promise<void>
  testRule(rule, email): Promise<boolean>
}
```

---

## Backend API Endpoints

### New Endpoints Required

**LLM Providers:**
```
GET    /api/llm/providers           - List user's providers
POST   /api/llm/providers           - Add new provider
PUT    /api/llm/providers/:id       - Update provider
DELETE /api/llm/providers/:id       - Remove provider
POST   /api/llm/test/:id            - Test connection
POST   /api/llm/validate-key        - Validate API key
```

**Email Rules:**
```
GET    /api/email/rules             - List user's rules
POST   /api/email/rules             - Create new rule
PUT    /api/email/rules/:id         - Update rule
DELETE /api/email/rules/:id         - Delete rule
POST   /api/email/rules/:id/test    - Test rule
PUT    /api/email/rules/reorder     - Reorder priority
```

**OAuth Enhancement:**
```
GET    /api/auth/test               - Test OAuth connection
```

---

## Database Migrations

### LLM Providers Table

```sql
CREATE TABLE llm_providers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  provider_name VARCHAR(50) NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  max_tokens INTEGER DEFAULT 4000,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  endpoint TEXT,
  is_active BOOLEAN DEFAULT false,
  last_tested TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Email Parsing Rules Table

```sql
CREATE TABLE email_parsing_rules (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority VARCHAR(20) NOT NULL,
  priority_order INTEGER NOT NULL,
  keywords TEXT[] NOT NULL,
  sender_domains TEXT[],
  require_attachment BOOLEAN DEFAULT false,
  auto_process BOOLEAN DEFAULT false,
  notify_channels TEXT[] NOT NULL,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Accessibility Features (WCAG 2.1 AA)

### Keyboard Navigation
- Tab through all interactive elements
- Arrow keys for tab navigation
- Enter/Space to activate buttons
- Escape to close modals
- Focus visible indicators (3px outline)

### Screen Reader Support
- ARIA labels on all interactive elements
- Live regions for status announcements
- Role attributes (tab, tabpanel, status, alert)
- Descriptive button labels
- Form field descriptions

### Color Contrast
- Text on white: minimum 4.5:1 ratio
- Status colors:
  - Success: #047857 (5.02:1) ✓
  - Warning: #92400e (7.92:1) ✓
  - Error: #991b1b (7.88:1) ✓
- Interactive elements: #2563eb (4.79:1) ✓

---

## Security Implementation

### API Key Encryption

**Backend Encryption:**
```typescript
// AES-256-GCM with unique salt per key
encrypted = `${salt}:${iv}:${authTag}:${ciphertext}`
```

**Frontend Display:**
```typescript
// Never show full API key
maskedKey = "●●●●●●●●sk-abc123" // Last 8 chars only
```

**Storage:**
- Database: Encrypted ciphertext only
- Frontend: No plaintext storage
- Transmission: HTTPS only

### Input Validation

**Zod Schemas:**
```typescript
LLMProviderSchema = z.object({
  apiKey: z.string().min(20).max(200),
  model: z.string().min(1).max(100),
  maxTokens: z.number().int().min(100).max(8000)
})

EmailRuleSchema = z.object({
  keywords: z.array(z.string()).min(1).max(20),
  priority: z.enum(['urgent', 'high', 'medium', 'low'])
})
```

### Rate Limiting
- API key validation: 10 attempts per 15 minutes
- Rule testing: 50 tests per hour
- Provider testing: 20 tests per hour

---

## Responsive Design

### Breakpoints
- **Mobile (< 640px):** Single column, vertical tabs, touch-friendly (44x44px buttons)
- **Tablet (640-1023px):** 2-column grid, horizontal tabs, side-by-side forms
- **Desktop (1024px+):** Multi-column layout, maximum width 1400px

### Mobile Optimizations
- Collapsible sections
- Full-width buttons
- Larger touch targets
- Simplified navigation
- Progressive disclosure

---

## Performance Optimization

### Code Splitting
```typescript
const OAuthConnectionCard = lazy(() => import('./OAuthConnectionCard'))
const LLMProviderCard = lazy(() => import('./LLMProviderCard'))
// Load only active tab content
```

### Data Fetching
```typescript
// Parallel loading on mount
Promise.all([
  oauthStore.checkOAuthStatus(),
  llmConfigStore.loadProviders(),
  emailRulesStore.loadRules()
])
```

### Caching
- Configuration data: 5-minute cache
- OAuth status: 2-minute cache
- LLM provider list: 10-minute cache

---

## Implementation Roadmap

### Phase 1: OAuth Enhancement (Week 1)
- Create OAuthConnectionCard component
- Implement oauthStore with Zustand
- Add OAuth service methods
- Backend /api/auth/test endpoint
- Unit and integration tests

### Phase 2: LLM Configuration (Week 2)
- Create LLMProviderCard component
- Implement llmConfigStore
- Backend encryption service
- Database migrations
- API endpoints for LLM management
- Provider testing logic

### Phase 3: Email Rules (Week 3)
- Create EmailParsingRulesCard
- Implement emailRulesStore
- Drag-and-drop reordering
- Rule matching engine
- Database migrations
- Testing interface

### Phase 4: Polish & Testing (Week 4)
- Enhance user preferences
- Accessibility audit
- Performance optimization
- E2E testing
- User acceptance testing

---

## Testing Strategy

### Unit Tests (>90% coverage)
- Store actions and state management
- Component rendering and interactions
- Form validation
- Error handling

### Integration Tests
- OAuth connection flow
- LLM provider management
- Email rule creation and testing
- Configuration persistence

### E2E Tests
- Complete user workflows
- Multi-step processes
- Error scenarios
- Cross-browser compatibility

### Accessibility Tests
- Automated axe-core scanning
- Keyboard navigation flows
- Screen reader announcements
- Color contrast validation

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (>90% coverage)
- [ ] Accessibility audit complete
- [ ] Security audit complete
- [ ] Performance audit (Lighthouse >90)
- [ ] Code review approved
- [ ] Documentation updated

### Database
- [ ] Migration scripts tested
- [ ] Rollback procedures documented
- [ ] Indexes created
- [ ] Data validation scripts

### Monitoring
- [ ] Error tracking (Sentry)
- [ ] Analytics events configured
- [ ] Performance metrics tracked
- [ ] Alert thresholds set

---

## Key Design Decisions

### 1. Tabbed Navigation
**Rationale:** Progressive disclosure prevents overwhelming users with all settings at once. Each tab focuses on a specific configuration area.

### 2. API Key Masking
**Rationale:** Security best practice - never display full API keys. Users can verify configuration without exposing sensitive data.

### 3. Drag-and-Drop Rule Ordering
**Rationale:** Visual priority management is more intuitive than numerical input. Rules process in order, so visual ordering is critical.

### 4. Inline Testing
**Rationale:** Immediate feedback reduces configuration errors. Users can validate settings before saving.

### 5. Separate Stores
**Rationale:** Modular state management improves maintainability and allows independent testing of each feature.

---

## Next Steps

1. Review design document with team
2. Create detailed technical specifications for each component
3. Set up development environment
4. Begin Phase 1 implementation (OAuth enhancement)
5. Establish testing framework and CI/CD integration

---

## Related Documents

- Full Design Document: `/docs/configuration-page-design.md`
- Existing OAuth Design: `/docs/oauth-config-page-design.json`
- API Reference: `/docs/API_REFERENCE.md`
- Security Audit: `/docs/SECURITY_AUDIT_REPORT.md`

---

**Document Status:** Ready for Implementation
**Next Review:** After Phase 1 completion
