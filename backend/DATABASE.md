# Database Setup - StillOnTime Film Schedule Automation System

## Overview

This document describes the database setup for the StillOnTime Film Schedule Automation System using PostgreSQL with Prisma ORM.

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

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run Database Migrations

```bash
npm run prisma:migrate
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
| `npm run prisma:generate` | Generate Prisma client from schema      |
| `npm run prisma:migrate`  | Run database migrations                 |
| `npm run prisma:studio`   | Open Prisma Studio (database GUI)       |
| `npm run prisma:reset`    | Reset database and run all migrations   |
| `npm run prisma:deploy`   | Deploy migrations (production)          |
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

1. Update `prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create and apply migration
3. Run `npm run db:test` to verify changes

### Production Deployment

```bash
# Deploy migrations to production
npm run prisma:deploy

# Generate client for production
npm run prisma:generate
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
   npm run prisma:reset
   ```

2. Check migration status:
   ```bash
   npx prisma migrate status
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

Use Prisma Studio for database inspection:

```bash
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555` for viewing and editing data.

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
