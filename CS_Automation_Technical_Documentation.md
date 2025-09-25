# MP2 Film Schedule Automation Tool - Dokumentacja Techniczna

## 1. Product Overview

Narzędzie automatyzacji planów zdjęciowych MP2 to system, który automatycznie przetwarza maile z planami zdjęciowymi filmu "Matki Pingwinów 2", analizuje załączone pliki PDF i tworzy kompletny plan dnia z uwzględnieniem tras, alarmów, wydarzeń kalendarzowych i prognozy pogody.

System rozwiązuje problem manualnego planowania dnia zdjęciowego poprzez automatyczne obliczanie czasów podróży, ustawianie przypomnień i integrację z kalendarzem Google. Głównym użytkownikiem jest członek ekipy filmowej wymagający precyzyjnego planowania czasu.

## 2. Core Features

### 2.1 User Roles

| Role             | Registration Method  | Core Permissions                       |
| ---------------- | -------------------- | -------------------------------------- |
| Film Crew Member | Google Account OAuth | Full access to all automation features |

### 2.2 Feature Module

Nasz system automatyzacji MP2 składa się z następujących głównych modułów:

1. **Email Processing Module**: automatyczne wykrywanie i przetwarzanie maili MP2, parsowanie załączników PDF
2. **Route Planning Module**: obliczanie tras Dom→Panavision→Lokacja z uwzględnieniem ruchu i buforów czasowych
3. **Calendar Integration Module**: tworzenie wydarzeń kalendarzowych z alarmami i przypomnieniami
4. **Weather Monitoring Module**: sprawdzanie prognozy pogody i generowanie ostrzeżeń
5. **Notification System**: generowanie podsumowań i komunikatów dla użytkownika

### 2.3 Page Details

| Module Name          | Feature Name            | Feature Description                                                                      |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Email Processing     | Gmail Trigger           | Monitor incoming emails matching MP2 criteria (sender, subject regex, PDF attachment)    |
| Email Processing     | PDF Parser              | Extract date, call time, locations, INT/EXT type, safety notes, contacts from PDF        |
| Email Processing     | Duplicate Prevention    | Hash Message-ID and PDF content to prevent duplicate processing                          |
| Route Planning       | Travel Time Calculator  | Calculate Dom→Panavision→Location routes with traffic_model=best_guess                   |
| Route Planning       | Buffer Management       | Apply 15min car change, 10min parking, 10min entry, 20min traffic, 45min morning routine |
| Route Planning       | Wake-up Time Calculator | Calculate optimal wake-up time based on call time minus total travel and buffer time     |
| Calendar Integration | Event Creator           | Create Google Calendar event with title "MP2 — Dzień zdjęciowy (location)"               |
| Calendar Integration | Alarm Setter            | Set 3 wake-up alarms at different times (wake-up-10, wake-up, wake-up+5)                 |
| Calendar Integration | Reminder Manager        | Add reminders at -12h, -3h, -1h, and departure time                                      |
| Weather Monitoring   | Weather API Integration | Fetch weather forecast for shoot date and location                                       |
| Weather Monitoring   | Alert Generator         | Generate warnings for rain, storms, fog, temp <0°C or >30°C, strong wind                 |
| Notification System  | Summary Generator       | Create detailed day summary with times, locations, weather, warnings                     |

## 3. Core Process

### Main Automation Flow

1. **Email Detection**: System monitors Gmail for MP2-related emails with PDF attachments
2. **PDF Processing**: Extract shooting schedule data (date, call time, locations, type)
3. **Route Calculation**: Calculate travel times Dom→Panavision→Location with traffic data
4. **Time Planning**: Determine wake-up time, departure times, arrival times with buffers
5. **Weather Check**: Fetch weather forecast and generate warnings if needed
6. **Calendar Integration**: Create calendar event with all details and set multiple alarms
7. **Summary Generation**: Create comprehensive day summary for user review

```mermaid
graph TD
    A[Gmail Email Received] --> B[Email Filter Check]
    B --> C[PDF Attachment Download]
    C --> D[PDF Content Parsing]
    D --> E[Route Planning]
    E --> F[Weather Forecast Check]
    F --> G[Calendar Event Creation]
    G --> H[Alarm Setup]
    H --> I[Summary Generation]
    I --> J[User Notification]
```

