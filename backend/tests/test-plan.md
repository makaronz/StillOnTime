# OAuth and Gmail Integration Test Plan

## Executive Summary

This document outlines a comprehensive test strategy for the StillOnTime application's OAuth 2.0 authentication flow, Gmail API integration, email processing capabilities, and configuration page functionality. The test plan follows industry best practices with emphasis on security, reliability, and user experience.

**Testing Framework**: Jest with Supertest for API testing
**Test Coverage Target**: >80% for critical paths, >90% for OAuth/security flows
**Test Environment**: Isolated test database with mocked external APIs

---

## 1. OAuth 2.0 Authentication Flow Testing

### 1.1 Login Initiation (`GET /auth/login`)

#### Test Cases

##### TC-AUTH-001: Successful Login Initiation
**Priority**: 🔴 CRITICAL
**Description**: Verify successful OAuth URL generation
**Prerequisites**: Valid Google OAuth configuration
**Steps**:
1. Send GET request to `/auth/login`
2. Verify response contains `authUrl` and `state`
3. Validate `state` is 64-character hex string
4. Confirm `authUrl` contains required parameters

**Expected Results**:
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/...",
  "state": "<64-char-hex>",
  "message": "Redirect to Google OAuth for authentication"
}
```

**Acceptance Criteria**:
- Response status: 200
- `state` parameter is cryptographically secure (32 bytes)
- `authUrl` includes all required scopes
- State is unique per request

##### TC-AUTH-002: Login with Custom State Parameter
**Priority**: 🟡 IMPORTANT
**Description**: Test state parameter forwarding
**Steps**:
1. Send GET request with `?state=custom-state-value`
2. Verify custom state is returned

**Expected Results**:
- Returns provided state value
- State validation still applied

##### TC-AUTH-003: Login Initiation Error Handling
**Priority**: 🔴 CRITICAL
**Description**: Verify graceful error handling
**Test Scenarios**:
- Missing Google OAuth credentials
- Invalid OAuth configuration
- Network timeout to Google

**Expected Results**:
```json
{
  "error": "Internal Server Error",
  "message": "Failed to initiate authentication",
  "code": "AUTH_INIT_FAILED",
  "timestamp": "<ISO-8601>",
  "path": "/auth/login"
}
```

---

### 1.2 OAuth Callback (`POST /auth/callback`)

#### Test Cases

##### TC-AUTH-010: Successful OAuth Callback
**Priority**: 🔴 CRITICAL
**Description**: Complete OAuth flow with valid code and state
**Prerequisites**: Valid authorization code and state from Google
**Steps**:
1. POST to `/auth/callback` with valid `code` and `state`
2. Verify token exchange with Google
3. Confirm user info retrieval
4. Validate user creation/update in database
5. Verify JWT token generation

**Expected Results**:
```json
{
  "success": true,
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "name": "Test User"
  },
  "token": "<jwt-token>",
  "message": "Authentication successful"
}
```

**Acceptance Criteria**:
- User record created/updated in database
- Tokens encrypted with AES-256-GCM
- JWT token valid and contains correct payload
- Response time <2 seconds
- All database operations atomic

##### TC-AUTH-011: Missing Authorization Code
**Priority**: 🔴 CRITICAL
**Description**: Reject callback without code
**Steps**:
1. POST to `/auth/callback` with state but no code

**Expected Results**:
```json
{
  "error": "Bad Request",
  "message": "Authorization code is required",
  "code": "MISSING_AUTH_CODE",
  "timestamp": "<ISO-8601>",
  "path": "/auth/callback"
}
```

##### TC-AUTH-012: Invalid State Parameter (CSRF Attack)
**Priority**: 🔴 CRITICAL
**Description**: Detect and prevent CSRF attacks
**Test Scenarios**:
- Missing state parameter
- State too short (<16 characters)
- Non-alphanumeric state characters
- Null or empty state

**Expected Results**:
```json
{
  "error": "Bad Request",
  "message": "Invalid state parameter - possible CSRF attack",
  "code": "INVALID_STATE",
  "timestamp": "<ISO-8601>",
  "path": "/auth/callback"
}
```

**Security Requirements**:
- MUST reject invalid states
- MUST log security events
- MUST not expose internal state validation logic

##### TC-AUTH-013: OAuth Provider Error
**Priority**: 🔴 CRITICAL
**Description**: Handle errors from Google OAuth
**Test Scenarios**:
- `error=access_denied` (user cancelled)
- `error=invalid_scope`
- `error=server_error`

**Expected Results**:
```json
{
  "error": "Bad Request",
  "message": "OAuth authentication failed: access_denied",
  "code": "OAUTH_ERROR",
  "timestamp": "<ISO-8601>",
  "path": "/auth/callback"
}
```

##### TC-AUTH-014: Invalid Authorization Code
**Priority**: 🔴 CRITICAL
**Description**: Handle invalid/expired auth codes
**Steps**:
1. POST with expired or invalid authorization code
2. Verify graceful error handling

**Expected Results**:
- Error response with appropriate message
- No partial database updates
- User can retry authentication

##### TC-AUTH-015: Token Exchange Network Failure
**Priority**: 🟡 IMPORTANT
**Description**: Handle Google API unavailability
**Test Scenarios**:
- Network timeout
- Google API 5xx errors
- Connection refused

**Expected Results**:
- Graceful error response
- Appropriate retry logic (if implemented)
- No data corruption

##### TC-AUTH-016: Incomplete User Information
**Priority**: 🟡 IMPORTANT
**Description**: Handle missing user data from Google
**Steps**:
1. Mock Google userinfo API to return incomplete data
2. Verify error handling

**Expected Results**:
- Clear error message
- Request to re-authenticate
- No partial user records

---

### 1.3 Token Refresh (`POST /auth/refresh`)

#### Test Cases

##### TC-AUTH-020: Successful Token Refresh
**Priority**: 🔴 CRITICAL
**Description**: Refresh valid JWT session token
**Prerequisites**: Authenticated user with valid JWT
**Steps**:
1. Send POST with valid JWT in Authorization header
2. Verify new JWT generation
3. Confirm user data consistency

**Expected Results**:
```json
{
  "success": true,
  "token": "<new-jwt-token>",
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "name": "Test User"
  },
  "message": "Token refreshed successfully"
}
```

**Acceptance Criteria**:
- New JWT has updated expiry (24 hours)
- Old JWT becomes invalid (if token blacklist implemented)
- User data matches database

##### TC-AUTH-021: Refresh Without Authentication
**Priority**: 🔴 CRITICAL
**Description**: Reject refresh for unauthenticated requests

**Expected Results**:
```json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "code": "NOT_AUTHENTICATED"
}
```

##### TC-AUTH-022: Refresh for Non-Existent User
**Priority**: 🟡 IMPORTANT
**Description**: Handle deleted user accounts
**Steps**:
1. Authenticate user
2. Delete user from database
3. Attempt token refresh

**Expected Results**:
```json
{
  "error": "Not Found",
  "message": "User not found",
  "code": "USER_NOT_FOUND"
}
```

---

### 1.4 Logout (`POST /auth/logout`)

#### Test Cases

##### TC-AUTH-030: Successful Logout
**Priority**: 🔴 CRITICAL
**Description**: Revoke OAuth tokens and invalidate session
**Prerequisites**: Authenticated user
**Steps**:
1. POST to `/auth/logout` with valid JWT
2. Verify token revocation with Google
3. Confirm database token cleanup
4. Validate JWT invalidation

**Expected Results**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Acceptance Criteria**:
- OAuth tokens revoked with Google
- Database tokens set to null
- User must re-authenticate to access protected resources

##### TC-AUTH-031: Logout Already Revoked Tokens
**Priority**: 🟢 RECOMMENDED
**Description**: Handle graceful logout even if tokens already invalid
**Steps**:
1. Attempt logout with already-revoked tokens

**Expected Results**:
- Successful logout response
- No errors thrown
- Database cleanup completed

---

### 1.5 Authentication Status (`GET /auth/status`)

#### Test Cases

##### TC-AUTH-040: Status for Authenticated User
**Priority**: 🔴 CRITICAL
**Description**: Return complete auth status
**Steps**:
1. GET `/auth/status` with valid JWT
2. Verify OAuth status retrieval
3. Confirm user data accuracy

**Expected Results**:
```json
{
  "isAuthenticated": true,
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "name": "Test User",
    "createdAt": "<ISO-8601>"
  },
  "oauth": {
    "isAuthenticated": true,
    "scopes": ["gmail.readonly", "calendar", ...],
    "expiresAt": "<ISO-8601>",
    "needsReauth": false
  }
}
```

##### TC-AUTH-041: Status for Unauthenticated User
**Priority**: 🔴 CRITICAL
**Description**: Return unauthenticated status

**Expected Results**:
```json
{
  "isAuthenticated": false,
  "user": null,
  "oauth": {
    "isAuthenticated": false,
    "scopes": [],
    "needsReauth": true
  }
}
```

##### TC-AUTH-042: Status with Expired OAuth Tokens
**Priority**: 🟡 IMPORTANT
**Description**: Detect expired tokens requiring refresh
**Steps**:
1. Set user's token expiry to past date
2. GET `/auth/status`

**Expected Results**:
- `oauth.needsReauth` should be `true` if no refresh token
- `oauth.needsReauth` should be `false` if refresh token available

---

### 1.6 Re-authentication (`POST /auth/reauth`)

#### Test Cases

##### TC-AUTH-050: Force Re-authentication
**Priority**: 🟡 IMPORTANT
**Description**: Generate new auth URL for re-consent
**Steps**:
1. POST to `/auth/reauth` as authenticated user
2. Verify new auth URL with consent prompt

**Expected Results**:
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/...",
  "message": "Re-authentication URL generated"
}
```

