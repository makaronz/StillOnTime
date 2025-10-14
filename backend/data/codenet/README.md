# Project CodeNet Integration - Dataset Management

This directory contains the Project CodeNet dataset used for RAG (Retrieval-Augmented Generation) to enhance AI code generation capabilities in StillOnTime.

## Directory Structure

```
codenet/
├── metadata/           # CSV files from Project CodeNet
│   └── submissions.csv # Submission metadata
├── javascript/         # JavaScript source files
│   └── s*.js          # Individual submissions
├── typescript/         # TypeScript source files
│   └── s*.ts          # Individual submissions
├── python/            # Python source files
│   └── s*.py          # Individual submissions
└── preprocessed/      # Processed documents ready for Qdrant
    └── s*.json        # Document JSON files with embeddings
```

## Dataset Workflow

### 1. Download Dataset

Download and filter Project CodeNet submissions:

```bash
npm run codenet:download
# or
npm run codenet:download -- --limit 1000
```

**What it does:**
- Downloads metadata from IBM DAX (or uses mock data for PoC)
- Filters for TypeScript, JavaScript, Python submissions
- Only includes "Accepted" status
- Filters by code size (50-500 lines)
- Creates directory structure

**Output:** Source files in `javascript/`, `typescript/`, `python/`

### 2. Preprocess Dataset

Process source files and generate embeddings:

```bash
npm run codenet:preprocess
```

**What it does:**
- Reads all downloaded source files
- Extracts metadata:
  - Functions and imports
  - Code patterns (async-await, error-handling, etc.)
  - Concepts (recursion, sorting, etc.)
  - Comments and quality metrics
- Generates OpenAI embeddings (ada-002)
- Calculates quality scores
- Saves to `preprocessed/` directory

**Requirements:**
- OpenAI API key configured in `.env`
- Downloaded source files present

**Output:** JSON documents in `preprocessed/`

### 3. Ingest to Qdrant

Upload preprocessed documents to Qdrant vector database:

```bash
npm run codenet:ingest
```

**What it does:**
- Initializes Qdrant collection
- Loads preprocessed documents
- Generates embeddings if missing
- Uploads in batches (1000 docs/batch)
- Creates searchable vector index

**Requirements:**
- Qdrant running (via Docker Compose)
- Preprocessed documents available
- OpenAI API key configured

**Output:** Searchable vector database in Qdrant

### 4. Generate Patterns Documentation

Extract patterns and generate systemPatterns.md:

```bash
npm run codenet:patterns
```

**What it does:**
- Analyzes top 1000 documents
- Identifies common patterns
- Calculates pattern frequency
- Generates markdown documentation
- Outputs to `coordination/orchestration/systemPatterns.md`

**Output:** Pattern documentation file

## Complete Setup (First Time)

Run all steps in sequence:

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Download dataset (mock data for PoC)
npm run codenet:download

# 3. Preprocess files
npm run codenet:preprocess

# 4. Ingest to Qdrant
npm run codenet:ingest

# 5. Generate patterns
npm run codenet:patterns

# 6. Enable RAG in environment
# Set CODENET_ENABLE_RAG=true in .env
```

## Configuration

Environment variables (`.env`):

```bash
# Qdrant Vector Database
QDRANT_URL=http://localhost:6333

# OpenAI API (required for embeddings and generation)
OPENAI_API_KEY=sk-your-api-key-here

# CodeNet Dataset Configuration
CODENET_DATASET_PATH=/app/data/codenet
CODENET_MAX_EXAMPLES=10000
CODENET_ENABLE_RAG=true  # Enable after dataset ingestion
```

## API Endpoints

Once ingestion is complete, use these endpoints:

### Search Similar Code

```bash
GET /api/codenet/search?query=async error handling&language=TypeScript&limit=5
```

### Generate Code with Context

```bash
POST /api/codenet/generate
Content-Type: application/json

{
  "task": "Implement retry logic with exponential backoff",
  "language": "TypeScript",
  "existingCode": "// optional context"
}
```

### Get Code Patterns

```bash
GET /api/codenet/patterns?codeContext=async function fetchData()...
```

### Dataset Statistics

```bash
GET /api/codenet/stats
```

### Health Check

```bash
GET /api/codenet/health
```

## Dataset Statistics (PoC)

After mock dataset ingestion:

- **Total Documents**: ~10,000 (configurable)
- **Languages**: 
  - TypeScript: ~3,333 submissions
  - JavaScript: ~3,333 submissions
  - Python: ~3,334 submissions
- **Average Quality Score**: 0.65
- **Top Patterns**:
  - async-await
  - error-handling
  - functional-programming
  - promises

## Production Considerations

### For Real Project CodeNet Integration

1. **Download Real Dataset**:
   - Access IBM DAX: https://dax-cdn.cdn.appdomain.cloud/dax-project-codenet/1.0.0
   - Download metadata CSVs
   - Download source code archives
   - Total size: ~7GB compressed

2. **Filtering Strategy**:
   - Start with 1,000-10,000 examples
   - Focus on high-quality submissions
   - Filter by complexity and readability
   - Deduplicate similar solutions

3. **Cost Management**:
   - OpenAI embedding costs: ~$0.0001 per document
   - For 10,000 documents: ~$1.00
   - Cache embeddings locally
   - Use batch processing

4. **Performance Optimization**:
   - Batch embedding generation
   - Parallel processing
   - Redis caching for frequent queries
   - Qdrant index optimization

## Troubleshooting

### "OpenAI API key not configured"

Set `OPENAI_API_KEY` in `.env` file.

### "Qdrant connection failed"

Ensure Qdrant container is running:
```bash
docker-compose ps | grep qdrant
docker-compose logs qdrant
```

### "No documents to ingest"

Run preprocessing first:
```bash
npm run codenet:preprocess
```

### Large dataset causing timeout

Reduce `CODENET_MAX_EXAMPLES` or process in smaller batches.

## References

- **Project CodeNet**: https://github.com/IBM/Project_CodeNet
- **Research Paper**: https://arxiv.org/abs/2105.12655
- **IBM DAX Dataset**: https://developer.ibm.com/exchanges/data/all/project-codenet/
- **Qdrant Docs**: https://qdrant.tech/documentation/
- **LangChain**: https://js.langchain.com/docs/

## Maintenance

### Weekly Updates

1. Download new submissions
2. Preprocess and ingest
3. Regenerate patterns documentation
4. Monitor quality metrics

### Cleanup

Remove old/low-quality examples:
```bash
# TODO: Add cleanup script
```

---

**Last Updated**: 2025-10-14
**Version**: 1.0.0 (PoC)

