# StillOnTime API Quick Reference

Quick reference for all external API integrations used in StillOnTime.

## Quick Start

Follow the step-by-step interactive guide, then use helper scripts:

```bash
# 1. Follow the manual setup guide
cat claudedocs/INTERACTIVE_API_SETUP.md

# 2. Create .env file with your credentials
chmod +x scripts/create-env.sh
./scripts/create-env.sh

# 3. Test your API configuration
chmod +x scripts/test-apis.sh
./scripts/test-apis.sh
```

**Estimated time:** 15-20 minutes

**Why manual setup?**
Google Cloud Console requires human authentication and blocks automated browsers for security. The helper scripts automate what's possible (env generation, validation) while you handle the manual OAuth setup steps.

---

## Required Accounts & APIs

| Service | Purpose | Free Tier | Setup Time |
|---------|---------|-----------|------------|
| **Google Cloud Platform** | OAuth, Gmail, Calendar, Maps | Yes (with limits) | 10 min |
| **OpenWeather** | Weather forecasts | Yes (60 calls/min) | 5 min |

---

## Google Cloud Platform

### Required APIs to Enable

1. **Gmail API** - Email monitoring
2. **Google Calendar API** - Event creation
3. **Maps JavaScript API** - Route calculation
4. **Directions API** - Turn-by-turn directions
5. **Geocoding API** - Address to coordinates
6. **Distance Matrix API** - Travel time calculation

### OAuth 2.0 Scopes

```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

### Redirect URIs

**Development:**
```
http://localhost:3000/auth/callback
```

**Production:**
```
https://yourdomain.com/auth/callback
```

---

## Environment Variables

### Required Variables

```bash
# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your-generated-secret-here

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# External APIs
OPENWEATHER_API_KEY=your-openweather-api-key
GOOGLE_MAPS_API_KEY=AIzaSy-your-maps-api-key
```

### Optional Variables

```bash
# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-phone-number
```

---

## Quick Testing

### Test OpenWeather API

```bash
curl "https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY"
```

**Expected:** JSON with weather data

### Test Google Maps API

```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=YOUR_API_KEY"
```

**Expected:** JSON with geocoding data

### Test Application Health

```bash
# Backend
curl http://localhost:3001/health

# API endpoints
curl http://localhost:3001/api/health
```

---

## Common Commands

### Generate JWT Secret

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

### Start Services

```bash
# Docker services (PostgreSQL, Redis)
npm run docker:up

# Initialize database
cd backend && npm run db:init

# Start application
npm run dev
```

### Check Logs

```bash
# Docker logs
npm run docker:logs

# Backend logs
cd backend && npm run dev

# Frontend logs
cd frontend && npm run dev
```

---

## Important URLs

### Google Cloud Console

- **Main Console:** https://console.cloud.google.com/
- **API Library:** https://console.cloud.google.com/apis/library
- **Credentials:** https://console.cloud.google.com/apis/credentials
- **OAuth Consent:** https://console.cloud.google.com/apis/credentials/consent
- **Project Selector:** https://console.cloud.google.com/projectselector2

### OpenWeather

- **Sign Up:** https://home.openweathermap.org/users/sign_up
- **API Keys:** https://home.openweathermap.org/api_keys
- **Documentation:** https://openweathermap.org/api
- **Pricing:** https://openweathermap.org/price

### StillOnTime (Local Development)

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health
- **Monitoring:** http://localhost:3001/api/monitoring/health

---

## Troubleshooting Quick Fixes

### "Missing environment variable"

```bash
# Check if .env file exists
ls -la backend/.env

# Verify all required variables are set
cat backend/.env | grep -E "(GOOGLE|JWT|OPENWEATHER)"

# Restart backend after updating .env
cd backend && npm run dev
```

### "OAuth redirect_uri_mismatch"

1. Check Google Cloud Console → Credentials
2. Verify redirect URI exactly matches: `http://localhost:3000/auth/callback`
3. No trailing slashes
4. Protocol must match (http vs https)

### "API key invalid"

**Google Maps:**
- Wait 5-10 minutes after key creation
- Check if APIs are enabled
- Verify API restrictions

**OpenWeather:**
- Wait up to 2 hours for activation
- Check for rate limit (60 calls/minute)
- Verify no extra spaces in key

### "Database connection error"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart Docker services
npm run docker:down
npm run docker:up

# Test database connection
cd backend && npm run db:test
```

---

## API Rate Limits & Quotas

### Google Maps (Free Tier)

- **Geocoding API:** $5 per 1000 requests (after free tier)
- **Directions API:** $5 per 1000 requests (after free tier)
- **Distance Matrix API:** $5 per 1000 elements (after free tier)
- **Free Monthly Credit:** $200

### OpenWeather (Free Tier)

- **Calls per minute:** 60
- **Calls per month:** 1,000,000
- **Current weather:** ✅ Included
- **5-day forecast:** ✅ Included
- **16-day forecast:** ❌ Paid only

### Gmail API (Free)

- **Quota:** 1 billion quota units per day
- **Reading emails:** Free
- **No request charges**

---

## Security Checklist

- [ ] JWT secret is at least 32 characters
- [ ] .env files are in .gitignore
- [ ] API keys are restricted (not open to public)
- [ ] OAuth redirect URIs are properly configured
- [ ] Test users added for development
- [ ] Production secrets are different from development
- [ ] Database has strong password
- [ ] Redis is not publicly accessible

---

## Support & Documentation

### Official Documentation

- **Google Cloud:** https://cloud.google.com/docs
- **Gmail API:** https://developers.google.com/gmail/api
- **Google Calendar API:** https://developers.google.com/calendar
- **Google Maps API:** https://developers.google.com/maps
- **OpenWeather API:** https://openweathermap.org/api

### StillOnTime Documentation

- **Full Setup Guide:** [API_SETUP_GUIDE.md](./API_SETUP_GUIDE.md)
- **Main README:** [../README.md](../README.md)
- **Development Guide:** [../DEV_ENVIRONMENT_SETUP.md](../DEV_ENVIRONMENT_SETUP.md)
- **Architecture:** [../CS_Technical_Architecture.md](../CS_Technical_Architecture.md)

---

## Quick Decision Matrix

**Q: Do I need a Google Workspace account?**
A: No, regular Gmail account works fine for development

**Q: How much will this cost?**
A: Free for development and moderate usage. Monitor quotas in production.

**Q: Can I use different accounts for different APIs?**
A: Yes, but easier to manage all Google APIs from one project

**Q: What if I hit rate limits?**
A: Application has built-in caching and rate limiting. Consider upgrading in production.

**Q: Do I need a credit card?**
A: Not required for free tiers, but recommended for Google Cloud to avoid interruptions

---

*Last updated: 2025-01-08*
*StillOnTime v1.0*