---

## 2. Gmail API Connection and Authorization

### 2.1 Token Management

#### Test Cases

##### TC-GMAIL-001: Access Token Refresh on Expiry
**Priority**: 🔴 CRITICAL
**Description**: Automatic token refresh when expired
**Prerequisites**: User with expired access token and valid refresh token
**Steps**:
1. Set user's access token expiry to past
2. Attempt Gmail API operation
3. Verify automatic refresh
4. Confirm updated tokens in database

**Expected Results**:
- New access token obtained
- Database updated with new tokens
- Gmail operation succeeds
- Token expiry updated

**Acceptance Criteria**:
- Refresh happens transparently
- No user interaction required
- Operations complete successfully
- Token refresh logged

##### TC-GMAIL-002: Refresh Token Invalid
**Priority**: 🔴 CRITICAL
**Description**: Handle invalid refresh tokens
**Test Scenarios**:
- Refresh token revoked by user
- Refresh token expired
- Refresh token invalid format

**Expected Results**:
- Clear error message requesting re-authentication
- No infinite refresh loops
- Graceful degradation

##### TC-GMAIL-003: No Refresh Token Available
**Priority**: 🔴 CRITICAL
**Description**: Handle missing refresh token
**Steps**:
1. Set user's access token as expired
2. Set refresh token to null
3. Attempt Gmail operation