## 4. User Interface Design

### 4.1 Design Style

- **Primary Colors**: Google Blue (#4285F4), Warning Orange (#FF9800)
- **Secondary Colors**: Success Green (#4CAF50), Error Red (#F44336)
- **Typography**: Roboto font family, 14px base size
- **Layout Style**: Clean, minimal interface with card-based information display
- **Icons**: Material Design icons for consistency with Google ecosystem
- **Notifications**: Toast-style notifications with appropriate color coding

### 4.2 Page Design Overview

| Module Name          | UI Elements                    | Design Specifications                                               |
| -------------------- | ------------------------------ | ------------------------------------------------------------------- |
| Email Processing     | Status indicators, PDF preview | Clean status cards with green/red indicators, PDF thumbnail preview |
| Route Planning       | Interactive map, time timeline | Google Maps integration, horizontal timeline with travel segments   |
| Calendar Integration | Calendar preview, alarm list   | Mini calendar widget, alarm time chips with edit capability         |
| Weather Monitoring   | Weather cards, alert badges    | Weather icon cards, prominent warning badges for alerts             |
| Notification System  | Summary dashboard              | Comprehensive dashboard with collapsible sections                   |

### 4.3 Responsiveness

System is designed as a backend automation tool with web-based monitoring dashboard. Mobile-responsive design for monitoring on mobile devices, with touch-optimized controls for manual overrides.

## 5. Technical Architecture

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   React 19  │ │ TypeScript  │ │     Tailwind CSS        │ │
│  │   + Vite    │ │   + Zod     │ │   + Zustand State       │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Google Apps Script Runtime                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              MP2System Orchestrator                     │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │ConfigManager│ │   Logger    │ │    DataStorage      │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │EmailMonitor │ │ PDFParser   │ │   RoutePlanner      │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │CalendarMgr  │ │WeatherSvc   │ │ NotificationMgr     │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Gmail API  │ │ Calendar API│ │    Google Maps API      │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Drive API  │ │Weather APIs │ │   Notification APIs     │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Technology Stack

#### Frontend Stack

- **React 19**: Modern UI framework with concurrent features
- **TypeScript**: Type-safe development with strict mode
- **Vite**: Fast build tool and HMR development server
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **React Hook Form + Zod**: Form handling with validation
- **React Router**: Client-side routing
- **Recharts**: Data visualization components
- **Lucide React**: Modern icon library

#### Backend Stack

- **Google Apps Script V8**: JavaScript runtime environment
- **Modular Architecture**: Component-based system design
- **MP2System Orchestrator**: Central system coordinator
- **Event-Driven Architecture**: Component communication via events

#### Build & Deployment

- **clasp**: Google Apps Script CLI tool
- **Custom Build Pipeline**: Frontend-to-GAS integration
- **npm Scripts**: Automated build and deployment workflows
- **Inline Asset Processing**: CSS/JS inlining for GAS compatibility

### 5.3 Core Components

#### System Orchestration

1. **MP2System**: Central orchestrator managing all components
2. **ConfigManager**: Centralized configuration management
3. **Logger**: Comprehensive logging with multiple levels
4. **DataStorage**: Data persistence layer with Google Sheets
5. **MigrationManager**: Version migration and compatibility

#### Business Logic Components

1. **EmailMonitor**: Gmail API integration with intelligent filtering
2. **PDFParser**: Advanced document parsing with OCR support
3. **RoutePlanner**: Google Maps integration with traffic optimization
4. **CalendarManager**: Google Calendar API with event management
5. **WeatherService**: Multi-provider weather data integration
6. **NotificationManager**: Multi-channel notification system

#### System Management

1. **SystemMonitor**: Health monitoring and performance tracking
2. **WebInterface**: React frontend integration layer
3. **TestFramework**: Comprehensive testing infrastructure

## 6. Implementation Details

### 6.1 Google Apps Script Code Structure

```javascript
// Main trigger function
function processMP2Emails() {
  const emails = getMP2Emails();

  for (const email of emails) {
    if (isDuplicate(email)) continue;

    const pdfData = parsePDFAttachment(email);
    const routePlan = calculateRoutes(pdfData);
    const weather = getWeatherForecast(pdfData);

    createCalendarEvent(pdfData, routePlan, weather);
    setAlarms(routePlan.wakeUpTime);
    generateSummary(pdfData, routePlan, weather);

    markAsProcessed(email);
  }
}

// Email detection and filtering
function getMP2Emails() {
  const query =
    'has:attachment filename:pdf (MP2 OR "plan zdjęciowy" OR drabinka OR "call time")';
  const threads = GmailApp.search(query, 0, 10);

  return threads.flatMap((thread) =>
    thread
      .getMessages()
      .filter((msg) => hasValidMP2Sender(msg) && hasValidPDFAttachment(msg))
  );
}

// PDF parsing function
function parsePDFAttachment(email) {
  const attachments = email.getAttachments();
  const pdfAttachment = attachments.find(
    (att) => att.getContentType() === "application/pdf"
  );

  if (!pdfAttachment) return null;

  // Save to Drive temporarily
  const blob = pdfAttachment.copyBlob();
  const file = DriveApp.createFile(blob);

  try {
    // Use external PDF parsing service or OCR
    const pdfText = extractTextFromPDF(file);
    return parseScheduleData(pdfText);
  } finally {
    DriveApp.getFileById(file.getId()).setTrashed(true);
  }
}

// Route calculation with traffic
function calculateRoutes(scheduleData) {
  const homeAddress = "ul. Stylowa 7, Warszawa";
  const panavisionAddress = "ul. Wyczółki, Warszawa";
  const locationAddress = scheduleData.location || panavisionAddress;

  // Calculate Dom → Panavision → Location
  const route1 = Maps.newDirectionFinder()
    .setOrigin(homeAddress)
    .setDestination(panavisionAddress)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .getDirections();

  const route2 = Maps.newDirectionFinder()
    .setOrigin(panavisionAddress)
    .setDestination(locationAddress)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .getDirections();

  const totalTravelTime =
    route1.routes[0].legs[0].duration.value +
    route2.routes[0].legs[0].duration.value;

  // Add buffers: 15min car change + 10min parking + 10min entry + 20min traffic + 45min morning routine
  const bufferMinutes = 15 + 10 + 10 + 20 + 45; // 100 minutes total
  const totalMinutes = Math.ceil(totalTravelTime / 60) + bufferMinutes;

  const callTime = new Date(scheduleData.date + " " + scheduleData.callTime);
  const wakeUpTime = new Date(callTime.getTime() - totalMinutes * 60 * 1000);
  const departureTime = new Date(wakeUpTime.getTime() + 45 * 60 * 1000); // After morning routine

  return {
    wakeUpTime,
    departureTime,
    callTime,
    totalTravelTime: totalMinutes,
    routes: [route1, route2],
  };
}

// Weather forecast integration
function getWeatherForecast(scheduleData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(
    "OPENWEATHER_API_KEY"
  );
  const location = scheduleData.location || "Warszawa";
  const date = scheduleData.date;

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${apiKey}&units=metric&lang=pl`;

  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    // Find forecast for the shooting date
    const targetDate = new Date(date);
    const forecast = data.list.find((item) => {
      const forecastDate = new Date(item.dt * 1000);
      return forecastDate.toDateString() === targetDate.toDateString();
    });

    if (forecast) {
      return {
        temperature: forecast.main.temp,
        description: forecast.weather[0].description,
        humidity: forecast.main.humidity,
        windSpeed: forecast.wind.speed,
        precipitation: forecast.rain ? forecast.rain["3h"] : 0,
        warnings: generateWeatherWarnings(forecast),
      };
    }
  } catch (error) {
    console.error("Weather API error:", error);
    return { error: "Pogoda niedostępna" };
  }

  return null;
}

