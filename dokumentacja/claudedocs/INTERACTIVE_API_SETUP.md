# 🎬 StillOnTime - Interactive API Setup Guide

**Estimated time:** 15-20 minutes  
**Difficulty:** Easy (just follow the steps)

---

## ✅ What You'll Need

- [ ] Gmail account (personal or work)
- [ ] Web browser
- [ ] 15-20 minutes of your time

---

## 📋 Setup Checklist

Use this checklist to track your progress:

- [ ] **Step 1:** Create Google Cloud Project
- [ ] **Step 2:** Enable Gmail API
- [ ] **Step 3:** Enable Calendar API
- [ ] **Step 4:** Enable Maps APIs (4 APIs)
- [ ] **Step 5:** Configure OAuth Consent Screen
- [ ] **Step 6:** Create OAuth Credentials
- [ ] **Step 7:** Create Maps API Key
- [ ] **Step 8:** Setup OpenWeather Account
- [ ] **Step 9:** Generate JWT Secret
- [ ] **Step 10:** Create .env File
- [ ] **Step 11:** Verify Setup

---

## 🚀 STEP 1: Create Google Cloud Project

### What to do:

1. **Open in your browser:**
   ```
   https://console.cloud.google.com/projectcreate
   ```

2. **Fill in the form:**
   - **Project name:** `StillOnTime`
   - **Organization:** (leave default)
   - Click **"CREATE"**

3. **Wait for creation** (takes ~30 seconds)
   - You'll see a notification in top-right
   - Click **"SELECT PROJECT"** in the notification

4. **Verify:** Check that "StillOnTime" appears in the top bar

✅ **Done?** Check the box above and continue to Step 2

---

## 📧 STEP 2: Enable Gmail API

### What to do:

1. **Open in your browser:**
   ```
   https://console.cloud.google.com/apis/library/gmail.googleapis.com
   ```

2. **Make sure "StillOnTime" is selected** in the top bar

3. **Click the blue "ENABLE" button**

4. **Wait** for ~10 seconds until you see "API enabled"

✅ **Done?** Continue to Step 3

---

## 📅 STEP 3: Enable Calendar API

### What to do:

1. **Open in your browser:**
   ```
   https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
   ```

2. **Click "ENABLE"**

3. **Wait** for activation

✅ **Done?** Continue to Step 4

---

## 🗺️ STEP 4: Enable Maps APIs (4 APIs)

You need to enable **4 separate Maps APIs**. Follow this for each one:

### 4.1. Maps JavaScript API

1. **Open:**
   ```
   https://console.cloud.google.com/apis/library/maps-backend.googleapis.com
   ```
2. **Click "ENABLE"** → Wait for activation

### 4.2. Directions API

1. **Open:**
   ```
   https://console.cloud.google.com/apis/library/directions-backend.googleapis.com
   ```
2. **Click "ENABLE"** → Wait for activation

### 4.3. Geocoding API

1. **Open:**
   ```
   https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
   ```
2. **Click "ENABLE"** → Wait for activation

### 4.4. Distance Matrix API

1. **Open:**
   ```
   https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com
   ```
2. **Click "ENABLE"** → Wait for activation

✅ **Done with all 4?** Continue to Step 5

---

## 🔐 STEP 5: Configure OAuth Consent Screen

### What to do:

1. **Open:**
   ```
   https://console.cloud.google.com/apis/credentials/consent
   ```

2. **Select "External"** user type → Click **"CREATE"**

3. **Fill in App Information:**
   - **App name:** `StillOnTime`
   - **User support email:** (select your email from dropdown)
   - **Developer contact email:** (enter your email)
   - Click **"SAVE AND CONTINUE"**

4. **Add Scopes:**
   - Click **"ADD OR REMOVE SCOPES"**
   - In the filter box, search for: `gmail`
   - ✅ Check: `.../auth/gmail.readonly`
   - Search for: `calendar`
   - ✅ Check: `.../auth/calendar`
   - ✅ Check: `.../auth/calendar.events`
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

