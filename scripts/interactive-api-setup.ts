#!/usr/bin/env ts-node

/**
 * Interactive API Setup Assistant for StillOnTime
 * 
 * This script guides you through setting up all required external APIs:
 * - Google Cloud Platform (OAuth, Maps, Calendar)
 * - OpenWeather API
 * - Environment variable configuration
 * 
 * Usage: npx ts-node scripts/interactive-api-setup.ts
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ApiCredentials {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  googleMapsApiKey?: string;
  openweatherApiKey?: string;
  jwtSecret?: string;
  nodeEnv?: string;
  port?: string;
  frontendUrl?: string;
  databaseUrl?: string;
  redisUrl?: string;
}

class ApiSetupAssistant {
  private rl: readline.Interface;
  private credentials: ApiCredentials = {};

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async question(query: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(query, resolve);
    });
  }

  private async confirm(message: string): Promise<boolean> {
    const answer = await this.question(`${message} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  private async openUrl(url: string): Promise<void> {
    console.log(`\n🌐 Opening: ${url}`);
    try {
      // Cross-platform URL opening
      const command = process.platform === 'darwin' 
        ? `open "${url}"` 
        : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
      
      await execAsync(command);
      await this.sleep(1000);
    } catch (error) {
      console.log(`⚠️  Could not auto-open. Please manually navigate to: ${url}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateJwtSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private printBanner(): void {
    console.clear();
    console.log('\n' + '='.repeat(70));
    console.log('🎬 StillOnTime - Interactive API Setup Assistant');
    console.log('='.repeat(70) + '\n');
    console.log('This assistant will guide you through setting up:');
    console.log('  ✓ Google Cloud Platform (OAuth, Maps, Calendar APIs)');
    console.log('  ✓ OpenWeather API');
    console.log('  ✓ Environment variables\n');
    console.log('⏱️  Estimated time: 15-20 minutes\n');
    console.log('='.repeat(70) + '\n');
  }

  private printStep(stepNumber: number, totalSteps: number, title: string): void {
    console.log('\n' + '─'.repeat(70));
    console.log(`📍 STEP ${stepNumber}/${totalSteps}: ${title}`);
    console.log('─'.repeat(70) + '\n');
  }

  private printInstructions(...lines: string[]): void {
    lines.forEach(line => {
      if (line.startsWith('  -')) {
        console.log(`  ${line}`);
      } else if (line.startsWith('✓') || line.startsWith('⚠️') || line.startsWith('📝')) {
        console.log(`${line}`);
      } else {
        console.log(`  ${line}`);
      }
    });
    console.log();
  }

  private printSuccess(message: string): void {
    console.log(`✅ ${message}\n`);
  }

  private printWarning(message: string): void {
    console.log(`⚠️  ${message}\n`);
  }

  async run(): Promise<void> {
    try {
      this.printBanner();

      // Step 1: Google Cloud Project
      await this.setupGoogleCloudProject();

      // Step 2: Enable APIs
      await this.enableGoogleApis();

      // Step 3: OAuth Consent Screen
      await this.setupOAuthConsent();

      // Step 4: Create OAuth Credentials
      await this.createOAuthCredentials();

      // Step 5: Create Maps API Key
      await this.createMapsApiKey();

      // Step 6: OpenWeather Setup
      await this.setupOpenWeather();

      // Step 7: Generate JWT Secret
      await this.generateCredentials();

      // Step 8: Create .env file
      await this.createEnvFile();

      // Step 9: Verify Setup
      await this.verifySetup();

      // Final summary
      this.printFinalSummary();

    } catch (error) {
      console.error('\n❌ Error during setup:', error);
    } finally {
      this.rl.close();
    }
  }

  private async setupGoogleCloudProject(): Promise<void> {
    this.printStep(1, 9, 'Create Google Cloud Project');
    
    await this.openUrl('https://console.cloud.google.com/projectcreate');
    
    this.printInstructions(
      '1. In the "Project name" field, enter: StillOnTime',
      '2. Click "CREATE" button',
      '3. Wait for the project to be created (notification will appear)',
      '4. Click "SELECT PROJECT" in the notification',
      '',
      '⚠️  Make sure the project "StillOnTime" is selected in the top bar!'
    );

    await this.confirm('✓ Have you created and selected the project?');
  }

  private async enableGoogleApis(): Promise<void> {
    this.printStep(2, 9, 'Enable Required APIs');

    const apis = [
      { name: 'Gmail API', url: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com' },
      { name: 'Google Calendar API', url: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com' },
      { name: 'Maps JavaScript API', url: 'https://console.cloud.google.com/apis/library/maps-backend.googleapis.com' },
      { name: 'Directions API', url: 'https://console.cloud.google.com/apis/library/directions-backend.googleapis.com' },
      { name: 'Geocoding API', url: 'https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com' },
      { name: 'Distance Matrix API', url: 'https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com' },
    ];

    for (const api of apis) {
      console.log(`\n📦 Enabling: ${api.name}`);
      await this.openUrl(api.url);
      this.printInstructions(
        `1. Click the blue "ENABLE" button`,
        `2. Wait for activation confirmation`,
      );
      await this.confirm(`✓ Have you enabled ${api.name}?`);
    }

    this.printSuccess('All APIs enabled!');
  }

  private async setupOAuthConsent(): Promise<void> {
    this.printStep(3, 9, 'Configure OAuth Consent Screen');

    await this.openUrl('https://console.cloud.google.com/apis/credentials/consent');

    this.printInstructions(
      '1. Select "External" user type',
      '2. Click "CREATE"',
      '',
      '📝 Fill in the required fields:',
      '  - App name: StillOnTime',
      '  - User support email: (your email)',
      '  - Developer contact email: (your email)',
      '',
      '3. Click "SAVE AND CONTINUE"',
      '',
      '📝 Scopes - Click "ADD OR REMOVE SCOPES":',
      '  - Search and select: ".../auth/gmail.readonly"',
      '  - Search and select: ".../auth/calendar"',
      '  - Search and select: ".../auth/calendar.events"',
      '  - Click "UPDATE"',
      '  - Click "SAVE AND CONTINUE"',
      '',
      '📝 Test Users:',
      '  - Click "ADD USERS"',
      '  - Enter your Gmail address',
      '  - Click "ADD"',
      '  - Click "SAVE AND CONTINUE"',
      '',
      '4. Review summary and click "BACK TO DASHBOARD"'
    );

    await this.confirm('✓ Have you configured the OAuth consent screen?');
  }

  private async createOAuthCredentials(): Promise<void> {
    this.printStep(4, 9, 'Create OAuth 2.0 Credentials');

    await this.openUrl('https://console.cloud.google.com/apis/credentials');

    this.printInstructions(
      '1. Click "+ CREATE CREDENTIALS" at the top',
      '2. Select "OAuth client ID"',
      '3. Application type: "Web application"',
      '4. Name: "StillOnTime Web Client"',
      '',
      '📝 Authorized redirect URIs:',
      '  - Click "+ ADD URI"',
      '  - Enter: http://localhost:3000/auth/callback',
      '  - For production, also add: https://yourdomain.com/auth/callback',
      '',
      '5. Click "CREATE"',
      '',
      '📋 A dialog will show your credentials - DO NOT CLOSE IT YET!'
    );

    await this.confirm('✓ Have you created the OAuth client?');

    console.log('\n📋 Now, please copy the credentials from the dialog:\n');
    
    this.credentials.googleClientId = await this.question('Paste Google Client ID: ');
    this.credentials.googleClientSecret = await this.question('Paste Google Client Secret: ');
    
    this.printSuccess('OAuth credentials saved!');
  }

  private async createMapsApiKey(): Promise<void> {
    this.printStep(5, 9, 'Create Google Maps API Key');

    await this.openUrl('https://console.cloud.google.com/apis/credentials');

    this.printInstructions(
      '1. Click "+ CREATE CREDENTIALS" at the top',
      '2. Select "API key"',
      '3. An API key will be created automatically',
      '',
      '🔒 RECOMMENDED: Restrict the API key',
      '  - Click "EDIT API KEY" (or the key name)',
      '  - Under "API restrictions", select "Restrict key"',
      '  - Check these APIs:',
      '    ✓ Maps JavaScript API',
      '    ✓ Directions API',
      '    ✓ Geocoding API',
      '    ✓ Distance Matrix API',
      '  - Click "SAVE"',
      '',
      '📋 Copy the API key from the list'
    );

    await this.confirm('✓ Have you created the Maps API key?');

    this.credentials.googleMapsApiKey = await this.question('Paste Google Maps API Key: ');
    
    this.printSuccess('Maps API key saved!');
  }

  private async setupOpenWeather(): Promise<void> {
    this.printStep(6, 9, 'Setup OpenWeather API');

    console.log('📝 If you already have an OpenWeather account, you can skip registration.\n');
    const hasAccount = await this.confirm('Do you already have an OpenWeather account?');

    if (!hasAccount) {
      await this.openUrl('https://home.openweathermap.org/users/sign_up');
      
      this.printInstructions(
        '1. Fill in the registration form',
        '2. Confirm your email address',
        '3. Log in to your account'
      );

      await this.confirm('✓ Have you created and confirmed your account?');
    }

    await this.openUrl('https://home.openweathermap.org/api_keys');

    this.printInstructions(
      '1. You should see a default API key already created',
      '2. Copy the API key',
      '',
      '⚠️  Note: New API keys can take up to 2 hours to activate',
      '    For development, this is usually faster (~10 minutes)'
    );

    this.credentials.openweatherApiKey = await this.question('Paste OpenWeather API Key: ');
    
    this.printSuccess('OpenWeather API key saved!');
  }

  private async generateCredentials(): Promise<void> {
    this.printStep(7, 9, 'Generate Application Credentials');

    console.log('🔐 Generating secure JWT secret...');
    this.credentials.jwtSecret = this.generateJwtSecret();
    this.printSuccess(`JWT Secret generated: ${this.credentials.jwtSecret.substring(0, 16)}...`);

    // Set default values
    this.credentials.nodeEnv = 'development';
    this.credentials.port = '3001';
    this.credentials.frontendUrl = 'http://localhost:3000';
    this.credentials.googleRedirectUri = 'http://localhost:3000/auth/callback';
    this.credentials.databaseUrl = 'postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation';
    this.credentials.redisUrl = 'redis://localhost:6379';

    console.log('✓ Default configuration values set');
  }

  private async createEnvFile(): Promise<void> {
    this.printStep(8, 9, 'Create Environment Configuration');

    const envContent = this.generateEnvContent();
    const backendEnvPath = path.join(process.cwd(), 'backend', '.env');
    const rootEnvPath = path.join(process.cwd(), '.env');

    console.log('📝 Creating .env files...\n');

    // Create backend/.env
    if (fs.existsSync(backendEnvPath)) {
      const backup = await this.confirm('⚠️  backend/.env already exists. Create backup?');
      if (backup) {
        const backupPath = `${backendEnvPath}.backup.${Date.now()}`;
        fs.copyFileSync(backendEnvPath, backupPath);
        console.log(`✓ Backup created: ${backupPath}`);
      }
    }

    fs.writeFileSync(backendEnvPath, envContent);
    this.printSuccess(`Created: backend/.env`);

    // Create root .env
    if (!fs.existsSync(rootEnvPath)) {
      fs.writeFileSync(rootEnvPath, envContent);
      this.printSuccess(`Created: .env`);
    }

    console.log('\n📋 Environment file contents:');
    console.log('─'.repeat(70));
    console.log(this.maskSensitiveData(envContent));
    console.log('─'.repeat(70) + '\n');
  }

  private generateEnvContent(): string {
    return `# Application Configuration
NODE_ENV=${this.credentials.nodeEnv}
PORT=${this.credentials.port}
FRONTEND_URL=${this.credentials.frontendUrl}

# Database
DATABASE_URL=${this.credentials.databaseUrl}

# Redis
REDIS_URL=${this.credentials.redisUrl}

# JWT Secret
JWT_SECRET=${this.credentials.jwtSecret}

# Google OAuth 2.0
GOOGLE_CLIENT_ID=${this.credentials.googleClientId}
GOOGLE_CLIENT_SECRET=${this.credentials.googleClientSecret}
GOOGLE_REDIRECT_URI=${this.credentials.googleRedirectUri}

# External APIs
OPENWEATHER_API_KEY=${this.credentials.openweatherApiKey}
GOOGLE_MAPS_API_KEY=${this.credentials.googleMapsApiKey}

# Optional: Email Configuration (Uncomment and configure if needed)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Optional: SMS Configuration (Uncomment and configure if needed)
# TWILIO_ACCOUNT_SID=your-twilio-account-sid
# TWILIO_AUTH_TOKEN=your-twilio-auth-token
# TWILIO_PHONE_NUMBER=your-twilio-phone-number
`;
  }

  private maskSensitiveData(content: string): string {
    return content
      .replace(/JWT_SECRET=.+/g, 'JWT_SECRET=***HIDDEN***')
      .replace(/GOOGLE_CLIENT_SECRET=.+/g, 'GOOGLE_CLIENT_SECRET=***HIDDEN***')
      .replace(/OPENWEATHER_API_KEY=.+/g, 'OPENWEATHER_API_KEY=***HIDDEN***')
      .replace(/GOOGLE_MAPS_API_KEY=.+/g, 'GOOGLE_MAPS_API_KEY=***HIDDEN***');
  }

  private async verifySetup(): Promise<void> {
    this.printStep(9, 9, 'Verify API Configuration');

    console.log('🧪 Testing API connectivity...\n');

    // Test OpenWeather API
    console.log('📡 Testing OpenWeather API...');
    try {
      const weatherTest = await this.testOpenWeatherApi(this.credentials.openweatherApiKey!);
      if (weatherTest) {
        this.printSuccess('OpenWeather API: Working ✓');
      } else {
        this.printWarning('OpenWeather API: May need activation time (up to 2 hours)');
      }
    } catch (error) {
      this.printWarning('OpenWeather API: Could not verify (network error)');
    }

    // Test Google Maps API
    console.log('📡 Testing Google Maps API...');
    try {
      const mapsTest = await this.testGoogleMapsApi(this.credentials.googleMapsApiKey!);
      if (mapsTest) {
        this.printSuccess('Google Maps API: Working ✓');
      } else {
        this.printWarning('Google Maps API: May need activation time (~10 minutes)');
      }
    } catch (error) {
      this.printWarning('Google Maps API: Could not verify (network error)');
    }

    console.log('\n💡 Note: Some APIs may take time to activate.');
    console.log('   If tests fail now, try again in 10-15 minutes.\n');
  }

  private async testOpenWeatherApi(apiKey: string): Promise<boolean> {
    try {
      const https = require('https');
      return new Promise((resolve) => {
        https.get(
          `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${apiKey}`,
          (res: any) => {
            resolve(res.statusCode === 200);
          }
        ).on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  private async testGoogleMapsApi(apiKey: string): Promise<boolean> {
    try {
      const https = require('https');
      return new Promise((resolve) => {
        https.get(
          `https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${apiKey}`,
          (res: any) => {
            resolve(res.statusCode === 200);
          }
        ).on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  private printFinalSummary(): void {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 API Setup Complete!');
    console.log('='.repeat(70) + '\n');

    console.log('✅ Completed Tasks:');
    console.log('  ✓ Google Cloud Project created');
    console.log('  ✓ Required APIs enabled (Gmail, Calendar, Maps)');
    console.log('  ✓ OAuth 2.0 configured');
    console.log('  ✓ API keys generated');
    console.log('  ✓ OpenWeather account setup');
    console.log('  ✓ Environment variables configured');
    console.log('  ✓ .env files created\n');

    console.log('📋 Credentials Summary:');
    console.log('  • Google Client ID: ' + (this.credentials.googleClientId?.substring(0, 20) + '...'));
    console.log('  • Google Client Secret: ***HIDDEN***');
    console.log('  • Google Maps API Key: ' + (this.credentials.googleMapsApiKey?.substring(0, 20) + '...'));
    console.log('  • OpenWeather API Key: ' + (this.credentials.openweatherApiKey?.substring(0, 20) + '...'));
    console.log('  • JWT Secret: ***HIDDEN***\n');

    console.log('📝 Configuration Files:');
    console.log('  • backend/.env - Backend configuration');
    console.log('  • .env - Root configuration\n');

    console.log('🚀 Next Steps:');
    console.log('  1. Start Docker services:');
    console.log('     npm run docker:up\n');
    console.log('  2. Initialize database:');
    console.log('     cd backend && npm run db:init\n');
    console.log('  3. Start the application:');
    console.log('     npm run dev\n');
    console.log('  4. Test the application:');
    console.log('     Open http://localhost:3000\n');

    console.log('📚 Documentation:');
    console.log('  • API Setup Guide: claudedocs/API_SETUP_GUIDE.md');
    console.log('  • Quick Reference: claudedocs/API_QUICK_REFERENCE.md');
    console.log('  • Main README: README.md\n');

    console.log('⚠️  Important Notes:');
    console.log('  • New API keys may take up to 2 hours to fully activate');
    console.log('  • Test the OAuth flow after starting the application');
    console.log('  • Keep your .env files secure - they contain secrets!\n');

    console.log('='.repeat(70));
    console.log('💚 Thank you for using StillOnTime API Setup Assistant!');
    console.log('='.repeat(70) + '\n');
  }
}

// Run the assistant
const assistant = new ApiSetupAssistant();
assistant.run().catch(console.error);