// Generate weather warnings
function generateWeatherWarnings(forecast) {
  const warnings = [];
  const temp = forecast.main.temp;
  const windSpeed = forecast.wind.speed;
  const precipitation = forecast.rain ? forecast.rain["3h"] : 0;

  if (temp < 0) warnings.push("⚠️ Temperatura poniżej 0°C - ryzyko oblodzenia");
  if (temp > 30) warnings.push("🌡️ Wysoka temperatura powyżej 30°C");
  if (windSpeed > 10) warnings.push("💨 Silny wiatr - uwaga na sprzęt");
  if (precipitation > 0) warnings.push("🌧️ Opady deszczu przewidywane");
  if (forecast.weather[0].main === "Thunderstorm")
    warnings.push("⛈️ Burza - zagrożenie dla sprzętu");
  if (forecast.weather[0].main === "Fog")
    warnings.push("🌫️ Mgła - ograniczona widoczność");

  return warnings;
}

// Calendar event creation
function createCalendarEvent(scheduleData, routePlan, weather) {
  const calendar = CalendarApp.getDefaultCalendar();

  const title = `MP2 — Dzień zdjęciowy (${scheduleData.location || "baza"})`;
  const startTime = routePlan.departureTime;
  const endTime = new Date(routePlan.callTime.getTime() + 10 * 60 * 60 * 1000); // +10 hours

  const description = createEventDescription(scheduleData, routePlan, weather);

  const event = calendar.createEvent(title, startTime, endTime, {
    description: description,
    location: scheduleData.location,
  });

  // Add reminders
  event.addPopupReminder(12 * 60); // 12 hours before
  event.addPopupReminder(3 * 60); // 3 hours before
  event.addPopupReminder(60); // 1 hour before
  event.addPopupReminder(
    Math.floor((startTime.getTime() - Date.now()) / (60 * 1000))
  ); // At departure time

  return event;
}

