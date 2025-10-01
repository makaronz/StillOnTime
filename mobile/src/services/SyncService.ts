/**
 * Offline Synchronization Service
 * Handles data sync between local storage and backend API
 */

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';

interface SyncConfig {
  apiUrl: string;
  syncInterval: number;
  retryAttempts: number;
  batchSize: number;
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  isSyncing: boolean;
  pendingChanges: number;
  conflicts: SyncConflict[];
}

interface SyncConflict {
  id: string;
  type: 'schedule' | 'route' | 'notification';
  localData: any;
  serverData: any;
  timestamp: Date;
  resolved: boolean;
}

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
  attempts: number;
}

export class SyncService {
  private database: Database;
  private config: SyncConfig;
  private syncStatus: SyncStatus;
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(database: Database, config: SyncConfig) {
    this.database = database;
    this.config = config;
    this.syncStatus = {
      isOnline: false,
      lastSync: null,
      isSyncing: false,
      pendingChanges: 0,
      conflicts: []
    };

    this.initializeNetworkListener();
    this.loadPendingOperations();
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    try {
      // Check network status
      const networkState = await NetInfo.fetch();
      this.syncStatus.isOnline = networkState.isConnected ?? false;

      // Load last sync timestamp
      const lastSyncStr = await AsyncStorage.getItem('last_sync_timestamp');
      if (lastSyncStr) {
        this.syncStatus.lastSync = new Date(lastSyncStr);
      }

      // Load pending operations
      await this.loadPendingOperations();

      // Start sync interval if online
      if (this.syncStatus.isOnline) {
        this.startSyncInterval();
      }

      this.isInitialized = true;

      console.log('SyncService initialized', {
        isOnline: this.syncStatus.isOnline,
        lastSync: this.syncStatus.lastSync,
        pendingChanges: this.syncStatus.pendingChanges
      });

    } catch (error) {
      console.error('Failed to initialize SyncService:', error);
      throw error;
    }
  }

  /**
   * Perform full synchronization
   */
  async performSync(): Promise<SyncStatus> {
    if (!this.isInitialized) {
      throw new Error('SyncService not initialized');
    }

    if (this.syncStatus.isSyncing) {
      console.log('Sync already in progress, skipping');
      return this.syncStatus;
    }

    if (!this.syncStatus.isOnline) {
      console.log('Device offline, sync skipped');
      return this.syncStatus;
    }

    this.syncStatus.isSyncing = true;

    try {
      console.log('Starting full sync...');

      // Step 1: Push pending changes
      await this.pushPendingChanges();

      // Step 2: Pull server changes
      await this.pullServerChanges();

      // Step 3: Resolve conflicts
      await this.resolveConflicts();

      // Update sync timestamp
      this.syncStatus.lastSync = new Date();
      await AsyncStorage.setItem('last_sync_timestamp', this.syncStatus.lastSync.toISOString());

      console.log('Sync completed successfully');

    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }

    return this.syncStatus;
  }

