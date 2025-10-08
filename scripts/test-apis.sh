#!/bin/bash

# StillOnTime - API Connectivity Tester
# This script tests if all external APIs are properly configured and accessible

clear

echo "========================================================================"
echo "🧪 StillOnTime - API Connectivity Tester"
echo "========================================================================"
echo ""
echo "This script will test your API configurations."
echo ""
echo "⚠️  Make sure you have:"
echo "   1. Created .env file (run: ./scripts/create-env.sh)"
echo "   2. Waited for API activation (up to 10 minutes for new keys)"
echo ""
echo "========================================================================"
echo ""

# Load environment variables
if [ -f "backend/.env" ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from backend/.env"
elif [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from .env"
else
    echo "❌ Error: No .env file found!"
    echo "   Please run: ./scripts/create-env.sh"
    exit 1
fi

echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "📡 Testing API Connectivity..."
echo "──────────────────────────────────────────────────────────────────────"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test URL
test_api() {
    local NAME=$1
    local URL=$2
    local EXPECTED=$3
    
    echo -n "Testing $NAME... "
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)
    
    if [ "$RESPONSE" = "$EXPECTED" ]; then
        echo "✅ PASS (HTTP $RESPONSE)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo "❌ FAIL (HTTP $RESPONSE, expected $EXPECTED)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: OpenWeather API
echo "1️⃣  OpenWeather API"
if [ -z "$OPENWEATHER_API_KEY" ]; then
    echo "   ❌ OPENWEATHER_API_KEY not set in .env"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    test_api "OpenWeather" \
        "https://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY" \
        "200"
    
    if [ $? -ne 0 ]; then
        echo "   💡 Tip: New keys take up to 2 hours to activate"
    fi
fi
echo ""

# Test 2: Google Maps Geocoding API
echo "2️⃣  Google Maps Geocoding API"
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "   ❌ GOOGLE_MAPS_API_KEY not set in .env"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    test_api "Maps Geocoding" \
        "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=$GOOGLE_MAPS_API_KEY" \
        "200"
    
    if [ $? -ne 0 ]; then
        echo "   💡 Tip: Wait 5-10 minutes after key creation"
        echo "   💡 Tip: Check if Geocoding API is enabled"
    fi
fi
echo ""

# Test 3: Google Maps Directions API
echo "3️⃣  Google Maps Directions API"
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "   ❌ GOOGLE_MAPS_API_KEY not set in .env"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    test_api "Maps Directions" \
        "https://maps.googleapis.com/maps/api/directions/json?origin=London&destination=Manchester&key=$GOOGLE_MAPS_API_KEY" \
        "200"
    
    if [ $? -ne 0 ]; then
        echo "   💡 Tip: Check if Directions API is enabled"
    fi
fi
echo ""

# Test 4: JWT Secret
echo "4️⃣  JWT Secret"
if [ -z "$JWT_SECRET" ]; then
    echo "   ❌ JWT_SECRET not set in .env"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    LENGTH=${#JWT_SECRET}
    if [ $LENGTH -ge 32 ]; then
        echo "   ✅ PASS (Length: $LENGTH characters)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "   ⚠️  WARNING: JWT Secret is only $LENGTH characters (should be at least 32)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
fi
echo ""

# Test 5: Google OAuth Credentials
echo "5️⃣  Google OAuth Credentials"
OAUTH_OK=true

if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "   ❌ GOOGLE_CLIENT_ID not set in .env"
    OAUTH_OK=false
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "   ❌ GOOGLE_CLIENT_SECRET not set in .env"
    OAUTH_OK=false
fi

if [ -z "$GOOGLE_REDIRECT_URI" ]; then
    echo "   ❌ GOOGLE_REDIRECT_URI not set in .env"
    OAUTH_OK=false
fi

if [ "$OAUTH_OK" = true ]; then
    echo "   ✅ PASS (All OAuth credentials set)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 6: Database URL
echo "6️⃣  Database Configuration"
if [ -z "$DATABASE_URL" ]; then
    echo "   ❌ DATABASE_URL not set in .env"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo "   ✅ PASS (DATABASE_URL is set)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "   💡 Note: Run 'npm run docker:up' to start PostgreSQL"
fi
echo ""

# Test 7: Redis URL
echo "7️⃣  Redis Configuration"
if [ -z "$REDIS_URL" ]; then
    echo "   ❌ REDIS_URL not set in .env"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo "   ✅ PASS (REDIS_URL is set)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "   💡 Note: Run 'npm run docker:up' to start Redis"
fi
echo ""

# Summary
echo "══════════════════════════════════════════════════════════════════════"
echo "📊 Test Results"
echo "══════════════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
echo "✅ Passed:    $TESTS_PASSED"
echo "❌ Failed:    $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 SUCCESS! All tests passed."
    echo ""
    echo "🚀 You're ready to start the application:"
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
    exit 0
else
    echo "⚠️  Some tests failed. Please check the errors above."
    echo ""
    echo "📚 Common Issues:"
    echo ""
    echo "  1. API keys not activated yet:"
    echo "     • Google Maps: Wait 5-10 minutes"
    echo "     • OpenWeather: Wait up to 2 hours"
    echo ""
    echo "  2. Missing .env file:"
    echo "     • Run: ./scripts/create-env.sh"
    echo ""
    echo "  3. APIs not enabled in Google Cloud Console:"
    echo "     • Check: https://console.cloud.google.com/apis/library"
    echo ""
    echo "  4. Incorrect API keys:"
    echo "     • Verify in .env file (no extra spaces)"
    echo ""
    echo "📖 Documentation:"
    echo "  • Setup Guide: claudedocs/INTERACTIVE_API_SETUP.md"
    echo "  • Quick Reference: claudedocs/API_QUICK_REFERENCE.md"
    echo ""
    exit 1
fi

