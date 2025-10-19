# StillOnTime Film Schedule Automation System
# Use Case Modeling

## Executive Summary

This document outlines the comprehensive use cases for the StillOnTime Film Schedule Automation System, defining the interactions between various actors and the system to achieve specific goals in film production scheduling.

## 1. Actors Identification

### 1.1 Primary Actors

**Film Production Coordinator**
- Role: Manages daily shooting schedules and logistics
- Goals: Automate schedule processing, ensure timely arrivals, coordinate with team
- Technical Proficiency: Moderate to High
- Frequency of Use: Daily

**Director/Producer**
- Role: Oversees production schedule and makes strategic decisions
- Goals: Review schedules, approve changes, monitor production progress
- Technical Proficiency: Low to Moderate
- Frequency of Use: Weekly

**Camera Department Head**
- Role: Manages camera crew and equipment schedules
- Goals: Coordinate crew schedules, ensure equipment availability
- Technical Proficiency: Moderate
- Frequency of Use: Daily

**Transportation Coordinator**
- Role: Manages vehicle logistics and personnel transport
- Goals: Optimize routes, coordinate pickup times, manage fleet
- Technical Proficiency: Moderate
- Frequency of Use: Daily

**Production Assistant**
- Role: Supports coordination and administrative tasks
- Goals: Monitor schedules, communicate updates, handle exceptions
- Technical Proficiency: High
- Frequency of Use: Multiple times daily

### 1.2 Secondary Actors

**Google APIs System**
- Role: Provides email, calendar, maps, and drive services
- Interaction: Automated API calls for data retrieval and updates
- Reliability: Critical for system functionality

**OpenWeatherMap API**
- Role: Provides weather forecast and warning data
- Interaction: Periodic weather data retrieval
- Reliability: High priority for outdoor shoots

**Twilio SMS Service**
- Role: Delivers SMS notifications and alerts
- Interaction: On-demand message delivery
- Reliability: Critical for urgent communications

### 1.3 Tertiary Actors

**System Administrator**
- Role: Maintains system health and configuration
- Goals: Monitor performance, troubleshoot issues, manage users
- Technical Proficiency: Expert
- Frequency of Use: As needed

**External Vendors**
- Role: Provide equipment and services
- Interaction: Schedule coordination and notifications
- Technical Proficiency: Variable
- Frequency of Use: Per production

