import request from 'supertest';
import { app } from '../../src/index';
import { PrismaClient } from '@prisma/client';
import { redisClient } from '@/config/redis';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('API Integration Tests', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword'
      }
    });
    testUserId = testUser.id;

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUserId, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
    await prisma.schedule.deleteMany({
      where: { productionId: { contains: 'test' } }
    });
    await prisma.$disconnect();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe(userData.email);
        expect(response.body.user).not.toHaveProperty('password');
        expect(response.body).toHaveProperty('token');
      });

      it('should return 400 for invalid email', async () => {
        const userData = {
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.message).toContain('Invalid email');
      });

      it('should return 400 for weak password', async () => {
        const userData = {
          email: 'test@example.com',
          password: '123',
          name: 'Test User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.message).toContain('Password must be');
      });

      it('should return 409 for duplicate email', async () => {
        const userData = {
          email: 'test@example.com', // Already exists
          password: 'password123',
          name: 'Test User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(409);

        expect(response.body.message).toContain('User already exists');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe(loginData.email);
      });

      it('should return 401 for invalid credentials', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'wrongpassword'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid credentials');
      });

      it('should return 401 for non-existent user', async () => {
        const loginData = {
          email: 'nonexistent@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid credentials');
      });
    });

    describe('GET /api/auth/verify', () => {
      it('should verify valid token', async () => {
        const response = await request(app)
          .get('/api/auth/verify')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.id).toBe(testUserId);
      });

      it('should return 401 for invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/verify')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.message).toContain('Invalid token');
      });

      it('should return 401 for missing token', async () => {
        const response = await request(app)
          .get('/api/auth/verify')
          .expect(401);

        expect(response.body.message).toContain('No token provided');
      });
    });
  });

  describe('Schedule Endpoints', () => {
    let testScheduleId: string;

    describe('POST /api/schedules', () => {
      it('should create a new schedule', async () => {
        const scheduleData = {
          title: 'Test Film Shoot',
          shootingDate: '2025-01-15T08:00:00Z',
          callTime: '08:00',
          wrapTime: '18:00',
          location: 'Studio A',
          productionId: 'test-production-123'
        };

        const response = await request(app)
          .post('/api/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send(scheduleData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe(scheduleData.title);
        expect(response.body.status).toBe('SCHEDULED');

        testScheduleId = response.body.id;
      });

      it('should return 400 for invalid schedule data', async () => {
        const invalidSchedule = {
          title: '', // Empty title
          shootingDate: 'invalid-date'
        };

        const response = await request(app)
          .post('/api/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidSchedule)
          .expect(400);

        expect(response.body.message).toContain('Validation failed');
      });

      it('should return 401 for unauthorized request', async () => {
        const scheduleData = {
          title: 'Test Film Shoot',
          shootingDate: '2025-01-15T08:00:00Z',
          location: 'Studio A'
        };

        await request(app)
          .post('/api/schedules')
          .send(scheduleData)
          .expect(401);
      });
    });

    describe('GET /api/schedules', () => {
      it('should get all schedules for authenticated user', async () => {
        const response = await request(app)
          .get('/api/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('schedules');
        expect(Array.isArray(response.body.schedules)).toBe(true);
        expect(response.body.schedules.length).toBeGreaterThan(0);
      });

      it('should filter schedules by date range', async () => {
        const response = await request(app)
          .get('/api/schedules?startDate=2025-01-01&endDate=2025-01-31')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.schedules).toBeDefined();
        response.body.schedules.forEach((schedule: any) => {
          const scheduleDate = new Date(schedule.shootingDate);
          expect(scheduleDate >= new Date('2025-01-01')).toBe(true);
          expect(scheduleDate <= new Date('2025-01-31')).toBe(true);
        });
      });

      it('should paginate results', async () => {
        const response = await request(app)
          .get('/api/schedules?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('pagination');
        expect(response.body.pagination).toHaveProperty('page', 1);
        expect(response.body.pagination).toHaveProperty('limit', 10);
      });
    });

    describe('GET /api/schedules/:id', () => {
      it('should get schedule by ID', async () => {
        const response = await request(app)
          .get(`/api/schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testScheduleId);
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('scenes');
        expect(response.body).toHaveProperty('crew');
      });

      it('should return 404 for non-existent schedule', async () => {
        const response = await request(app)
          .get('/api/schedules/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.message).toContain('Schedule not found');
      });
    });

    describe('PUT /api/schedules/:id', () => {
      it('should update existing schedule', async () => {
        const updateData = {
          title: 'Updated Test Film Shoot',
          callTime: '09:00'
        };

        const response = await request(app)
          .put(`/api/schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.title).toBe(updateData.title);
        expect(response.body.callTime).toBe(updateData.callTime);
      });

      it('should return 404 when updating non-existent schedule', async () => {
        const updateData = { title: 'Updated Title' };

        await request(app)
          .put('/api/schedules/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(404);
      });
    });

    describe('DELETE /api/schedules/:id', () => {
      it('should delete existing schedule', async () => {
        await request(app)
          .delete(`/api/schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Verify schedule is deleted
        await request(app)
          .get(`/api/schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });

      it('should return 404 when deleting non-existent schedule', async () => {
        await request(app)
          .delete('/api/schedules/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Email Integration Endpoints', () => {
    describe('POST /api/emails/fetch', () => {
      it('should fetch unprocessed emails', async () => {
        const response = await request(app)
          .post('/api/emails/fetch')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('emails');
        expect(Array.isArray(response.body.emails)).toBe(true);
      });

      it('should handle OAuth token errors gracefully', async () => {
        // Mock invalid OAuth token scenario
        const response = await request(app)
          .post('/api/emails/fetch')
          .set('Authorization', 'Bearer invalid-oauth-token')
          .expect(401);

        expect(response.body.message).toContain('OAuth authentication required');
      });
    });

    describe('POST /api/emails/process', () => {
      it('should process email attachments', async () => {
        const processData = {
          messageId: 'test-message-id',
          userId: testUserId
        };

        const response = await request(app)
          .post('/api/emails/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(processData)
          .expect(200);

        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('processedCount');
      });
    });
  });

  describe('Notification Endpoints', () => {
    describe('GET /api/notifications', () => {
      it('should get user notifications', async () => {
        const response = await request(app)
          .get('/api/notifications')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('notifications');
        expect(Array.isArray(response.body.notifications)).toBe(true);
      });

      it('should filter unread notifications', async () => {
        const response = await request(app)
          .get('/api/notifications?unread=true')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.notifications.forEach((notification: any) => {
          expect(notification.read).toBe(false);
        });
      });
    });

    describe('PUT /api/notifications/:id/read', () => {
      it('should mark notification as read', async () => {
        // First create a test notification
        const notification = await prisma.notification.create({
          data: {
            userId: testUserId,
            type: 'INFO',
            message: 'Test notification',
            read: false
          }
        });

        const response = await request(app)
          .put(`/api/notifications/${notification.id}/read`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.read).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.message).toContain('Invalid JSON');
    });

    it('should handle rate limiting', async () => {
      const requests = Array(11).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(res => res.status === 429);

      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse?.body.message).toContain('Too many requests');
    });

    it('should handle CSRF protection', async () => {
      // Test without CSRF token
      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Schedule',
          shootingDate: '2025-01-15T08:00:00Z'
        })
        .expect(403);

      expect(response.body.message).toContain('CSRF token');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should check database connection', async () => {
      const response = await request(app)
        .get('/health/database')
        .expect(200);

      expect(response.body).toHaveProperty('database', 'connected');
    });

    it('should check Redis connection', async () => {
      const response = await request(app)
        .get('/health/redis')
        .expect(200);

      expect(response.body).toHaveProperty('redis', 'connected');
    });
  });
});