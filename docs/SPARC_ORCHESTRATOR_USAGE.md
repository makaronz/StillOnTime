# SPARC Orchestrator Usage Guide

## Quick Start

### 1. Initialize Orchestrator

```typescript
import { SPARCOrchestratorService } from '../services/sparc-orchestrator.service';
import { ErrorRecoveryService } from '../services/error-recovery.service';
import { MonitoringService } from '../services/monitoring.service';
import { NotificationService } from '../services/notification.service';
import { CacheService } from '../services/cache.service';

// Initialize dependencies
const errorRecoveryService = new ErrorRecoveryService(
  fallbackService,
  monitoringService,
  notificationService,
  cacheService
);

// Create orchestrator
const orchestrator = new SPARCOrchestratorService(
  errorRecoveryService,
  monitoringService,
  notificationService,
  cacheService
);
```

### 2. Define a Task

```typescript
const task = {
  id: 'task-001',
  name: 'implement-user-authentication',
  description: 'Implement complete user authentication system',
  priority: 'high' as const,
  subtasks: [
    {
      id: 'subtask-001',
      name: 'design-auth-flow',
      description: 'Design authentication flow architecture',
      agentType: 'architect',
      estimatedTime: 30,
    },
    {
      id: 'subtask-002',
      name: 'implement-backend-auth',
      description: 'Implement backend authentication endpoints',
      agentType: 'backend-dev',
      dependencies: ['subtask-001'],
      estimatedTime: 120,
    },
    {
      id: 'subtask-003',
      name: 'implement-frontend-auth',
      description: 'Implement frontend authentication UI',
      agentType: 'frontend-developer',
      dependencies: ['subtask-001'],
      estimatedTime: 90,
    },
    {
      id: 'subtask-004',
      name: 'write-auth-tests',
      description: 'Write comprehensive authentication tests',
      agentType: 'tester',
      dependencies: ['subtask-002', 'subtask-003'],
      estimatedTime: 60,
    },
  ],
};
```

### 3. Execute Task

```typescript
// Execute task with automatic self-healing
const result = await orchestrator.executeTask(task);

if (result.success) {
  console.log('Task completed successfully!');
  console.log('Results:', result.results);
  
  if (result.recoveryUsed) {
    console.log(`Recovery was used: ${result.recoveryMethod}`);
    console.log(`Recovery attempts: ${result.recoveryAttempts}`);
  }
} else {
  console.error('Task failed:', result.errors);
}
```

## Using with Claude Flow MCP Tools

### Initialize Swarm

```typescript
// Via MCP tools (preferred)
const swarmResult = await mcp__claude-flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 10,
  strategy: "auto"
});

// Via CLI (fallback)
// npx claude-flow@alpha swarm init --topology hierarchical --max-agents 10
```

### Spawn Agents

```typescript
// Spawn specialized agents for subtasks
const agents = await Promise.all([
  mcp__claude-flow__agent_spawn({
    type: "architect",
    name: "AuthFlowDesigner"
  }),
  mcp__claude-flow__agent_spawn({
    type: "backend-dev",
    name: "BackendAuthImplementer"
  }),
  mcp__claude-flow__agent_spawn({
    type: "frontend-developer",
    name: "FrontendAuthUI"
  }),
  mcp__claude-flow__agent_spawn({
    type: "tester",
    name: "AuthTestWriter"
  })
]);
```

### Orchestrate Execution

```typescript
// Use SPARC orchestrator mode
await mcp__claude-flow__sparc_mode({
  mode: "orchestrator",
  task_description: "Implement user authentication system with self-healing",
  options: {
    parallel: true,
    monitor: true,
    selfHealing: true
  }
});
```

## Self-Healing in Action

### Example: Automatic Dependency Recovery

```typescript
// Task execution automatically handles missing dependencies
const task = {
  id: 'task-002',
  name: 'setup-development-environment',
  priority: 'high' as const,
  subtasks: [
    {
      id: 'subtask-005',
      name: 'install-dependencies',
      description: 'Install npm packages',
      agentType: 'coder',
    }
  ]
};

// If npm install fails, orchestrator automatically:
// 1. Detects the error
// 2. Attempts recovery (retry, clear cache, etc.)
// 3. Learns from the recovery
// 4. Continues execution

const result = await orchestrator.executeTask(task);
```

### Example: Test Failure Recovery

