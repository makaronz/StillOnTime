# Security Quick Reference Guide

**Purpose:** Developer-friendly security checklist for StillOnTime system
**Last Updated:** 2025-10-12

---

## 🔴 CRITICAL SECURITY RULES (Never Break These)

### 1. Never Hardcode Secrets
```typescript
// ❌ BAD
const apiKey = "AIzaSyD1234567890abcdefgh";
const jwtSecret = "my-secret-key";

// ✅ GOOD
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
const jwtSecret = config.jwtSecret;
```

### 2. Always Use Parameterized Queries
```typescript
// ❌ BAD - SQL Injection vulnerable
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ GOOD - Kysely parameterized query
const user = await db
  .selectFrom("users")
  .selectAll()
  .where("email", "=", email)  // Parameterized
  .executeTakeFirst();
```

### 3. Never Log Sensitive Data
```typescript
// ❌ BAD
logger.info("User logged in", { password, token, refreshToken });

// ✅ GOOD
logger.info("User logged in", {
  userId: user.id,
  email: user.email,
  // Omit sensitive fields
});
```

### 4. Always Validate Input
```typescript
// ❌ BAD - No validation
const createUser = async (req, res) => {
  const user = await db.insertInto("users").values(req.body).execute();
};

// ✅ GOOD - Zod validation
const createUser = async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
  });
  const validated = schema.parse(req.body);
  const user = await db.insertInto("users").values(validated).execute();
};
```

---

## 🟡 Authentication & Authorization

### JWT Best Practices
```typescript
// ✅ Set appropriate expiration
const token = jwt.sign(payload, secret, { expiresIn: '1h' });

// ✅ Always verify tokens
try {
  const decoded = jwt.verify(token, secret);
} catch (error) {
  // Handle invalid/expired token
}

// ✅ Use strong secrets (64+ chars)
JWT_SECRET=$(openssl rand -base64 64)
```

### OAuth2 Security Checklist
- [ ] Use state parameter for CSRF protection
- [ ] Validate state with constant-time comparison
- [ ] Store tokens encrypted at rest
- [ ] Use `prompt: 'consent'` to get refresh tokens
- [ ] Implement token rotation
- [ ] Validate redirect URIs

### Middleware Usage
```typescript
// ✅ Protect routes with authentication
router.get('/profile',
  authenticateToken,  // Verify JWT
  requireValidOAuth,  // Check Google OAuth status
  profileController.getProfile
);

// ✅ Use rate limiting on auth endpoints
router.post('/login',
  authRateLimit(5, 15 * 60 * 1000),  // 5 attempts per 15 min
  authController.login
);
```

---

## 🟠 Data Protection

### Token Encryption
```typescript
// ✅ Encrypt sensitive tokens before storage
const encryptedToken = encryptToken(oauthToken);
await db.updateTable("users")
  .set({ accessToken: encryptedToken })
  .where("id", "=", userId)
  .execute();

// ✅ Decrypt when retrieving
const decryptedToken = decryptToken(user.accessToken);
```

### Secure Cookie Configuration
```typescript
// ✅ Set security flags
res.cookie('auth_token', token, {
  httpOnly: true,      // Prevent XSS
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 86400000,    // 24 hours
});
```

### Password Handling
```typescript
// ✅ Use bcrypt for password hashing
import bcrypt from 'bcryptjs';

// Hash password
const hashedPassword = await bcrypt.hash(password, 12);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

---

## 🔵 Input Validation

### Zod Schema Patterns
```typescript
// ✅ Email validation
const emailSchema = z.string().email().toLowerCase().max(255);

// ✅ URL validation
const urlSchema = z.string().url().max(2048);

// ✅ Date validation
const dateSchema = z.coerce.date().min(new Date());

// ✅ Enum validation
const statusSchema = z.enum(['pending', 'completed', 'failed']);

// ✅ Nested object validation
const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  config: z.object({
    notifications: z.boolean(),
    theme: z.enum(['light', 'dark']),
  }).optional(),
});
```

### Express Validator Patterns
```typescript
// ✅ Request validation
router.post('/callback',
  [
    body('code').isString().notEmpty(),
    body('state').isString().isLength({ max: 255 }),
    body('error').optional().isString(),
  ],
  handleValidationErrors,
  authController.callback
);
```

---

## 🟢 API Security

### Rate Limiting Configuration
```typescript
// ✅ Global rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests',
}));

