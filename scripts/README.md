# StillOnTime API Setup Scripts

This directory contains helper scripts for setting up external API integrations.

## 📋 Available Scripts

### 1. `create-env.sh` - Environment Configuration Generator

Creates `.env` files with your API credentials.

**Usage:**
```bash
./scripts/create-env.sh
```

**What it does:**
- Prompts for all required API credentials
- Generates JWT secret if not provided
- Creates both `backend/.env` and `.env`
- Backs up existing files
- Shows configuration summary

**Requirements:**
- Completed API setup (see `claudedocs/INTERACTIVE_API_SETUP.md`)
- Google OAuth credentials
- Google Maps API key
- OpenWeather API key

---

### 2. `test-apis.sh` - API Connectivity Tester

Tests if all external APIs are properly configured and accessible.

**Usage:**
```bash
./scripts/test-apis.sh
```

**What it tests:**
- ✅ OpenWeather API connectivity
- ✅ Google Maps Geocoding API
- ✅ Google Maps Directions API
- ✅ JWT secret length
- ✅ OAuth credentials presence
- ✅ Database configuration
- ✅ Redis configuration

**Requirements:**
- Existing `.env` file
- API keys must be activated (wait 5-10 minutes)

---

### 3. `interactive-api-setup.ts` - Full Setup Assistant (TypeScript)

**Note:** This script attempts interactive setup but Google blocks automated browser access.  
**Recommended:** Use `claudedocs/INTERACTIVE_API_SETUP.md` instead.

---

## 🚀 Quick Start Workflow

Follow this sequence for a smooth setup:

### Step 1: Manual API Setup (15-20 minutes)

Follow the interactive guide:
```
Open: claudedocs/INTERACTIVE_API_SETUP.md
```

This guide walks you through:
- Creating Google Cloud Project
- Enabling APIs
- Configuring OAuth
- Getting API keys
- Setting up OpenWeather

### Step 2: Generate .env File (2 minutes)

Run the environment generator:
```bash
./scripts/create-env.sh
```

Paste your credentials when prompted.

### Step 3: Test Configuration (1 minute)

Verify everything works:
```bash
./scripts/test-apis.sh
```

All tests should pass (or wait a few minutes for API activation).

### Step 4: Start Application

```bash
# Start Docker services
npm run docker:up

# Initialize database
cd backend && npm run db:init && cd ..

# Start application
npm run dev
```

Open: http://localhost:3000

---

## 📝 NPM Scripts

These scripts are also available as npm commands:

```bash
# Generate .env file
npm run setup:env

# Test API connectivity
npm run test:apis
```

---

## 🆘 Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/*.sh
```

### "API key invalid" Errors

**Wait time:**
- Google Maps: 5-10 minutes after creation
- OpenWeather: Up to 2 hours (usually 10-15 minutes)

### .env File Not Found

Run the environment generator:
```bash
./scripts/create-env.sh
```

### Tests Still Failing

Check:
1. APIs are enabled in Google Cloud Console
2. No extra spaces in API keys
3. Correct project is selected in Google Console
4. OAuth redirect URI matches exactly: `http://localhost:3000/auth/callback`

---

## 📚 Documentation

- **Interactive Setup Guide:** `claudedocs/INTERACTIVE_API_SETUP.md` (START HERE)
- **Quick Reference:** `claudedocs/API_QUICK_REFERENCE.md`
- **Full Setup Guide:** `claudedocs/API_SETUP_GUIDE.md`
- **Main README:** `../README.md`

---

## 🔒 Security Notes

- Never commit `.env` files to Git
- `.env` is already in `.gitignore`
- Keep your API keys secure
- Use different secrets for production
- Backup files are created with timestamps

---

## 💡 Tips

**For Development:**
- Use the same Google account for all services
- Add yourself as a test user in OAuth consent
- Free tiers are sufficient for development

**For Production:**
- Use separate API keys
- Enable API key restrictions
- Set up billing alerts in Google Cloud
- Monitor API quotas

---

## 📊 API Quotas & Limits

**Google Maps (Free Tier):**
- $200 free monthly credit
- ~40,000 geocoding requests per month
- ~40,000 directions requests per month

**OpenWeather (Free Tier):**
- 60 calls per minute
- 1,000,000 calls per month
- Current weather + 5-day forecast

**Gmail API:**
- 1 billion quota units per day (effectively unlimited for this use case)

---

*For issues or questions, check the troubleshooting sections in the documentation.*

