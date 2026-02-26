# CodeNet Mandatory Functions Reference

> **Required Functions for Cursor IDE, Claude Desktop, and Claude Code**  
> Universal API for CodeNet RAG Integration  
> Version: 1.0 | Last Updated: October 2025

---

## 📋 Table of Contents

1. [Core Functions](#core-functions)
2. [Cursor IDE Functions](#cursor-ide-functions)
3. [Claude Desktop Functions](#claude-desktop-functions)
4. [Claude Code Functions](#claude-code-functions)
5. [Universal CLI Functions](#universal-cli-functions)
6. [Integration Examples](#integration-examples)

---

## Core Functions

### Required for ALL Implementations

These functions MUST be available in every CodeNet-integrated environment:

#### 1. `codenet_search(query, language, limit)`

Search CodeNet for similar code examples.

**Signature:**
```typescript
function codenet_search(
  query: string,
  language: 'TypeScript' | 'JavaScript' | 'Python',
  limit: number = 5
): Promise<CodeNetExample[]>

interface CodeNetExample {
  code: string;
  patterns: string[];
  quality: number;
  similarity: number;
  source: string;
}
```

**HTTP API:**
```bash
GET /api/codenet/search?query={query}&language={language}&limit={limit}
```

**Example:**
```typescript
const examples = await codenet_search(
  'async error handling with retry',
  'TypeScript',
  5
);

console.log(examples[0]);
// {
//   code: "async function fetchData() { try { ... } catch { ... } }",
//   patterns: ["async-await", "error-handling", "retry-logic"],
//   quality: 0.95,
//   similarity: 0.89,
//   source: "codenet"
// }
```

---

#### 2. `codenet_extract_patterns(code)`

Extract coding patterns from provided code.

**Signature:**
```typescript
function codenet_extract_patterns(
  code: string
): Promise<string[]>
```

**HTTP API:**
```bash
POST /api/codenet/patterns
Content-Type: application/json

{
  "code": "your code here"
}
```

**Example:**
```typescript
const code = `
async function fetchData(): Promise<Data> {
  try {
    const result = await api.fetch();
    return result;
  } catch (error) {
    logger.error('Failed', { error });
    throw error;
  }
}
`;

const patterns = await codenet_extract_patterns(code);
console.log(patterns);
// ["async-await", "error-handling", "explicit-types", "structured-logging"]
```

---

#### 3. `codenet_validate_patterns(code, requiredPatterns)`

Validate if code implements required patterns.

**Signature:**
```typescript
function codenet_validate_patterns(
  code: string,
  requiredPatterns: string[]
): Promise<ValidationResult>

interface ValidationResult {
  valid: boolean;
  foundPatterns: string[];
  missingPatterns: string[];
  suggestions: string[];
}
```

**HTTP API:**
```bash
POST /api/codenet/validate
Content-Type: application/json

{
  "code": "your code here",
  "requiredPatterns": ["async-await", "error-handling"]
}
```

**Example:**
```typescript
const result = await codenet_validate_patterns(
  myCode,
  ['async-await', 'error-handling', 'retry-logic']
);

if (!result.valid) {
  console.error('Missing patterns:', result.missingPatterns);
  console.log('Suggestions:', result.suggestions);
}
```

---

#### 4. `codenet_generate_with_context(task, language, context?)`

Generate code using CodeNet examples as context.

**Signature:**
```typescript
function codenet_generate_with_context(
  task: string,
  language: 'TypeScript' | 'JavaScript' | 'Python',
  context?: string
): Promise<GeneratedCode>

interface GeneratedCode {
  code: string;
  patterns: string[];
  examples_used: number;
  quality_score: number;
}
```

**HTTP API:**
```bash
POST /api/codenet/generate
Content-Type: application/json

{
  "task": "implement circuit breaker pattern",
  "language": "TypeScript",
  "context": "class ApiClient { ... }"
}
```

**Example:**
```typescript
const generated = await codenet_generate_with_context(
  'Implement retry logic with exponential backoff',
  'TypeScript'
);

console.log(generated.code);
// Generated code with retry pattern based on examples
console.log(`Quality: ${generated.quality_score}`);
// Quality: 0.92
console.log(`Used ${generated.examples_used} examples`);
// Used 5 examples
```

---

#### 5. `codenet_health_check()`

Check CodeNet system health and availability.

**Signature:**
```typescript
function codenet_health_check(): Promise<HealthStatus>

interface HealthStatus {
  success: boolean;
  codenet_enabled: boolean;
  qdrant_available: boolean;
  qdrant_url: string;
  collection_status: 'green' | 'yellow' | 'red';
  vectors_count: number;
}
```

**HTTP API:**
```bash
GET /api/codenet/health
```

**Example:**
```typescript
const health = await codenet_health_check();

if (!health.codenet_enabled) {
  console.warn('CodeNet RAG is disabled');
  // Fall back to standard implementation
}

if (health.vectors_count === 0) {
  console.error('No vectors in collection - run ingestion');
}
```

---

#### 6. `codenet_get_pattern_stats()`

Get statistics about pattern usage in dataset.

**Signature:**
```typescript
function codenet_get_pattern_stats(): Promise<PatternStats>

interface PatternStats {
  total_patterns: number;
  patterns: {
    name: string;
    count: number;
    percentage: number;
    quality_avg: number;
  }[];
}
```

**HTTP API:**
```bash
GET /api/codenet/stats/patterns
```

**Example:**
```typescript
const stats = await codenet_get_pattern_stats();

stats.patterns.forEach(p => {
  console.log(`${p.name}: ${p.percentage}% (${p.count} examples)`);
});
// async-await: 82% (8200 examples)
// error-handling: 78% (7800 examples)
// retry-logic: 65% (6500 examples)
```

---

## Cursor IDE Functions

### Mandatory Functions for Cursor Integration

#### 1. `cursor_codenet_before_edit(file, position)`

Called before user starts editing code.

**Implementation Location:** `.cursor/hooks/pre-edit.ts`

```typescript
async function cursor_codenet_before_edit(
  file: string,
  position: { line: number; column: number }
): Promise<void> {
  // 1. Analyze current context
  const context = await readFileContext(file, position);
  
  // 2. Search CodeNet for relevant examples
  const examples = await codenet_search(
    context.intent || 'general pattern',
    'TypeScript',
    3
  );
  
  // 3. Display inline suggestions
  if (examples.length > 0) {
    showInlineSuggestion({
      title: 'CodeNet Patterns Available',
      examples: examples.map(e => ({
        patterns: e.patterns,
        preview: e.code.substring(0, 100)
      }))
    });
  }
}
```

**Usage in Cursor:**
```json
// .cursor/settings.json
{
  "codenet.hooks.preEdit": true,
  "codenet.inlineSuggestions": true,
  "codenet.autoQuery": true
}
```

---

#### 2. `cursor_codenet_after_edit(file, changes)`

Called after user completes code edit.

**Implementation Location:** `.cursor/hooks/post-edit.ts`

```typescript
async function cursor_codenet_after_edit(
  file: string,
  changes: CodeChange[]
): Promise<void> {
  // 1. Extract patterns from new code
  const newCode = changes.map(c => c.text).join('\n');
  const patterns = await codenet_extract_patterns(newCode);
  
  // 2. Validate against required patterns
  const requiredPatterns = await getProjectRequiredPatterns();
  const validation = await codenet_validate_patterns(newCode, requiredPatterns);
  
  // 3. Show warnings if patterns missing
  if (!validation.valid) {
    showWarning({
      message: `Missing patterns: ${validation.missingPatterns.join(', ')}`,
      suggestions: validation.suggestions,
      severity: 'warning'
    });
  }
  
  // 4. Update project pattern stats
  await updateProjectPatternStats(file, patterns);
}
```

---

#### 3. `cursor_codenet_command_palette()`

Add CodeNet commands to Cursor command palette.

**Implementation Location:** `.cursor/commands/codenet.ts`

```typescript
export const codenetCommands = [
  {
    id: 'codenet.searchExamples',
    title: 'CodeNet: Search Examples',
    async execute() {
      const query = await promptUser('Enter search query:');
      const language = await promptUser('Select language:', ['TypeScript', 'JavaScript', 'Python']);
      const examples = await codenet_search(query, language, 10);
      displayResults(examples);
    }
  },
  {
    id: 'codenet.extractPatterns',
    title: 'CodeNet: Extract Patterns from Selection',
    async execute() {
      const selection = getActiveSelection();
      const patterns = await codenet_extract_patterns(selection);
      showInfo(`Found patterns: ${patterns.join(', ')}`);
    }
  },
  {
    id: 'codenet.validateFile',
    title: 'CodeNet: Validate Current File',
    async execute() {
      const code = getActiveFileContent();
      const requiredPatterns = ['async-await', 'error-handling'];
      const result = await codenet_validate_patterns(code, requiredPatterns);
      displayValidationResults(result);
    }
  },
  {
    id: 'codenet.healthCheck',
    title: 'CodeNet: Health Check',
    async execute() {
      const health = await codenet_health_check();
      displayHealthStatus(health);
    }
  }
];
```

**Register in Cursor:**
```json
// .cursor/keybindings.json
[
  {
    "key": "ctrl+shift+c s",
    "command": "codenet.searchExamples"
  },
  {
    "key": "ctrl+shift+c p",
    "command": "codenet.extractPatterns"
  },
  {
    "key": "ctrl+shift+c v",
    "command": "codenet.validateFile"
  },
  {
    "key": "ctrl+shift+c h",
    "command": "codenet.healthCheck"
  }
]
```

---

#### 4. `cursor_codenet_autocomplete(context)`

Provide autocomplete suggestions based on CodeNet.

**Implementation Location:** `.cursor/completion/codenet-provider.ts`

```typescript
async function cursor_codenet_autocomplete(
  context: CompletionContext
): Promise<CompletionItem[]> {
  // 1. Analyze context
  const { prefix, suffix, language } = context;
  
  // 2. Search CodeNet
  const query = `${prefix} ${context.intent || 'completion'}`;
  const examples = await codenet_search(query, language, 5);
  
  // 3. Generate completion items
  const items: CompletionItem[] = examples.map(example => ({
    label: example.patterns[0],
    kind: CompletionItemKind.Snippet,
    detail: `CodeNet (${Math.round(example.similarity * 100)}% match)`,
    documentation: {
      value: `\`\`\`${language}\n${example.code}\n\`\`\`\n\nPatterns: ${example.patterns.join(', ')}\nQuality: ${example.quality}`,
      kind: 'markdown'
    },
    insertText: extractRelevantSnippet(example.code, context),
    sortText: `0_${example.similarity}` // Prioritize by similarity
  }));
  
  return items;
}

// Register provider
registerCompletionProvider(
  ['typescript', 'javascript', 'python'],
  cursor_codenet_autocomplete
);
```

---

#### 5. `cursor_codenet_diagnostics(file)`

Provide real-time diagnostics based on CodeNet patterns.

**Implementation Location:** `.cursor/diagnostics/codenet-linter.ts`

```typescript
async function cursor_codenet_diagnostics(
  file: string
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const code = await readFile(file);
  
  // 1. Extract patterns
  const patterns = await codenet_extract_patterns(code);
  
  // 2. Get required patterns for project
  const required = await getProjectRequiredPatterns();
  
  // 3. Check for missing patterns
  const missing = required.filter(p => !patterns.includes(p));
  
  for (const pattern of missing) {
    // Search for examples
    const examples = await codenet_search(pattern, 'TypeScript', 1);
    
    if (examples.length > 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: getFileRange(file),
        message: `Missing pattern: ${pattern}`,
        source: 'CodeNet',
        code: `CODENET_${pattern.toUpperCase().replace('-', '_')}`,
        relatedInformation: [{
          location: { uri: 'codenet://example', range: Range.create(0, 0, 0, 0) },
          message: `Example: ${examples[0].code.substring(0, 50)}...`
        }]
      });
    }
  }
  
  return diagnostics;
}

