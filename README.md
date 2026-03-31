# CareAI

CareAI is a pediatric nutrition data-quality workbench built with Node.js, Express, SQLite, and a static browser client. It validates anthropometric and lab data, cross-checks clinical notes, and exports validated records as FHIR bundles.

## Stack

- Backend: Node.js + Express + better-sqlite3
- Frontend: static HTML, CSS, and browser JavaScript
- Validation engine: rule-based Tier 1, NLP-assisted Tier 2, FHIR Tier 3
- AI assistant: Groq-backed chat with fallback mode when no API key is configured

## Quick Start

```bash
yarn install
yarn seed
yarn dev
```

Open `http://localhost:3008/login.html`.

Demo credentials:

- Username: `admin`
- Password: `admin`

## Available Scripts

- `yarn start`: start the production server
- `yarn dev`: start the server in watch mode
- `yarn seed`: seed the SQLite database with synthetic pediatric cases
- `yarn lint`: run ESLint across backend and frontend scripts
- `yarn lint:fix`: auto-fix lint issues where safe
- `yarn smoke`: run an end-to-end smoke check against an ephemeral app instance
- `yarn check`: run lint plus smoke verification

## Project Layout

```text
server.js              Process entrypoint
web.config             IIS reverse-proxy config (Azure)

backend/
  app.js               Express bootstrap
  config.js            Runtime configuration and thresholds
  database.js          SQLite connection and schema setup
  routes/              Thin HTTP route handlers
  services/            Business logic and orchestration
  lib/                 Shared utility modules
  tier1/               Rule-based validators
  tier2/               NLP and contradiction detection
  tier3/               FHIR bundle generation
  agent/               AI assistant integration
  data/                Seed and synthetic dataset generation

public/
  *.html               App screens
  css/                 UI styling
  js/                  Browser-side application logic
  locales/             Translation files (en, vi)

icons/outline/         Tabler outline SVGs (used icons only)
data/                  Runtime SQLite database (gitignored)
scripts/               Smoke-check and tooling scripts
docs/
  architecture.md      System overview and conventions
  reference/           Research notes, chat logs, papers
```

## HTTP Endpoints

- `GET /healthz`: application health check
- `GET /api/dashboard/stats`: dashboard aggregates
- `GET /api/dashboard/recent-alerts`: latest active alerts
- `GET /api/patients`: patient list with filters
- `GET /api/patients/:id`: patient detail
- `GET /api/validation/:patientId`: recompute validation summary for a patient
- `GET /api/fhir/:patientId`: generate FHIR bundle
- `POST /api/agent/chat`: AI assistant endpoint
- `POST /api/medical-record`: save a structured medical record payload

## Environment

Supported environment variables:

- `PORT`: HTTP port, defaults to `3008`
- `DB_PATH`: SQLite file path, defaults to `./data/careai.db`
- `GROQ_API_KEY`: optional API key for the AI assistant

## Development Notes

- The app uses SQLite and creates the schema automatically on startup.
- The frontend is intentionally static and loaded directly from `public/`.
- Validation recomputation currently updates the UI immediately and is designed as a read/review flow.
- Use `yarn check` before shipping changes.

## Documentation

- See [docs/architecture.md](docs/architecture.md) for the current architecture and engineering conventions.