// Set multiple alarms
function setAlarms(wakeUpTime) {
  const calendar = CalendarApp.getDefaultCalendar();

  // Create 3 separate alarm events
  const alarmTimes = [
    new Date(wakeUpTime.getTime() - 10 * 60 * 1000), // 10 min before
    wakeUpTime, // Exact time
    new Date(wakeUpTime.getTime() + 5 * 60 * 1000), // 5 min after
  ];

  alarmTimes.forEach((time, index) => {
    const alarmEvent = calendar.createEvent(
      `🚨 ALARM MP2 #${index + 1}`,
      time,
      new Date(time.getTime() + 5 * 60 * 1000), // 5 min duration
      {
        description: "Pobudka na plan zdjęciowy MP2",
        location: "Dom",
      }
    );

    alarmEvent.addPopupReminder(0); // Immediate popup
    alarmEvent.addSmsReminder(0); // SMS if configured
  });
}

// Generate comprehensive summary
function generateSummary(scheduleData, routePlan, weather) {
  const summary = {
    date: scheduleData.date,
    callTime: formatTime(routePlan.callTime),
    wakeUpTime: formatTime(routePlan.wakeUpTime),
    departureTime: formatTime(routePlan.departureTime),
    location: scheduleData.location,
    type: scheduleData.type,
    weather: weather,
    route: {
      totalTime: `${Math.floor(routePlan.totalTravelTime / 60)}h ${
        routePlan.totalTravelTime % 60
      }m`,
      segments: [
        "Dom → Panavision",
        `Panavision → ${scheduleData.location || "Lokacja"}`,
      ],
    },
    warnings: weather.warnings || [],
    contacts: scheduleData.contacts,
  };

  // Log summary to Google Sheets for record keeping
  logSummary(summary);

  // Send notification (could be email, Slack, etc.)
  sendNotification(summary);

  return summary;
}