```typescript
// If tests fail, orchestrator spawns debugger agent
const task = {
  id: 'task-003',
  name: 'implement-feature',
  priority: 'medium' as const,
  subtasks: [
    {
      id: 'subtask-006',
      name: 'run-tests',
      description: 'Run test suite',
      agentType: 'tester',
    }
  ]
};

// Orchestrator automatically:
// 1. Detects test failure
// 2. Spawns debugger agent to analyze failure
// 3. Applies fix based on analysis
// 4. Re-runs tests
// 5. Stores recovery pattern for future use

const result = await orchestrator.executeTask(task);
```

## Monitoring and Health Checks

### Check Orchestrator Health

```typescript
const health = await orchestrator.getHealth();

console.log({
  status: health.status, // "healthy" | "degraded" | "unhealthy"
  activeTasks: health.activeTasks,
  activeAgents: health.activeAgents,
  errorRate: health.errorRate,
  recoveryRate: health.recoveryRate
});
```

### Monitor Task Progress

```typescript
// Check active tasks
const activeTasks = orchestrator.activeTasks;

for (const [taskId, task] of activeTasks) {
  console.log(`Task ${taskId}: ${task.name}`);
  console.log(`Status: ${task.status}`);
  console.log(`Progress: ${task.progress}%`);
}
```

## Error Pattern Learning

### View Learned Patterns

```typescript
// Patterns are automatically stored in memory
const patterns = await mcp__claude-flow__memory_search({
  namespace: "error-patterns",
  query: "authentication"
});

console.log('Learned error patterns:', patterns);
```

### Manual Pattern Storage

```typescript
// Store custom recovery pattern
await mcp__claude-flow__memory_usage({
  action: "store",
  key: "error-pattern-auth-failure",
  value: JSON.stringify({
    errorType: "OAuthError",
    errorMessage: "Token expired",
    recoveryStrategy: "refresh-token",
    success: true
  }),
  namespace: "error-patterns",
  ttl: 2592000 // 30 days
});
```

## Best Practices

### 1. Task Design

- **Break tasks into logical subtasks**: Each subtask should be independently executable
- **Define clear dependencies**: Use dependencies to ensure proper execution order
- **Set appropriate priorities**: Critical tasks get higher priority recovery
- **Include metadata**: Add context for better error recovery

### 2. Agent Selection

- **Match agent type to subtask**: Use specialized agents for each task type
- **Consider agent capabilities**: Ensure agents can handle the subtask requirements
- **Balance parallel execution**: Use dependencies to enable parallel execution where possible

### 3. Error Handling

- **Trust the self-healing**: Let orchestrator handle automatic recovery
- **Monitor recovery patterns**: Review learned patterns to improve system
- **Set appropriate retry limits**: Avoid infinite recovery loops
- **Notify on critical failures**: Ensure manual intervention when needed

### 4. Performance

- **Use parallel execution**: Design tasks for maximum parallelization
- **Monitor execution times**: Track and optimize slow subtasks
- **Cache results**: Use caching for expensive operations
- **Set time estimates**: Help orchestrator optimize scheduling

## Integration Examples

### With Express Routes

```typescript
import { Router } from 'express';
import { SPARCOrchestratorService } from '../services/sparc-orchestrator.service';

const router = Router();

router.post('/tasks/execute', async (req, res) => {
  try {
    const task = req.body;
    const result = await orchestrator.executeTask(task);
    
    res.json({
      success: result.success,
      taskId: result.taskId,
      executionTime: result.executionTime,
      recoveryUsed: result.recoveryUsed,
      results: result.results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  const health = await orchestrator.getHealth();
  res.json(health);
});
```

### With Background Jobs

```typescript
import Bull from 'bull';
import { SPARCOrchestratorService } from '../services/sparc-orchestrator.service';

const taskQueue = new Bull('sparc-tasks', {
  redis: { host: 'localhost', port: 6379 }
});

taskQueue.process(async (job) => {
  const task = job.data;
  const result = await orchestrator.executeTask(task);
  
  // Store result
  await job.progress(result);
  
  return result;
});
```

## Troubleshooting

### Common Issues

1. **Self-healing not triggering**: Check hook configuration in `.claude/settings.json`
2. **Recovery loops**: Reduce max recovery attempts or add circuit breaker
3. **Pattern learning not working**: Verify memory storage configuration
4. **Agent coordination failures**: Check swarm topology and communication

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'sparc-orchestrator:*';

// Execute task with verbose logging
const result = await orchestrator.executeTask(task, { debug: true });
```

## References

- [SPARC Orchestrator Self-Healing Documentation](./SPARC_ORCHESTRATOR_SELF_HEALING.md)
- [Error Recovery Service](../backend/src/services/error-recovery.service.ts)
- [Monitoring Service](../backend/src/services/monitoring.service.ts)
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)