// Register diagnostic provider
registerDiagnosticProvider(
  ['typescript', 'javascript', 'python'],
  cursor_codenet_diagnostics
);
```

---

## Claude Desktop Functions

### Mandatory Functions for Claude Desktop Integration

#### 1. `claude_desktop_codenet_tool()`

Register CodeNet as a tool in Claude Desktop.

**Implementation Location:** `~/.claude/tools/codenet.json`

```json
{
  "name": "codenet_search",
  "description": "Search Project CodeNet for code examples and patterns",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query describing the code pattern or task"
      },
      "language": {
        "type": "string",
        "enum": ["TypeScript", "JavaScript", "Python"],
        "description": "Programming language"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of examples to return",
        "default": 5
      }
    },
    "required": ["query", "language"]
  }
}
```

**Handler Implementation:**
```typescript
// ~/.claude/tools/handlers/codenet.ts
export async function handle_codenet_search(params: {
  query: string;
  language: string;
  limit?: number;
}): Promise<string> {
  const examples = await codenet_search(
    params.query,
    params.language as any,
    params.limit || 5
  );
  
  // Format for Claude
  return examples.map((ex, i) => `
**Example ${i + 1}** (Quality: ${ex.quality}, Match: ${Math.round(ex.similarity * 100)}%)

\`\`\`${params.language.toLowerCase()}
${ex.code}
\`\`\`

**Patterns:** ${ex.patterns.join(', ')}
---
  `).join('\n');
}
```

---

#### 2. `claude_desktop_codenet_context()`

Provide CodeNet context to every Claude conversation.

**Implementation Location:** `~/.claude/context/codenet.ts`

```typescript
async function claude_desktop_codenet_context(): Promise<string> {
  const health = await codenet_health_check();
  
  if (!health.codenet_enabled) {
    return '';
  }
  
  const stats = await codenet_get_pattern_stats();
  
  return `
# CodeNet RAG Available

I have access to Project CodeNet with ${health.vectors_count.toLocaleString()} code examples.

## Top Patterns in Dataset:
${stats.patterns.slice(0, 5).map(p => 
  `- **${p.name}**: ${p.percentage}% adoption (${p.count.toLocaleString()} examples)`
).join('\n')}

## How to Use:
- Before implementing code, I will search CodeNet for similar examples
- I will apply discovered patterns to your code
- I will validate implementations against best practices

## Available Tool:
Use \`codenet_search\` tool to find examples for any coding task.
`;
}

