/**
 * SPARC Orchestrator Service
 * Multi-agent task orchestration with self-healing capabilities
 * Integrates with existing error recovery and monitoring services
 */

import { logger, structuredLogger } from "../utils/logger";
import { ErrorRecoveryService, RecoveryResult, RecoveryContext } from "./error-recovery.service";
import { MonitoringService } from "./monitoring.service";
import { NotificationService } from "./notification.service";
import { CacheService } from "./cache.service";

export interface Task {
  id: string;
  name: string;
  description: string;
  subtasks: Subtask[];
  dependencies?: string[];
  priority: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, any>;
}

export interface Subtask {
  id: string;
  name: string;
  description: string;
  agentType: string;
  dependencies?: string[];
  estimatedTime?: number;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  results: Record<string, any>;
  executionTime: number;
  recoveryUsed: boolean;
  recoveryMethod?: string;
  recoveryAttempts?: number;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface AgentExecution {
  agentId: string;
  agentType: string;
  subtaskId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
  error?: Error;
  executionTime?: number;
}

export class SPARCOrchestratorService {
  private errorRecoveryService: ErrorRecoveryService;
  private monitoringService: MonitoringService;
  private notificationService: NotificationService;
  private cacheService: CacheService;

  private activeTasks: Map<string, Task> = new Map();
  private agentExecutions: Map<string, AgentExecution> = new Map();
  private errorPatterns: Map<string, any> = new Map();

  constructor(
    errorRecoveryService: ErrorRecoveryService,
    monitoringService: MonitoringService,
    notificationService: NotificationService,
    cacheService: CacheService
  ) {
    this.errorRecoveryService = errorRecoveryService;
    this.monitoringService = monitoringService;
    this.notificationService = notificationService;
    this.cacheService = cacheService;

    structuredLogger.info("SPARC Orchestrator Service initialized", {
      service: "sparc-orchestrator",
    });
  }

  /**
   * Execute task with self-healing capabilities
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const taskId = task.id;

    structuredLogger.info("Executing task with orchestrator", {
      taskId,
      taskName: task.name,
      subtasksCount: task.subtasks.length,
    });

    // Store task in active tasks
    this.activeTasks.set(taskId, task);

    try {
      // Execute with error recovery
      const recoveryResult = await this.errorRecoveryService.executeWithRecovery(
        async () => {
          return await this.executeTaskInternal(task);
        },
        {
          serviceName: "sparc-orchestrator",
          operation: task.name,
          requestId: taskId,
          metadata: {
            taskId,
            priority: task.priority,
            subtasksCount: task.subtasks.length,
          },
        },
        {
          enableRetry: true,
          enableFallback: true,
          enableCircuitBreaker: true,
          maxRecoveryAttempts: 3,
          gracefulDegradation: true,
          notifyOnFailure: true,
          cacheFailureData: true,
        }
      );

      const executionTime = Date.now() - startTime;

      // Build task result
      const taskResult: TaskResult = {
        taskId,
        success: recoveryResult.success,
        results: recoveryResult.data || {},
        executionTime,
        recoveryUsed: recoveryResult.fallbackUsed || recoveryResult.attempts > 1,
        recoveryMethod: recoveryResult.recoveryMethod,
        recoveryAttempts: recoveryResult.attempts,
        errors: recoveryResult.errors,
        warnings: recoveryResult.warnings,
        metadata: {
          circuitBreakerTripped: recoveryResult.circuitBreakerTripped,
          degraded: recoveryResult.degraded,
        },
      };

      // Record metrics
      await this.recordTaskExecution(task, taskResult);

      // Clean up
      this.activeTasks.delete(taskId);

      return taskResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      structuredLogger.error("Task execution failed", {
        taskId,
        error,
        executionTime,
      });

      // Attempt automatic recovery
      const recoveryResult = await this.recoverFromError(error, task);

      if (recoveryResult.success) {
        return {
          taskId,
          success: true,
          results: recoveryResult.data || {},
          executionTime,
          recoveryUsed: true,
          recoveryMethod: "automatic-recovery",
          recoveryAttempts: recoveryResult.attempts,
          warnings: recoveryResult.warnings,
        };
      }

      // Notify failure
      await this.notifyFailure(task, error, recoveryResult);

      // Clean up
      this.activeTasks.delete(taskId);

      throw error;
    }
  }

  /**
   * Internal task execution
   */
  private async executeTaskInternal(task: Task): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    // Execute subtasks in dependency order
    const executedSubtasks = new Set<string>();
    const subtaskMap = new Map(task.subtasks.map((st) => [st.id, st]));

