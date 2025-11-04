# SPARC Orchestrator with Self-Healing Workflows

## Overview

This document describes the SPARC Orchestrator mode configuration with integrated self-healing capabilities for the StillOnTime project. The orchestrator coordinates multi-agent task execution while automatically detecting and recovering from errors.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              SPARC Orchestrator Mode                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Task Decomposition & Planning                    │  │
│  │  - Analyze requirements                           │  │
│  │  - Break into subtasks                            │  │
│  │  - Define dependencies                            │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        ▼                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Agent Coordination                               │  │
│  │  - Spawn specialized agents                       │  │
│  │  - Allocate resources                            │  │
│  │  - Monitor progress                              │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        ▼                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Self-Healing Layer                              │  │
│  │  - Error detection                                │  │
│  │  - Automatic recovery                             │  │
│  │  - Pattern learning                               │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│                        ▼                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Error Recovery Service Integration              │  │
│  │  - Circuit breakers                               │  │
│  │  - Retry logic                                    │  │
│  │  - Fallback strategies                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Self-Healing Capabilities

### 1. Error Detection

The orchestrator monitors for:
- **Failed Commands**: Bash commands returning non-zero exit codes
- **Syntax Errors**: TypeScript/JavaScript compilation errors
- **Missing Dependencies**: Module not found errors
- **Test Failures**: Jest/Playwright test failures
- **API Errors**: External service failures (detected via circuit breakers)
- **Database Errors**: Connection or query failures

### 2. Automatic Recovery

#### Missing Dependencies
```typescript
// Pattern: npm install for missing modules
if (error.message.includes("Cannot find module")) {
  const moduleName = extractModuleName(error);
  await executeCommand(`npm install ${moduleName}`);
  await retryOperation();
}
```

#### Syntax Errors
```typescript
// Pattern: Analyze and fix syntax errors
if (error instanceof SyntaxError) {
  const analysis = await analyzeError(error);
  const fix = await generateFix(analysis);
  await applyFix(fix);
  await retryOperation();
}
```

#### Test Failures
```typescript
// Pattern: Debug and fix test failures
if (testFailure) {
  const debuggerAgent = await spawnAgent("debugger");
  const analysis = await debuggerAgent.analyze(testFailure);
  const fix = await generateFix(analysis);
  await applyFix(fix);
  await rerunTests();
}
```

#### API Service Failures
```typescript
// Pattern: Use existing ErrorRecoveryService
import { ErrorRecoveryService } from '../services/error-recovery.service';

const recoveryResult = await errorRecoveryService.executeWithRecovery(
  () => externalService.call(),
  {
    serviceName: 'external_api',
    operation: 'fetch_data'
  },
  {
    enableRetry: true,
    enableFallback: true,
    enableCircuitBreaker: true,
    maxRecoveryAttempts: 3
  }
);
```

### 3. Pattern Learning

Each recovery is stored in Claude Flow memory for future prevention:

```typescript
// Store error pattern
await memoryUsage({
  action: "store",
  key: `error-pattern-${Date.now()}`,
  value: JSON.stringify({
    errorType: error.constructor.name,
    errorMessage: error.message,
    recoveryStrategy: recoveryMethod,
    success: true,
    timestamp: new Date().toISOString()
  }),
  namespace: "error-patterns",
  ttl: 2592000 // 30 days
});

// Analyze patterns
await neuralPatterns({
  action: "analyze",
  operation: "error-recovery",
  outcome: "success"
});
```

## Integration with Existing Services

### ErrorRecoveryService Integration

The orchestrator uses the existing `ErrorRecoveryService` for comprehensive error handling:

```typescript
import { ErrorRecoveryService } from '../services/error-recovery.service';

class SPARCOrchestrator {
  private errorRecoveryService: ErrorRecoveryService;

  async executeTask(task: Task): Promise<TaskResult> {
    return this.errorRecoveryService.executeWithRecovery(
      async () => {
        // Decompose task
        const subtasks = await this.decomposeTask(task);
        
        // Spawn agents
        const agents = await this.spawnAgents(subtasks);
        
        // Execute in parallel with coordination
        const results = await this.coordinateExecution(agents);
        
        // Synthesize results
        return this.synthesizeResults(results);
      },
      {
        serviceName: 'sparc-orchestrator',
        operation: task.name,
        metadata: { taskId: task.id }
      },
      {
        enableRetry: true,
        enableFallback: true,
        enableCircuitBreaker: true,
        maxRecoveryAttempts: 3,
        gracefulDegradation: true
      }
    );
  }
}
```

### MonitoringService Integration

Track orchestrator performance and health:

```typescript
import { MonitoringService } from '../services/monitoring.service';

class SPARCOrchestrator {
  private monitoringService: MonitoringService;

  async recordTaskExecution(task: Task, result: TaskResult): Promise<void> {
    await this.monitoringService.recordRequest(
      `orchestrator:${task.name}`,
      result.executionTime,
      result.success
    );

    if (!result.success) {
      await this.monitoringService.recordError({
        service: 'orchestrator',
        error: result.error,
        metadata: {
          taskId: task.id,
          subtasks: task.subtasks.length,
          recoveryAttempts: result.recoveryAttempts
        }
      });
    }
  }
}
```

