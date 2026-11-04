#!/bin/bash

# StillOnTime - .env File Generator
# This script helps create environment configuration files

clear

echo "========================================================================"
echo "🎬 StillOnTime - Environment Configuration Generator"
echo "========================================================================"
echo ""
echo "This script will create .env files with your API credentials."
echo ""
echo "⚠️  Make sure you have completed the API setup steps first!"
echo "   (See: claudedocs/INTERACTIVE_API_SETUP.md)"
echo ""
echo "========================================================================"
echo ""

# Prompt for credentials
echo "📋 Please enter your credentials:"
echo ""

read -p "🔑 Google Client ID: " GOOGLE_CLIENT_ID
read -p "🔐 Google Client Secret: " GOOGLE_CLIENT_SECRET
read -p "🗺️  Google Maps API Key: " GOOGLE_MAPS_API_KEY
read -p "🌤️  OpenWeather API Key: " OPENWEATHER_API_KEY
read -p "🔒 JWT Secret (or press Enter to generate): " JWT_SECRET

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    echo ""
    echo "🔐 Generating JWT secret..."
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "✅ Generated: ${JWT_SECRET:0:16}..."
fi

echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "📝 Creating configuration files..."
echo "──────────────────────────────────────────────────────────────────────"
echo ""

# Create .env content
ENV_CONTENT="# Application Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret
JWT_SECRET=${JWT_SECRET}

# Google OAuth 2.0
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# External APIs
OPENWEATHER_API_KEY=${OPENWEATHER_API_KEY}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}

# Optional: Email Configuration (Uncomment and configure if needed)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Optional: SMS Configuration (Uncomment and configure if needed)
# TWILIO_ACCOUNT_SID=your-twilio-account-sid
# TWILIO_AUTH_TOKEN=your-twilio-auth-token
# TWILIO_PHONE_NUMBER=your-twilio-phone-number
"

# Backup existing files if they exist
if [ -f "backend/.env" ]; then
    BACKUP_FILE="backend/.env.backup.$(date +%s)"
    cp backend/.env "$BACKUP_FILE"
    echo "📦 Backed up existing backend/.env to $BACKUP_FILE"
fi

if [ -f ".env" ]; then
    BACKUP_FILE=".env.backup.$(date +%s)"
    cp .env "$BACKUP_FILE"
    echo "📦 Backed up existing .env to $BACKUP_FILE"
fi

# Create backend/.env (fail loudly: setup-api.sh branches on our exit code)
if ! echo "$ENV_CONTENT" > backend/.env; then
    echo "❌ Failed to write backend/.env (run this script from the repository root)"
    exit 1
fi
echo "✅ Created: backend/.env"

# Create root .env
if ! echo "$ENV_CONTENT" > .env; then
    echo "❌ Failed to write .env"
    exit 1
fi
echo "✅ Created: .env"

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "🎉 Success! Configuration files created."
echo "══════════════════════════════════════════════════════════════════════"
echo ""

# Display masked configuration
echo "📋 Configuration Summary:"
echo "──────────────────────────────────────────────────────────────────────"
echo "Google Client ID:      ${GOOGLE_CLIENT_ID:0:30}..."
echo "Google Client Secret:  ***HIDDEN***"
echo "Google Maps API Key:   ${GOOGLE_MAPS_API_KEY:0:20}..."
echo "OpenWeather API Key:   ${OPENWEATHER_API_KEY:0:20}..."
echo "JWT Secret:            ***HIDDEN***"
echo "Database URL:          postgresql://stillontime_user:***@localhost:5432/***"
echo "Redis URL:             redis://localhost:6379"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

echo "🚀 Next Steps:"
echo ""
echo "  1. Start Docker services:"
echo "     npm run docker:up"
echo ""
echo "  2. Initialize database:"
echo "     cd backend && npm run db:init"
echo ""
echo "  3. Start the application:"
echo "     npm run dev"
echo ""
echo "  4. Open in browser:"
echo "     http://localhost:3000"
echo ""

echo "📚 Documentation:"
echo "  • Interactive Setup Guide: claudedocs/INTERACTIVE_API_SETUP.md"
echo "  • Quick Reference: claudedocs/API_QUICK_REFERENCE.md"
echo "  • Main README: README.md"
echo ""

echo "⚠️  Security Reminder:"
echo "  • Never commit .env files to Git"
echo "  • Keep your credentials secure"
echo "  • Use different secrets for production"
echo ""

echo "══════════════════════════════════════════════════════════════════════"
echo "💚 Thank you for using StillOnTime!"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