// Helper functions
function formatTime(date) {
  return date.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isDuplicate(email) {
  const messageId = email.getId();
  const sheet =
    SpreadsheetApp.openById("YOUR_SHEET_ID").getSheetByName("ProcessedEmails");
  const processedIds = sheet.getRange("A:A").getValues().flat();
  return processedIds.includes(messageId);
}

function markAsProcessed(email) {
  const messageId = email.getId();
  const sheet =
    SpreadsheetApp.openById("YOUR_SHEET_ID").getSheetByName("ProcessedEmails");
  sheet.appendRow([messageId, new Date(), email.getSubject()]);
}
```

### 6.2 Configuration Setup

#### Step 1: Enable Required APIs

1. Open Google Apps Script project
2. Go to "Services" and enable:
   - Gmail API
   - Google Drive API
   - Google Calendar API
   - Google Maps Platform (Directions API)

#### Step 2: Set API Keys

```javascript
// In Apps Script, go to Project Settings → Script Properties
PropertiesService.getScriptProperties().setProperties({
  OPENWEATHER_API_KEY: "c23f1a53e2fb33ea05e58852469f9fca",
GOOGLE_MAPS_API_KEY: "AIzaSyDQKWPyBuKl0JephPqn7BfPsxjOTVvCkpg",
  PROCESSED_EMAILS_SHEET_ID: "your_google_sheet_id",
});
```

#### Step 3: Set Up Triggers

```javascript
function createTriggers() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    ScriptApp.deleteTrigger(trigger);
  });

  // Create new email trigger (checks every 5 minutes)
  ScriptApp.newTrigger("processMP2Emails").timeBased().everyMinutes(5).create();
}
```

#### Step 4: OAuth Permissions

Grant permissions for:

- Gmail: Read emails and attachments
- Drive: Create and delete temporary files
- Calendar: Create events and reminders
- External APIs: Fetch weather and maps data

## 7. Example Data Structures

### 7.1 Parsed PDF JSON Output

```json
{
  "date": "2024-03-15",
  "callTime": "07:00",
  "location": "Plac Zamkowy, Warszawa",
  "baseLocation": "Panavision, ul. Wyczółki, Warszawa",
  "type": "EXT",
  "scenes": ["Scene 45", "Scene 46", "Scene 47"],
  "safetyNotes": "Praca z dziećmi, specjalne pozwolenia",
  "contacts": {
    "director": "+48 123 456 789",
    "producer": "+48 987 654 321",
    "locationManager": "+48 555 666 777"
  },
  "equipment": ["Camera A", "Camera B", "Lighting Kit"],
  "notes": "Backup plan w przypadku deszczu"
}
```

### 7.2 Route Planning Output

```json
{
  "wakeUpTime": "2024-03-15T05:15:00Z",
  "departureTime": "2024-03-15T06:00:00Z",
  "callTime": "2024-03-15T07:00:00Z",
  "totalTravelTime": 100,
  "routes": [
    {
      "from": "ul. Stylowa 7, Warszawa",
      "to": "ul. Wyczółki, Warszawa",
      "duration": 25,
      "distance": "12.5 km"
    },
    {
      "from": "ul. Wyczółki, Warszawa",
      "to": "Plac Zamkowy, Warszawa",
      "duration": 15,
      "distance": "8.2 km"
    }
  ],
  "buffers": {
    "carChange": 15,
    "parking": 10,
    "entry": 10,
    "traffic": 20,
    "morningRoutine": 45
  }
}
```

### 7.3 Calendar Event Example

```
Tytuł: MP2 — Dzień zdjęciowy (Plac Zamkowy)
Data: 2024-03-15
Czas: 06:00 - 17:00
Lokalizacja: Plac Zamkowy, Warszawa

Opis:
📅 Plan zdjęciowy MP2
🎬 Sceny: 45, 46, 47 (EXT)
⏰ Call time: 07:00
🏠 Pobudka: 05:15
🚗 Wyjazd z domu: 06:00

📍 Trasa:
• Dom → Panavision (25 min)
• Panavision → Plac Zamkowy (15 min)
• Całkowity czas podróży: 1h 40m (z buforami)

🌤️ Pogoda:
• Temperatura: 12°C
• Opis: Częściowe zachmurzenie
• Wiatr: 5 m/s
• Opady: 0mm

⚠️ Ostrzeżenia:
• Brak ostrzeżeń pogodowych

📞 Kontakty:
• Reżyser: +48 123 456 789
• Producent: +48 987 654 321
• Location Manager: +48 555 666 777

🛡️ BHP: Praca z dziećmi, specjalne pozwolenia
📝 Notatki: Backup plan w przypadku deszczu
```

### 7.4 Summary Notification Example

```
🎬 MP2 - PLAN DNIA 2024-03-15

⏰ HARMONOGRAM:
• 05:15 - Pobudka (3 alarmy: 05:05, 05:15, 05:20)
• 06:00 - Wyjazd z domu
• 06:25 - Przyjazd do Panavision
• 06:40 - Wyjazd z Panavision
• 06:55 - Przyjazd na plan (Plac Zamkowy)
• 07:00 - Call time

📍 LOKALIZACJE:
• Baza: Panavision, ul. Wyczółki
• Plan: Plac Zamkowy, Warszawa (EXT)
• Sceny: 45, 46, 47

🌤️ POGODA:
• 12°C, częściowe zachmurzenie
• Wiatr: 5 m/s, bez opadów
• ✅ Brak ostrzeżeń

