# External API Setup Guide for StillOnTime

This guide will walk you through setting up all required external API integrations for the StillOnTime film schedule automation system.

## Overview

StillOnTime requires the following API credentials:

1. **Google OAuth 2.0** - For Gmail access and user authentication
2. **Google Maps API** - For route calculation and geocoding
3. **Google Calendar API** - For creating calendar events
4. **OpenWeather API** - For weather forecasts

---

## 1. Google Cloud Platform Setup

All Google services (OAuth, Maps, Calendar) are configured through Google Cloud Platform.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"New Project"** or **"Select a Project"** → **"New Project"**
3. Enter project name: `StillOnTime` (or your preferred name)
4. Click **"Create"**
5. Wait for project creation (you'll get a notification)

### Step 2: Enable Required APIs

Navigate to **APIs & Services** → **Library** and enable:

1. **Gmail API**
   - Search for "Gmail API"
   - Click on it
   - Click **"Enable"**

2. **Google Calendar API**
   - Search for "Google Calendar API"
   - Click on it
   - Click **"Enable"**

3. **Google Maps Platform APIs**
   - Search for "Maps JavaScript API" → **Enable**
   - Search for "Directions API" → **Enable**
   - Search for "Geocoding API" → **Enable**
   - Search for "Distance Matrix API" → **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **"External"** user type (unless you have a Google Workspace)
3. Click **"Create"**

Fill in the required information:

```
App name: StillOnTime
User support email: your-email@gmail.com
Developer contact email: your-email@gmail.com
```

4. **Scopes**: Click **"Add or Remove Scopes"**
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
   - Click **"Update"**

5. **Test Users** (for development):
   - Add your Gmail address as a test user
   - Click **"Add Users"**
   - Enter your email → **"Add"**

6. Click **"Save and Continue"** through remaining steps

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Select **Application type**: **"Web application"**
4. Enter name: `StillOnTime Web Client`

5. **Authorized redirect URIs**:
   - For development: `http://localhost:3000/auth/callback`
   - For production: `https://yourdomain.com/auth/callback`
   - Click **"Add URI"** for each

6. Click **"Create"**
7. **Copy the credentials** - you'll see:
   - **Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
   - **Client Secret**: Something like `GOCSPX-abc123xyz`

8. **Save these values** - you'll need them for your `.env` file

### Step 5: Create Google Maps API Key

1. Still in **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"API key"**
3. An API key will be created automatically
4. Click on the key name to configure it (recommended for security)

**Restrict the API key** (recommended):

1. Click **"Edit API key"**
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check these APIs:
     - Maps JavaScript API
     - Directions API
     - Geocoding API
     - Distance Matrix API
3. Under **"Application restrictions"**:
   - For development: Select **"None"**
   - For production: Select **"HTTP referrers"** and add your domain
4. Click **"Save"**

5. **Copy the API key** - something like `AIzaSyAbc123Xyz...`

---

## 2. OpenWeather API Setup

### Step 1: Create OpenWeather Account

1. Go to [OpenWeatherMap](https://openweathermap.org/)
2. Click **"Sign Up"** or **"Sign In"**
3. Create a free account (requires email confirmation)

### Step 2: Get API Key

1. After signing in, go to [API Keys](https://home.openweathermap.org/api_keys)
2. You'll see a default API key already created
3. **Copy the API key** - something like `a1b2c3d4e5f6g7h8i9j0...`

**Note**: Free tier includes:
- 60 calls/minute
- 1,000,000 calls/month
- Current weather data
- 5-day forecast

This is sufficient for development and moderate production use.

---

## 3. Configure Environment Variables

### Step 1: Create `.env` File

Copy the example environment file:

```bash
# In the StillOnTime root directory
cp .env.example .env

# Also copy for backend
cp backend/.env.example backend/.env
```

### Step 2: Edit `.env` File

Open `.env` (or `backend/.env`) and fill in your API credentials:

```bash
# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret (Generate a strong random string)
JWT_SECRET=your-generated-secret-here-at-least-32-characters-long

# Google OAuth 2.0 (from Step 4 above)
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# External APIs
OPENWEATHER_API_KEY=a1b2c3d4e5f6g7h8i9j0
GOOGLE_MAPS_API_KEY=AIzaSyAbc123Xyz

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

### Generate JWT Secret

Use one of these methods to generate a secure JWT secret:

**Node.js**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**OpenSSL**:
```bash
openssl rand -hex 32
```

**Online**: Use a password generator with at least 32 characters

---

## 4. Verify Configuration

### Step 1: Check Environment Loading

Create a test script to verify environment variables are loaded:

```bash
cd backend
node -e "require('dotenv').config(); console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Loaded' : '✗ Missing');"
```

### Step 2: Test API Connectivity

#### Test OpenWeather API

```bash
# Replace YOUR_API_KEY with your actual key
curl "https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY"
```

Expected response: JSON with weather data

#### Test Google Maps API

```bash
# Replace YOUR_API_KEY with your actual key
curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_API_KEY"
```

Expected response: JSON with geocoding data

---

## 5. Testing the Integration

### Start the Application

```bash
# From root directory
npm run dev
```

This will start:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

### Test OAuth Flow

1. Open http://localhost:3000 in your browser
2. Click on "Login with Google" or navigate to authentication
3. You should be redirected to Google's OAuth consent screen
4. Log in with the test user you added earlier
5. Grant permissions
6. You should be redirected back to the application

### Check API Integration

Monitor the backend logs for:
- ✓ Configuration loaded successfully
- ✓ Connected to database
- ✓ Redis connection established
- ✓ API keys validated

---

## 6. Common Issues and Troubleshooting

### Issue: "Missing required environment variable"

**Solution**:
- Verify `.env` file exists in the backend directory
- Check that all required variables are set (no `your-*-here` placeholders)
- Restart the backend server after updating `.env`

### Issue: "OAuth redirect_uri_mismatch"

**Solution**:
- Verify the redirect URI in Google Cloud Console matches exactly: `http://localhost:3000/auth/callback`
- Check `GOOGLE_REDIRECT_URI` in `.env` matches
- Ensure no trailing slashes

### Issue: "API key invalid" for Google Maps

**Solution**:
- Wait 5-10 minutes after creating the API key (activation delay)
- Verify the APIs are enabled in Google Cloud Console
- Check API restrictions aren't blocking your requests

### Issue: OpenWeather API returns 401 Unauthorized

**Solution**:
- Wait up to 2 hours after creating the API key (activation can be slow)
- Verify the API key is correct (no extra spaces)
- Check you haven't exceeded the rate limit (60 calls/minute)

### Issue: Gmail API permissions error

**Solution**:
- Ensure Gmail API is enabled in Google Cloud Console
- Verify OAuth scopes include `gmail.readonly`
- Re-authenticate the user to get new permissions

---

## 7. Production Considerations

When deploying to production:

### Security

1. **Regenerate JWT Secret**: Use a production-grade secret (64+ characters)
2. **Restrict API Keys**:
   - Google Maps: Limit to your production domain
   - Consider IP restrictions for backend APIs
3. **OAuth Redirect URIs**: Update to your production domain
4. **Environment Variables**: Use secure secret management (not `.env` files)

### API Quotas

Monitor and consider upgrading if needed:

- **Google Maps**: Free tier has daily limits
  - Directions API: $5 per 1000 requests after free tier
  - Consider enabling billing with limits

- **OpenWeather**: Free tier limits
  - 60 calls/minute, 1M calls/month
  - Consider paid plan for higher limits

### Rate Limiting

The application includes built-in rate limiting and caching:
- Route calculations cached for 24 hours
- Weather data cached for 30 minutes
- Circuit breakers prevent API overload

---

## 8. Next Steps

After completing this setup:

1. ✅ All API credentials configured
2. ✅ Environment variables set
3. ✅ Application running successfully

**Continue to**:
- Database setup and migrations
- Test the complete workflow (email → PDF → calendar)
- Deploy to staging environment

---

## Quick Reference

### Required Credentials Checklist

- [ ] Google Cloud Project created
- [ ] Gmail API enabled
- [ ] Google Calendar API enabled
- [ ] Google Maps APIs enabled (Directions, Geocoding, Distance Matrix)
- [ ] OAuth 2.0 Client ID and Secret created
- [ ] OAuth redirect URIs configured
- [ ] Google Maps API key created
- [ ] OpenWeather account created
- [ ] OpenWeather API key obtained
- [ ] JWT secret generated
- [ ] All credentials added to `.env` file
- [ ] Application tested successfully

### Important URLs

- Google Cloud Console: https://console.cloud.google.com/
- OAuth Credentials: https://console.cloud.google.com/apis/credentials
- OpenWeather API Keys: https://home.openweathermap.org/api_keys
- Application (dev): http://localhost:3000

### Support

For issues specific to:
- **Google APIs**: https://console.cloud.google.com/support
- **OpenWeather**: https://openweathermap.org/faq
- **StillOnTime App**: Check backend logs and error messages
