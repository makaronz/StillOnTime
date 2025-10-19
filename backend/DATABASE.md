# Database Setup - StillOnTime Film Schedule Automation System

## Overview

This document describes the database setup for the StillOnTime Film Schedule Automation System using PostgreSQL with Kysely Query Builder.

## Database Schema

The system uses the following main entities:

### Core Models

1. **User** - OAuth 2.0 authenticated users
2. **ProcessedEmail** - Gmail messages that have been processed
3. **ScheduleData** - Extracted shooting schedule information
4. **RoutePlan** - Calculated travel routes and times
5. **WeatherData** - Weather forecasts for shooting locations
6. **CalendarEvent** - Google Calendar events created by the system
7. **UserConfig** - User-specific configuration settings

### Relationships

- User has many ProcessedEmails, ScheduleData, RoutePlans, WeatherData, CalendarEvents
- User has one UserConfig
- ProcessedEmail has one ScheduleData
- ScheduleData has one RoutePlan, WeatherData, CalendarEvent

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed
- npm or yarn package manager

### 1. Start Database Services

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d postgres redis

# Check if services are running
docker-compose ps
```

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Update the database URL if needed:

```env
DATABASE_URL=postgresql://stillontime_user:stillontime_password@localhost:5432/stillontime_automation
```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Database is ready (no client generation needed)

```bash
# Database types are auto-generated from schema.sql
# No additional generation needed
```

### 5. Database schema is managed via direct SQL

```bash
# Use schema.sql for database structure
# No migrations needed - direct SQL execution
```

### 6. Verify Setup

```bash
# Test database connection
npm run db:init

# Run comprehensive schema tests
npm run db:test
```

## Available Scripts

| Script                    | Description                             |
| ------------------------- | --------------------------------------- |
| `npm run db:init`         | Initialize database connection          |
| `npm run db:test`         | Test database operations                |
| `pgAdmin`                 | Use pgAdmin or similar for database GUI |
| `npm run db:init`         | Initialize and test database connection |
| `npm run db:test`         | Run comprehensive database schema tests |

## Database Connection

The database connection is configured in `src/config/database.ts` with:

- Connection pooling
- Graceful shutdown handling
- Health check functionality
- Environment-specific logging

## Schema Management

### Making Schema Changes

1. Update `schema.sql` directly
2. Run the SQL changes against the database
3. Run `npm run db:test` to verify changes

### Production Deployment

```bash
# Deploy schema changes to production
psql -d production_db -f schema.sql

# Database types are auto-generated from schema
```

## Troubleshooting

### Connection Issues

1. Ensure PostgreSQL container is running:

   ```bash
   docker-compose logs postgres
   ```

2. Test direct database connection:

   ```bash
   docker exec -it stillontime-postgres psql -U stillontime_user -d stillontime_automation -c "SELECT 1;"
   ```

3. Check environment variables:
   ```bash
   echo $DATABASE_URL
   ```

### Migration Issues

1. Reset database if needed:

   ```bash
   # Drop and recreate database
   dropdb stillontime_dev && createdb stillontime_dev
   psql -d stillontime_dev -f schema.sql
   ```

2. Check database status:
   ```bash
   npm run db:test
   ```

### Performance Optimization

The schema includes optimized indexes for:

- User lookups by email and googleId
- Email deduplication by messageId
- Schedule relationships
- Foreign key constraints for data integrity

## Security Considerations

- All foreign keys use CASCADE deletion for data consistency
- Sensitive tokens are stored in encrypted format
- Database connections use connection pooling
- Environment variables for sensitive configuration
- Proper indexing for query performance

## Monitoring

Use pgAdmin or similar for database inspection:

```bash
# Use pgAdmin or similar database management tool
# Connect to: postgresql://stillontime_user:stillontime_password@localhost:5433/stillontime_dev
```

Connect using your preferred PostgreSQL client for viewing and editing data.

## Backup and Recovery

### Backup

```bash
docker exec stillontime-postgres pg_dump -U stillontime_user stillontime_automation > backup.sql
```

### Restore

```bash
docker exec -i stillontime-postgres psql -U stillontime_user stillontime_automation < backup.sql
```

## Data Types and Constraints

### JSON Fields

- `scenes` - Array of scene numbers/descriptions
- `equipment` - Array of equipment items
- `contacts` - Array of contact objects with name/phone
- `routeSegments` - Array of route segment objects
- `buffers` - Object with time buffer configurations
- `warnings` - Array of weather warning strings

### Timestamps

All timestamps use PostgreSQL `TIMESTAMP(3)` for millisecond precision and are stored in UTC.

### Unique Constraints

- User email and googleId must be unique
- Email messageId must be unique (prevents duplicates)
- One-to-one relationships enforced with unique constraints

This database setup provides a robust foundation for the StillOnTime automation system with proper relationships, constraints, and performance optimizations.