**Expected Results**:
```
Error: "Access token expired and no refresh token available - re-authentication required"
```

##### TC-GMAIL-004: Concurrent Token Refresh
**Priority**: 🟡 IMPORTANT
**Description**: Prevent race conditions during refresh
**Steps**:
1. Trigger multiple simultaneous Gmail operations with expired token
2. Verify only one refresh occurs
3. Confirm all operations succeed

**Expected Results**:
- Single token refresh
- No duplicate refresh requests
- All operations complete successfully

---

### 2.2 Token Encryption/Decryption

#### Test Cases

##### TC-GMAIL-010: Token Encryption (AES-256-GCM)
**Priority**: 🔴 CRITICAL
**Description**: Verify secure token storage
**Steps**:
1. Store OAuth tokens for user
2. Verify database contains encrypted tokens
3. Confirm encryption format: `salt:iv:authTag:encrypted`
4. Validate unique salt per token

**Expected Results**:
- Tokens stored encrypted in database
- Each token has unique salt
- Authentication tag present for GCM mode
- Plain text never stored

**Security Requirements**:
- MUST use AES-256-GCM
- MUST generate unique salt (not hardcoded)
- MUST store authentication tag
- MUST validate on decryption

##### TC-GMAIL-011: Token Decryption
**Priority**: 🔴 CRITICAL
**Description**: Verify correct decryption
**Steps**:
1. Encrypt token with known value
2. Retrieve from database
3. Decrypt and compare to original

**Expected Results**:
- Decrypted token matches original
- No data corruption
- Decryption succeeds on first attempt

##### TC-GMAIL-012: Decryption Error Handling
**Priority**: 🔴 CRITICAL
**Description**: Handle tampered or corrupted tokens
**Test Scenarios**:
- Modified ciphertext
- Wrong authentication tag
- Corrupted salt or IV
- Invalid format (wrong number of parts)

**Expected Results**:
- Clear error message
- Request to re-authenticate
- No system crashes
- Security event logged