// Register context provider
registerContextProvider('codenet', claude_desktop_codenet_context);
```

---

#### 3. `claude_desktop_codenet_validate_response()`

Validate Claude's code responses against CodeNet patterns.

**Implementation Location:** `~/.claude/validators/codenet.ts`

```typescript
async function claude_desktop_codenet_validate_response(
  response: string,
  language: string
): Promise<ValidationReport> {
  // Extract code blocks from response
  const codeBlocks = extractCodeBlocks(response, language);
  
  const report: ValidationReport = {
    valid: true,
    issues: [],
    suggestions: []
  };
  
  for (const code of codeBlocks) {
    // Extract patterns from generated code
    const patterns = await codenet_extract_patterns(code);
    
    // Get expected patterns for this type of code
    const expectedPatterns = await inferExpectedPatterns(code);
    
    // Validate
    const validation = await codenet_validate_patterns(code, expectedPatterns);
    
    if (!validation.valid) {
      report.valid = false;
      report.issues.push({
        code,
        missingPatterns: validation.missingPatterns
      });
      report.suggestions.push(...validation.suggestions);
    }
  }
  
  return report;
}

// Register validator
registerResponseValidator('code', claude_desktop_codenet_validate_response);
```

---

## Claude Code Functions

### Mandatory Functions for Claude Code CLI Integration

#### 1. `claude_code_codenet_preprocess(prompt)`

Pre-process prompts to include CodeNet context.

**Implementation Location:** `~/.claude/preprocessors/codenet.sh`

```bash
#!/bin/bash

