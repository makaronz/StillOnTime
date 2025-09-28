# Backend Development Patterns & Learnings

## Project Architecture Insights

### Service Layer Pattern
- **Services Index**: All service instances exported from `src/services/index.ts`
- **Dependency Injection**: Services properly instantiated with dependencies
- **Repository Pattern**: Data access abstracted through repository layer

### Error Handling Standards
```typescript
// Correct TypeScript error handling pattern
try {
  // operation
} catch (error) {
  logger.error("Operation failed", {
    error: error instanceof Error ? error.message : String(error)
  });
}
```

### Express Controller Patterns
```typescript
// Proper void return type handling
async method(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return; // Don't return response object
  }
  // ... rest of method
}
```

### Authentication Pattern
```typescript
// Standard user validation
if (!req.user) {
  res.status(401).json({ error: "Unauthorized" });
  return;
}
```

## Type System Usage
- **Database Types**: Prisma-generated types exported as domain types
- **API Types**: Separate interfaces for request/response data
- **Service Integration**: Proper type annotations for service method signatures

## Development Environment
- **Simple Mode**: `npm run dev:simple` for lightweight development
- **Full Mode**: `npm run dev` with full monitoring (resource intensive)
- **Build Validation**: `npm run build` for TypeScript compilation check

## Common Issues & Solutions
1. **Scope in Closures**: Capture class properties before function overrides
2. **Type Imports**: Use proper import paths from index files
3. **Error Types**: Always handle `unknown` error types with type guards
4. **Response Returns**: Avoid returning Express response objects in void methods