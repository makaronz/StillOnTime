import { ScheduleService } from '@/services/scheduleService';
import { PrismaClient } from '@prisma/client';
import { RouteOptimizationService } from '@/services/routeOptimizationService';

jest.mock('@prisma/client');
jest.mock('@/services/routeOptimizationService');

describe('ScheduleService', () => {
  let scheduleService: ScheduleService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRouteService: jest.Mocked<RouteOptimizationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockRouteService = new RouteOptimizationService() as jest.Mocked<RouteOptimizationService>;
    scheduleService = new ScheduleService(mockPrisma, mockRouteService);
  });

  describe('createSchedule', () => {
    it('should create a new schedule successfully', async () => {
      // Arrange
      const scheduleData = {
        title: 'Film Shoot Day 1',
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A',
        productionId: 'prod-123',
        scenes: [
          {
            sceneNumber: '1',
            description: 'Opening scene',
            estimatedDuration: 120,
            location: 'Studio A',
            cast: ['Actor A', 'Actor B'],
            equipment: ['Camera 1', 'Lighting Kit A']
          }
        ],
        crew: [
          {
            name: 'John Doe',
            role: 'Director',
            contact: 'john@example.com',
            callTime: '07:30'
          }
        ]
      };

      const createdSchedule = {
        id: 'schedule-123',
        ...scheduleData,
        status: 'SCHEDULED',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.schedule.create.mockResolvedValue(createdSchedule as any);

      // Act
      const result = await scheduleService.createSchedule(scheduleData);

      // Assert
      expect(mockPrisma.schedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: scheduleData.title,
          shootingDate: scheduleData.shootingDate,
          callTime: scheduleData.callTime,
          wrapTime: scheduleData.wrapTime,
          location: scheduleData.location,
          productionId: scheduleData.productionId,
          status: 'SCHEDULED'
        })
      });
      expect(result).toEqual(createdSchedule);
    });

    it('should validate schedule date conflicts', async () => {
      // Arrange
      const scheduleData = {
        title: 'Film Shoot Day 1',
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A',
        productionId: 'prod-123'
      };

      // Mock existing schedule at same time
      mockPrisma.schedule.findMany.mockResolvedValue([{
        id: 'existing-schedule',
        shootingDate: scheduleData.shootingDate,
        location: scheduleData.location
      }] as any);

      // Act & Assert
      await expect(scheduleService.createSchedule(scheduleData)).rejects.toThrow('Location already booked for this date');
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidScheduleData = {
        title: '',
        shootingDate: new Date(),
        // Missing required fields
      };

      // Act & Assert
      await expect(scheduleService.createSchedule(invalidScheduleData)).rejects.toThrow('Title and shooting date are required');
    });
  });

  describe('updateSchedule', () => {
    it('should update existing schedule', async () => {
      // Arrange
      const scheduleId = 'schedule-123';
      const updateData = {
        title: 'Updated Film Shoot Day 1',
        callTime: '09:00',
        location: 'Studio B'
      };

      const existingSchedule = {
        id: scheduleId,
        title: 'Film Shoot Day 1',
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        location: 'Studio A'
      };

      const updatedSchedule = {
        ...existingSchedule,
        ...updateData,
        updatedAt: new Date()
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(existingSchedule as any);
      mockPrisma.schedule.update.mockResolvedValue(updatedSchedule as any);

      // Act
      const result = await scheduleService.updateSchedule(scheduleId, updateData);

      // Assert
      expect(mockPrisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: scheduleId }
      });
      expect(mockPrisma.schedule.update).toHaveBeenCalledWith({
        where: { id: scheduleId },
        data: expect.objectContaining(updateData)
      });
      expect(result).toEqual(updatedSchedule);
    });

    it('should throw error for non-existent schedule', async () => {
      // Arrange
      const scheduleId = 'non-existent';
      const updateData = { title: 'Updated Title' };

      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(scheduleService.updateSchedule(scheduleId, updateData)).rejects.toThrow('Schedule not found');
    });
  });

  describe('getScheduleById', () => {
    it('should retrieve schedule by ID with relations', async () => {
      // Arrange
      const scheduleId = 'schedule-123';
      const schedule = {
        id: scheduleId,
        title: 'Film Shoot Day 1',
        shootingDate: new Date('2025-01-15'),
        scenes: [
          {
            id: 'scene-1',
            sceneNumber: '1',
            description: 'Opening scene'
          }
        ],
        crew: [
          {
            id: 'crew-1',
            name: 'John Doe',
            role: 'Director'
          }
        ]
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(schedule as any);

      // Act
      const result = await scheduleService.getScheduleById(scheduleId);

      // Assert
      expect(mockPrisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: scheduleId },
        include: {
          scenes: true,
          crew: true,
          equipment: true,
          notifications: true
        }
      });
      expect(result).toEqual(schedule);
    });

    it('should return null for non-existent schedule', async () => {
      // Arrange
      const scheduleId = 'non-existent';
      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      // Act
      const result = await scheduleService.getScheduleById(scheduleId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getSchedulesByDateRange', () => {
    it('should retrieve schedules within date range', async () => {
      // Arrange
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const schedules = [
        {
          id: 'schedule-1',
          title: 'Shoot Day 1',
          shootingDate: new Date('2025-01-15')
        },
        {
          id: 'schedule-2',
          title: 'Shoot Day 2',
          shootingDate: new Date('2025-01-20')
        }
      ];

      mockPrisma.schedule.findMany.mockResolvedValue(schedules as any);

      // Act
      const result = await scheduleService.getSchedulesByDateRange(startDate, endDate);

      // Assert
      expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith({
        where: {
          shootingDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          scenes: true,
          crew: true
        },
        orderBy: {
          shootingDate: 'asc'
        }
      });
      expect(result).toEqual(schedules);
    });

    it('should return empty array for no schedules in range', async () => {
      // Arrange
      const startDate = new Date('2025-02-01');
      const endDate = new Date('2025-02-28');
      mockPrisma.schedule.findMany.mockResolvedValue([]);

      // Act
      const result = await scheduleService.getSchedulesByDateRange(startDate, endDate);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule successfully', async () => {
      // Arrange
      const scheduleId = 'schedule-123';
      const existingSchedule = {
        id: scheduleId,
        title: 'Film Shoot Day 1'
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(existingSchedule as any);
      mockPrisma.schedule.delete.mockResolvedValue(existingSchedule as any);

      // Act
      const result = await scheduleService.deleteSchedule(scheduleId);

      // Assert
      expect(mockPrisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: scheduleId }
      });
      expect(mockPrisma.schedule.delete).toHaveBeenCalledWith({
        where: { id: scheduleId }
      });
      expect(result).toEqual(true);
    });

    it('should throw error for non-existent schedule', async () => {
      // Arrange
      const scheduleId = 'non-existent';
      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(scheduleService.deleteSchedule(scheduleId)).rejects.toThrow('Schedule not found');
    });
  });

  describe('optimizeScheduleRoutes', () => {
    it('should optimize routes for schedule locations', async () => {
      // Arrange
      const scheduleId = 'schedule-123';
      const schedule = {
        id: scheduleId,
        title: 'Multi-Location Shoot',
        scenes: [
          {
            id: 'scene-1',
            location: 'Studio A',
            address: '123 Studio St, Los Angeles, CA'
          },
          {
            id: 'scene-2',
            location: 'Location B',
            address: '456 Location Ave, Los Angeles, CA'
          },
          {
            id: 'scene-3',
            location: 'Studio C',
            address: '789 Studio Blvd, Los Angeles, CA'
          }
        ]
      };

      const optimizedRoute = {
        optimizedOrder: ['scene-1', 'scene-3', 'scene-2'],
        totalDistance: 15.2,
        estimatedTime: 45,
        waypoints: [
          { location: 'Studio A', arrivalTime: '08:00' },
          { location: 'Studio C', arrivalTime: '10:30' },
          { location: 'Location B', arrivalTime: '13:00' }
        ]
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(schedule as any);
      mockRouteService.optimizeRoute.mockResolvedValue(optimizedRoute);

      // Act
      const result = await scheduleService.optimizeScheduleRoutes(scheduleId);

      // Assert
      expect(mockRouteService.optimizeRoute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ address: '123 Studio St, Los Angeles, CA' }),
          expect.objectContaining({ address: '456 Location Ave, Los Angeles, CA' }),
          expect.objectContaining({ address: '789 Studio Blvd, Los Angeles, CA' })
        ])
      );
      expect(result).toEqual(optimizedRoute);
    });

    it('should handle schedule with no locations', async () => {
      // Arrange
      const scheduleId = 'schedule-123';
      const schedule = {
        id: scheduleId,
        title: 'Studio Only Shoot',
        scenes: [
          {
            id: 'scene-1',
            location: 'Studio A'
          }
        ]
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(schedule as any);

      // Act & Assert
      await expect(scheduleService.optimizeScheduleRoutes(scheduleId)).rejects.toThrow('No locations to optimize');
    });
  });

  describe('checkScheduleConflicts', () => {
    it('should detect scheduling conflicts', async () => {
      // Arrange
      const newSchedule = {
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A'
      };

      const conflictingSchedules = [
        {
          id: 'conflict-1',
          title: 'Another Shoot',
          shootingDate: new Date('2025-01-15'),
          callTime: '10:00',
          wrapTime: '16:00',
          location: 'Studio A'
        }
      ];

      mockPrisma.schedule.findMany.mockResolvedValue(conflictingSchedules as any);

      // Act
      const conflicts = await scheduleService.checkScheduleConflicts(newSchedule);

      // Assert
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        type: 'LOCATION_CONFLICT',
        schedule: conflictingSchedules[0],
        message: 'Studio A is already booked on 2025-01-15 from 10:00 to 16:00'
      });
    });

    it('should return empty array when no conflicts', async () => {
      // Arrange
      const newSchedule = {
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A'
      };

      mockPrisma.schedule.findMany.mockResolvedValue([]);

      // Act
      const conflicts = await scheduleService.checkScheduleConflicts(newSchedule);

      // Assert
      expect(conflicts).toEqual([]);
    });
  });

  describe('duplicateSchedule', () => {
    it('should duplicate existing schedule with new date', async () => {
      // Arrange
      const originalScheduleId = 'schedule-123';
      const newDate = new Date('2025-02-15');

      const originalSchedule = {
        id: originalScheduleId,
        title: 'Film Shoot Day 1',
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A',
        scenes: [
          {
            sceneNumber: '1',
            description: 'Opening scene',
            estimatedDuration: 120
          }
        ],
        crew: [
          {
            name: 'John Doe',
            role: 'Director',
            callTime: '07:30'
          }
        ]
      };

      const duplicatedSchedule = {
        id: 'schedule-456',
        title: 'Film Shoot Day 1 (Copy)',
        shootingDate: newDate,
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A'
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(originalSchedule as any);
      mockPrisma.schedule.create.mockResolvedValue(duplicatedSchedule as any);

      // Act
      const result = await scheduleService.duplicateSchedule(originalScheduleId, newDate);

      // Assert
      expect(mockPrisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: originalScheduleId },
        include: {
          scenes: true,
          crew: true,
          equipment: true
        }
      });
      expect(mockPrisma.schedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Film Shoot Day 1 (Copy)',
          shootingDate: newDate,
          callTime: '08:00',
          wrapTime: '18:00',
          location: 'Studio A'
        })
      });
      expect(result).toEqual(duplicatedSchedule);
    });

    it('should throw error for non-existent original schedule', async () => {
      // Arrange
      const originalScheduleId = 'non-existent';
      const newDate = new Date('2025-02-15');

      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(scheduleService.duplicateSchedule(originalScheduleId, newDate)).rejects.toThrow('Original schedule not found');
    });
  });
});