🚗 TRASA:
• Dom → Panavision: 25 min
• Panavision → Plan: 15 min
• Bufory: 100 min (łącznie)

📞 KONTAKTY:
• Reżyser: +48 123 456 789
• Producent: +48 987 654 321

🛡️ UWAGI BHP:
• Praca z dziećmi, specjalne pozwolenia
• Backup plan w przypadku deszczu

✅ Wydarzenie dodane do kalendarza
✅ Alarmy ustawione
✅ Przypomnienia aktywne
```

## 8. Edge Cases Handling

### 8.1 Missing Address

```javascript
function handleMissingAddress(scheduleData) {
  if (!scheduleData.location || scheduleData.location.trim() === "") {
    console.warn("Missing location, using Panavision as fallback");
    scheduleData.location = "ul. Wyczółki, Warszawa";
    scheduleData.notes =
      (scheduleData.notes || "") +
      " [UWAGA: Użyto adresu Panavision jako fallback]";
  }
  return scheduleData;
}
```

### 8.2 Multiple Call Times

```javascript
function selectEarliestCallTime(scheduleData) {
  if (Array.isArray(scheduleData.callTime)) {
    const earliestTime = scheduleData.callTime.sort()[0];
    console.log(
      `Multiple call times found, selected earliest: ${earliestTime}`
    );
    scheduleData.callTime = earliestTime;
    scheduleData.notes =
      (scheduleData.notes || "") +
      ` [Inne call times: ${scheduleData.callTime.slice(1).join(", ")}]`;
  }
  return scheduleData;
}
```

### 8.3 Weather API Failure

```javascript
function handleWeatherFailure(location, date) {
  console.error(`Weather API failed for ${location} on ${date}`);
  return {
    error: "Pogoda niedostępna",
    warnings: [
      "⚠️ Nie udało się pobrać prognozy pogody - sprawdź warunki ręcznie",
    ],
    fallbackAdvice:
      "Użyj domyślnych buforów czasowych i przygotuj się na różne warunki pogodowe",
  };
}
```

### 8.4 Duplicate Detection

```javascript
function advancedDuplicateCheck(email) {
  const messageId = email.getId();
  const subject = email.getSubject();
  const attachments = email.getAttachments();

  // Check message ID first
  if (isMessageProcessed(messageId)) {
    return true;
  }

  // Check PDF hash if available
  if (attachments.length > 0) {
    const pdfHash = calculatePDFHash(attachments[0]);
    if (isPDFProcessed(pdfHash)) {
      console.log("Duplicate PDF detected, skipping");
      return true;
    }
  }

  return false;
}
```

### 8.5 API Rate Limiting

```javascript
function handleRateLimit(apiName, retryCount = 0) {
  const maxRetries = 3;
  const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff

  if (retryCount >= maxRetries) {
    throw new Error(
      `${apiName} API rate limit exceeded after ${maxRetries} retries`
    );
  }

  console.log(
    `Rate limited by ${apiName}, waiting ${backoffTime}ms before retry ${
      retryCount + 1
    }`
  );
  Utilities.sleep(backoffTime);

  return retryCount + 1;
}
```

## 9. Monitoring and Logging

### 9.1 Comprehensive Logging System

```javascript
function logActivity(level, message, data = {}) {
  const sheet =
    SpreadsheetApp.openById("YOUR_LOG_SHEET_ID").getSheetByName("ActivityLog");

  sheet.appendRow([
    new Date(),
    level,
    message,
    JSON.stringify(data),
    Session.getActiveUser().getEmail(),
  ]);

  // Also log to console
  console.log(`[${level}] ${message}`, data);
}