function claude_code_codenet_preprocess() {
  local prompt="$1"
  
  # Check if CodeNet is available
  if ! curl -sf http://localhost:3001/api/codenet/health > /dev/null; then
    echo "$prompt"
    return
  fi
  
  # Extract intent from prompt
  local intent=$(echo "$prompt" | grep -oE "(implement|create|build|write|add)" | head -1)
  
  if [ -n "$intent" ]; then
    # Search CodeNet for relevant examples
    local examples=$(curl -s "http://localhost:3001/api/codenet/search?query=$(urlencode "$prompt")&language=TypeScript&limit=3" | jq -r '.examples[] | "- \(.patterns | join(", "))"')
    
    # Augment prompt
    echo "CONTEXT: CodeNet patterns available for this task:
$examples

TASK: $prompt

INSTRUCTIONS: Use the patterns above from CodeNet when implementing."
  else
    echo "$prompt"
  fi
}

export -f claude_code_codenet_preprocess
```

---

#### 2. `claude_code_codenet_postprocess(response)`

Post-process Claude Code responses to validate patterns.

**Implementation Location:** `~/.claude/postprocessors/codenet.sh`

```bash
#!/bin/bash

function claude_code_codenet_postprocess() {
  local response="$1"
  
  # Extract code blocks
  local code=$(echo "$response" | sed -n '/```typescript/,/```/p' | sed '1d;$d')
  
  if [ -z "$code" ]; then
    echo "$response"
    return
  fi
  
  # Validate patterns
  local validation=$(curl -s -X POST http://localhost:3001/api/codenet/validate \
    -H "Content-Type: application/json" \
    -d "{\"code\":$(echo "$code" | jq -Rs .), \"requiredPatterns\":[\"async-await\",\"error-handling\"]}")
  
  local valid=$(echo "$validation" | jq -r '.valid')
  
  if [ "$valid" = "false" ]; then
    local missing=$(echo "$validation" | jq -r '.missingPatterns | join(", ")')
    echo "$response

⚠️  CODENET WARNING: Missing patterns: $missing
Consider adding these patterns based on CodeNet best practices."
  else
    echo "$response

✅ CODENET VALIDATED: Code follows best practices"
  fi
}

