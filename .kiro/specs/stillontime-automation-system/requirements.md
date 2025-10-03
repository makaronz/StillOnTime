# Requirements Document - StillOnTime Film Schedule Automation System

## Introduction

System automatyzacji planów zdjęciowych StillOnTime to inteligentne narzędzie, które automatycznie przetwarza maile z harmonogramami filmowymi, analizuje załączone pliki PDF i tworzy kompletny plan dnia z uwzględnieniem tras, alarmów, wydarzeń kalendarzowych i prognozy pogody.

System rozwiązuje problem manualnego planowania dnia zdjęciowego poprzez automatyczne obliczanie czasów podróży, ustawianie przypomnień i integrację z kalendarzem Google. Głównym użytkownikiem jest członek ekipy filmowej wymagający precyzyjnego planowania czasu.

## Requirements

### Requirement 1

**User Story:** As a film crew member, I want the system to automatically detect and process shooting schedule emails, so that I don't have to manually monitor my inbox for schedule updates.

#### Acceptance Criteria

1. WHEN a new email arrives in Gmail THEN the system SHALL check if it matches StillOnTime criteria within 5 minutes
2. WHEN an email contains schedule keywords ("plan zdjęciowy", "drabinka", "call time", "shooting schedule") in subject THEN the system SHALL flag it for processing
3. WHEN an email has a PDF attachment AND matches sender criteria THEN the system SHALL download and process the attachment
4. WHEN an email has already been processed THEN the system SHALL skip it to prevent duplicates
5. IF email processing fails THEN the system SHALL retry up to 3 times with exponential backoff

### Requirement 2

**User Story:** As a film crew member, I want the system to extract all relevant information from PDF shooting schedules, so that I have accurate data for planning my day.

#### Acceptance Criteria

1. WHEN a PDF is processed THEN the system SHALL extract shooting date in YYYY-MM-DD format
2. WHEN a PDF is processed THEN the system SHALL extract call time in HH:MM 24-hour format
3. WHEN a PDF contains location information THEN the system SHALL extract and validate addresses using geocoding
4. WHEN a PDF contains scene information THEN the system SHALL extract scene numbers and INT/EXT designation
5. WHEN a PDF contains contact information THEN the system SHALL extract names and phone numbers
6. IF PDF parsing fails THEN the system SHALL provide manual correction interface
7. WHEN OCR is required for scanned PDFs THEN the system SHALL process with confidence scoring

### Requirement 3

**User Story:** As a film crew member, I want the system to calculate optimal travel routes and times, so that I know exactly when to wake up and leave home.

#### Acceptance Criteria

1. WHEN route calculation is triggered THEN the system SHALL calculate Dom→Panavision→Location route
2. WHEN calculating routes THEN the system SHALL use real-time traffic data from Google Maps API
3. WHEN calculating total time THEN the system SHALL apply buffers: 15min car change, 10min parking, 10min entry, 20min traffic, 45min morning routine
4. WHEN call time is known THEN the system SHALL calculate wake-up time as call_time - (total_travel_time + buffers)
5. WHEN wake-up time is before 4:00 AM THEN the system SHALL flag as unreasonable and suggest adjustments
6. IF route calculation fails THEN the system SHALL use fallback estimates based on distance
7. WHEN multiple route options exist THEN the system SHALL provide alternatives with time comparisons

### Requirement 4

**User Story:** As a film crew member, I want the system to create calendar events with proper alarms and reminders, so that I never miss a shooting day.

#### Acceptance Criteria

1. WHEN schedule data is processed THEN the system SHALL create Google Calendar event with title "StillOnTime — Dzień zdjęciowy (location)"
2. WHEN creating calendar event THEN the system SHALL set duration from departure time to call_time + 10 hours
3. WHEN creating calendar event THEN the system SHALL include comprehensive description with route plan and weather
4. WHEN creating alarms THEN the system SHALL set 3 wake-up alarms at wake_up_time-10min, wake_up_time, wake_up_time+5min
5. WHEN creating reminders THEN the system SHALL set popup reminders at -12h, -3h, -1h, and departure time
6. IF calendar API fails THEN the system SHALL retry with exponential backoff
7. WHEN user has SMS configured THEN the system SHALL send SMS reminders

### Requirement 5

**User Story:** As a film crew member, I want the system to provide weather forecasts and warnings, so that I can prepare appropriately for outdoor shoots.