// Usage examples
logActivity("INFO", "Processing MP2 email", { messageId: email.getId() });
logActivity("WARNING", "Weather API unavailable", { location: "Warszawa" });
logActivity("ERROR", "PDF parsing failed", { error: error.message });
```

### 9.2 Health Check Function

```javascript
function performHealthCheck() {
  const results = {
    timestamp: new Date(),
    gmail: testGmailAPI(),
    calendar: testCalendarAPI(),
    maps: testMapsAPI(),
    weather: testWeatherAPI(),
    sheets: testSheetsAPI(),
  };

  logActivity("HEALTH_CHECK", "System health check completed", results);

  // Send alert if any service is down
  const failedServices = Object.entries(results)
    .filter(([key, value]) => key !== "timestamp" && !value)
    .map(([key]) => key);

  if (failedServices.length > 0) {
    sendAlert(`Services down: ${failedServices.join(", ")}`);
  }

  return results;
}
```

## 10. Extensions and Future Enhancements

### 10.1 Home Assistant Integration

```javascript
// Integration with Home Assistant for smart home automation
function integrateWithHomeAssistant(scheduleData, routePlan) {
  const haUrl = "http://your-home-assistant:8123/api/services";
  const token = PropertiesService.getScriptProperties().getProperty("HA_TOKEN");

  // Set wake-up lighting
  const wakeUpTime = routePlan.wakeUpTime;
  scheduleHomeAssistantAction(haUrl, token, {
    service: "light.turn_on",
    entity_id: "light.bedroom",
    data: { brightness: 50, color_name: "orange" },
    time: new Date(wakeUpTime.getTime() - 10 * 60 * 1000), // 10 min before wake-up
  });

  // Start coffee maker
  scheduleHomeAssistantAction(haUrl, token, {
    service: "switch.turn_on",
    entity_id: "switch.coffee_maker",
    time: new Date(wakeUpTime.getTime() - 5 * 60 * 1000), // 5 min before wake-up
  });

  // Set departure reminder
  scheduleHomeAssistantAction(haUrl, token, {
    service: "tts.google_say",
    data: { message: "Czas wyjazdu na plan MP2 za 5 minut!" },
    time: new Date(routePlan.departureTime.getTime() - 5 * 60 * 1000),
  });
}
```

### 10.2 Weather-Based Equipment Checklist

```javascript
function generateWeatherBasedChecklist(weather, scheduleData) {
  const checklist = ["Kamera", "Baterie", "Karty pamięci"];

  if (weather.precipitation > 0) {
    checklist.push("Osłony przeciwdeszczowe dla sprzętu");
    checklist.push("Ręczniki do wycierania");
    checklist.push("Plastikowe torby");
  }

  if (weather.temperature < 5) {
    checklist.push("Ogrzewacze do rąk");
    checklist.push("Dodatkowe baterie (zimno skraca żywotność)");
    checklist.push("Termos z ciepłym napojem");
  }

  if (weather.windSpeed > 8) {
    checklist.push("Dodatkowe statywy");
    checklist.push("Worki z piaskiem do stabilizacji");
    checklist.push("Osłony przeciwwietrzne dla mikrofonów");
  }

  if (scheduleData.type === "EXT" && weather.temperature > 25) {
    checklist.push("Parasole/reflektory do cienia");
    checklist.push("Woda dla ekipy");
    checklist.push("Chłodzące ręczniki");
  }

  return checklist;
}
```

### 10.3 Traffic-Based Dynamic Routing

```javascript
function getDynamicRoute(origin, destination, departureTime) {
  const alternatives = [
    { name: "Fastest", avoid: "" },
    { name: "Avoid highways", avoid: "highways" },
    { name: "Avoid tolls", avoid: "tolls" },
  ];

  const routes = alternatives.map((alt) => {
    const directions = Maps.newDirectionFinder()
      .setOrigin(origin)
      .setDestination(destination)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .setAvoid(alt.avoid)
      .getDirections();

    return {
      name: alt.name,
      duration: directions.routes[0].legs[0].duration.value,
      distance: directions.routes[0].legs[0].distance.value,
      route: directions.routes[0],
    };
  });

  // Select fastest route
  const bestRoute = routes.reduce((best, current) =>
    current.duration < best.duration ? current : best
  );

  logActivity("INFO", "Selected optimal route", {
    selected: bestRoute.name,
    duration: bestRoute.duration,
    alternatives: routes.map((r) => ({ name: r.name, duration: r.duration })),
  });

  return bestRoute;
}
```

### 10.4 Machine Learning for Schedule Optimization

```javascript
// Collect historical data for ML optimization
function collectHistoricalData(scheduleData, routePlan, actualTimes) {
  const sheet = SpreadsheetApp.openById("YOUR_ML_DATA_SHEET_ID").getSheetByName(
    "HistoricalData"
  );

  sheet.appendRow([
    scheduleData.date,
    scheduleData.location,
    scheduleData.type,
    routePlan.totalTravelTime,
    actualTimes.actualTravelTime,
    actualTimes.actualWakeUpTime,
    weather.temperature,
    weather.precipitation,
    weather.windSpeed,
    // Add more relevant features
  ]);
}