##### TC-GMAIL-013: Legacy Token Format Migration
**Priority**: 🟢 RECOMMENDED
**Description**: Handle old token format gracefully
**Steps**:
1. Create token with old format (iv:encrypted)
2. Attempt decryption
3. Verify fallback to legacy decryption

**Expected Results**:
- Successful decryption with warning logged
- Recommendation to re-encrypt token
- No service disruption

---

## 3. Email Fetching with Error Scenarios

### 3.1 Email Monitoring

#### Test Cases

##### TC-EMAIL-001: Successful Email Fetch
**Priority**: 🔴 CRITICAL
**Description**: Retrieve schedule emails from Gmail
**Prerequisites**: User with valid Gmail access
**Steps**:
1. Call `monitorEmails(userId)`
2. Verify Gmail API search query
3. Confirm email filtering logic
4. Validate email processing

**Expected Results**:
- Emails matching criteria retrieved
- Validation filters applied
- Only schedule emails processed
- Duplicate detection works

**Acceptance Criteria**:
- Max 50 emails retrieved per request
- Only emails with PDF attachments
- Subject contains schedule keywords
- Sender domain validation (optional)

##### TC-EMAIL-002: No Matching Emails
**Priority**: 🟡 IMPORTANT
**Description**: Handle empty result set
**Steps**:
1. Gmail API returns empty array
2. Verify graceful handling

**Expected Results**:
- No errors thrown
- Empty array returned
- Appropriate logging
- No database operations

##### TC-EMAIL-003: Gmail API Rate Limiting
**Priority**: 🔴 CRITICAL
**Description**: Handle rate limit errors
**Test Scenarios**:
- 429 Too Many Requests
- Quota exceeded errors

**Expected Results**:
- Exponential backoff retry (if implemented)
- Clear error message to user
- No data loss
- Retry suggestion

##### TC-EMAIL-004: Gmail API Network Timeout
**Priority**: 🔴 CRITICAL
**Description**: Handle network failures
**Steps**:
1. Mock network timeout to Gmail API
2. Verify error handling

**Expected Results**:
```
Error: "Email monitoring failed: Network timeout"
```
- Appropriate timeout value (e.g., 30 seconds)
- Retry capability
- No partial processing

##### TC-EMAIL-005: Expired OAuth Token During Fetch
**Priority**: 🔴 CRITICAL
**Description**: Auto-refresh and retry
**Steps**:
1. Start email fetch with expired token
2. Verify automatic refresh
3. Confirm retry succeeds

**Expected Results**:
- Token automatically refreshed
- Email fetch completes successfully
- User unaware of refresh

##### TC-EMAIL-006: OAuth Token Revoked
**Priority**: 🔴 CRITICAL
**Description**: Handle revoked access
**Steps**:
1. User revokes Gmail access externally
2. Attempt email fetch

**Expected Results**:
```
Error: "Gmail authentication expired - please re-authenticate"
```
- Clear re-authentication prompt
- No infinite retry loops
- User redirected to login

---

### 3.2 Email Validation

#### Test Cases

##### TC-EMAIL-010: Valid Schedule Email
**Priority**: 🔴 CRITICAL
**Description**: Correctly identify schedule emails
**Test Scenarios**:
- Subject: "Shooting Schedule - Day 1"
- Subject: "Call Sheet - Production XYZ"
- Subject: "Plan zdjęciowy" (Polish)
- PDF attachment present
- From trusted domain

**Expected Results**:
- Email passes validation
- Processed for schedule extraction

##### TC-EMAIL-011: Missing Subject Keywords
**Priority**: 🟡 IMPORTANT
**Description**: Reject emails without keywords
**Steps**:
1. Email with generic subject
2. Has PDF attachment
3. Run validation

**Expected Results**:
- Email rejected
- Reason logged: "no schedule keywords in subject"

##### TC-EMAIL-012: Missing PDF Attachment
**Priority**: 🟡 IMPORTANT
**Description**: Reject emails without PDF
**Steps**:
1. Email with schedule keywords in subject
2. No PDF attachment
3. Run validation

**Expected Results**:
- Email rejected
- Reason logged: "no PDF attachment"

##### TC-EMAIL-013: Untrusted Sender Domain
**Priority**: 🟢 RECOMMENDED
**Description**: Handle emails from unknown senders
**Steps**:
1. Email from non-whitelisted domain
2. Otherwise valid (keywords + PDF)
3. Run validation

