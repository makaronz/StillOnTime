# StillOnTime Film Schedule Automation System

A comprehensive automation system that processes film shooting schedule emails, extracts data from PDF attachments, calculates optimal routes, integrates with Google Calendar, and provides weather forecasts for shooting days.

## Features

- **Automated Email Processing**: Monitors Gmail for shooting schedule emails with PDF attachments
- **PDF Data Extraction**: Extracts shooting dates, call times, locations, and other relevant information
- **Route Planning**: Calculates optimal routes with real-time traffic data and configurable time buffers
- **Google Calendar Integration**: Creates calendar events with multiple alarms and comprehensive descriptions
- **Weather Integration**: Provides weather forecasts and warnings for outdoor shoots
- **React Dashboard**: Web interface for monitoring, configuration, and manual overrides
- **OAuth 2.0 Security**: Secure Google services integration with proper token management

## Technology Stack

### Backend
- **Node.js 20+** with TypeScript
- **Express.js** web framework
- **PostgreSQL** database with Prisma ORM
- **Redis** for caching and session storage
- **Bull Queue** for background job processing
- **Google APIs** (Gmail, Calendar, Drive, Maps)
- **OpenWeatherMap API** for weather data

### Frontend
- **React 18** with TypeScript
- **Vite** build tool
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Google Cloud Console project with APIs enabled
- OpenWeatherMap API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stillontime-automation-system
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Configure Google OAuth 2.0**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Gmail API, Calendar API, Drive API, and Maps API
   - Create OAuth 2.0 credentials
   - Add your client ID and secret to `.env` files

4. **Get OpenWeatherMap API key**
   - Sign up at [OpenWeatherMap](https://openweathermap.org/api)
   - Get your free API key
   - Add it to your `.env` file

5. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

6. **Run database migrations**
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   ```

7. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

### Development

- **Backend API**: http://localhost:3001
- **Frontend Dashboard**: http://localhost:3000
- **Database**: PostgreSQL on port 5432
- **Redis**: Redis on port 6379

### Available Scripts

#### Backend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Run ESLint
npm run prisma:studio # Open Prisma Studio
```

#### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Run ESLint
```

## Project Structure

```
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── services/        # Business logic services
│   │   ├── repositories/    # Data access layer
│   │   ├── middleware/      # Express middleware
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   ├── config/         # Configuration files
│   │   └── jobs/           # Background job processors
│   ├── prisma/             # Database schema and migrations
│   └── tests/              # Test files
├── frontend/               # React dashboard
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service functions
│   │   ├── stores/         # Zustand state stores
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # Utility functions
│   └── tests/              # Frontend tests
└── docker-compose.yml      # Development environment
```

## Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/stillontime_automation"
REDIS_URL="redis://localhost:6379"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/callback"

# External APIs
OPENWEATHER_API_KEY="your-openweather-api-key"
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# Application
JWT_SECRET="your-jwt-secret"
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
```

### Google APIs Setup

1. **Enable required APIs**:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Maps API

2. **OAuth 2.0 Scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/drive.file`

3. **Authorized redirect URIs**:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

## Usage

1. **Authentication**: Sign in with your Google account
2. **Configuration**: Set up your home address, Panavision address, and time buffers
3. **Email Monitoring**: The system automatically monitors your Gmail for schedule emails
4. **Processing**: When a schedule email is detected, it:
   - Downloads and parses the PDF attachment
   - Calculates optimal routes with traffic data
   - Fetches weather forecasts
   - Creates calendar events with alarms
   - Sends notifications

## API Documentation

The API follows RESTful conventions and includes the following endpoints:

- `GET /api/health` - Health check
- `POST /api/auth/google` - OAuth 2.0 authentication
- `GET /api/schedules` - Get processed schedules
- `POST /api/schedules/process` - Manually trigger email processing
- `GET /api/config` - Get user configuration
- `PUT /api/config` - Update user configuration

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

### Production Environment

1. **Set up production environment variables**
2. **Configure HTTPS and domain**
3. **Set up production database**
4. **Configure monitoring and logging**
5. **Deploy using Docker or your preferred method**

### Security Considerations

- Use HTTPS in production
- Rotate JWT secrets regularly
- Implement proper rate limiting
- Monitor for suspicious activity
- Keep dependencies updated

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository.