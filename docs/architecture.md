# Architecture Overview

## Runtime Model

The application is a single Node.js process serving both JSON APIs and static frontend assets.

- `server.js`: process entrypoint
- `backend/app.js`: Express app composition
- `backend/database.js`: SQLite bootstrap and schema creation

## Backend Layers

### HTTP Layer

Route handlers are intentionally thin and should only do three things:

1. Parse request input.
2. Delegate to a service.
3. Send a response or surface an HTTP error.

Shared HTTP helpers live in `backend/lib/http.js`.

### Service Layer

Business logic belongs in `backend/services/`.

- `dashboard-service.js`: aggregate dashboard metrics
- `patient-service.js`: patient queries and summaries
- `validation-service.js`: Tier 1 and Tier 2 validation orchestration
- `fhir-service.js`: FHIR bundle generation and persistence
- `medical-record-service.js`: transactional record ingestion
- `agent-service.js`: AI chat request normalization

### Validation Tiers

- Tier 1: deterministic data-quality rules in `backend/tier1/`
- Tier 2: clinical-note extraction and contradiction detection in `backend/tier2/`
- Tier 3: FHIR resource and bundle generation in `backend/tier3/`

## Frontend Structure

The frontend is a multi-page static app under `public/`.

- `dashboard.html`: operational overview
- `patients.html`: patient list
- `patient-detail.html`: patient deep dive
- `medical-record.html`: structured record entry
- `agent.html`: standalone AI chat page

Shared browser logic lives in `public/js/`.

- `api.js`: fetch helpers and shared rendering utilities
- `layout.js`: navigation shell, search, toast, shortcuts
- `copilot.js`: slide-in contextual AI assistant
- page-specific files: `dashboard.js`, `patients.js`, `patient-detail.js`, `medical-record.js`, `agent.js`

## Project Layout

```
server.js                   # Process entrypoint
web.config                  # IIS reverse-proxy config (Azure)
backend/
  app.js                    # Express app composition
  config.js                 # Port / env config
  database.js               # SQLite bootstrap & schema
  agent/                    # Groq-backed AI chat logic
  data/                     # Seed & synthetic data generators
  lib/                      # Shared utility modules
  routes/                   # Thin HTTP route handlers
  services/                 # Business-logic layer
  tier1/                    # Deterministic validation rules
  tier2/                    # NLP + contradiction detection
  tier3/                    # FHIR bundle generation
public/
  *.html                    # Multi-page static frontend
  css/style.css             # Single stylesheet
  js/                       # Shared & page-specific browser scripts
  locales/                  # i18n JSON files (en, vi)
icons/
  outline/                  # ~60 Tabler outline SVGs (used icons only)
data/
  careai.db                 # Runtime SQLite database (gitignored)
docs/
  architecture.md           # This file
  reference/                # Research notes, chat logs, papers
scripts/
  smoke-check.js            # End-to-end smoke test
```

## Engineering Conventions

- Keep route handlers thin.
- Prefer small helper functions over deeply nested route logic.
- Keep database statements close to the service that owns the workflow.
- Use `yarn lint` and `yarn smoke` before merging larger changes.
- Preserve current API response shapes unless a coordinated frontend update is part of the change.

## Practical Next Steps

If the project continues to grow, the next upgrades should be:

1. Move browser globals toward ES modules.
2. Add persistence-aware validation refresh for Tier 1 and Tier 2 alerts.
3. Add focused automated tests for service modules.