**Expected Results**:
- Warning logged but email allowed (configurable)
- Or email rejected if strict mode enabled

##### TC-EMAIL-014: Multiple PDF Attachments
**Priority**: 🟡 IMPORTANT
**Description**: Handle emails with multiple PDFs
**Steps**:
1. Email with 3 PDF attachments
2. Run processing

**Expected Results**:
- All PDFs extracted
- First PDF used for schedule parsing
- Additional PDFs stored for reference

---

### 3.3 Attachment Processing

#### Test Cases

##### TC-EMAIL-020: Download PDF Attachment
**Priority**: 🔴 CRITICAL
**Description**: Successfully download attachment
**Prerequisites**: Valid email with PDF
**Steps**:
1. Call `downloadAttachment(userId, messageId, attachmentId)`
2. Verify base64url decoding
3. Confirm Buffer returned

**Expected Results**:
- PDF data returned as Buffer
- Size matches expected
- Data integrity verified
- Download logged

##### TC-EMAIL-021: Missing Attachment Data
**Priority**: 🔴 CRITICAL
**Description**: Handle empty attachment response
**Steps**:
1. Gmail API returns no attachment data
2. Verify error handling

**Expected Results**:
```
Error: "No attachment data received"
```

##### TC-EMAIL-022: Attachment Too Large
**Priority**: 🟡 IMPORTANT
**Description**: Handle oversized attachments
**Test Scenarios**:
- Attachment >25MB (Gmail limit)
- Attachment >10MB (app limit)

**Expected Results**:
- Clear error message
- Size limit specified
- No memory overflow

##### TC-EMAIL-023: Corrupted Attachment
**Priority**: 🟡 IMPORTANT
**Description**: Handle corrupted PDF data
**Steps**:
1. Download returns invalid PDF data
2. Verify error detection

**Expected Results**:
- Corruption detected
- Email marked for manual review
- No processing crash

---

### 3.4 Duplicate Detection

#### Test Cases

##### TC-EMAIL-030: Duplicate Message ID
**Priority**: 🔴 CRITICAL
**Description**: Prevent reprocessing same email
**Steps**:
1. Process email with ID "msg-123"
2. Attempt to process same email again
3. Verify duplicate detection

**Expected Results**:
- Email skipped on second attempt
- Log message: "Email already processed"
- No duplicate database records

##### TC-EMAIL-031: Duplicate PDF Content
**Priority**: 🟡 IMPORTANT
**Description**: Detect same PDF sent multiple times
**Steps**:
1. Process email with PDF (hash generated)
2. Receive new email with same PDF content
3. Verify duplicate detection

**Expected Results**:
- PDF hash matches existing record
- Email marked as duplicate
- No duplicate schedule creation

##### TC-EMAIL-032: PDF Hash Generation
**Priority**: 🔴 CRITICAL
**Description**: Verify hash consistency
**Steps**:
1. Generate hash for PDF file
2. Modify file slightly (metadata)
3. Generate hash again

**Expected Results**:
- Same content = same hash
- Different content = different hash
- Hash algorithm consistent (SHA-256)

---

### 3.5 Error Recovery

#### Test Cases

##### TC-EMAIL-040: Partial Processing Failure
**Priority**: 🔴 CRITICAL
**Description**: Handle failure during processing
**Steps**:
1. Start processing email batch
2. Simulate failure on 3rd email
3. Verify rollback/recovery

**Expected Results**:
- Failed email marked with error status
- Other emails continue processing
- Error details logged
- User notified of failure

##### TC-EMAIL-041: Database Connection Loss
**Priority**: 🔴 CRITICAL
**Description**: Handle database unavailability
**Steps**:
1. Start email processing
2. Disconnect database mid-operation
3. Verify error handling

**Expected Results**:
- Graceful error response
- No data corruption
- Retry mechanism (if implemented)
- Clear error message

---

## 4. Configuration Page Functionality

### 4.1 OAuth Settings Management

#### Test Cases

##### TC-CONFIG-001: View Current OAuth Status
**Priority**: 🔴 CRITICAL
**Description**: Display OAuth connection status
**Prerequisites**: Authenticated user
**Steps**:
1. Navigate to settings page
2. View OAuth section

**Expected Results**:
- Gmail connection status displayed
- Scopes listed
- Token expiry shown
- Re-authenticate button available

**UI Requirements**:
- Green indicator: Connected and valid
- Yellow indicator: Expiring soon
- Red indicator: Expired or missing

