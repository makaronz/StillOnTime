#!/usr/bin/env ts-node

/**
 * API Integration Test Script
 * Tests all external API connections and credentials
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { google } from 'googleapis';

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

const results: TestResult[] = [];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function printResult(result: TestResult): void {
  const icon = result.status === 'success' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
  const color = result.status === 'success' ? colors.green : result.status === 'warning' ? colors.yellow : colors.red;

  console.log(`${color}${icon} ${result.name}${colors.reset}`);
  console.log(`  ${result.message}`);
  if (result.details) {
    console.log(`  ${colors.cyan}${result.details}${colors.reset}`);
  }
  console.log();
}

async function testEnvironmentVariables(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}Testing Environment Variables...${colors.reset}\n`);

  const requiredVars = [
    { name: 'GOOGLE_CLIENT_ID', description: 'Google OAuth Client ID' },
    { name: 'GOOGLE_CLIENT_SECRET', description: 'Google OAuth Client Secret' },
    { name: 'GOOGLE_REDIRECT_URI', description: 'Google OAuth Redirect URI' },
    { name: 'GOOGLE_MAPS_API_KEY', description: 'Google Maps API Key' },
    { name: 'OPENWEATHER_API_KEY', description: 'OpenWeather API Key' },
    { name: 'JWT_SECRET', description: 'JWT Secret' },
    { name: 'DATABASE_URL', description: 'Database URL' },
    { name: 'REDIS_URL', description: 'Redis URL' },
  ];

  for (const envVar of requiredVars) {
    const value = process.env[envVar.name];

    if (!value || value.startsWith('your-') || value.length < 10) {
      results.push({
        name: envVar.description,
        status: 'error',
        message: `Missing or invalid: ${envVar.name}`,
        details: 'Please set this in your .env file',
      });
    } else {
      results.push({
        name: envVar.description,
        status: 'success',
        message: `Configured (${value.substring(0, 20)}...)`,
      });
    }
  }
}

async function testOpenWeatherAPI(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}Testing OpenWeather API...${colors.reset}\n`);

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey || apiKey.startsWith('your-')) {
    results.push({
      name: 'OpenWeather API Connection',
      status: 'error',
      message: 'API key not configured',
      details: 'Set OPENWEATHER_API_KEY in .env file',
    });
    return;
  }

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: 'London',
          appid: apiKey,
          units: 'metric',
        },
        timeout: 10000,
      }
    );

    if (response.status === 200 && response.data.main) {
      results.push({
        name: 'OpenWeather API Connection',
        status: 'success',
        message: `Successfully retrieved weather data`,
        details: `Temperature in London: ${response.data.main.temp}°C`,
      });
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      results.push({
        name: 'OpenWeather API Connection',
        status: 'error',
        message: 'Invalid API key',
        details: 'Check your OPENWEATHER_API_KEY in .env file',
      });
    } else if (error.code === 'ECONNABORTED') {
      results.push({
        name: 'OpenWeather API Connection',
        status: 'warning',
        message: 'Connection timeout',
        details: 'Check your internet connection',
      });
    } else {
      results.push({
        name: 'OpenWeather API Connection',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: error.response?.data?.message || 'Unknown error',
      });
    }
  }
}

async function testGoogleMapsAPI(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}Testing Google Maps API...${colors.reset}\n`);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey.startsWith('your-')) {
    results.push({
      name: 'Google Maps API Connection',
      status: 'error',
      message: 'API key not configured',
      details: 'Set GOOGLE_MAPS_API_KEY in .env file',
    });
    return;
  }

  // Test Geocoding API
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: '1600 Amphitheatre Parkway, Mountain View, CA',
          key: apiKey,
        },
        timeout: 10000,
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      results.push({
        name: 'Google Maps Geocoding API',
        status: 'success',
        message: 'Successfully geocoded address',
        details: `Found location: ${response.data.results[0].formatted_address}`,
      });
    } else if (response.data.status === 'REQUEST_DENIED') {
      results.push({
        name: 'Google Maps Geocoding API',
        status: 'error',
        message: 'API request denied',
        details: response.data.error_message || 'Check API key restrictions in Google Cloud Console',
      });
    } else {
      results.push({
        name: 'Google Maps Geocoding API',
        status: 'warning',
        message: `Unexpected status: ${response.data.status}`,
        details: response.data.error_message,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Google Maps Geocoding API',
      status: 'error',
      message: `Failed: ${error.message}`,
      details: error.response?.data?.error_message || 'Unknown error',
    });
  }

  // Test Directions API
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: 'San Francisco, CA',
          destination: 'Los Angeles, CA',
          key: apiKey,
        },
        timeout: 10000,
      }
    );

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const distance = route.legs[0].distance.text;
      const duration = route.legs[0].duration.text;

      results.push({
        name: 'Google Maps Directions API',
        status: 'success',
        message: 'Successfully calculated route',
        details: `SF to LA: ${distance}, ${duration}`,
      });
    } else if (response.data.status === 'REQUEST_DENIED') {
      results.push({
        name: 'Google Maps Directions API',
        status: 'error',
        message: 'API request denied',
        details: response.data.error_message || 'Check API key restrictions in Google Cloud Console',
      });
    } else {
      results.push({
        name: 'Google Maps Directions API',
        status: 'warning',
        message: `Unexpected status: ${response.data.status}`,
        details: response.data.error_message,
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Google Maps Directions API',
      status: 'error',
      message: `Failed: ${error.message}`,
      details: error.response?.data?.error_message || 'Unknown error',
    });
  }
}

async function testGoogleOAuth(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}Testing Google OAuth Configuration...${colors.reset}\n`);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || clientId.startsWith('your-')) {
    results.push({
      name: 'Google OAuth Client ID',
      status: 'error',
      message: 'Not configured',
      details: 'Set GOOGLE_CLIENT_ID in .env file',
    });
    return;
  }

  if (!clientSecret || clientSecret.startsWith('your-')) {
    results.push({
      name: 'Google OAuth Client Secret',
      status: 'error',
      message: 'Not configured',
      details: 'Set GOOGLE_CLIENT_SECRET in .env file',
    });
    return;
  }

  // Validate OAuth client configuration
  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate an auth URL to test configuration
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
      ],
    });

    if (authUrl && authUrl.includes('client_id=')) {
      results.push({
        name: 'Google OAuth Configuration',
        status: 'success',
        message: 'OAuth client properly configured',
        details: 'Auth URL can be generated successfully',
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Google OAuth Configuration',
      status: 'error',
      message: `Configuration error: ${error.message}`,
      details: 'Check your OAuth credentials in Google Cloud Console',
    });
  }
}

async function printSummary(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  results.forEach(printResult);

  const successCount = results.filter(r => r.status === 'success').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`${colors.bold}Results:${colors.reset}`);
  console.log(`${colors.green}✓ Success: ${successCount}${colors.reset}`);
  console.log(`${colors.yellow}⚠ Warnings: ${warningCount}${colors.reset}`);
  console.log(`${colors.red}✗ Errors: ${errorCount}${colors.reset}`);
  console.log();

  if (errorCount === 0 && warningCount === 0) {
    console.log(`${colors.green}${colors.bold}All API integrations configured correctly! 🎉${colors.reset}`);
  } else if (errorCount === 0) {
    console.log(`${colors.yellow}${colors.bold}Configuration complete with some warnings.${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bold}Please fix the errors above before proceeding.${colors.reset}`);
    console.log(`${colors.cyan}Refer to claudedocs/API_SETUP_GUIDE.md for detailed setup instructions.${colors.reset}`);
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

async function main(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}StillOnTime API Integration Test${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  await testEnvironmentVariables();
  await testOpenWeatherAPI();
  await testGoogleMapsAPI();
  await testGoogleOAuth();
  await printSummary();
}

// Run tests
main().catch(console.error);