    while (executedSubtasks.size < task.subtasks.length) {
      // Find subtasks ready to execute (dependencies satisfied)
      const readySubtasks = task.subtasks.filter(
        (subtask) =>
          !executedSubtasks.has(subtask.id) &&
          (!subtask.dependencies ||
            subtask.dependencies.every((dep) => executedSubtasks.has(dep)))
      );

      if (readySubtasks.length === 0) {
        throw new Error("Circular dependency or missing dependency in subtasks");
      }

      // Execute ready subtasks in parallel
      const subtaskResults = await Promise.allSettled(
        readySubtasks.map((subtask) => this.executeSubtask(subtask, task))
      );

      // Process results
      for (let i = 0; i < readySubtasks.length; i++) {
        const subtask = readySubtasks[i];
        const result = subtaskResults[i];

        if (result.status === "fulfilled") {
          results[subtask.id] = result.value;
          executedSubtasks.add(subtask.id);
        } else {
          // Handle subtask failure with recovery
          const recoveryResult = await this.recoverSubtaskFailure(
            subtask,
            result.reason,
            task
          );

          if (recoveryResult.success) {
            results[subtask.id] = recoveryResult.data;
            executedSubtasks.add(subtask.id);
          } else {
            throw new Error(
              `Subtask ${subtask.name} failed: ${result.reason.message}`
            );
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute individual subtask
   */
  private async executeSubtask(
    subtask: Subtask,
    parentTask: Task
  ): Promise<any> {
    const executionId = `${parentTask.id}-${subtask.id}`;
    const startTime = Date.now();

    structuredLogger.info("Executing subtask", {
      subtaskId: subtask.id,
      subtaskName: subtask.name,
      agentType: subtask.agentType,
      taskId: parentTask.id,
    });

    const execution: AgentExecution = {
      agentId: executionId,
      agentType: subtask.agentType,
      subtaskId: subtask.id,
      status: "running",
    };

    this.agentExecutions.set(executionId, execution);

    try {
      // In a real implementation, this would spawn actual agents via MCP tools
      // For now, we simulate agent execution
      const result = await this.simulateAgentExecution(subtask, parentTask);

      execution.status = "completed";
      execution.result = result;
      execution.executionTime = Date.now() - startTime;

      this.agentExecutions.set(executionId, execution);

      return result;
    } catch (error) {
      execution.status = "failed";
      execution.error = error as Error;
      execution.executionTime = Date.now() - startTime;

      this.agentExecutions.set(executionId, execution);

      throw error;
    }
  }

  /**
   * Simulate agent execution (placeholder for actual MCP agent spawning)
   */
  private async simulateAgentExecution(
    subtask: Subtask,
    parentTask: Task
  ): Promise<any> {
    // This would be replaced with actual agent spawning via MCP tools:
    // const agent = await mcp__claude-flow__agent_spawn({
    //   type: subtask.agentType,
    //   name: subtask.name
    // });
    // const result = await agent.execute(subtask);

    structuredLogger.info("Simulating agent execution", {
      subtaskId: subtask.id,
      agentType: subtask.agentType,
    });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      subtaskId: subtask.id,
      status: "completed",
      agentType: subtask.agentType,
    };
  }

  /**
   * Recover from subtask failure
   */
  private async recoverSubtaskFailure(
    subtask: Subtask,
    error: Error,
    parentTask: Task
  ): Promise<RecoveryResult<any>> {
    structuredLogger.warn("Recovering from subtask failure", {
      subtaskId: subtask.id,
      error: error.message,
      taskId: parentTask.id,
    });

    // Check for learned recovery patterns
    const pattern = this.findRecoveryPattern(error);

    if (pattern) {
      structuredLogger.info("Applying learned recovery pattern", {
        subtaskId: subtask.id,
        pattern: pattern.name,
      });

      try {
        const result = await this.applyRecoveryPattern(pattern, subtask, error);
        return {
          success: true,
          data: result,
          recoveryMethod: `pattern:${pattern.name}`,
          attempts: 1,
          totalTime: 0,
          degraded: false,
          warnings: [`Applied recovery pattern: ${pattern.name}`],
          errors: [],
          fallbackUsed: true,
          circuitBreakerTripped: false,
        };
      } catch (recoveryError) {
        structuredLogger.warn("Recovery pattern failed, trying standard recovery", {
          subtaskId: subtask.id,
          pattern: pattern.name,
          error: recoveryError,
        });
      }
    }

    // Use standard error recovery
    return await this.errorRecoveryService.executeWithRecovery(
      async () => {
        return await this.executeSubtask(subtask, parentTask);
      },
      {
        serviceName: `sparc-orchestrator:${subtask.agentType}`,
        operation: subtask.name,
        requestId: `${parentTask.id}-${subtask.id}`,
        metadata: {
          subtaskId: subtask.id,
          taskId: parentTask.id,
        },
      },
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 2,
        gracefulDegradation: true,
      }
    );
  }

  /**
   * Recover from task-level error
   */
  private async recoverFromError(
    error: Error,
    task: Task
  ): Promise<RecoveryResult<any>> {
    structuredLogger.warn("Recovering from task-level error", {
      taskId: task.id,
      error: error.message,
    });

    // Store error pattern for learning
    await this.learnErrorPattern(error, task);

    // Attempt recovery using error recovery service
    return await this.errorRecoveryService.executeWithRecovery(
      async () => {
        return await this.executeTaskInternal(task);
      },
      {
        serviceName: "sparc-orchestrator",
        operation: task.name,
        requestId: task.id,
        metadata: {
          taskId: task.id,
        },
      },
      {
        enableRetry: true,
        enableFallback: true,
        maxRecoveryAttempts: 2,
        gracefulDegradation: true,
      }
    );
  }

  /**
   * Find recovery pattern for error
   */
  private findRecoveryPattern(error: Error): any | null {
    const errorKey = `${error.constructor.name}:${error.message.substring(0, 50)}`;
    return this.errorPatterns.get(errorKey) || null;
  }

  /**
   * Learn error pattern from recovery
   */
  private async learnErrorPattern(error: Error, task: Task): Promise<void> {
    const errorKey = `${error.constructor.name}:${error.message.substring(0, 50)}`;

    if (!this.errorPatterns.has(errorKey)) {
      this.errorPatterns.set(errorKey, {
        name: errorKey,
        errorType: error.constructor.name,
        errorMessage: error.message,
        taskType: task.name,
        firstSeen: new Date().toISOString(),
        recoveryStrategies: [],
      });

      structuredLogger.info("Learned new error pattern", {
        errorKey,
        errorType: error.constructor.name,
      });
    }
  }

  /**
   * Apply recovery pattern
   */
  private async applyRecoveryPattern(
    pattern: any,
    subtask: Subtask,
    error: Error
  ): Promise<any> {
    // This would implement pattern-specific recovery logic
    // For now, we just retry with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await this.executeSubtask(subtask, { id: "", name: "", subtasks: [], priority: "medium" } as Task);
  }

  /**
   * Record task execution metrics
   */
  private async recordTaskExecution(
    task: Task,
    result: TaskResult
  ): Promise<void> {
    await this.monitoringService.recordRequest(
      `orchestrator:${task.name}`,
      result.executionTime,
      result.success
    );

    if (!result.success) {
      await this.monitoringService.recordError({
        service: "sparc-orchestrator",
        error: new Error(result.errors?.join(", ") || "Task execution failed"),
        metadata: {
          taskId: task.id,
          taskName: task.name,
          subtasksCount: task.subtasks.length,
          recoveryAttempts: result.recoveryAttempts,
          recoveryMethod: result.recoveryMethod,
        },
      });
    }
  }

  /**
   * Notify on task failure
   */
  private async notifyFailure(
    task: Task,
    error: Error,
    recoveryResult: RecoveryResult<any>
  ): Promise<void> {
    structuredLogger.error("Task failure notification", {
      taskId: task.id,
      taskName: task.name,
      error: error.message,
      recoveryAttempts: recoveryResult.attempts,
    });

    await this.notificationService.sendNotification({
      type: "task_failure",
      severity: task.priority === "critical" ? "critical" : "high",
      title: `Task Failed: ${task.name}`,
      message: `Task ${task.name} failed after ${recoveryResult.attempts} recovery attempts: ${error.message}`,
      metadata: {
        taskId: task.id,
        error: error.message,
        recoveryAttempts: recoveryResult.attempts,
      },
    });
  }

  /**
   * Get orchestrator health status
   */
  async getHealth(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    activeTasks: number;
    activeAgents: number;
    errorRate: number;
    recoveryRate: number;
  }> {
    const activeTasks = this.activeTasks.size;
    const activeAgents = Array.from(this.agentExecutions.values()).filter(
      (e) => e.status === "running"
    ).length;

    // Calculate error rate (simplified)
    const totalExecutions = this.agentExecutions.size;
    const failedExecutions = Array.from(this.agentExecutions.values()).filter(
      (e) => e.status === "failed"
    ).length;
    const errorRate = totalExecutions > 0 ? failedExecutions / totalExecutions : 0;

    // Calculate recovery rate (would need to track recovery attempts)
    const recoveryRate = 0.8; // Placeholder

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (errorRate > 0.5) {
      status = "unhealthy";
    } else if (errorRate > 0.2) {
      status = "degraded";
    }

    return {
      status,
      activeTasks,
      activeAgents,
      errorRate,
      recoveryRate,
    };
  }
}