// Use historical data to improve time estimates
function getOptimizedTravelTime(baseTime, location, weather, dayOfWeek) {
  // This would integrate with a machine learning service
  // For now, use simple heuristics based on historical data

  let adjustment = 0;

  // Weekend adjustment
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    adjustment -= 10; // Less traffic on weekends
  }

  // Weather adjustment
  if (weather.precipitation > 0) {
    adjustment += 15; // Rain slows traffic
  }

  // Location-specific adjustments based on historical data
  const locationAdjustments = {
    Centrum: 20,
    Mokotów: 5,
    Wilanów: -5,
  };

  const locationKey = Object.keys(locationAdjustments).find((key) =>
    location.includes(key)
  );

  if (locationKey) {
    adjustment += locationAdjustments[locationKey];
  }

  return Math.max(baseTime + adjustment, baseTime * 0.8); // Never reduce by more than 20%
}
```

### 10.5 Integration with Production Management Tools

```javascript
// Integration with tools like StudioBinder, Celtx, or custom production software
function syncWithProductionTools(scheduleData) {
  // Example: Update StudioBinder shooting schedule
  const studioBinder = {
    apiKey: PropertiesService.getScriptProperties().getProperty(
      "STUDIOBINDER_API_KEY"
    ),
    projectId: "mp2-project-id",
  };

  const updateData = {
    date: scheduleData.date,
    callTime: scheduleData.callTime,
    location: scheduleData.location,
    scenes: scheduleData.scenes,
    status: "confirmed",
    weatherForecast: weather,
    crewNotified: true,
  };

  // Make API call to update production management system
  const response = UrlFetchApp.fetch(
    `https://api.studiobinder.com/v1/projects/${studioBinder.projectId}/schedule`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${studioBinder.apiKey}`,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(updateData),
    }
  );

  logActivity("INFO", "Production tools updated", {
    response: response.getResponseCode(),
  });
}
```

## 11. Security and Privacy Considerations

### 11.1 Data Protection

- All sensitive data (API keys, personal information) stored in Google Apps Script Properties
- Email content and PDF data processed temporarily and not permanently stored
- Access logs maintained for audit purposes
- Regular cleanup of temporary files in Google Drive

### 11.2 Access Control

- OAuth 2.0 authentication for all Google services
- Principle of least privilege for API permissions
- Regular review and rotation of API keys
- Monitoring for unusual access patterns

### 11.3 Error Handling and Resilience

- Comprehensive try-catch blocks for all external API calls
- Graceful degradation when services are unavailable
- Automatic retry mechanisms with exponential backoff
- Fallback options for critical functionality

## 12. Deployment and Maintenance

### 12.1 Deployment Checklist

1. ✅ Create Google Apps Script project
2. ✅ Enable required APIs (Gmail, Drive, Calendar, Maps)
3. ✅ Set up API keys and credentials
4. ✅ Create Google Sheets for logging and configuration
5. ✅ Deploy code and test with sample data
6. ✅ Set up automated triggers
7. ✅ Configure monitoring and alerting
8. ✅ Document access credentials and recovery procedures

### 12.2 Maintenance Schedule

- **Daily**: Monitor logs for errors and performance issues
- **Weekly**: Review processed emails and calendar events for accuracy
- **Monthly**: Update API keys and review security settings
- **Quarterly**: Analyze historical data and optimize algorithms
- **Annually**: Review and update all integrations and dependencies

### 12.3 Backup and Recovery

- Regular backups of Google Apps Script code
- Export of configuration data and logs
- Documented recovery procedures for each component
- Test recovery procedures quarterly

Ten system automatyzacji planów zdjęciowych MP2 zapewnia kompleksowe rozwiązanie dla efektywnego zarządzania harmonogramem filmowym, integrując się z ekosystemem Google i zewnętrznymi usługami pogodowymi. Dzięki modularnej architekturze i rozbudowanym możliwościom rozszerzenia, system może być łatwo dostosowany do zmieniających się potrzeb produkcji filmowej.