##### TC-CONFIG-002: Initiate Re-authentication
**Priority**: 🟡 IMPORTANT
**Description**: Reconnect Gmail account
**Steps**:
1. Click "Reconnect Gmail" button
2. Follow OAuth flow
3. Return to settings

**Expected Results**:
- New OAuth flow initiated
- User redirected to Google consent
- Settings page shows updated status
- Toast notification confirms success

##### TC-CONFIG-003: Revoke Gmail Access
**Priority**: 🟡 IMPORTANT
**Description**: Disconnect Gmail integration
**Steps**:
1. Click "Disconnect Gmail" button
2. Confirm action
3. Verify revocation

**Expected Results**:
- Confirmation dialog shown
- Tokens revoked with Google
- Database tokens cleared
- Status updated to "Disconnected"
- Email monitoring stops

---

### 4.2 Email Filter Configuration

#### Test Cases

##### TC-CONFIG-010: Configure Sender Whitelist
**Priority**: 🟢 RECOMMENDED
**Description**: Manage trusted sender domains
**Steps**:
1. Navigate to email filters
2. Add "production.com" to whitelist
3. Save configuration

**Expected Results**:
- Domain added to whitelist
- Validation applied to domain format
- Configuration saved to database
- Applied to next email fetch

**Validation Rules**:
- Valid domain format required
- Duplicate domains prevented
- At least one domain required (or allow all)

##### TC-CONFIG-011: Configure Schedule Keywords
**Priority**: 🟢 RECOMMENDED
**Description**: Customize keyword filters
**Steps**:
1. Add custom keyword "film roster"
2. Save configuration

**Expected Results**:
- Keyword added to filter list
- Applied immediately
- Case-insensitive matching

##### TC-CONFIG-012: Invalid Configuration Handling
**Priority**: 🟡 IMPORTANT
**Description**: Prevent invalid settings
**Test Scenarios**:
- Empty keyword list
- Invalid domain format
- Conflicting rules

**Expected Results**:
- Validation errors shown
- Configuration not saved
- Helpful error messages
- Previous config preserved

---

### 4.3 Email Monitoring Settings

#### Test Cases

##### TC-CONFIG-020: Configure Monitoring Frequency
**Priority**: 🟢 RECOMMENDED
**Description**: Adjust email check interval
**Steps**:
1. Set monitoring to "Every 15 minutes"
2. Save settings

**Expected Results**:
- Interval saved
- Cron job updated (if applicable)
- Next check time displayed

##### TC-CONFIG-021: Enable/Disable Monitoring
**Priority**: 🟡 IMPORTANT
**Description**: Toggle email monitoring
**Steps**:
1. Toggle monitoring switch to OFF
2. Verify monitoring stops

**Expected Results**:
- Monitoring paused
- Status indicator updated
- No new emails processed
- Can be re-enabled

---

## 5. Integration Test Scenarios

### 5.1 End-to-End User Flows

#### Test Cases

##### TC-E2E-001: Complete First-Time User Journey
**Priority**: 🔴 CRITICAL
**Description**: Full workflow from signup to email processing
**Steps**:
1. User visits application
2. Clicks "Sign in with Google"
3. Completes OAuth consent
4. Returns to application
5. Gmail monitoring starts automatically
6. Schedule email received and processed

**Expected Results**:
- Smooth, uninterrupted flow
- Clear progress indicators
- Successful authentication
- Email monitoring active
- First email processed correctly

**Performance Requirements**:
- OAuth callback completes in <2s
- Email fetch completes in <5s
- Total flow completes in <15s

##### TC-E2E-002: Token Expiry and Renewal During Active Session
**Priority**: 🔴 CRITICAL
**Description**: Seamless token refresh
**Steps**:
1. User authenticated
2. Access token expires (simulate)
3. User performs action requiring Gmail
4. Token automatically refreshed
5. Action completes

**Expected Results**:
- User unaware of refresh
- No interruption to workflow
- Action completes successfully

##### TC-E2E-003: User Revokes Access Externally
**Priority**: 🟡 IMPORTANT
**Description**: Handle external revocation
**Steps**:
1. User authenticated in app
2. User revokes access in Google account settings
3. App attempts Gmail operation

**Expected Results**:
- Clear error message shown
- User prompted to reconnect
- No data loss
- Easy recovery path

---

### 5.2 Security Test Scenarios

#### Test Cases