#### Acceptance Criteria

1. WHEN processing EXT shoots THEN the system SHALL fetch detailed weather forecast for shooting date and location
2. WHEN processing INT shoots THEN the system SHALL fetch basic weather information
3. WHEN temperature is <0°C or >30°C THEN the system SHALL generate temperature warning
4. WHEN precipitation >0mm is forecast THEN the system SHALL generate rain warning
5. WHEN wind speed >10m/s is forecast THEN the system SHALL generate wind warning
6. WHEN storms or fog are forecast THEN the system SHALL generate severe weather warnings
7. IF weather API fails THEN the system SHALL use cached data and notify user of limitation

### Requirement 6

**User Story:** As a film crew member, I want to receive comprehensive day summaries, so that I have all information needed for the shooting day in one place.

#### Acceptance Criteria

1. WHEN processing is complete THEN the system SHALL generate summary in Polish language
2. WHEN generating summary THEN the system SHALL include timeline with wake-up, departure, and arrival times
3. WHEN generating summary THEN the system SHALL include location details and route information
4. WHEN generating summary THEN the system SHALL include weather forecast and any warnings
5. WHEN generating summary THEN the system SHALL include contact information and safety notes
6. WHEN summary is ready THEN the system SHALL send via configured notification channels
7. WHEN summary is generated THEN the system SHALL store in history for future reference

### Requirement 7

**User Story:** As a film crew member, I want to access a web dashboard to monitor system status and manually override settings, so that I have control over the automation process.

#### Acceptance Criteria

1. WHEN accessing dashboard THEN the system SHALL display real-time processing status
2. WHEN accessing dashboard THEN the system SHALL show last 10 processed emails with status
3. WHEN accessing dashboard THEN the system SHALL display upcoming shooting schedules
4. WHEN manual processing is needed THEN the system SHALL provide trigger button for specific emails
5. WHEN configuration changes are needed THEN the system SHALL provide settings interface
6. WHEN errors occur THEN the system SHALL display error logs with retry options
7. IF system health check fails THEN the system SHALL display service status indicators

### Requirement 8

**User Story:** As a system administrator, I want to configure API keys and system settings securely, so that the system can integrate with external services properly.

#### Acceptance Criteria

1. WHEN configuring API keys THEN the system SHALL store them securely in encrypted database storage
2. WHEN testing API connections THEN the system SHALL provide connection status indicators
3. WHEN configuring addresses THEN the system SHALL validate using Google Maps geocoding
4. WHEN configuring time buffers THEN the system SHALL provide presets and custom options
5. WHEN configuring notifications THEN the system SHALL support email, SMS, and push preferences
6. IF API quotas are exceeded THEN the system SHALL implement rate limiting and fallback options
7. WHEN system configuration changes THEN the system SHALL log changes for audit purposes

### Requirement 9

**User Story:** As a film crew member, I want the system to handle errors gracefully and provide recovery options, so that I can still get my schedule information even when something goes wrong.

#### Acceptance Criteria

1. WHEN external API fails THEN the system SHALL implement exponential backoff retry mechanism
2. WHEN PDF parsing fails THEN the system SHALL provide manual data entry interface
3. WHEN route calculation fails THEN the system SHALL use distance-based time estimates
4. WHEN weather API is unavailable THEN the system SHALL use cached data and notify user
5. WHEN calendar creation fails THEN the system SHALL store data locally and retry later
6. IF critical errors occur THEN the system SHALL send immediate notification to user
7. WHEN system recovers from error THEN the system SHALL automatically resume processing

### Requirement 10

**User Story:** As a film crew member, I want to view analytics and historical data, so that I can optimize my planning and understand patterns in the shooting schedule.

#### Acceptance Criteria

1. WHEN accessing analytics THEN the system SHALL display processing success rates over time
2. WHEN viewing route data THEN the system SHALL show historical travel times and traffic patterns
3. WHEN analyzing weather impact THEN the system SHALL correlate weather with schedule changes
4. WHEN viewing statistics THEN the system SHALL provide date range filters and export options
5. WHEN optimizing routes THEN the system SHALL suggest improvements based on historical data
6. IF patterns are detected THEN the system SHALL provide recommendations for buffer adjustments
7. WHEN generating reports THEN the system SHALL support PDF and CSV export formats
