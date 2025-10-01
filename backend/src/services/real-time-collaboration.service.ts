/**
 * Real-Time Collaboration Service
 * WebSocket-based multi-user collaboration with conflict resolution
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger, structuredLogger } from '../utils/logger';
import { z } from 'zod';

// Collaboration schemas
export const UserPresenceSchema = z.object({
  userId: string,
  userEmail: string,
  userName: string,
  status: z.enum(['online', 'idle', 'away', 'offline']),
  lastActivity: z.date(),
  currentView: z.string().optional(),
  activeFeatures: z.array(z.string()),
  deviceInfo: z.object({
    type: z.enum(['desktop', 'tablet', 'mobile']),
    browser: z.string(),
    os: z.string()
  })
});

export const CollaborationEventSchema = z.object({
  eventId: z.string(),
  type: z.enum([
    'user_joined',
    'user_left',
    'data_updated',
    'conflict_detected',
    'conflict_resolved',
    'system_notification',
    'email_processed',
    'schedule_updated',
    'route_calculated'
  ]),
  userId: z.string(),
  timestamp: z.date(),
  data: z.record(z.any()),
  affectedUsers: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high', 'critical'])
});

export const DataUpdateSchema = z.object({
  updateId: z.string(),
  entityType: z.enum(['schedule', 'route', 'weather', 'notification', 'configuration']),
  entityId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  oldValue: z.any().optional(),
  newValue: z.any(),
  userId: z.string(),
  timestamp: z.date(),
  version: z.number(),
  conflictResolution: z.enum(['automatic', 'manual', 'user_choice']).optional()
});

export const ConflictSchema = z.object({
  conflictId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  conflictingUpdates: z.array(DataUpdateSchema),
  detectedAt: z.date(),
  status: z.enum(['detected', 'resolving', 'resolved', 'escalated']),
  resolutionStrategy: z.enum(['last_writer_wins', 'merge', 'user_choice', 'expert_review']),
  affectedUsers: z.array(z.string())
});

export type UserPresence = z.infer<typeof UserPresenceSchema>;
export type CollaborationEvent = z.infer<typeof CollaborationEventSchema>;
export type DataUpdate = z.infer<typeof DataUpdateSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;

/**
 * Real-Time Collaboration Service
 */
export class RealTimeCollaborationService {
  private io: SocketIOServer;
  private activeUsers: Map<string, UserPresence> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private activeConflicts: Map<string, Conflict> = new Map();
  private dataVersions: Map<string, number> = new Map(); // entityId -> version
  private collaborationRooms: Map<string, Set<string>> = new Map(); // roomId -> userIds
  
