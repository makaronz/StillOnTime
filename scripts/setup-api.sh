#!/bin/bash

# StillOnTime - API Setup Helper
# This script guides you through the API setup process

clear

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                  🎬 StillOnTime - API Setup Helper                  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "This helper will guide you through setting up external APIs."
echo ""
echo "⚠️  IMPORTANT: Google Cloud Console requires MANUAL setup"
echo "   Google blocks automated browsers for security reasons."
echo "   You'll need to do some steps manually in your browser."
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo ""

# Check if guide exists
if [ ! -f "claudedocs/INTERACTIVE_API_SETUP.md" ]; then
    echo "❌ Error: Setup guide not found!"
    echo "   Expected: claudedocs/INTERACTIVE_API_SETUP.md"
    exit 1
fi

echo "📖 Step 1: Read the Setup Guide"
echo "──────────────────────────────────────────────────────────────────────"
echo ""
echo "The interactive guide will walk you through:"
echo "  • Creating Google Cloud Project"
echo "  • Enabling required APIs (Gmail, Calendar, Maps)"
echo "  • Setting up OAuth 2.0"
echo "  • Creating API keys"
echo "  • OpenWeather account setup"
echo ""
read -p "Press ENTER to open the guide in your default editor/viewer..."

# Try to open the guide
if command -v open &> /dev/null; then
    open claudedocs/INTERACTIVE_API_SETUP.md
elif command -v xdg-open &> /dev/null; then
    xdg-open claudedocs/INTERACTIVE_API_SETUP.md
else
    echo "📄 Guide location: claudedocs/INTERACTIVE_API_SETUP.md"
    echo "   Please open it manually"
fi

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "✅ Have you completed the manual setup steps?"
echo "   (Created Google Cloud project, enabled APIs, got credentials)"
echo ""
read -p "Continue to .env file creation? (y/n): " CONTINUE

if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
    echo ""
    echo "👋 No problem! Come back when you're ready."
    echo "   Run this script again: ./scripts/setup-api.sh"
    echo ""
    exit 0
fi

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "📝 Step 2: Create .env File"
echo "──────────────────────────────────────────────────────────────────────"
echo ""
echo "Running environment configuration generator..."
echo ""

# Make sure create-env.sh is executable
chmod +x scripts/create-env.sh

# Run the env creator
./scripts/create-env.sh

# Check if it succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════════════════"
    echo ""
    echo "🧪 Step 3: Test API Configuration"
    echo "──────────────────────────────────────────────────────────────────────"
    echo ""
    read -p "Would you like to test your API configuration now? (y/n): " TEST

    if [ "$TEST" = "y" ] || [ "$TEST" = "Y" ]; then
        echo ""
        chmod +x scripts/test-apis.sh
        ./scripts/test-apis.sh
    else
        echo ""
        echo "You can test later by running:"
        echo "  ./scripts/test-apis.sh"
        echo ""
    fi
else
    echo ""
    echo "❌ Environment file creation failed."
    echo "   Please check the error messages above."
    echo ""
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                        🎉 Setup Complete!                           ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 What was created:"
echo "  ✅ backend/.env - Backend configuration"
echo "  ✅ .env - Root configuration"
echo ""
echo "📚 Next Steps:"
echo ""
echo "  1. Start Docker services:"
echo "     npm run docker:up"
echo ""
echo "  2. Initialize database:"
echo "     cd backend && npm run db:init && cd .."
echo ""
echo "  3. Start the application:"
echo "     npm run dev"
echo ""
echo "  4. Open in browser:"
echo "     http://localhost:3000"
echo ""
echo "📖 Documentation:"
echo "  • Setup Guide: claudedocs/INTERACTIVE_API_SETUP.md"
echo "  • Quick Reference: claudedocs/API_QUICK_REFERENCE.md"
echo "  • Test APIs: ./scripts/test-apis.sh"
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo ""