export -f claude_code_codenet_postprocess
```

---

#### 3. `claude_code_codenet_wrapper()`

Main wrapper for Claude Code with CodeNet integration.

**Implementation Location:** `~/bin/claude-codenet`

```bash
#!/bin/bash

# Claude Code with CodeNet Integration

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check CodeNet health
function check_codenet() {
  if curl -sf http://localhost:3001/api/codenet/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ CodeNet RAG enabled${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  CodeNet RAG unavailable${NC}"
    return 1
  fi
}

# Search CodeNet
function search_codenet() {
  local query="$1"
  echo -e "${GREEN}🔍 Searching CodeNet...${NC}"
  curl -s "http://localhost:3001/api/codenet/search?query=$(echo $query | jq -sRr @uri)&language=TypeScript&limit=5" | \
    jq -r '.examples[] | "\n\u001b[1m[\(.similarity * 100 | floor)% match]\u001b[0m\n\(.code)\n\u001b[2mPatterns: \(.patterns | join(", "))\u001b[0m\n"'
}

# Main wrapper
function main() {
  echo "🧠 Claude Code + CodeNet"
  echo "========================"
  
  # Check CodeNet
  check_codenet
  codenet_available=$?
  
  if [ $# -eq 0 ]; then
    # Interactive mode
    export CODENET_AVAILABLE=$codenet_available
    claude
  else
    # Command mode
    local command="$1"
    shift
    
    case "$command" in
      search)
        search_codenet "$@"
        ;;
      validate)
        local file="$1"
        if [ -f "$file" ]; then
          curl -s -X POST http://localhost:3001/api/codenet/patterns \
            -H "Content-Type: application/json" \
            -d "{\"code\":$(cat "$file" | jq -Rs .)}" | \
            jq -r '"Patterns found: \(.patterns | join(", "))"'
        else
          echo "File not found: $file"
        fi
        ;;
      *)
        # Pass through to claude
        claude "$command" "$@"
        ;;
    esac
  fi
}