##### TC-SEC-001: CSRF Attack Prevention
**Priority**: 🔴 CRITICAL
**Description**: Prevent cross-site request forgery
**Attack Scenarios**:
1. Attacker crafts OAuth callback URL with own code
2. Attempts to use victim's state parameter
3. Sends malicious callback request

**Expected Results**:
- State validation detects mismatch
- Request rejected with 400 error
- Security event logged
- No session created

##### TC-SEC-002: Token Theft Prevention
**Priority**: 🔴 CRITICAL
**Description**: Verify token security measures
**Test Points**:
- Tokens encrypted in database
- JWT uses secure signing algorithm (HS256/RS256)
- No tokens exposed in logs
- No tokens in error messages
- Tokens not in URL parameters

**Expected Results**:
- All security measures in place
- No token leakage
- Encryption validated

##### TC-SEC-003: Session Hijacking Prevention
**Priority**: 🔴 CRITICAL
**Description**: Protect against session attacks
**Test Scenarios**:
- Stolen JWT used from different IP
- JWT replay attack
- Concurrent sessions from different locations

**Expected Results**:
- JWT expiry enforced (24 hours)
- Refresh required after expiry
- Optional: IP binding (if implemented)
- Optional: Device fingerprinting

---

## 6. Performance Test Scenarios

### 6.1 Load Testing

#### Test Cases

##### TC-PERF-001: Concurrent OAuth Logins
**Priority**: 🟡 IMPORTANT
**Description**: Handle multiple simultaneous logins
**Test Parameters**:
- 100 concurrent users
- OAuth callback handling
- Database writes

**Expected Results**:
- All requests complete successfully
- Response time <3s (95th percentile)
- No database deadlocks
- No rate limiting errors

##### TC-PERF-002: Bulk Email Processing
**Priority**: 🟡 IMPORTANT
**Description**: Process large email volumes
**Test Parameters**:
- 500 emails in mailbox
- 50 match schedule criteria
- Concurrent processing

**Expected Results**:
- All emails processed within 2 minutes
- No memory leaks
- Database connection pool managed
- CPU usage <80%

---

## 7. Test Data Requirements

### 7.1 Test Users

```typescript
// Test User Profiles
const TEST_USERS = {
  new_user: {
    email: "newuser@test.com",
    google_id: "google-new-123",
    // No existing tokens
  },
  active_user: {
    email: "active@test.com",
    google_id: "google-active-456",
    access_token: "<valid-encrypted-token>",
    refresh_token: "<valid-encrypted-refresh>",
    token_expiry: new Date(Date.now() + 3600000), // 1 hour future
  },
  expired_user: {
    email: "expired@test.com",
    google_id: "google-expired-789",
    access_token: "<encrypted-expired-token>",
    refresh_token: "<valid-encrypted-refresh>",
    token_expiry: new Date(Date.now() - 3600000), // 1 hour past
  },
  no_refresh_user: {
    email: "norefresh@test.com",
    google_id: "google-norefresh-101",
    access_token: "<encrypted-expired-token>",
    refresh_token: null,
    token_expiry: new Date(Date.now() - 3600000),
  }
};
```

### 7.2 Test Emails

```typescript
// Sample Test Emails
const TEST_EMAILS = {
  valid_schedule_email: {
    id: "msg-valid-001",
    subject: "Shooting Schedule - Day 1",
    from: "production@stillontime.pl",
    has_pdf: true,
    pdf_size: 245000, // ~240KB
  },
  no_attachment_email: {
    id: "msg-noattach-002",
    subject: "Call Sheet Update",
    from: "production@stillontime.pl",
    has_pdf: false,
  },
  wrong_subject_email: {
    id: "msg-wrongsub-003",
    subject: "Meeting Notes",
    from: "admin@company.com",
    has_pdf: true,
  },
  untrusted_sender: {
    id: "msg-untrusted-004",
    subject: "Shooting Schedule",
    from: "unknown@suspicious.com",
    has_pdf: true,
  }
};
```

---

## 8. Test Environment Setup

### 8.1 Prerequisites

```bash
# Install dependencies
npm install

# Set test environment variables
cp .env.example .env.test

# Configure test database
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/stillontime_test"

# Mock OAuth credentials
GOOGLE_CLIENT_ID="test-client-id"
GOOGLE_CLIENT_SECRET="test-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/callback"

# JWT secret
JWT_SECRET="test-jwt-secret-key-32-characters"
```