5. **Add Test Users:**
   - Click **"+ ADD USERS"**
   - Enter your Gmail address (the one you'll use for testing)
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

6. **Review Summary:**
   - Click **"BACK TO DASHBOARD"**

✅ **Done?** Continue to Step 6

---

## 🔑 STEP 6: Create OAuth Credentials

### What to do:

1. **Open:**
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. **Click "+ CREATE CREDENTIALS"** (top of page)

3. **Select "OAuth client ID"**

4. **Fill in the form:**
   - **Application type:** Web application
   - **Name:** `StillOnTime Web Client`

5. **Add Authorized redirect URIs:**
   - Click **"+ ADD URI"**
   - Enter: `http://localhost:3000/auth/callback`
   - (Optional) For production, add: `https://yourdomain.com/auth/callback`

6. **Click "CREATE"**

7. **IMPORTANT:** A dialog will appear with your credentials:
   - **Copy the Client ID** (looks like: `123456-abc.apps.googleusercontent.com`)
   - **Copy the Client Secret** (looks like: `GOCSPX-abc123xyz`)
   - **Save both in a temporary text file** - you'll need them soon!
   - Click **"OK"** to close the dialog

✅ **Done?** Make sure you saved both values! Continue to Step 7

---

## 🗺️ STEP 7: Create Maps API Key

### What to do:

1. **Still on the Credentials page:**
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. **Click "+ CREATE CREDENTIALS"** → **"API key"**

3. **An API key will be generated automatically**
   - **Copy the API key** (looks like: `AIzaSyAbc123...`)
   - **Save it in your text file**

4. **RECOMMENDED: Restrict the API key:**
   - Click the **pencil icon** (Edit) next to your new API key
   - Under **"API restrictions":**
     - Select **"Restrict key"**
     - Check these 4 APIs:
       - ✅ Maps JavaScript API
       - ✅ Directions API
       - ✅ Geocoding API
       - ✅ Distance Matrix API
   - Click **"SAVE"**

✅ **Done?** Make sure you saved the API key! Continue to Step 8

---

## 🌤️ STEP 8: Setup OpenWeather Account

### What to do:

#### If you already have an OpenWeather account:

1. **Login:**
   ```
   https://home.openweathermap.org/users/sign_in
   ```

2. **Get your API key:**
   ```
   https://home.openweathermap.org/api_keys
   ```

3. **Copy the default API key** (or create a new one)
4. **Save it in your text file**

#### If you need to create an account:

1. **Sign up:**
   ```
   https://home.openweathermap.org/users/sign_up
   ```

2. **Fill in the registration form**
   - Email, password, etc.
   - **Confirm your email** (check inbox)

3. **Login and get API key:**
   ```
   https://home.openweathermap.org/api_keys
   ```

4. **Copy the API key** and **save it in your text file**

⚠️ **Note:** New OpenWeather API keys can take up to 2 hours to activate (usually faster)

✅ **Done?** Continue to Step 9

---

## 🔐 STEP 9: Generate JWT Secret

### What to do:

**Run this command in your terminal:**

```bash
cd /Users/arkadiuszfudali/Git/StillOnTime
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Or use OpenSSL:**

```bash
openssl rand -hex 32
```

**Copy the generated string** (will look like: `a1b2c3d4e5f6...`) and **save it in your text file**

✅ **Done?** Continue to Step 10

---

## 📝 STEP 10: Create .env File

Now we'll create the configuration file with all your credentials.

### What to do:

**Run this script I'll provide:**

Create a file `/Users/arkadiuszfudali/Git/StillOnTime/scripts/create-env.sh`:

```bash
#!/bin/bash

echo "🎬 StillOnTime - .env File Generator"
echo "===================================="
echo ""

# Prompt for credentials
echo "Please enter your credentials:"
echo ""

read -p "Google Client ID: " GOOGLE_CLIENT_ID
read -p "Google Client Secret: " GOOGLE_CLIENT_SECRET
read -p "Google Maps API Key: " GOOGLE_MAPS_API_KEY
read -p "OpenWeather API Key: " OPENWEATHER_API_KEY
read -p "JWT Secret: " JWT_SECRET

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

# Create backend/.env
echo "$ENV_CONTENT" > backend/.env
echo "✅ Created: backend/.env"

# Create root .env
echo "$ENV_CONTENT" > .env
echo "✅ Created: .env"

echo ""
echo "🎉 Success! Configuration files created."
echo ""
echo "Next steps:"
echo "  1. Start Docker: npm run docker:up"
echo "  2. Init database: cd backend && npm run db:init"
echo "  3. Start app: npm run dev"
```

**Then run it:**

```bash
chmod +x scripts/create-env.sh
./scripts/create-env.sh
```

**Paste your credentials when prompted.**

✅ **Done?** Continue to Step 11

---

## ✅ STEP 11: Verify Setup

### Test API Connectivity

**Test OpenWeather API:**

```bash
# Replace YOUR_KEY with your actual key
curl "https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_OPENWEATHER_KEY"
```

**Expected:** JSON response with weather data

**Test Google Maps API:**

```bash
# Replace YOUR_KEY with your actual key
curl "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=YOUR_MAPS_KEY"
```

**Expected:** JSON response with geocoding data

### Start the Application

```bash
# Start Docker services (PostgreSQL, Redis)
npm run docker:up

# Initialize database
cd backend && npm run db:init && cd ..

# Start application
npm run dev
```

**Open in browser:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001/health

✅ **Everything working?** You're done!

---

## 🎉 SUCCESS! What's Next?

You've successfully configured all APIs! Here's what you can do now:

### Immediate Next Steps:

1. **Test OAuth Flow:**
   - Open http://localhost:3000
   - Try logging in with Google
   - Grant permissions

2. **Test Email Processing:**
   - Send a test email with PDF attachment
   - Check if it's processed

3. **Explore the Application:**
   - Dashboard
   - Configuration
   - History
   - Monitoring

### Documentation:

- **Quick Reference:** `claudedocs/API_QUICK_REFERENCE.md`
- **Full Guide:** `claudedocs/API_SETUP_GUIDE.md`
- **Architecture:** `CS_Technical_Architecture.md`

---

## 🆘 Troubleshooting

### "API key invalid" errors

**Wait time:** 
- Google Maps: 5-10 minutes
- OpenWeather: Up to 2 hours (usually 10-15 minutes)

**Solution:** Have a coffee, come back later

### "OAuth redirect_uri_mismatch"

**Check:**
- Redirect URI in Google Console exactly matches: `http://localhost:3000/auth/callback`
- No trailing slashes
- Protocol is `http` (not `https`) for localhost

### "Database connection error"

**Fix:**
```bash
npm run docker:down
npm run docker:up
cd backend && npm run db:test
```

### Still stuck?

1. Check `backend/logs/` for error messages
2. Verify all credentials in `.env` file
3. Make sure Docker is running: `docker ps`
4. Check if ports 3000, 3001, 5432, 6379 are free

---

## 📊 Summary of What You Created

✅ Google Cloud Project: "StillOnTime"  
✅ 7 APIs Enabled (Gmail, Calendar, 4x Maps, Geocoding)  
✅ OAuth 2.0 Client configured  
✅ Maps API Key created  
✅ OpenWeather account setup  
✅ Environment variables configured  
✅ Application ready to run  

**Total time:** ~15-20 minutes  
**APIs cost:** $0 (free tier)  
**Next step:** Start building! 🚀

---

*Need help? Check the troubleshooting section or main documentation.*

