# API Setup Scripts

Helper scripts for setting up StillOnTime external API integrations.

## Quick Start

Run the main setup helper:

```bash
./scripts/setup-api.sh
```

This will guide you through the entire process.

## Individual Scripts

### 1. setup-api.sh (Main Helper)
**Purpose**: Interactive guide through the entire setup process  
**Usage**: `./scripts/setup-api.sh`  
**What it does**:
- Opens the step-by-step manual guide
- Runs the .env file generator
- Optionally runs API connectivity tests
- Provides next steps

### 2. create-env.sh (Environment Generator)
**Purpose**: Create .env files with your API credentials  
**Usage**: `./scripts/create-env.sh`  
**What it does**:
- Prompts for all API credentials
- Auto-generates JWT secret if not provided
- Creates backend/.env and root .env files
- Backs up existing .env files
- Shows configuration summary

**Required inputs**:
- Google Client ID
- Google Client Secret
- Google Maps API Key
- OpenWeather API Key
- JWT Secret (optional - auto-generated if empty)

### 3. test-apis.sh (API Validator)
**Purpose**: Test all API configurations  
**Usage**: `./scripts/test-apis.sh`  
**What it does**:
- Validates all environment variables are set
- Tests OpenWeather API connectivity
- Tests Google Maps API (Geocoding, Directions)
- Checks JWT secret length (≥32 chars)
- Verifies OAuth credentials are configured
- Provides troubleshooting tips for failures

## Why Manual Setup?

**You cannot fully automate Google Cloud Console setup** because:
- Google blocks automated browsers (Playwright, Selenium) for security
- OAuth setup requires human authentication (2FA, CAPTCHA)
- API key creation needs manual approval and verification

**What IS automated**:
- ✅ JWT secret generation
- ✅ .env file creation
- ✅ API connectivity testing
- ✅ Configuration validation

**What requires manual steps**:
- ⚠️ Creating Google Cloud Project
- ⚠️ Enabling APIs in Google Console
- ⚠️ Setting up OAuth consent screen
- ⚠️ Creating OAuth credentials and API keys
- ⚠️ OpenWeather account registration

## Step-by-Step Process

### Step 1: Manual API Setup
Follow the interactive guide:
```bash
cat claudedocs/INTERACTIVE_API_SETUP.md
# Or use: ./scripts/setup-api.sh (opens it for you)
```

This guide walks you through:
1. Creating Google Cloud Project "StillOnTime"
2. Enabling 7 required APIs (Gmail, Calendar, 4x Maps)
3. Configuring OAuth consent screen
4. Creating OAuth credentials
5. Creating Google Maps API key
6. Setting up OpenWeather account

### Step 2: Create .env Files
After collecting all credentials:
```bash
./scripts/create-env.sh
```

Paste your credentials when prompted.

### Step 3: Verify Configuration
Test that everything works:
```bash
./scripts/test-apis.sh
```

### Step 4: Start Application
If tests pass:
```bash
npm run docker:up          # Start PostgreSQL & Redis
cd backend && npm run db:init  # Initialize database
npm run dev                # Start application
```

## Troubleshooting

### "API key invalid"
**Cause**: New API keys need activation time  
**Solution**: Wait 5-10 minutes (Google Maps) or up to 2 hours (OpenWeather)

### "OAuth redirect_uri_mismatch"
**Cause**: Redirect URI in Google Console doesn't match exactly  
**Solution**: Verify it's exactly `http://localhost:3000/auth/callback` (no trailing slash)

### "Missing environment variable"
**Cause**: .env file incomplete or not created  
**Solution**: Re-run `./scripts/create-env.sh`

### "Database connection error"
**Cause**: Docker containers not running  
**Solution**: 
```bash
npm run docker:down
npm run docker:up
```

## Documentation

- **Interactive Setup Guide**: [../claudedocs/INTERACTIVE_API_SETUP.md](../claudedocs/INTERACTIVE_API_SETUP.md)
- **Quick Reference**: [../claudedocs/API_QUICK_REFERENCE.md](../claudedocs/API_QUICK_REFERENCE.md)
- **Main README**: [../README.md](../README.md)

## Security Notes

⚠️ **IMPORTANT**:
- Never commit .env files to Git (already in .gitignore)
- Keep API credentials secure
- Use different secrets for production
- JWT secret should be ≥32 characters (auto-generated secrets are 64 chars)

## Scripts Location

```
scripts/
├── README.md           # This file
├── setup-api.sh        # Main interactive helper
├── create-env.sh       # Environment file generator
└── test-apis.sh        # API connectivity tester
```

## Getting Help

If you encounter issues:
1. Check the troubleshooting sections in this README
2. Review [INTERACTIVE_API_SETUP.md](../claudedocs/INTERACTIVE_API_SETUP.md) for detailed steps
3. Check [API_QUICK_REFERENCE.md](../claudedocs/API_QUICK_REFERENCE.md) for common fixes
4. Verify Docker is running: `docker ps`
5. Check application logs in `backend/logs/`

## Skrypty porządkowe i uruchomieniowe (2024 cleanup)

| Skrypt | Opis | Log |
| --- | --- | --- |
| `backup_and_branch.sh` | Backup repo + tag/gałąź bezpieczeństwa | `logs/backup.log` |
| `backup_and_branch.ps1` | Wariant PowerShell | `logs/backup.log` |
| `bootstrap.sh` | Instalacja zależności (dev/prod) | `logs/bootstrap.log` |
| `build.sh` | Build wszystkich modułów | `logs/build.log` |
| `start.sh` | Uruchamianie usług (local/docker) | `logs/start.log` |
| `smoke-test.sh` | Smoke test + moduły runtime | `logs/smoke-test.log` |
| `purge_unused.sh` | Raport i usuwanie artefaktów | `logs/purge-unused.log` |
| `update-doc-links.sh` | Aktualizacja odnośników po migracji dokumentacji | `logs/update-doc-links.log` |

> Wszystkie skrypty są idempotentne i wspierają `--dry-run`. Uruchamiaj z katalogu `<ABSOLUTE_REPO_PATH>`.