### 8.2 Database Setup

```bash
# Create test database
npm run db:test:setup

# Run migrations
npm run db:test:migrate

# Seed test data
npm run db:test:seed
```

### 8.3 Mock Configuration

```typescript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
};
```

---

## 9. Test Execution Strategy

### 9.1 Test Phases

#### Phase 1: Unit Tests (Week 1)
**Focus**: Individual service methods
**Coverage Target**: >85%
**Priority**: OAuth service, Gmail service, encryption functions

**Test Files**:
- `oauth2.service.test.ts`
- `gmail.service.test.ts`
- `auth.controller.test.ts`

#### Phase 2: Integration Tests (Week 2)
**Focus**: API endpoints and database interactions
**Coverage Target**: >80%
**Priority**: Auth flow, email processing

**Test Files**:
- `auth.integration.test.ts`
- `gmail.integration.test.ts`
- `oauth-security.test.ts`

#### Phase 3: E2E Tests (Week 3)
**Focus**: Complete user workflows
**Coverage Target**: Critical paths
**Priority**: OAuth flow, email monitoring

**Test Files**:
- `oauth-flow.e2e.test.ts`
- `email-processing.e2e.test.ts`
- `config-page.e2e.test.ts`

#### Phase 4: Performance & Security (Week 4)
**Focus**: Load testing, security validation
**Priority**: High-traffic scenarios, security hardening

**Test Files**:
- `performance.test.ts`
- `security.test.ts`

### 9.2 Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Run integration tests
        run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 10. Success Criteria

### 10.1 Coverage Metrics

| Test Type | Target Coverage | Critical Paths |
|-----------|----------------|----------------|
| Unit Tests | >85% | >95% |
| Integration Tests | >80% | >90% |
| E2E Tests | Critical flows | 100% |

### 10.2 Quality Gates

#### Must Pass (Blocking)
- All OAuth flow tests pass
- All security tests pass
- No critical vulnerabilities
- Token encryption validated
- CSRF protection verified

#### Should Pass (Warning)
- Performance tests meet targets
- Error recovery tests pass
- Configuration tests pass

### 10.3 Performance Benchmarks

| Operation | Target | Maximum |
|-----------|--------|---------|
| OAuth Login | <1s | 2s |
| OAuth Callback | <2s | 5s |
| Token Refresh | <500ms | 1s |
| Email Fetch (50 emails) | <5s | 10s |
| Attachment Download (1MB) | <2s | 5s |

---

## 11. Test Maintenance

### 11.1 Regular Reviews
- Weekly test result analysis
- Monthly test suite audit
- Quarterly performance baseline update

### 11.2 Test Documentation
- Keep test plan synchronized with features
- Document new test cases with PRs
- Update coverage requirements as needed

---

## 12. Risk Assessment

### High-Risk Areas
1. **OAuth State Validation**: CSRF vulnerability if broken
2. **Token Encryption**: Data breach if compromised
3. **Token Refresh Logic**: Service disruption if buggy
4. **Email Filtering**: Wrong emails processed

### Mitigation Strategies
1. Mandatory security test reviews
2. Automated security scanning (OWASP ZAP, Snyk)
3. Penetration testing before production
4. Regular dependency updates

---

## Appendix A: Test Case Template

```typescript
describe('Feature: [Feature Name]', () => {
  describe('[Sub-feature/Method]', () => {
    it('should [expected behavior] when [condition]', async () => {
      // Arrange
      const mockData = { /* setup */ };

      // Act
      const result = await servicMethod(mockData);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
    });
  });
});
```

---

## Appendix B: Mock Data Factories

```typescript
// factories/user.factory.ts
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: faker.datatype.uuid(),
  email: faker.internet.email(),
  name: faker.name.fullName(),
  googleId: `google-${faker.datatype.uuid()}`,
  accessToken: createEncryptedToken(),
  refreshToken: createEncryptedToken(),
  tokenExpiry: new Date(Date.now() + 3600000),
  ...overrides,
});

// factories/email.factory.ts
export const createMockEmail = (overrides?: Partial<GmailMessage>): GmailMessage => ({
  id: `msg-${faker.datatype.uuid()}`,
  threadId: `thread-${faker.datatype.uuid()}`,
  snippet: faker.lorem.sentence(),
  payload: createMockPayload(),
  ...overrides,
});
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-12 | QA Specialist Agent | Initial comprehensive test plan |

---

**End of Test Plan Document**