## Hook Configuration

### Post-Tool Hooks for Self-Healing

```json
{
  "PostToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "cat | jq -r '.tool_result.exitCode // 0' | xargs -I {} sh -c 'if [ {} -ne 0 ]; then npx claude-flow@alpha hooks post-error --error-type \"command-failure\" --exit-code {} --auto-recover true; fi'"
        }
      ]
    },
    {
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [
        {
          "type": "command",
          "command": "cat | jq -r '.tool_result.error // empty' | if [ -n \"$0\" ]; then npx claude-flow@alpha hooks post-error --error-type \"syntax-error\" --auto-recover true; fi"
        }
      ]
    }
  ]
}
```

## Workflow Examples

### Example 1: Feature Development with Self-Healing

```typescript
// Initialize orchestrator
const swarmId = await swarmInit({
  topology: "hierarchical",
  maxAgents: 10,
  strategy: "auto"
});

// Decompose feature development task
const task = {
  name: "implement-user-authentication",
  subtasks: [
    { name: "design-auth-flow", agent: "architect" },
    { name: "implement-backend", agent: "backend-dev" },
    { name: "implement-frontend", agent: "frontend-developer" },
    { name: "write-tests", agent: "tester" }
  ]
};

// Execute with self-healing
const result = await orchestrator.executeTask(task);

// Result includes recovery information
if (result.recoveryUsed) {
  console.log(`Recovery applied: ${result.recoveryMethod}`);
  console.log(`Recovery attempts: ${result.recoveryAttempts}`);
}
```

### Example 2: Error Recovery During Execution

```typescript
// Task execution with automatic recovery
try {
  const result = await orchestrator.executeTask(task);
  return result;
} catch (error) {
  // Self-healing automatically attempts recovery
  const recoveryResult = await orchestrator.recoverFromError(error, task);
  
  if (recoveryResult.success) {
    // Continue with recovered state
    return recoveryResult.data;
  } else {
    // Escalate to manual intervention
    await orchestrator.notifyFailure(task, error, recoveryResult);
    throw error;
  }
}
```

## Configuration

### Environment Variables

```bash
# SPARC Orchestrator Configuration
SPARC_ORCHESTRATOR_ENABLED=true
SPARC_MAX_AGENTS=10
SPARC_TOPOLOGY=hierarchical
SPARC_SELF_HEALING_ENABLED=true

# Self-Healing Configuration
SELF_HEALING_MAX_RETRIES=3
SELF_HEALING_RETRY_DELAY=1000
SELF_HEALING_PATTERN_LEARNING=true
SELF_HEALING_NOTIFY_ON_FAILURE=true
```

### Claude Flow Settings

Update `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cat | jq -r '.tool_result.exitCode // 0' | xargs -I {} sh -c 'if [ {} -ne 0 ]; then npx claude-flow@alpha hooks post-error --error-type \"command-failure\" --exit-code {} --auto-recover true; fi'"
          }
        ]
      }
    ]
  },
  "sparc": {
    "orchestrator": {
      "enabled": true,
      "selfHealing": true,
      "maxAgents": 10,
      "topology": "hierarchical"
    }
  }
}
```

## Monitoring and Metrics

### Key Metrics

- **Task Success Rate**: Percentage of tasks completed successfully
- **Recovery Rate**: Percentage of errors automatically recovered
- **Average Recovery Time**: Time taken for automatic recovery
- **Pattern Learning Accuracy**: Success rate of learned recovery patterns
- **Agent Coordination Efficiency**: Time spent in coordination vs execution

### Health Checks

```typescript
// Check orchestrator health
const health = await orchestrator.getHealth();

console.log({
  status: health.status, // "healthy" | "degraded" | "unhealthy"
  activeAgents: health.activeAgents,
  pendingTasks: health.pendingTasks,
  errorRate: health.errorRate,
  recoveryRate: health.recoveryRate
});
```

## Best Practices

1. **Always enable self-healing** for critical operations
2. **Monitor recovery patterns** to identify systemic issues
3. **Set appropriate retry limits** to avoid infinite loops
4. **Notify on failures** for manual intervention when needed
5. **Learn from successful recoveries** to improve future performance
6. **Integrate with existing error recovery services** for consistency

## Troubleshooting

### Common Issues

1. **Self-healing not triggering**: Check hook configuration and error detection
2. **Recovery loops**: Reduce max retries or add circuit breaker
3. **Pattern learning not working**: Verify memory storage configuration
4. **Agent coordination failures**: Check swarm topology and communication

## References

- [Error Recovery Service](../backend/src/services/error-recovery.service.ts)
- [Monitoring Service](../backend/src/services/monitoring.service.ts)
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)
- [SPARC Methodology](../docs/SPARC_IMPLEMENTATION_SUMMARY.md)