  /**
   * Add operation to pending queue for offline sync
   */
  async queueOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'attempts'>): Promise<void> {
    const pendingOp: PendingOperation = {
      id: this.generateOperationId(),
      timestamp: new Date(),
      attempts: 0,
      ...operation
    };

    this.pendingOperations.set(pendingOp.id, pendingOp);
    this.syncStatus.pendingChanges = this.pendingOperations.size;

    // Save to persistent storage
    await this.savePendingOperations();

    console.log('Operation queued for sync:', {
      id: pendingOp.id,
      type: pendingOp.type,
      table: pendingOp.table
    });

    // Try immediate sync if online
    if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
      this.performSync().catch(error => {
        console.warn('Immediate sync failed:', error);
      });
    }
  }

  /**
   * Push pending changes to server
   */
  private async pushPendingChanges(): Promise<void> {
    if (this.pendingOperations.size === 0) {
      console.log('No pending changes to push');
      return;
    }

    console.log(`Pushing ${this.pendingOperations.size} pending changes...`);

    const operations = Array.from(this.pendingOperations.values());
    const batches = this.createBatches(operations, this.config.batchSize);

    for (const batch of batches) {
      try {
        await this.pushBatch(batch);
        
        // Remove successful operations
        batch.forEach(op => {
          this.pendingOperations.delete(op.id);
        });

      } catch (error) {
        console.error('Failed to push batch:', error);
        
        // Increment attempt count
        batch.forEach(op => {
          op.attempts += 1;
          if (op.attempts >= this.config.retryAttempts) {
            console.error(`Operation ${op.id} exceeded retry limit, removing`);
            this.pendingOperations.delete(op.id);
          }
        });
      }
    }

    this.syncStatus.pendingChanges = this.pendingOperations.size;
    await this.savePendingOperations();
  }

  /**
   * Pull server changes and update local database
   */
  private async pullServerChanges(): Promise<void> {
    try {
      console.log('Pulling server changes...');

      // Use WatermelonDB sync
      await synchronize({
        database: this.database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
          const response = await fetch(`${this.config.apiUrl}/sync/pull`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lastPulledAt,
              schemaVersion,
              migration
            })
          });

          if (!response.ok) {
            throw new Error(`Pull failed: ${response.status}`);
          }

          return await response.json();
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
          const response = await fetch(`${this.config.apiUrl}/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              changes,
              lastPulledAt
            })
          });

          if (!response.ok) {
            throw new Error(`Push failed: ${response.status}`);
          }

          return await response.json();
        },
        conflictResolver: this.handleConflict.bind(this)
      });

    } catch (error) {
      console.error('Failed to pull server changes:', error);
      throw error;
    }
  }

  /**
   * Handle sync conflicts
   */
  private handleConflict(conflict: any): any {
    console.log('Conflict detected:', conflict);

    const syncConflict: SyncConflict = {
      id: this.generateConflictId(),
      type: this.mapTableToType(conflict.table),
      localData: conflict.local,
      serverData: conflict.remote,
      timestamp: new Date(),
      resolved: false
    };

    this.syncStatus.conflicts.push(syncConflict);

    // Default resolution strategy: server wins
    // In production, this would be more sophisticated
    return conflict.remote;
  }

  /**
   * Resolve conflicts with user input or automatic strategies
   */
  private async resolveConflicts(): Promise<void> {
    const unresolvedConflicts = this.syncStatus.conflicts.filter(c => !c.resolved);
    
    if (unresolvedConflicts.length === 0) {
      return;
    }

    console.log(`Resolving ${unresolvedConflicts.length} conflicts...`);

    for (const conflict of unresolvedConflicts) {
      try {
        // Automatic resolution based on type and business rules
        const resolution = await this.autoResolveConflict(conflict);
        
        if (resolution) {
          conflict.resolved = true;
          console.log(`Auto-resolved conflict ${conflict.id}`);
        } else {
          // Conflict requires user intervention
          console.log(`Conflict ${conflict.id} requires manual resolution`);
        }

      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }
  }

  /**
   * Automatic conflict resolution
   */
  private async autoResolveConflict(conflict: SyncConflict): Promise<boolean> {
    switch (conflict.type) {
      case 'schedule':
        // For schedules, newer timestamp wins
        const localTime = new Date(conflict.localData.updatedAt);
        const serverTime = new Date(conflict.serverData.updatedAt);
        return serverTime > localTime;

      case 'route':
        // For routes, use server data if it has better route optimization
        return true; // Server typically has better route calculation

      case 'notification':
        // For notifications, merge both versions
        return true; // Notifications can typically be merged

      default:
        return false; // Unknown type requires manual resolution
    }
  }

  /**
   * Push batch of operations to server
   */
  private async pushBatch(operations: PendingOperation[]): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/sync/operations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: operations.map(op => ({
          type: op.type,
          table: op.table,
          data: op.data,
          timestamp: op.timestamp.toISOString()
        }))
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Push batch failed: ${response.status} - ${error}`);
    }

    console.log(`Successfully pushed batch of ${operations.length} operations`);
  }

  /**
   * Initialize network connectivity listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.syncStatus.isOnline;
      this.syncStatus.isOnline = state.isConnected ?? false;

      console.log('Network status changed:', {
        isConnected: this.syncStatus.isOnline,
        type: state.type
      });

      // Start sync when coming back online
      if (!wasOnline && this.syncStatus.isOnline && this.isInitialized) {
        console.log('Device came online, starting sync...');
        this.startSyncInterval();
        this.performSync().catch(error => {
          console.error('Failed to sync after coming online:', error);
        });
      }

      // Stop sync interval when going offline
      if (wasOnline && !this.syncStatus.isOnline) {
        console.log('Device went offline, stopping sync interval');
        this.stopSyncInterval();
      }
    });
  }

  /**
   * Start periodic sync interval
   */
  private startSyncInterval(): void {
    if (this.syncInterval) {
      return; // Already running
    }

    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.performSync().catch(error => {
          console.error('Scheduled sync failed:', error);
        });
      }
    }, this.config.syncInterval);

    console.log(`Sync interval started (${this.config.syncInterval}ms)`);
  }

  /**
   * Stop periodic sync interval
   */
  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Sync interval stopped');
    }
  }

  /**
   * Load pending operations from storage
   */
  private async loadPendingOperations(): Promise<void> {
    try {
      const pendingOpsStr = await AsyncStorage.getItem('pending_operations');
      if (pendingOpsStr) {
        const pendingOpsArray: PendingOperation[] = JSON.parse(pendingOpsStr);
        
        pendingOpsArray.forEach(op => {
          // Convert timestamp back to Date object
          op.timestamp = new Date(op.timestamp);
          this.pendingOperations.set(op.id, op);
        });

        this.syncStatus.pendingChanges = this.pendingOperations.size;
        console.log(`Loaded ${this.pendingOperations.size} pending operations`);
      }
    } catch (error) {
      console.error('Failed to load pending operations:', error);
    }
  }

  /**
   * Save pending operations to storage
   */
  private async savePendingOperations(): Promise<void> {
    try {
      const pendingOpsArray = Array.from(this.pendingOperations.values());
      await AsyncStorage.setItem('pending_operations', JSON.stringify(pendingOpsArray));
    } catch (error) {
      console.error('Failed to save pending operations:', error);
    }
  }

  /**
   * Create batches from operations array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Map database table to conflict type
   */
  private mapTableToType(table: string): SyncConflict['type'] {
    switch (table) {
      case 'schedules':
      case 'schedule_items':
        return 'schedule';
      case 'routes':
      case 'route_plans':
        return 'route';
      case 'notifications':
        return 'notification';
      default:
        return 'schedule'; // Default fallback
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique conflict ID
   */
  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Force sync (manual trigger)
   */
  async forceSync(): Promise<SyncStatus> {
    console.log('Force sync triggered');
    return await this.performSync();
  }

  /**
   * Clear all pending operations (admin function)
   */
  async clearPendingOperations(): Promise<void> {
    this.pendingOperations.clear();
    this.syncStatus.pendingChanges = 0;
    await AsyncStorage.removeItem('pending_operations');
    console.log('All pending operations cleared');
  }

  /**
   * Get pending operations for debugging
   */
  getPendingOperations(): PendingOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  /**
   * Cleanup and stop all sync activities
   */
  cleanup(): void {
    this.stopSyncInterval();
    console.log('SyncService cleanup completed');
  }
}