## 2. Use Case Diagram Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    StillOnTime System                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Production  │  │   Director  │  │ Camera Dept │        │
│  │ Coordinator │  │ / Producer  │  │   Head      │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                 │                 │             │
│         │                 │                 │             │
│  ┌──────▼─────────────────▼─────────────────▼──────┐      │
│  │            Core System Functionality           │      │
│  └─────────────────────────────────────────────────┘      │
│         │                 │                 │             │
│  ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐      │
│  │ Transport   │  │ Production   │  │ System      │      │
│  │ Coordinator │  │ Assistant    │  │ Administrator│      │
│  └─────────────┘  └──────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                     │                     │
┌────────▼───────┐    ┌─────────▼────────┐    ┌───────▼──────┐
│ Google APIs    │    │ OpenWeatherMap   │    │ Twilio SMS   │
│ (Email, Cal,   │    │ API              │    │ Service      │
│ Maps, Drive)   │    │                  │    │              │
└────────────────┘    └──────────────────┘    └──────────────┘
```

## 3. Detailed Use Cases

### 3.1 Authentication and User Management

#### UC-001: User Authentication
**Actor**: Production Coordinator, Director/Producer, Camera Department Head, Transportation Coordinator, Production Assistant

**Brief Description**: User logs into the system using Google OAuth 2.0 authentication.

**Preconditions**:
- User has valid Google account
- User has internet connectivity
- System is operational

**Basic Flow**:
1. User navigates to the StillOnTime application
2. User clicks "Login with Google" button
3. System redirects to Google OAuth consent screen
4. User grants consent for required Google API scopes
5. Google redirects back to StillOnTime with authorization code
6. System exchanges authorization code for access tokens
7. System retrieves user information from Google
8. System creates/updates user account in database
9. System generates JWT session token
10. System redirects user to dashboard with authenticated session

**Postconditions**:
- User is authenticated in the system
- User has active session with valid JWT token
- Google API tokens are securely stored for the user
- User can access system features based on their role

**Alternative Flows**:
- **A1: User denies consent**: System displays error message and offers retry option
- **A2: Invalid Google credentials**: Google displays authentication error, user must resolve with Google
- **A3: Network connectivity issues**: System displays connection error and retry option
- **A4: System error during token exchange**: System logs error and displays user-friendly message

**Exceptions**:
- **E1: Google API unavailable**: System displays service unavailable message
- **E2: Database connection failure**: System logs error and displays maintenance message
- **E3: Invalid authorization code**: System rejects authentication and restarts flow

**Business Rules**:
- Users must grant all required API scopes for full functionality
- Session tokens expire after 24 hours for security
- Failed authentication attempts are logged for security monitoring

**Priority**: Critical
**Frequency**: Per user session
**Complexity**: Low

---

#### UC-002: User Profile Management
**Actor**: All authenticated users

**Brief Description**: User manages their personal profile information and system preferences.

**Preconditions**:
- User is authenticated
- User has valid session

**Basic Flow**:
1. User navigates to profile/settings page
2. System displays current user information and preferences
3. User updates desired information (name, notification preferences, locations)
4. User submits changes
5. System validates input data
6. System updates user record in database
7. System displays confirmation message

**Postconditions**:
- User profile information is updated
- System preferences are saved and applied
- Audit log records the changes

**Alternative Flows**:
- **A1: Invalid input data**: System displays validation errors and highlights problematic fields
- **A2: Concurrent modification**: System detects conflicts and prompts user to reload
- **A3: Network error during save**: System displays error and offers retry option

**Priority**: Medium
**Frequency**: Weekly to monthly per user
**Complexity**: Low

---

### 3.2 Email Processing and Schedule Management

#### UC-003: Automated Email Processing
**Actor**: System (automated), Production Coordinator (monitoring)

**Brief Description**: System automatically processes incoming emails to extract shooting schedule information.

**Preconditions**:
- User has authenticated and granted Gmail access
- Background email processing is enabled
- System has valid Gmail API tokens

**Basic Flow**:
1. System monitors Gmail account for new messages
2. System identifies potential schedule emails based on filters
3. System downloads email content and attachments
4. System extracts PDF attachments from emails
5. System processes PDF content using OCR and parsing
6. System extracts structured schedule data
7. System validates extracted data against expected format
8. System stores processed data in database
9. System triggers notifications for user review

**Postconditions**:
- New schedule data is extracted and stored
- User is notified of new schedule information
- Processing history is logged
- Errors are captured and reported

**Alternative Flows**:
- **A1: No new emails found**: System continues monitoring, updates last checked time
- **A2: PDF extraction fails**: System logs error, marks email for manual review
- **A3: Schedule parsing incomplete**: System stores partial data, flags for review
- **A4: Duplicate schedule detected**: System compares with existing data, updates if newer

**Exceptions**:
- **E1: Gmail API quota exceeded**: System implements exponential backoff and retry
- **E2: Corrupted PDF file**: System logs error, notifies user of processing failure
- **E3: Network connectivity loss**: System queues processing for retry when connection restored

**Priority**: Critical
**Frequency**: Continuous background process
**Complexity**: High

---

#### UC-004: Schedule Review and Confirmation
**Actor**: Production Coordinator

**Brief Description**: User reviews automatically processed schedule information and confirms or edits details.

**Preconditions**:
- System has processed and extracted schedule data
- User is authenticated and has valid session
- Schedule data is pending user review

**Basic Flow**:
1. User navigates to dashboard or schedule review page
2. System displays list of schedules pending review
3. User selects schedule to review
4. System displays extracted schedule data in readable format
5. User reviews all extracted information (dates, times, locations, scenes)
6. User makes corrections if needed
7. User confirms schedule acceptance
8. System updates schedule status to "confirmed"
9. System triggers downstream processes (route planning, calendar integration)

**Postconditions**:
- Schedule data is confirmed as accurate
- System initiates automated scheduling tasks
- User receives confirmation of successful processing

**Alternative Flows**:
- **A1: User rejects schedule**: System marks schedule as rejected, notifies relevant parties
- **A2: User needs additional information**: System marks as pending, allows user to add notes
- **A3: Schedule conflicts detected**: System displays conflicts, offers resolution options
- **A4: Partial schedule acceptance**: User confirms available portions, flags others for later

**Priority**: Critical
**Frequency**: Multiple times daily as schedules arrive
**Complexity**: Medium

---

#### UC-005: Schedule Conflict Resolution
**Actor**: Production Coordinator, Director/Producer

**Brief Description**: System identifies and helps resolve scheduling conflicts.

**Preconditions**:
- Multiple schedules are confirmed in the system
- Potential conflicts exist (time, location, resources)
- User is authenticated

**Basic Flow**:
1. System analyzes confirmed schedules for conflicts
2. System detects potential conflicts (overlapping times, same locations)
3. System generates conflict alerts for affected users
4. User reviews conflict details from dashboard
5. System displays suggested resolutions
6. User selects resolution option or provides alternative
7. System updates schedules based on resolution
8. System notifies all affected parties of changes

**Postconditions**:
- Conflicts are resolved or documented
- All parties are notified of changes
- Schedule integrity is maintained

**Alternative Flows**:
- **A1: No resolution found**: System escalates to manual resolution process
- **A2: User needs additional information**: System provides detailed analysis and impact assessment
- **A3: Resolution affects other schedules**: System performs cascade conflict analysis

**Priority**: High
**Frequency**: As conflicts arise
**Complexity**: High

---

### 3.3 Route Planning and Travel Management

#### UC-006: Automated Route Calculation
**Actor**: System (automated), Transportation Coordinator

**Brief Description**: System calculates optimal travel routes and timing for confirmed schedules.

**Preconditions**:
- Schedule is confirmed with location information
- User has provided home and base location preferences
- System has access to Google Maps API

**Basic Flow**:
1. System extracts location data from confirmed schedule
2. System retrieves user's home and base location preferences
3. System calculates travel time using Google Maps API
4. System considers current and historical traffic patterns
5. System applies user-defined buffer times
6. System calculates recommended wake-up and departure times
7. System generates optimal route with multiple stops if needed
8. System stores route plan in database
9. System creates calendar events with travel information

**Postconditions**:
- Optimal route is calculated and stored
- Travel times are calculated with buffers included
- Calendar events are updated with travel information
- User receives route confirmation

**Alternative Flows**:
- **A1: Location not found**: System prompts user to verify address or coordinates
- **A2: Unusually high traffic**: System suggests alternative routes or departure times
- **A3: Multiple optimal routes**: System presents options with trade-offs
- **A4: Walking/public transit requested**: System recalculates using alternative transport modes

**Exceptions**:
- **E1: Google Maps API unavailable**: System uses cached data or estimated travel times
- **E2: Invalid location coordinates**: System flags for manual correction

**Priority**: High
**Frequency**: For each confirmed schedule
**Complexity**: Medium

---

#### UC-007: Route Optimization and Adjustment
**Actor**: Transportation Coordinator, Production Assistant

**Brief Description**: User optimizes routes and adjusts timing based on real-time conditions.

**Preconditions**:
- Route plan exists for schedule
- User is authenticated
- Real-time traffic data is available

**Basic Flow**:
1. User navigates to route management page
2. System displays current route plan with timing
3. User views real-time traffic conditions
4. System suggests optimizations based on current conditions
5. User accepts suggestions or makes manual adjustments
6. System recalculates timing and buffers
7. System updates calendar events if times change significantly
8. System notifies affected parties of adjustments

**Postconditions**:
- Route is optimized for current conditions
- Timing is updated and synchronized
- All stakeholders are informed of changes

**Alternative Flows**:
- **A1: Significant delay unavoidable**: System escalates to coordinator for decision
- **A2: Better route becomes available**: System proactively suggests change
- **A3: Weather affects route**: System integrates weather considerations

**Priority**: Medium
**Frequency**: As needed based on conditions
**Complexity**: Medium

---

### 3.4 Calendar Integration and Management

#### UC-008: Automatic Calendar Event Creation
**Actor**: System (automated), Production Coordinator

**Brief Description**: System automatically creates detailed calendar events for confirmed schedules.

**Preconditions**:
- Schedule is confirmed and approved
- Route plan is calculated
- User has granted Google Calendar access
- Calendar integration is enabled

**Basic Flow**:
1. System extracts all relevant schedule information
2. System retrieves user's calendar preferences
3. System creates calendar event with following details:
   - Title: Shooting schedule with project/scene information
   - Start/End times: Including travel time and buffers
   - Location: Shooting address with map link
   - Description: Full schedule details, equipment notes, contacts
   - Reminders: Multiple reminders based on travel times
4. System invites relevant team members if configured
5. System stores calendar event ID in schedule record
6. System confirms successful calendar creation

**Postconditions**:
- Calendar event is created with all relevant details
- Team members receive calendar invitations
- Schedule is synchronized with user's calendar
- System maintains link between schedule and calendar event

**Alternative Flows**:
- **A1: Calendar already has conflicting event**: System alerts user and offers resolution options
- **A2: Calendar API quota exceeded**: System queues creation for retry
- **A3: Insufficient permissions**: System requests additional calendar access

**Priority**: High
**Frequency**: For each confirmed schedule
**Complexity**: Low

---

#### UC-009: Calendar Synchronization and Updates
**Actor**: System (automated), Production Coordinator

**Brief Description**: System maintains synchronization between schedules and calendar events.

**Preconditions**:
- Calendar events exist for schedules
- Schedules may be updated or cancelled
- User maintains calendar access

**Basic Flow**:
1. System monitors for schedule changes
2. System detects schedule modification or cancellation
3. System retrieves corresponding calendar event ID
4. System updates calendar event with new information:
   - Updated times and locations
   - Modified descriptions or notes
   - Changed reminder settings
5. For cancelled schedules, system removes or updates calendar event
6. System notifies affected parties of changes
7. System logs all synchronization activities

**Postconditions**:
- Calendar events reflect current schedule information
- All stakeholders are notified of changes
- Synchronization history is maintained

**Alternative Flows**:
- **A1: Calendar event deleted manually**: System recreates event if schedule still active
- **A2: Sync conflict detected**: System prompts user to resolve discrepancy
- **A3: Multiple calendars involved**: System handles cross-calendar synchronization

**Priority**: High
**Frequency**: As schedules change
**Complexity**: Medium

---

### 3.5 Weather Monitoring and Alerts

#### UC-010: Weather Data Integration
**Actor**: System (automated), Production Coordinator

**Brief Description**: System integrates weather forecast data with shooting schedules.

**Preconditions**:
- Schedule is confirmed with outdoor locations
- Weather integration is enabled
- OpenWeatherMap API is accessible

**Basic Flow**:
1. System extracts location data from confirmed schedules
2. System retrieves weather forecast for each location and date
3. System analyzes weather conditions for shooting suitability:
   - Precipitation probability and amount
   - Wind speed and direction
   - Temperature and humidity
   - Visibility conditions
4. System assesses weather impact on equipment and scenes
5. System generates weather impact assessment
6. System stores weather data with schedule information
7. System updates schedule status based on weather conditions

**Postconditions**:
- Weather data is integrated with schedule information
- Weather impact assessment is available to users
- Weather-related risks are identified and documented

**Alternative Flows**:
- **A1: Weather data unavailable**: System uses cached data or marks as unavailable
- **A2: Location not in weather service**: System uses nearest available location
- **A3: Severe weather warning**: System triggers alert workflow

**Priority**: Medium
**Frequency**: Daily for upcoming schedules
**Complexity**: Low

---

#### UC-011: Weather Alert Management
**Actor**: System (automated), Production Coordinator, Director/Producer

**Brief Description**: System generates and manages weather-related alerts and recommendations.

**Preconditions**:
- Weather data indicates potential issues
- Alert system is configured
- User notification preferences are set

**Basic Flow**:
1. System monitors weather conditions for upcoming schedules
2. System identifies weather-related risks:
   - Severe weather warnings
   - Poor shooting conditions
   - Safety concerns for cast/crew
   - Equipment protection needs
3. System generates appropriate alert level:
   - Informational: Minor weather considerations
   - Warning: Potential schedule impact
   - Critical: Immediate attention required
4. System composes alert message with:
   - Weather conditions and forecast
   - Potential impact on shooting
   - Recommended actions or alternatives
5. System delivers alerts through configured channels:
   - Email notifications with detailed information
   - SMS alerts for critical warnings
   - In-app notifications for immediate visibility
6. System tracks alert delivery and acknowledgment
7. System monitors conditions and updates alerts as needed

**Postconditions**:
- Relevant weather alerts are delivered to appropriate users
- Users receive actionable information for decision-making
- Alert delivery is tracked and confirmed
- Weather conditions continue to be monitored

**Alternative Flows**:
- **A1: Alert delivery fails**: System retries with alternative channels
- **A2: Conditions improve**: System updates or cancels alerts
- **A3: Multiple locations affected**: System prioritizes and coordinates alerts

**Priority**: High
**Frequency**: As weather conditions warrant
**Complexity**: Medium

---

### 3.6 Notification Management

#### UC-012: Multi-Channel Notification Delivery
**Actor**: System (automated), All users

**Brief Description**: System delivers notifications through multiple channels based on user preferences and message urgency.

**Preconditions**:
- Notification events are triggered
- User preferences are configured
- Notification services are available

**Basic Flow**:
1. System identifies notification trigger:
   - New schedule processed
   - Schedule confirmed
   - Route calculated
   - Weather alert
   - System update or maintenance
2. System determines message urgency and priority
3. System selects appropriate delivery channels based on:
   - User notification preferences
   - Message urgency level
   - Time of day and quiet hours
   - Channel availability
4. System formats message for each selected channel:
   - Email: Detailed information with links and attachments
   - SMS: Concise critical information with action links
   - Push notification: Brief alerts with deep links
   - In-app: Full-featured notifications with rich content
5. System delivers notifications through selected channels
6. System tracks delivery status and user engagement
7. System handles delivery failures with retry logic

**Postconditions**:
- Notifications are delivered through appropriate channels
- Delivery status is tracked and logged
- Users receive timely and relevant information
- System maintains notification history

**Alternative Flows**:
- **A1: Primary channel unavailable**: System fails over to secondary channels
- **A2: User in quiet hours**: System queues non-critical notifications
- **A3: Message too large for channel**: System truncates or provides link to full content

**Priority**: High
**Frequency**: Continuous as events occur
**Complexity**: Medium

---

#### UC-013: Notification Preference Management
**Actor**: All authenticated users

**Brief Description**: Users manage their notification preferences and delivery settings.

**Preconditions**:
- User is authenticated
- User has valid session

**Basic Flow**:
1. User navigates to notification settings page
2. System displays current notification preferences:
   - Channel selection (email, SMS, push, in-app)
   - Urgency thresholds for each channel
   - Quiet hours and do-not-disturb settings
   - Message content preferences
3. User modifies desired settings
4. System validates settings for consistency and completeness
5. System updates user preferences in database
6. System applies changes to future notifications
7. System displays confirmation of changes

**Postconditions**:
- User notification preferences are updated
- Future notifications respect new settings
- Change is logged for audit purposes

**Alternative Flows**:
- **A1: Invalid settings combination**: System provides guidance and corrections
- **A2: Critical notifications disabled**: System warns about potential missed important alerts
- **A3: Settings conflict with team policies**: System highlights policy violations

**Priority**: Medium
**Frequency**: Monthly per user
**Complexity**: Low

---

### 3.7 Monitoring and Administration

#### UC-014: System Health Monitoring
**Actor**: System Administrator, Production Coordinator

**Brief Description**: System monitors its own health and performance, alerting administrators to issues.

**Preconditions**:
- Monitoring system is active
- Administrator has valid credentials
- System components are operational

**Basic Flow**:
1. System continuously monitors key metrics:
   - API response times and error rates
   - Database connection health and query performance
   - External API availability and quota usage
   - Background job processing status
   - User authentication success rates
2. System evaluates metrics against thresholds and SLAs
3. System identifies potential issues or degradations
4. System generates appropriate alerts:
   - Informational: Performance below optimal but within acceptable range
   - Warning: Approaching SLA limits or showing degradation patterns
   - Critical: Service failure or security incident
5. System delivers alerts to administrators:
   - Dashboard notifications for real-time awareness
   - Email alerts for detailed information and analysis
   - SMS alerts for critical system failures
6. System maintains monitoring history and trends
7. System provides diagnostic tools for troubleshooting

**Postconditions**:
- System health is continuously monitored
- Administrators are alerted to potential issues
- Performance trends are tracked and analyzed
- Historical data supports capacity planning

**Alternative Flows**:
- **A1: Monitoring system failure**: System implements redundant monitoring processes
- **A2: False positive alerts**: System refines thresholds and reduces noise
- **A3: Alert fatigue**: System implements alert consolidation and prioritization

**Priority**: Critical
**Frequency**: Continuous background monitoring
**Complexity**: High

---

#### UC-015: User Activity and Performance Analytics
**Actor**: Production Coordinator, System Administrator

**Brief Description**: System provides analytics on user activity and system performance.

**Preconditions**:
- Sufficient usage data has been collected
- User has appropriate permissions for analytics access
- Analytics processing is current

**Basic Flow**:
1. User navigates to analytics dashboard
2. System processes and displays various metrics:
   - Email processing volume and success rates
   - Schedule confirmation turnaround times
   - Route optimization effectiveness
   - Weather alert accuracy and response times
   - Notification delivery rates and engagement
3. User selects time period and filters for analysis
4. System updates displays with filtered data
5. User can export reports in various formats
6. System provides insights and recommendations based on trends

**Postconditions**:
- User has visibility into system performance and usage
- Data-driven decisions can be made about improvements
- Historical performance is documented and analyzed

**Alternative Flows**:
- **A1: Insufficient data for selected period**: System adjusts period or indicates limitations
- **A2: Complex analysis requested**: System queues processing and notifies when complete
- **A3: Anomalous data detected**: System flags for investigation and correction

**Priority**: Low
**Frequency**: Weekly to monthly review
**Complexity**: Medium

---

## 4. Use Case Relationships

### 4.1 Include Relationships
- **UC-001 (User Authentication)** includes **UC-002 (User Profile Management)**
- **UC-004 (Schedule Review)** includes **UC-003 (Email Processing)**
- **UC-008 (Calendar Creation)** includes **UC-006 (Route Calculation)**

### 4.2 Extend Relationships
- **UC-005 (Conflict Resolution)** extends **UC-004 (Schedule Review)**
- **UC-009 (Calendar Updates)** extends **UC-008 (Calendar Creation)**
- **UC-011 (Weather Alerts)** extends **UC-010 (Weather Integration)**

### 4.3 Generalization Relationships
- **All notification use cases (UC-012, UC-013)** generalize to **Notification Management**
- **All monitoring use cases (UC-014, UC-015)** generalize to **System Administration**

## 5. Use Case Prioritization

### 5.1 Critical Priority (Must Have)
- UC-001: User Authentication
- UC-003: Automated Email Processing  
- UC-004: Schedule Review and Confirmation
- UC-006: Automated Route Calculation
- UC-008: Automatic Calendar Event Creation

### 5.2 High Priority (Should Have)
- UC-005: Schedule Conflict Resolution
- UC-009: Calendar Synchronization and Updates
- UC-010: Weather Data Integration
- UC-011: Weather Alert Management
- UC-012: Multi-Channel Notification Delivery

### 5.3 Medium Priority (Could Have)
- UC-002: User Profile Management
- UC-007: Route Optimization and Adjustment
- UC-013: Notification Preference Management
- UC-014: System Health Monitoring

### 5.4 Low Priority (Won't Have - For Future Releases)
- UC-015: User Activity and Performance Analytics

## 6. Implementation Phasing

### 6.1 Phase 1 - Core Functionality (Critical Use Cases)
- Authentication system implementation
- Email processing pipeline
- Schedule management
- Basic route planning
- Calendar integration

### 6.2 Phase 2 - Enhanced Features (High Priority Use Cases)
- Conflict resolution system
- Weather integration and alerts
- Advanced notification system
- Calendar synchronization

### 6.3 Phase 3 - Optimization (Medium/Low Priority Use Cases)
- User experience enhancements
- Monitoring and analytics
- Advanced configuration options
- Performance optimization

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-18  
**Next Review**: 2025-11-18  
**Approved By**: SPARC Specification Team