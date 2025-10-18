# Agent types overview
_Exported on 12/10/2025 at 12:23:08 CEST from Cursor (1.7.43)_

---

**User**

/agents/agent-types 

--- Cursor Command: agents/agent-types.md ---
# agent-types

Complete guide to all 54 available agent types in Claude Flow.

## Core Development Agents
- `coder` - Implementation specialist
- `reviewer` - Code quality assurance
- `tester` - Test creation and validation
- `planner` - Strategic planning
- `researcher` - Information gathering

## Swarm Coordination Agents
- `hierarchical-coordinator` - Queen-led coordination
- `mesh-coordinator` - Peer-to-peer networks
- `adaptive-coordinator` - Dynamic topology

## Specialized Agents
- `backend-dev` - API development
- `mobile-dev` - React Native development
- `ml-developer` - Machine learning
- `system-architect` - High-level design

For full list and details:
```bash
npx claude-flow agents list
```

--- End Command ---

---

**Cursor**

# 🤖 Dostępne Typy Agentów w Claude Flow

## 📋 Pełna Lista 54 Agentów

### 🛠️ **Core Development (5 agentów)**
- `coder` - Implementacja kodu
- `reviewer` - Przegląd jakości kodu  
- `tester` - Tworzenie i walidacja testów
- `planner` - Planowanie strategiczne
- `researcher` - Zbieranie informacji

### 🕸️ **Swarm Coordination (5 agentów)**
- `hierarchical-coordinator` - Koordynacja hierarchiczna (Queen-led)
- `mesh-coordinator` - Sieć peer-to-peer
- `adaptive-coordinator` - Dynamiczna topologia
- `collective-intelligence-coordinator` - Inteligencja zbiorowa
- `swarm-memory-manager` - Zarządzanie pamięcią swarm

### 🔐 **Consensus & Distributed (7 agentów)**
- `byzantine-coordinator` - Koordynacja bizantyjska
- `raft-manager` - Zarządzanie algorytmem Raft
- `gossip-coordinator` - Koordynacja gossip
- `consensus-builder` - Budowanie konsensusu
- `crdt-synchronizer` - Synchronizacja CRDT
- `quorum-manager` - Zarządzanie kworum
- `security-manager` - Bezpieczeństwo

### ⚡ **Performance & Optimization (5 agentów)**
- `perf-analyzer` - Analiza wydajności
- `performance-benchmarker` - Benchmarking
- `task-orchestrator` - Orkiestracja zadań
- `memory-coordinator` - Koordynacja pamięci
- `smart-agent` - Inteligentny agent

### 🐙 **GitHub & Repository (9 agentów)**
- `github-modes` - Tryby GitHub
- `pr-manager` - Zarządzanie PR
- `code-review-swarm` - Swarm code review
- `issue-tracker` - Śledzenie issue
- `release-manager` - Zarządzanie release
- `workflow-automation` - Automatyzacja workflow
- `project-board-sync` - Synchronizacja project board
- `repo-architect` - Architektura repo
- `multi-repo-swarm` - Swarm multi-repo

### 📐 **SPARC Methodology (6 agentów)**
- `sparc-coord` - Koordynator SPARC
- `sparc-coder` - Koder SPARC
- `specification` - Specyfikacja
- `pseudocode` - Pseudokod
- `architecture` - Architektura
- `refinement` - Refinement

### 🎯 **Specialized Development (8 agentów)**
- `backend-dev` - Backend development
- `mobile-dev` - Mobile (React Native)
- `ml-developer` - Machine Learning
- `cicd-engineer` - CI/CD
- `api-docs` - Dokumentacja API
- `system-architect` - Architektura systemowa
- `code-analyzer` - Analiza kodu
- `base-template-generator` - Generator szablonów

### 🧪 **Testing & Validation (2 agentów)**
- `tdd-london-swarm` - TDD London style
- `production-validator` - Walidacja produkcyjna

### 🔄 **Migration & Planning (2 agentów)**
- `migration-planner` - Planowanie migracji
- `swarm-init` - Inicjalizacja swarm

---

## 📖 Więcej Informacji

```bash
# Lista wszystkich agentów
npx claude-flow agents list

# Szczegóły konkretnego agenta
npx claude-flow agents info <agent-type>

# Dostępne tryby
npx claude-flow sparc modes
```

```shellscript
# Lista wszystkich agentów
npx claude-flow agents list

# Szczegóły konkretnego agenta
npx claude-flow agents info <agent-type>

# Dostępne tryby
npx claude-flow sparc modes
```

---

**User**

npx claude-flow sparc modes

---

**Cursor**

Brak konfiguracji SPARC. Inicjalizuję teraz:

# ✨ Tryby SPARC w Claude Flow

## 📋 17 Dostępnych Trybów SPARC

### 🎯 **Core Orchestration Modes** (Tryby Orkiestracji)
- **orchestrator** - Orkiestracja zadań multi-agent
- **swarm-coordinator** - Zarządzanie wyspecjalizowanym swarm
- **workflow-manager** - Automatyzacja procesów
- **batch-executor** - Równoległe wykonywanie zadań

