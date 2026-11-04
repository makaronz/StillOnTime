module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': {
      useESM: false,
      isolatedModules: true,
    },
  },
  testTimeout: 10000,
  // Each test file loads the full route graph (tests/setup.ts imports
  // @/routes), and that registry stays reachable after the file finishes:
  // measured ~95 MB of post-GC heap per file in a worker. Without a limit,
  // workers reached the V8 heap limit after ~15-20 files and Jest killed them
  // ("A jest worker process ... was terminated by another process:
  // signal=SIGTERM"), failing whichever suite happened to be running. A worker
  // whose heap exceeds this after a test file is restarted. Does not change
  // which tests run or what they assert. Root cause: docs/audit/bug-findings.json OPEN-25.
  workerIdleMemoryLimit: '1GB',
};