// ✅ Endpoint-specific limits
router.post('/auth/login',
  rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }),
  authController.login
);
```

### CORS Configuration
```typescript
// ✅ Whitelist specific origins
app.use(cors({
  origin: [
    'https://stillontime.app',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

### Security Headers (Helmet)
```typescript
// ✅ Configure Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

---

## 🟣 Error Handling

### Secure Error Responses
```typescript
// ❌ BAD - Leaks internal details
catch (error) {
  res.status(500).json({ error: error.stack });
}

// ✅ GOOD - Safe error messages
catch (error) {
  logger.error('Operation failed', { error, userId: req.user?.id });

  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(500).json({
    error: 'Internal Server Error',
    message,
    code: 'OPERATION_FAILED',
    timestamp: new Date().toISOString(),
  });
}
```

### Custom Error Classes
```typescript
// ✅ Use domain-specific error types
throw new OAuthError(
  'OAuth token expired',
  ErrorCode.OAUTH_TOKEN_EXPIRED,
  { userId, provider: 'google' }
);

throw new ValidationError(
  'Invalid email format',
  ErrorCode.VALIDATION_ERROR,
  { field: 'email', value: 'not-an-email' }
);
```

---

## 🔐 Cryptography

### Random Generation
```typescript
// ✅ Use crypto.randomBytes for security-critical randomness
import crypto from 'crypto';

// OAuth state parameter
const state = crypto.randomBytes(32).toString('hex');

// Session ID
const sessionId = crypto.randomBytes(16).toString('base64');

// ❌ DON'T use Math.random() for security
const weakState = Math.random().toString(36);  // INSECURE
```

### Encryption Best Practices
```typescript
// ✅ Use authenticated encryption (AES-GCM)
const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(secret, salt, 32);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv(algorithm, key, iv);

let encrypted = cipher.update(plaintext, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();

// Store: iv:authTag:encrypted
return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
```

### Constant-Time Comparison
```typescript
// ✅ Prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ❌ DON'T use direct comparison for secrets
if (receivedToken === storedToken) { ... }  // Timing attack vulnerable
```

---

## 🛡️ Frontend Security

### XSS Prevention
```typescript
// ✅ Use React's automatic escaping
<div>{user.name}</div>  // Automatically escaped

// ✅ Sanitize HTML if necessary
import DOMPurify from 'dompurify';
const cleanHtml = DOMPurify.sanitize(userInput);

// ❌ NEVER use dangerouslySetInnerHTML with unsanitized input
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // XSS vulnerable
```

### Secure Storage
```typescript
// ❌ BAD - Tokens in localStorage (XSS vulnerable)
localStorage.setItem('token', jwt);

// ✅ GOOD - Use HttpOnly cookies (set by backend)
// Frontend: No manual token management needed
// Backend: Set cookie with httpOnly flag

// ✅ ACCEPTABLE - Use sessionStorage if cookies not feasible
sessionStorage.setItem('token', jwt);  // Cleared on tab close
```

### Content Security Policy
```html
<!-- ✅ Add CSP meta tag -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

---

## 📊 Logging & Monitoring

### Security Event Logging
```typescript
// ✅ Log security-relevant events
logger.info('Authentication successful', {
  category: 'security',
  event: 'auth_success',
  userId: user.id,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
});

logger.warn('Failed login attempt', {
  category: 'security',
  event: 'auth_failure',
  email: req.body.email,
  reason: 'invalid_password',
  ip: req.ip,
});

// ❌ DON'T log sensitive data
logger.info('Login', { password, token });  // NEVER DO THIS
```

### Audit Trail
```typescript
// ✅ Create audit logs for critical operations
await auditLog.create({
  userId: user.id,
  action: 'UPDATE_CONFIGURATION',
  resource: 'user_config',
  changes: { notificationEmail: true },
  ip: req.ip,
  timestamp: new Date(),
});
```

---

## 🧪 Security Testing

### Unit Test Security Scenarios
```typescript
// ✅ Test authentication failures
test('should reject invalid JWT token', async () => {
  const response = await request(app)
    .get('/api/profile')
    .set('Authorization', 'Bearer invalid-token');

  expect(response.status).toBe(401);
  expect(response.body.code).toBe('INVALID_TOKEN');
});

// ✅ Test rate limiting
test('should enforce rate limits', async () => {
  const requests = Array(6).fill(null).map(() =>
    request(app).post('/api/auth/login')
  );

  const responses = await Promise.all(requests);
  const last = responses[responses.length - 1];

  expect(last.status).toBe(429);
  expect(last.body.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
});

// ✅ Test SQL injection protection
test('should prevent SQL injection', async () => {
  const maliciousEmail = "'; DROP TABLE users; --";

  const response = await request(app)
    .post('/api/auth/callback')
    .send({ code: 'test', email: maliciousEmail });

  // Should either reject as invalid email or safely parameterize
  expect(response.status).not.toBe(200);
});
```

---

## 🚨 Common Vulnerabilities to Avoid

### 1. SQL Injection
```typescript
// ❌ NEVER concatenate user input into SQL
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ ALWAYS use parameterized queries
const user = await db
  .selectFrom("users")
  .where("id", "=", userId)
  .selectAll()
  .executeTakeFirst();
```

### 2. XSS (Cross-Site Scripting)
```typescript
// ❌ NEVER render unsanitized user input
<div dangerouslySetInnerHTML={{ __html: comment }} />

// ✅ ALWAYS sanitize or use automatic escaping
<div>{comment}</div>  // React escapes by default
```

### 3. CSRF (Cross-Site Request Forgery)
```typescript
// ❌ BAD - No CSRF protection
app.post('/api/auth/logout', authController.logout);

// ✅ GOOD - CSRF token validation
app.use(csrf());
app.post('/api/auth/logout', csrfProtection, authController.logout);
```

### 4. Insecure Direct Object References
```typescript
// ❌ BAD - No ownership check
router.get('/schedules/:id', async (req, res) => {
  const schedule = await db
    .selectFrom("schedules")
    .where("id", "=", req.params.id)
    .selectAll()
    .executeTakeFirst();
  res.json(schedule);
});

// ✅ GOOD - Verify ownership
router.get('/schedules/:id', authenticateToken, async (req, res) => {
  const schedule = await db
    .selectFrom("schedules")
    .where("id", "=", req.params.id)
    .where("userId", "=", req.user.userId)  // Check ownership
    .selectAll()
    .executeTakeFirst();

  if (!schedule) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(schedule);
});
```

### 5. Mass Assignment
```typescript
// ❌ BAD - User can set any field
await db.updateTable("users")
  .set(req.body)  // User could set isAdmin: true
  .where("id", "=", userId)
  .execute();

// ✅ GOOD - Explicitly allow fields
const allowedFields = { name, email, homeAddress };
await db.updateTable("users")
  .set(allowedFields)
  .where("id", "=", userId)
  .execute();
```

---

## 🔧 Development Workflow

### Pre-Commit Checklist
- [ ] No hardcoded secrets or API keys
- [ ] All user input validated with Zod/express-validator
- [ ] No SQL string concatenation (use Kysely)
- [ ] Sensitive data not logged
- [ ] Error messages don't leak internal details
- [ ] Authentication required on protected routes
- [ ] Rate limiting on authentication endpoints
- [ ] Tests include security scenarios

### Code Review Security Focus
- OAuth state parameter validation
- Token storage and transmission security
- Input validation completeness
- SQL injection prevention (parameterized queries)
- XSS prevention (proper escaping)
- Authorization checks (user owns resource)
- Error handling (no information disclosure)
- Cryptographic function usage (proper algorithms, no hardcoded salts)

---

## 📚 Additional Resources

### Internal Documentation
- [Full Security Audit Report](./SECURITY_AUDIT_REPORT.md)
- [Security Remediation Tracking](./SECURITY_REMEDIATION_TRACKING.md)

### External Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### Tools
- `npm audit` - Dependency vulnerability scanning
- `eslint-plugin-security` - Security-focused linting
- Snyk - Continuous dependency monitoring
- OWASP ZAP - Dynamic application security testing

---

**Questions or Security Concerns?**
Contact: [Security Team Email/Slack Channel]

**Last Updated:** 2025-10-12
**Next Review:** After Phase 1 remediation