main "$@"
```

**Installation:**
```bash
# Install wrapper
chmod +x ~/bin/claude-codenet
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Use it
claude-codenet search "async retry logic"
claude-codenet validate myfile.ts
claude-codenet  # Interactive mode with CodeNet
```

---

## Universal CLI Functions

### Cross-Platform Command-Line Tools

#### 1. `codenet`

Main CLI tool for CodeNet operations.

**Installation:**
```bash
npm install -g @your-org/codenet-cli
```

**Commands:**
```bash
# Search examples
codenet search "async error handling" -l typescript -n 5

# Extract patterns from file
codenet patterns myfile.ts

# Validate file
codenet validate myfile.ts --required async-await,error-handling

# Generate code
codenet generate "implement retry logic" -l typescript

# Health check
codenet health

# Statistics
codenet stats

# Start interactive mode
codenet interactive
```

**Implementation:** `packages/codenet-cli/src/index.ts`

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import {
  codenet_search,
  codenet_extract_patterns,
  codenet_validate_patterns,
  codenet_generate_with_context,
  codenet_health_check,
  codenet_get_pattern_stats
} from './api';

const program = new Command();

program
  .name('codenet')
  .description('CodeNet RAG CLI Tool')
  .version('1.0.0');

program
  .command('search <query>')
  .description('Search for code examples')
  .option('-l, --language <lang>', 'Language', 'TypeScript')
  .option('-n, --limit <number>', 'Number of results', '5')
  .action(async (query, options) => {
    const examples = await codenet_search(query, options.language, parseInt(options.limit));
    examples.forEach((ex, i) => {
      console.log(`\n[${i + 1}] ${Math.round(ex.similarity * 100)}% match`);
      console.log(ex.code);
      console.log(`Patterns: ${ex.patterns.join(', ')}`);
      console.log(`Quality: ${ex.quality}`);
    });
  });

program
  .command('patterns <file>')
  .description('Extract patterns from file')
  .action(async (file) => {
    const code = await readFile(file);
    const patterns = await codenet_extract_patterns(code);
    console.log('Patterns found:', patterns.join(', '));
  });

program
  .command('validate <file>')
  .description('Validate file against patterns')
  .option('-r, --required <patterns>', 'Required patterns (comma-separated)')
  .action(async (file, options) => {
    const code = await readFile(file);
    const required = options.required ? options.required.split(',') : ['async-await', 'error-handling'];
    const result = await codenet_validate_patterns(code, required);
    
    if (result.valid) {
      console.log('✅ Validation passed');
    } else {
      console.log('❌ Validation failed');
      console.log('Missing patterns:', result.missingPatterns.join(', '));
      console.log('\nSuggestions:');
      result.suggestions.forEach(s => console.log(`  - ${s}`));
    }
  });

program
  .command('generate <task>')
  .description('Generate code from task description')
  .option('-l, --language <lang>', 'Language', 'TypeScript')
  .option('-c, --context <file>', 'Context file')
  .action(async (task, options) => {
    const context = options.context ? await readFile(options.context) : undefined;
    const result = await codenet_generate_with_context(task, options.language, context);
    
    console.log('Generated code:');
    console.log(result.code);
    console.log(`\nQuality: ${result.quality_score}`);
    console.log(`Examples used: ${result.examples_used}`);
    console.log(`Patterns: ${result.patterns.join(', ')}`);
  });

program
  .command('health')
  .description('Check CodeNet health')
  .action(async () => {
    const health = await codenet_health_check();
    console.log('CodeNet Status:');
    console.log(`  Enabled: ${health.codenet_enabled ? '✅' : '❌'}`);
    console.log(`  Qdrant: ${health.qdrant_available ? '✅' : '❌'}`);
    console.log(`  Collection: ${health.collection_status}`);
    console.log(`  Vectors: ${health.vectors_count.toLocaleString()}`);
  });

program
  .command('stats')
  .description('Get pattern statistics')
  .action(async () => {
    const stats = await codenet_get_pattern_stats();
    console.log(`Total patterns: ${stats.total_patterns}`);
    console.log('\nTop patterns:');
    stats.patterns.slice(0, 10).forEach(p => {
      console.log(`  ${p.name}: ${p.percentage}% (${p.count} examples, avg quality: ${p.quality_avg})`);
    });
  });

program.parse();
```

