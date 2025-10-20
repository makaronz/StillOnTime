# Analiza Struktury .claude/ i Dostępne Komendy Claude-Flow

## Struktura Folderów .claude/

### 1. agents/
Zawiera definicje 54+ wyspecjalizowanych agentów AI podzielonych na kategorie:
- **core/**: podstawowi agenci (coder, planner, researcher, reviewer, tester)
- **architecture/**: agenci do projektowania systemów
- **consensus/**: agenci do koordynacji rozproszonej
- **github/**: agenci do integracji z GitHub
- **sparc/**: agenci do metodologii SPARC
- **swarm/**: koordynatory roju
- **flow-nexus/**: agenci chmurowi

### 2. commands/
Zawiera definicje komend podzielone na kategorie:
- **agents/**: zarządzanie agentami
- **analysis/**: narzędzia analityczne
- **automation/**: automatyzacja zadań
- **coordination/**: koordynacja agentów
- **github/**: integracja z GitHub
- **memory/**: zarządzanie pamięcią systemu
- **monitoring/**: monitorowanie systemu
- **optimization/**: optymalizacja wydajności
- **sparc/**: komendy SPARC (17 trybów)
- **swarm/**: zarządzanie rojem agentów
- **workflows/**: zarządzanie przepływami pracy

### 3. Konfiguracja
- **config.json**: konfiguracja SPARC i swarm
- **settings.json**: ustawienia środowiska, uprawnienia, hooks
- **system-prompts/**: systemowe prompty dla przepływów pracy

## Faktycznie Dostępne Komendy Claude-Flow

### Komendy Główne

1. **`npx claude-flow swarm <objective> [options]`**
   - Główne polecenie orkiestracji roju
   - Opcje: --strategy, --mode, --max-agents, --claude, --parallel

2. **`npx claude-flow sparc run <mode> "task"`**
   - Uruchomienie trybu SPARC (dostępne tryby: coder, tdd, architect, researcher, itd.)
   - 17 wyspecjalizowanych trybów

3. **`npx claude-flow analyze`**
   - Analiza spójności i jakości specyfikacji
   - Działa na plikach spec.md, plan.md, tasks.md

4. **`npx claude-flow specify <feature-description>`**
   - Tworzenie specyfikacji funkcji z opisu naturalnego

5. **`npx claude-flow plan [details]`**
   - Generowanie planu implementacji

6. **`npx claude-flow tasks [context]`**
   - Generowanie zadań do wykonania

7. **`npx claude-flow implement`**
   - Wykonanie planu implementacji

8. **`npx claude-flow refactor-code [target]`**
   - Inteligentna refaktoryzacja kodu

9. **`npx claude-flow code-review [file|commit|--full]`**
   - Kompleksowa recenzja kodu

### Komendy Koordynacji

10. **`npx claude-flow swarm init [options]`**
    - Inicjalizacja roju agentów
    - Opcje: --topology, --max-agents, --strategy, --auto-spawn

11. **`npx claude-flow automation smart-spawn [options]`**
    - Inteligentne uruchamianie agentów
    - Opcje: --analyze, --threshold, --topology

12. **`npx claude-flow task orchestrate`**
    - Koordynacja wykonania zadań

13. **`npx claude-flow agent spawn`**
    - Tworzenie agentów

### Komendy Analityczne

14. **`npx claude-flow bottleneck detect [options]`**
    - Wykrywanie wąskich gardeł wydajności
    - Opcje: --swarm-id, --time-range, --threshold, --export, --fix

15. **`npx claude-flow performance report`**
    - Raport wydajności

16. **`npx claude-flow token usage`**
    - Analiza zużycia tokenów

### Komendy Pamięci

17. **`npx claude-flow memory usage [options]`**
    - Zarządzanie pamięcią trwałą
    - Opcje: --action, --key, --value

18. **`npx claude-flow memory search`**
    - Wyszukiwanie w pamięci

19. **`npx claude-flow memory persist`**
    - Utrwalanie pamięci

### Komendy GitHub

20. **`npx claude-flow github swarm [options]`**
    - Specjalizowany rój dla zarządzania repozytorium GitHub
    - Opcje: --repository, --agents, --focus, --auto-pr, --issue-labels

21. **`npx claude-flow repo analyze`**
    - Głęboka analiza repozytorium

22. **`npx claude-flow pr enhance`**
    - Ulepszanie pull requestów

23. **`npx claude-flow issue triage`**
    - Zarządzanie issue'ami

### Komendy Weryfikacji

24. **`npx claude-flow verify check [options]`**
    - Weryfikacja kodu, zadań lub wyników agentów
    - Opcje: --file, --task, --directory, --threshold, --auto-fix, --json

25. **`npx claude-flow verify start`**
    - Uruchomienie weryfikacji

### Komendy Hive-Mind

26. **`npx claude-flow hive-mind [subcommand]`**
    - System kolektywnej inteligencji
    - Podkomendy: init, spawn, status, resume, stop

27. **`npx claude-flow hive-mind init`**
    - Inicjalizacja hive-mind

28. **`npx claude-flow hive-mind spawn "task"`**
    - Uruchomienie roju hive-mind

### Komendy Przepływów Pracy

29. **`npx claude-flow workflow execute [options]`**
    - Wykonywanie zapisanych przepływów pracy
    - Opcje: --name, --params, --dry-run

30. **`npx claude-flow workflow create`**
    - Tworzenie przepływów pracy

## Przykłady Użycia dla Projektu StillOnTime

### Analiza i Planowanie
```bash
# Analiza specyfikacji
npx claude-flow analyze

# Stworzenie specyfikacji nowej funkcji
npx claude-flow specify "Integracja z kalendarzem Google dla planowania filmowego"

# Planowanie implementacji
npx claude-flow plan --details "Użyć OAuth2 i Google Calendar API"

# Generowanie zadań
npx claude-flow tasks --context "Backend TypeScript, React frontend"
```

### Implementacja z Agentami
```bash
# Inicjalizacja roju agentów
npx claude-flow swarm init --topology hierarchical --max-agents 8

# Uruchomienie zadania z agentami
npx claude-flow swarm "Zaimplementować integrację z Google Calendar" --strategy development

# Implementacja z trybem SPARC
npx claude-flow sparc run coder "Implement OAuth2 authentication service"
npx claude-flow sparc run tdd "Create tests for calendar integration"
```

### Analiza i Optymalizacja
```bash
# Wykrywanie wąskich gardeł
npx claude-flow bottleneck detect --time-range 24h --export bottlenecks.json

# Recenzja kodu
npx claude-flow code-review --full

# Weryfikacja kodu
npx claude-flow verify check --directory backend/src --threshold 0.95
```

### Praca z GitHub
```bash
# Analiza repozytorium
npx claude-flow repo analyze

# Swarm do zarządzania GitHub
npx claude-flow github swarm --repository arkadiuszfudali/StillOnTime --focus development
```

## Integracja z MCP Tools

Claude-Flow może być używany z narzędziami MCP (Model Context Protocol) w Claude Code:

```javascript
// Inicjalizacja roju
mcp__claude-flow__swarm_init { 
  topology: "hierarchical", 
  maxAgents: 8 
}

// Uruchomienie agenta
mcp__claude-flow__agent_spawn { 
  type: "coder", 
  capabilities: ["typescript", "react"] 
}

// Tryb SPARC
mcp__claude-flow__sparc_mode { 
  mode: "coder", 
  task_description: "implement authentication" 
}
```

## Podsumowanie

Claude-Flow oferuje 30 głównych komend podzielonych na kategorie, które umożliwiają:
- Analizę kodu i projektu
- Koordynację agentów AI
- Automatyzację zadań deweloperskich
- Integrację z GitHub
- Zarządzanie pamięcią systemową
- Monitorowanie i optymalizację wydajności

Te komendy są faktycznie dostępne w Claude-Flow i mogą być wykorzystane do analizy, naprawy i uruchomienia aplikacji w repozytorium StillOnTime.