### 💻 **Development Modes** (Tryby Deweloperskie)
- **coder** - Autonomiczne generowanie kodu
- **architect** - Projektowanie systemów
- **reviewer** - Przegląd kodu
- **tdd** - Test-Driven Development

### 🔍 **Analysis and Research Modes** (Analiza i Research)
- **researcher** - Zaawansowane możliwości badawcze
- **analyzer** - Analiza kodu i danych
- **optimizer** - Optymalizacja wydajności

### 🎨 **Creative and Support Modes** (Tryby Kreatywne i Wsparcie)
- **designer** - UI/UX design
- **innovator** - Kreatywne rozwiązywanie problemów
- **documenter** - Generowanie dokumentacji
- **debugger** - Systematyczne debugowanie
- **tester** - Kompleksowe testowanie
- **memory-manager** - Zarządzanie wiedzą

---

## 🚀 Użycie

### **Opcja 1: MCP Tools (Zalecane w Claude Code)**

```javascript
// Uruchom tryb SPARC bezpośrednio
mcp__claude-flow__sparc_mode {
  mode: "coder",
  task_description: "implement user authentication",
  options: {}
}

// Inicjalizuj swarm dla zaawansowanej koordynacji
mcp__claude-flow__swarm_init {
  topology: "hierarchical",
  strategy: "auto",
  maxAgents: 8
}
```

### **Opcja 2: NPX CLI (Fallback)**

```bash
# Uruchom tryb SPARC
npx claude-flow sparc run <mode> "task description"

# Wersja alpha
npx claude-flow@alpha sparc run <mode> "task description"

# Lista wszystkich trybów
npx claude-flow sparc modes

# Pomoc dla trybu
npx claude-flow sparc help <mode>
```

### **Opcja 3: Lokalna Instalacja**

```bash
./claude-flow sparc run <mode> "task description"
```

---

## 📚 Typowe Workflow

### **Pełny Cykl Developerski (MCP)**

```javascript
// 1. Inicjalizacja swarm
mcp__claude-flow__swarm_init {
  topology: "hierarchical",
  maxAgents: 12
}

// 2. Projektowanie architektury
mcp__claude-flow__sparc_mode {
  mode: "architect",
  task_description: "design microservices"
}

// 3. Implementacja
mcp__claude-flow__sparc_mode {
  mode: "coder",
  task_description: "implement services"
}

// 4. Testowanie
mcp__claude-flow__sparc_mode {
  mode: "tdd",
  task_description: "test all services"
}

// 5. Review
mcp__claude-flow__sparc_mode {
  mode: "reviewer",
  task_description: "review implementation"
}
```

### **Research & Innovation (CLI)**

```bash
# 1. Faza badawcza
npx claude-flow sparc run researcher "research best practices"

# 2. Innowacja
npx claude-flow sparc run innovator "propose novel solutions"

# 3. Dokumentacja
npx claude-flow sparc run documenter "document findings"
```

---

## 💡 Ważne Informacje

✅ **MCP Tools są preferowaną metodą** w Claude Code  
✅ **NPX CLI działa jako fallback** gdy MCP niedostępne  
✅ **17 wyspecjalizowanych trybów** dla różnych potrzeb  
✅ **Integracja z systemem swarm** dla zaawansowanej koordynacji

```javascript
// Uruchom tryb SPARC bezpośrednio
mcp__claude-flow__sparc_mode {
  mode: "coder",
  task_description: "implement user authentication",
  options: {}
}

// Inicjalizuj swarm dla zaawansowanej koordynacji
mcp__claude-flow__swarm_init {
  topology: "hierarchical",
  strategy: "auto",
  maxAgents: 8
}
```

```shellscript
# Uruchom tryb SPARC
npx claude-flow sparc run <mode> "task description"

# Wersja alpha
npx claude-flow@alpha sparc run <mode> "task description"

# Lista wszystkich trybów
npx claude-flow sparc modes

# Pomoc dla trybu
npx claude-flow sparc help <mode>
```

```shellscript
./claude-flow sparc run <mode> "task description"
```

```javascript
// 1. Inicjalizacja swarm
mcp__claude-flow__swarm_init {
  topology: "hierarchical",
  maxAgents: 12
}

// 2. Projektowanie architektury
mcp__claude-flow__sparc_mode {
  mode: "architect",
  task_description: "design microservices"
}

// 3. Implementacja
mcp__claude-flow__sparc_mode {
  mode: "coder",
  task_description: "implement services"
}

// 4. Testowanie
mcp__claude-flow__sparc_mode {
  mode: "tdd",
  task_description: "test all services"
}

// 5. Review
mcp__claude-flow__sparc_mode {
  mode: "reviewer",
  task_description: "review implementation"
}
```

```shellscript
# 1. Faza badawcza
npx claude-flow sparc run researcher "research best practices"

# 2. Innowacja
npx claude-flow sparc run innovator "propose novel solutions"

# 3. Dokumentacja
npx claude-flow sparc run documenter "document findings"
```