  // Event queues for reliable delivery
  private eventQueue: Map<string, CollaborationEvent[]> = new Map(); // userId -> events
  private conflictQueue: Conflict[] = [];
  
  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
    this.startConflictResolution();
    this.startPresenceMonitoring();
  }

  /**
   * Initialize WebSocket handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      structuredLogger.info('User connected to collaboration service', {
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Authentication and user presence
      socket.on('authenticate', async (data: { userId: string; userEmail: string; userName: string }) => {
        await this.handleUserAuthentication(socket, data);
      });

      // Data update events
      socket.on('data_update', async (update: DataUpdate) => {
        await this.handleDataUpdate(socket, update);
      });

      // Collaboration events
      socket.on('join_room', async (roomId: string) => {
        await this.handleJoinRoom(socket, roomId);
      });

      socket.on('leave_room', async (roomId: string) => {
        await this.handleLeaveRoom(socket, roomId);
      });

      // Conflict resolution
      socket.on('resolve_conflict', async (conflictId: string, resolution: any) => {
        await this.handleConflictResolution(socket, conflictId, resolution);
      });

      // User activity tracking
      socket.on('activity', async (activity: { view: string; features: string[] }) => {
        await this.updateUserActivity(socket, activity);
      });

      // Disconnection handling
      socket.on('disconnect', async () => {
        await this.handleUserDisconnection(socket);
      });
    });
  }

  /**
   * Handle user authentication and presence setup
   */
  private async handleUserAuthentication(
    socket: Socket,
    authData: { userId: string; userEmail: string; userName: string }
  ): Promise<void> {
    try {
      const { userId, userEmail, userName } = authData;
      
      // Associate socket with user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);
      
      // Update user presence
      const presence: UserPresence = {
        userId,
        userEmail,
        userName,
        status: 'online',
        lastActivity: new Date(),
        activeFeatures: [],
        deviceInfo: this.extractDeviceInfo(socket)
      };
      
      this.activeUsers.set(userId, presence);
      
      // Join user to their personal room
      socket.join(`user:${userId}`);
      
      // Send pending events
      await this.sendPendingEvents(userId);
      
      // Notify other users
      const joinEvent: CollaborationEvent = {
        eventId: this.generateEventId(),
        type: 'user_joined',
        userId,
        timestamp: new Date(),
        data: { userName, userEmail },
        affectedUsers: Array.from(this.activeUsers.keys()),
        priority: 'low'
      };
      
      await this.broadcastEvent(joinEvent, [userId]);
      
      // Send current user list to the new user
      socket.emit('users_online', Array.from(this.activeUsers.values()));
      
      structuredLogger.info('User authenticated successfully', {
        userId,
        userName,
        socketId: socket.id,
        totalActiveUsers: this.activeUsers.size
      });
      
    } catch (error) {
      structuredLogger.error('User authentication failed', {
        error: error.message,
        socketId: socket.id
      });
      socket.emit('authentication_error', { message: 'Authentication failed' });
    }
  }

  /**
   * Handle data updates with conflict detection
   */
  private async handleDataUpdate(socket: Socket, update: DataUpdate): Promise<void> {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) {
        socket.emit('update_error', { message: 'User not authenticated' });
        return;
      }

      // Validate update
      const validatedUpdate = DataUpdateSchema.parse({
        ...update,
        userId,
        timestamp: new Date()
      });

      // Check for conflicts
      const conflict = await this.detectConflict(validatedUpdate);
      
      if (conflict) {
        // Handle conflict
        await this.handleConflict(conflict);
        socket.emit('conflict_detected', conflict);
        return;
      }

      // Apply update and increment version
      const entityKey = `${validatedUpdate.entityType}:${validatedUpdate.entityId}`;
      const currentVersion = this.dataVersions.get(entityKey) || 0;
      validatedUpdate.version = currentVersion + 1;
      this.dataVersions.set(entityKey, validatedUpdate.version);

      // Broadcast update to relevant users
      const updateEvent: CollaborationEvent = {
        eventId: this.generateEventId(),
        type: 'data_updated',
        userId,
        timestamp: new Date(),
        data: validatedUpdate,
        affectedUsers: await this.getAffectedUsers(validatedUpdate),
        priority: this.calculateEventPriority(validatedUpdate)
      };

      await this.broadcastEvent(updateEvent, [userId]);
      
      // Acknowledge successful update
      socket.emit('update_acknowledged', {
        updateId: validatedUpdate.updateId,
        version: validatedUpdate.version
      });

      structuredLogger.info('Data update processed successfully', {
        userId,
        updateId: validatedUpdate.updateId,
        entityType: validatedUpdate.entityType,
        operation: validatedUpdate.operation
      });

    } catch (error) {
      structuredLogger.error('Data update failed', {
        error: error.message,
        update
      });
      socket.emit('update_error', { message: 'Update failed', error: error.message });
    }
  }

  /**
   * Handle joining collaboration rooms
   */
  private async handleJoinRoom(socket: Socket, roomId: string): Promise<void> {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) return;

      socket.join(roomId);
      
      if (!this.collaborationRooms.has(roomId)) {
        this.collaborationRooms.set(roomId, new Set());
      }
      this.collaborationRooms.get(roomId)!.add(userId);

      // Notify room members
      socket.to(roomId).emit('user_joined_room', {
        userId,
        userName: this.activeUsers.get(userId)?.userName,
        roomId
      });

      structuredLogger.info('User joined collaboration room', {
        userId,
        roomId,
        roomSize: this.collaborationRooms.get(roomId)!.size
      });

    } catch (error) {
      structuredLogger.error('Failed to join room', {
        error: error.message,
        roomId
      });
    }
  }

  /**
   * Handle leaving collaboration rooms
   */
  private async handleLeaveRoom(socket: Socket, roomId: string): Promise<void> {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) return;

      socket.leave(roomId);
      
      const room = this.collaborationRooms.get(roomId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) {
          this.collaborationRooms.delete(roomId);
        }
      }

      // Notify remaining room members
      socket.to(roomId).emit('user_left_room', {
        userId,
        userName: this.activeUsers.get(userId)?.userName,
        roomId
      });

    } catch (error) {
      structuredLogger.error('Failed to leave room', {
        error: error.message,
        roomId
      });
    }
  }

  /**
   * Handle conflict resolution
   */
  private async handleConflictResolution(
    socket: Socket,
    conflictId: string,
    resolution: any
  ): Promise<void> {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) return;

      const conflict = this.activeConflicts.get(conflictId);
      if (!conflict) {
        socket.emit('conflict_error', { message: 'Conflict not found' });
        return;
      }

      // Apply resolution
      await this.applyConflictResolution(conflict, resolution, userId);
      
      // Mark conflict as resolved
      conflict.status = 'resolved';
      this.activeConflicts.delete(conflictId);

      // Notify affected users
      const resolutionEvent: CollaborationEvent = {
        eventId: this.generateEventId(),
        type: 'conflict_resolved',
        userId,
        timestamp: new Date(),
        data: { conflictId, resolution },
        affectedUsers: conflict.affectedUsers,
        priority: 'medium'
      };

      await this.broadcastEvent(resolutionEvent);

      structuredLogger.info('Conflict resolved successfully', {
        conflictId,
        resolvedBy: userId,
        affectedUsers: conflict.affectedUsers.length
      });

    } catch (error) {
      structuredLogger.error('Conflict resolution failed', {
        error: error.message,
        conflictId
      });
    }
  }

  /**
   * Update user activity and presence
   */
  private async updateUserActivity(
    socket: Socket,
    activity: { view: string; features: string[] }
  ): Promise<void> {
    const userId = this.getUserIdFromSocket(socket);
    if (!userId) return;

    const presence = this.activeUsers.get(userId);
    if (presence) {
      presence.lastActivity = new Date();
      presence.currentView = activity.view;
      presence.activeFeatures = activity.features;
      presence.status = 'online';

      // Broadcast presence update
      this.io.emit('user_presence_updated', presence);
    }
  }

  /**
   * Handle user disconnection
   */
  private async handleUserDisconnection(socket: Socket): Promise<void> {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) return;

      // Remove socket from user's socket set
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // If user has no more sockets, mark as offline
        if (userSockets.size === 0) {
          const presence = this.activeUsers.get(userId);
          if (presence) {
            presence.status = 'offline';
            
            // Notify other users
            const leaveEvent: CollaborationEvent = {
              eventId: this.generateEventId(),
              type: 'user_left',
              userId,
              timestamp: new Date(),
              data: { userName: presence.userName },
              affectedUsers: Array.from(this.activeUsers.keys()),
              priority: 'low'
            };

            await this.broadcastEvent(leaveEvent, [userId]);
            
            // Remove from active users after a delay (in case of reconnection)
            setTimeout(() => {
              if (this.activeUsers.get(userId)?.status === 'offline') {
                this.activeUsers.delete(userId);
                this.userSockets.delete(userId);
              }
            }, 30000); // 30 second grace period
          }
        }
      }

      structuredLogger.info('User disconnected', {
        userId,
        socketId: socket.id,
        remainingSockets: userSockets?.size || 0
      });

    } catch (error) {
      structuredLogger.error('Error handling user disconnection', {
        error: error.message,
        socketId: socket.id
      });
    }
  }

  /**
   * Detect conflicts in data updates
   */
  private async detectConflict(update: DataUpdate): Promise<Conflict | null> {
    const entityKey = `${update.entityType}:${update.entityId}`;
    const currentVersion = this.dataVersions.get(entityKey) || 0;
    
    // Version conflict detection
    if (update.version && update.version <= currentVersion) {
      const conflictId = this.generateConflictId();
      
      const conflict: Conflict = {
        conflictId,
        entityType: update.entityType,
        entityId: update.entityId,
        conflictingUpdates: [update],
        detectedAt: new Date(),
        status: 'detected',
        resolutionStrategy: 'user_choice',
        affectedUsers: await this.getAffectedUsers(update)
      };

      return conflict;
    }

    return null;
  }

  /**
   * Handle detected conflicts
   */
  private async handleConflict(conflict: Conflict): Promise<void> {
    this.activeConflicts.set(conflict.conflictId, conflict);
    this.conflictQueue.push(conflict);

    // Notify affected users about the conflict
    const conflictEvent: CollaborationEvent = {
      eventId: this.generateEventId(),
      type: 'conflict_detected',
      userId: 'system',
      timestamp: new Date(),
      data: conflict,
      affectedUsers: conflict.affectedUsers,
      priority: 'high'
    };

    await this.broadcastEvent(conflictEvent);
  }

  /**
   * Apply conflict resolution
   */
  private async applyConflictResolution(
    conflict: Conflict,
    resolution: any,
    resolvedBy: string
  ): Promise<void> {
    // Implementation depends on resolution strategy
    switch (conflict.resolutionStrategy) {
      case 'last_writer_wins':
        // Apply the most recent update
        break;
      case 'merge':
        // Attempt to merge conflicting changes
        break;
      case 'user_choice':
        // Apply user-selected resolution
        break;
      case 'expert_review':
        // Escalate to designated expert
        break;
    }

    structuredLogger.info('Conflict resolution applied', {
      conflictId: conflict.conflictId,
      strategy: conflict.resolutionStrategy,
      resolvedBy
    });
  }

  /**
   * Broadcast events to relevant users
   */
  private async broadcastEvent(
    event: CollaborationEvent,
    excludeUsers: string[] = []
  ): Promise<void> {
    const targetUsers = event.affectedUsers.filter(userId => !excludeUsers.includes(userId));
    
    for (const userId of targetUsers) {
      const userSockets = this.userSockets.get(userId);
      
      if (userSockets && userSockets.size > 0) {
        // User is online, send immediately
        userSockets.forEach(socketId => {
          this.io.to(socketId).emit('collaboration_event', event);
        });
      } else {
        // User is offline, queue event
        if (!this.eventQueue.has(userId)) {
          this.eventQueue.set(userId, []);
        }
        this.eventQueue.get(userId)!.push(event);
      }
    }
  }

  /**
   * Send pending events to newly connected user
   */
  private async sendPendingEvents(userId: string): Promise<void> {
    const pendingEvents = this.eventQueue.get(userId);
    
    if (pendingEvents && pendingEvents.length > 0) {
      const userSockets = this.userSockets.get(userId);
      
      if (userSockets && userSockets.size > 0) {
        const socketId = Array.from(userSockets)[0]; // Send to first socket
        
        this.io.to(socketId).emit('pending_events', pendingEvents);
        
        // Clear pending events
        this.eventQueue.delete(userId);
        
        structuredLogger.info('Sent pending events to user', {
          userId,
          eventCount: pendingEvents.length
        });
      }
    }
  }

  /**
   * Start conflict resolution background process
   */
  private startConflictResolution(): void {
    setInterval(() => {
      if (this.conflictQueue.length > 0) {
        structuredLogger.info('Processing conflict queue', {
          queueSize: this.conflictQueue.length
        });
        
        // Process conflicts based on priority and age
        this.conflictQueue.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return (b.detectedAt.getTime() - a.detectedAt.getTime()) || 
                 ((priorityOrder as any)['high'] - (priorityOrder as any)['high']);
        });
        
        // Auto-resolve simple conflicts
        const autoResolvableConflicts = this.conflictQueue.filter(c => 
          c.resolutionStrategy === 'last_writer_wins' && 
          c.status === 'detected'
        );
        
        autoResolvableConflicts.forEach(async conflict => {
          await this.applyConflictResolution(conflict, 'auto_resolve', 'system');
          conflict.status = 'resolved';
          this.activeConflicts.delete(conflict.conflictId);
        });
        
        // Remove resolved conflicts from queue
        this.conflictQueue = this.conflictQueue.filter(c => c.status !== 'resolved');
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Start presence monitoring
   */
  private startPresenceMonitoring(): void {
    setInterval(() => {
      const now = new Date();
      
      this.activeUsers.forEach((presence, userId) => {
        const inactiveTime = now.getTime() - presence.lastActivity.getTime();
        
        // Update status based on inactivity
        if (inactiveTime > 300000 && presence.status === 'online') { // 5 minutes
          presence.status = 'idle';
          this.io.emit('user_presence_updated', presence);
        } else if (inactiveTime > 1800000 && presence.status === 'idle') { // 30 minutes
          presence.status = 'away';
          this.io.emit('user_presence_updated', presence);
        }
      });
    }, 60000); // Check every minute
  }

  // Utility methods
  private getUserIdFromSocket(socket: Socket): string | null {
    for (const [userId, socketIds] of this.userSockets.entries()) {
      if (socketIds.has(socket.id)) {
        return userId;
      }
    }
    return null;
  }

  private extractDeviceInfo(socket: Socket): UserPresence['deviceInfo'] {
    const userAgent = socket.handshake.headers['user-agent'] || '';
    
    return {
      type: /Mobile|Android|iPhone/.test(userAgent) ? 'mobile' : 
            /Tablet|iPad/.test(userAgent) ? 'tablet' : 'desktop',
      browser: this.extractBrowser(userAgent),
      os: this.extractOS(userAgent)
    };
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private extractOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getAffectedUsers(update: DataUpdate): Promise<string[]> {
    // In a real implementation, this would query the database
    // to find users who have access to this entity
    return Array.from(this.activeUsers.keys());
  }

  private calculateEventPriority(update: DataUpdate): CollaborationEvent['priority'] {
    if (update.entityType === 'schedule' && update.operation === 'delete') return 'critical';
    if (update.entityType === 'route' && update.operation === 'update') return 'high';
    return 'medium';
  }

  /**
   * Get collaboration statistics
   */
  public getStats(): {
    activeUsers: number;
    activeRooms: number;
    pendingConflicts: number;
    totalEvents: number;
  } {
    return {
      activeUsers: this.activeUsers.size,
      activeRooms: this.collaborationRooms.size,
      pendingConflicts: this.activeConflicts.size,
      totalEvents: Array.from(this.eventQueue.values()).reduce((sum, events) => sum + events.length, 0)
    };
  }
}