/**
 * Runs via Jest `setupFiles`, i.e. BEFORE any test module (and before
 * tests/setup.ts) is imported. `src/config/config.ts` reads and validates
 * process.env at import time, so these values must exist before the first
 * `import "@/config/config"` anywhere in the test graph.
 *
 * Values are synthetic and satisfy backend/src/config/security.ts
 * (>= 48 chars, >= 3 character classes, no banned substrings).
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://test_user:test_password@localhost:5432/stillontime_test";
process.env.REDIS_URL ??= "redis://localhost:6379/1";
process.env.JWT_SECRET ??=
  "t3st-r4nd0m-1gn1tur3-k3y-f0r-t3st1ng-3nv1r0nm3nt-must-b3-l0ng-3n0ugh";
process.env.JWT_REFRESH_SECRET ??=
  "t3st-r3fr3sh-r4nd0m-k3y-f0r-t3st1ng-3nv1r0nm3nt-must-b3-l0ng-3n0ugh";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id.apps.googleusercontent.invalid";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret-value-0000";
process.env.OPENWEATHER_API_KEY ??= "test-openweather-api-key-0000";
process.env.GOOGLE_MAPS_API_KEY ??= "test-google-maps-api-key-0000";
