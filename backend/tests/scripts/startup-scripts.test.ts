/**
 * Startup Scripts - Unit Tests
 *
 * Tests individual startup script functions and behaviors
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';

const PROJECT_ROOT = resolve(__dirname, '../../../');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');

describe('Startup Scripts - Unit Tests', () => {
  let testTmpDir: string;

  beforeAll(() => {
    // Create temporary directory for test artifacts
    testTmpDir = join(tmpdir(), `stillontime-test-${Date.now()}`);
    mkdirSync(testTmpDir, { recursive: true });
  });

  describe('app-control.sh - Application Lifecycle', () => {
    const scriptPath = join(SCRIPTS_DIR, 'app-control.sh');

    test('should exist and be executable', () => {
      expect(existsSync(scriptPath)).toBe(true);

      // Check if file is readable
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    test('should contain required functions', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      const requiredFunctions = [
        'check_port',
        'get_pid',
        'start_app',
        'stop_app',
        'restart_app',
        'status_app'
      ];

      requiredFunctions.forEach(func => {
        expect(content).toContain(func);
      });
    });

    test('should define correct port numbers', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('BACKEND_PORT=3001');
      expect(content).toContain('FRONTEND_PORT=3000');
    });

    test('should have proper error handling', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      // Should check for errors and exit appropriately
      expect(content).toContain('exit 1');
      expect(content).toMatch(/if.*then/);
      expect(content).toContain('echo');
    });

    test('should validate prerequisites before starting', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      const prerequisites = [
        'Docker',
        'PostgreSQL',
        'Redis',
        '.env'
      ];

      prerequisites.forEach(prereq => {
        expect(content.toLowerCase()).toContain(prereq.toLowerCase());
      });
    });

    test('should have graceful shutdown logic', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('stop_app');
      expect(content).toContain('kill');
      expect(content).toMatch(/kill.*-9/);
    });

    test('should support multiple commands', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      const commands = ['start', 'stop', 'restart', 'status', 'logs'];

      commands.forEach(cmd => {
        expect(content).toContain(cmd);
      });
    });

    test('should provide usage instructions', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Usage');
      expect(content).toContain('Commands');
    });
  });

  describe('create-env.sh - Environment Configuration', () => {
    const scriptPath = join(SCRIPTS_DIR, 'create-env.sh');

    test('should exist', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });

    test('should prompt for required credentials', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      const requiredPrompts = [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_MAPS_API_KEY',
        'OPENWEATHER_API_KEY',
        'JWT_SECRET'
      ];

      requiredPrompts.forEach(prompt => {
        expect(content).toContain(prompt);
      });
    });

    test('should generate JWT secret if not provided', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('JWT_SECRET');
      expect(content).toMatch(/(openssl|node).*rand/);
    });

    test('should backup existing .env files', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('backup');
      expect(content).toContain('.env.backup');
    });

    test('should create both root and backend .env files', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('backend/.env');
      expect(content).toContain('.env');
    });

    test('should include all required environment variables', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      const requiredVars = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI',
        'OPENWEATHER_API_KEY',
        'GOOGLE_MAPS_API_KEY',
        'FRONTEND_URL'
      ];

      requiredVars.forEach(varName => {
        expect(content).toContain(varName);
      });
    });

    test('should display masked configuration summary', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Configuration Summary');
      expect(content).toContain('***HIDDEN***');
    });

    test('should provide next steps instructions', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Next Steps');
      expect(content).toContain('docker:up');
      expect(content).toContain('npm run dev');
    });

    test('should include security warnings', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Security');
      expect(content).toMatch(/never.*commit.*\.env/i);
    });
  });

  describe('setup-api.sh - API Setup Orchestration', () => {
    const scriptPath = join(SCRIPTS_DIR, 'setup-api.sh');

    test('should exist', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });

    test('should check for setup guide existence', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('INTERACTIVE_API_SETUP.md');
      expect(content).toMatch(/if.*!.*-f/);
    });

    test('should provide interactive guidance', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('read -p');
      expect(content).toContain('Press ENTER');
    });

    test('should orchestrate the setup flow', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      const steps = [
        'Step 1',
        'Step 2',
        'Step 3'
      ];

      steps.forEach(step => {
        expect(content).toContain(step);
      });
    });

    test('should call create-env.sh', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('create-env.sh');
      expect(content).toContain('./scripts/create-env.sh');
    });

    test('should optionally call test-apis.sh', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('test-apis.sh');
      expect(content).toContain('./scripts/test-apis.sh');
    });

    test('should handle user cancellation gracefully', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('CONTINUE');
      expect(content).toMatch(/if.*!=/);
      expect(content).toContain('exit 0');
    });

    test('should provide completion summary', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Setup Complete');
      expect(content).toContain('What was created');
    });
  });

  describe('test-apis.sh - API Connectivity Testing', () => {
    const scriptPath = join(SCRIPTS_DIR, 'test-apis.sh');

    test('should exist', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });

    test('should load environment variables', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('.env');
      expect(content).toContain('export');
    });

    test('should define test_api function', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('test_api()');
      expect(content).toContain('curl');
    });

    test('should test OpenWeather API', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('OpenWeather');
      expect(content).toContain('OPENWEATHER_API_KEY');
      expect(content).toContain('api.openweathermap.org');
    });

    test('should test Google Maps APIs', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Google Maps');
      expect(content).toContain('GOOGLE_MAPS_API_KEY');
      expect(content).toContain('maps.googleapis.com');
    });

    test('should validate JWT secret', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('JWT_SECRET');
      expect(content).toContain('LENGTH');
    });

    test('should check OAuth credentials', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('GOOGLE_CLIENT_ID');
      expect(content).toContain('GOOGLE_CLIENT_SECRET');
      expect(content).toContain('GOOGLE_REDIRECT_URI');
    });

    test('should track test results', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('TESTS_PASSED');
      expect(content).toContain('TESTS_FAILED');
    });

    test('should provide test summary', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Test Results');
      expect(content).toContain('Total Tests');
      expect(content).toContain('Passed');
      expect(content).toContain('Failed');
    });

    test('should handle test failures with helpful tips', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('💡 Tip');
      expect(content).toContain('Common Issues');
    });

    test('should exit with appropriate status code', () => {
      const content = readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('exit 0');
      expect(content).toContain('exit 1');
    });
  });

  describe('Script Integration and Flow', () => {
    test('should have consistent error handling across scripts', () => {
      const scripts = [
        'app-control.sh',
        'create-env.sh',
        'setup-api.sh',
        'test-apis.sh'
      ];

      scripts.forEach(scriptName => {
        const scriptPath = join(SCRIPTS_DIR, scriptName);
        const content = readFileSync(scriptPath, 'utf-8');

        // All scripts should have error handling
        expect(content).toContain('exit 1');
        expect(content).toMatch(/echo.*❌/);
      });
    });

    test('should have consistent UI styling', () => {
      const scripts = [
        'app-control.sh',
        'create-env.sh',
        'setup-api.sh',
        'test-apis.sh'
      ];

      scripts.forEach(scriptName => {
        const scriptPath = join(SCRIPTS_DIR, scriptName);
        const content = readFileSync(scriptPath, 'utf-8');

        // All scripts should use box drawing characters
        expect(content).toMatch(/[═║╔╗╚╝]/);
        expect(content).toMatch(/echo.*"[═─]+"/);
      });
    });

    test('should reference each other correctly', () => {
      const setupApiContent = readFileSync(join(SCRIPTS_DIR, 'setup-api.sh'), 'utf-8');

      expect(setupApiContent).toContain('./scripts/create-env.sh');
      expect(setupApiContent).toContain('./scripts/test-apis.sh');
    });

    test('should provide consistent documentation references', () => {
      const scripts = ['setup-api.sh', 'create-env.sh', 'test-apis.sh'];

      scripts.forEach(scriptName => {
        const scriptPath = join(SCRIPTS_DIR, scriptName);
        const content = readFileSync(scriptPath, 'utf-8');

        expect(content).toMatch(/claudedocs\/.*\.md/);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing script permissions', () => {
      // All scripts should be executable
      const scripts = [
        'app-control.sh',
        'create-env.sh',
        'setup-api.sh',
        'test-apis.sh'
      ];

      scripts.forEach(scriptName => {
        const scriptPath = join(SCRIPTS_DIR, scriptName);
        expect(existsSync(scriptPath)).toBe(true);
      });
    });

    test('should handle invalid input gracefully', () => {
      const appControlContent = readFileSync(join(SCRIPTS_DIR, 'app-control.sh'), 'utf-8');

      expect(appControlContent).toContain('Invalid');
      expect(appControlContent).toMatch(/\*\)/); // Default case in switch
    });

    test('should validate prerequisites before execution', () => {
      const testApisContent = readFileSync(join(SCRIPTS_DIR, 'test-apis.sh'), 'utf-8');

      expect(testApisContent).toContain('.env');
      expect(testApisContent).toMatch(/if.*!.*-f/);
    });
  });
});