---

## Integration Examples

### Complete Workflow Example

```typescript
// 1. Before implementing new feature
async function implementNewFeature() {
  // Step 1: Check CodeNet availability
  const health = await codenet_health_check();
  if (!health.codenet_enabled) {
    console.warn('CodeNet unavailable - using fallback');
    return standardImplementation();
  }
  
  // Step 2: Search for similar implementations
  const examples = await codenet_search(
    'async API client with retry and circuit breaker',
    'TypeScript',
    5
  );
  
  console.log(`Found ${examples.length} relevant examples`);
  
  // Step 3: Analyze patterns from examples
  const patterns = new Set<string>();
  examples.forEach(ex => {
    ex.patterns.forEach(p => patterns.add(p));
  });
  
  console.log('Patterns to use:', Array.from(patterns));
  // ['async-await', 'error-handling', 'retry-logic', 'circuit-breaker', 'decorator']
  
  // Step 4: Generate implementation using context
  const generated = await codenet_generate_with_context(
    'API client with retry and circuit breaker',
    'TypeScript',
    examples.map(e => e.code).join('\n\n')
  );
  
  // Step 5: Validate generated code
  const validation = await codenet_validate_patterns(
    generated.code,
    ['async-await', 'error-handling', 'retry-logic']
  );
  
  if (!validation.valid) {
    console.error('Generated code missing patterns:', validation.missingPatterns);
    // Enhance with missing patterns
  }
  
  // Step 6: Return implementation
  return generated.code;
}
```

### CI/CD Integration Example

```yaml
# .github/workflows/codenet-validation.yml
name: CodeNet Pattern Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    
    services:
      qdrant:
        image: qdrant/qdrant:latest
        ports:
          - 6333:6333
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install CodeNet CLI
        run: npm install -g @your-org/codenet-cli
      
      - name: Start Backend
        run: |
          cd backend
          npm install
          npm run build
          npm start &
          sleep 10
      
      - name: Health Check
        run: codenet health
      
      - name: Validate Changed Files
        run: |
          for file in $(git diff --name-only origin/main...HEAD | grep -E '\.(ts|js|py)$'); do
            echo "Validating $file"
            codenet validate "$file" --required async-await,error-handling
          done
      
      - name: Generate Pattern Report
        run: |
          echo "# Pattern Compliance Report" > pattern-report.md
          for file in src/**/*.ts; do
            patterns=$(codenet patterns "$file")
            echo "- $file: $patterns" >> pattern-report.md
          done
      
      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: pattern-report
          path: pattern-report.md
```

---

## Conclusion

These mandatory functions provide a complete API for CodeNet integration across all development tools. Implement them in your environment to enable:

✅ **Consistent Code Quality** - Enforce patterns across tools  
✅ **Seamless Workflow** - Same functions everywhere  
✅ **Real-time Validation** - Immediate feedback  
✅ **Pattern Discovery** - Learn from 14M+ examples  
✅ **Automated Compliance** - CI/CD integration  

### Implementation Checklist

- [ ] Implement core 6 functions
- [ ] Add Cursor IDE integration (5 functions)
- [ ] Add Claude Desktop tools (3 functions)
- [ ] Create Claude Code wrapper (3 functions)
- [ ] Build universal CLI tool
- [ ] Add CI/CD validation
- [ ] Document for team
- [ ] Train team on usage

---

**Version**: 1.0  
**Last Updated**: October 2025  
**Maintained By**: Engineering Team  

**Questions?** Check docs/CODENET_UNIVERSAL_DEPLOYMENT_GUIDE.md

