# Civic Intelligence

AI-powered infrastructure planning platform

Built for the Google Build with AI: Code for Communities hackathon. The intended platform will analyse multilingual citizen development requests alongside demographic and infrastructure data to identify infrastructure gaps and demand hotspots for policymakers.

## Current scope

This repository contains the application scaffold and first database layer:

- React + Vite frontend in JavaScript, using React Router and plain CSS.
- One Home page with the project name and tagline.
- Node.js + Express API with dotenv, cors, JSON parsing, and centralized error handling.
- Prisma ORM configured for MySQL with District, CitizenRequest, and InfrastructureMetric models.
- Read-only district, citizen request, and infrastructure endpoints.
- Clearly fictional demo fixtures for eight Karnataka districts.
- Backend HTTP tests using Node's built-in test runner.

Gemini, Google Maps, authentication, dashboards, and Google Cloud deployment are deferred.

## Requirements

- Node.js 22.12 or newer (verified locally with Node.js 24.14.0) and npm.
- MySQL 8 for migrations, seeding, and district endpoints. It is not required to run the Home page, health endpoint, mocked HTTP tests, or schema validation.

## Structure

```text
frontend/
  src/
    components/      # Reserved for reusable components
    pages/           # Home page
    services/        # Reserved for API calls
    App.jsx          # Routes
    main.jsx         # React entry point
    styles.css       # Minimal plain CSS
  .env.example
  index.html
  vite.config.js
  package.json
backend/
  prisma/
    schema.prisma    # MySQL models, enums, indexes, and relationships
    migrations/      # Versioned SQL migrations
    demoData.js       # Fictional demo fixtures; replace before real-world use
    seed.js           # Repeatable demo seed
  src/
    config/          # Shared Prisma client
    controllers/     # HTTP request and response handling
    middleware/      # Centralized error handling
    routes/          # Endpoint definitions
    services/        # Business logic and future database operations
    validators/      # Numeric district ID validation
    app.js           # Express configuration, without listening on a port
    server.js        # Environment loading and server startup
  tests/
  .env.example
  package.json
AGENTS.md
.gitignore
README.md
```

Each app has its own `package.json` and lockfile. Run its npm commands from that app's directory. Empty reserved directories use `.gitkeep` files so Git preserves the proposed structure.

The backend separates routes, controllers, and services so HTTP concerns stay out of business logic. Separating `app.js` from `server.js` lets tests start the app on a temporary port. Prisma 6 is deliberately used for the simple JavaScript client and schema-based MySQL connection configuration, without an additional driver adapter.

## Install and configure

From the project root, using PowerShell:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
cd ../backend
npm ci
Copy-Item .env.example .env
cd ..
```

Run the copy commands only when creating your local environment files; do not overwrite an existing configuration. The backend example contains:

```dotenv
PORT=3000
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/civic_intelligence"
```

Replace the database placeholders in your local `backend/.env` with your MySQL credentials. The health endpoint does not query MySQL. Local `.env` files are ignored by Git; commit only placeholder examples. Frontend `VITE_` variables are public browser configuration and must never contain secrets. `VITE_API_URL` is provided for later API calls and is not consumed by the Home page.

From `backend/`, apply the committed migration, generate the client, and seed:

```powershell
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
```

For future schema changes, `npm run prisma:migrate -- --name descriptive_name` creates and applies a development migration. Prisma may require permission to create a shadow database for that command. Do not reset a database containing data you need.

## Database layer and demo data

The initial migration is `20260921123312_initial_database_layer`. A district's name is unique within its state. Requests and metrics have indexed district foreign keys; deleting a district with related records is restricted. Requests use a MySQL `TEXT` column and enums for channel, category, and urgency. The tables use `utf8mb4` to preserve multilingual text.

The seed creates eight Karnataka districts: Bengaluru Urban, Bengaluru Rural, Mysuru, Mandya, Tumakuru, Hassan, Kolar, and Ramanagara. A fresh database receives **8 districts, 32 citizen requests (4 per district), and 8 infrastructure metrics (1 per district)**.

**Every seeded population and water coverage value is fictional DEMO data, not Census data or any official dataset. Replace these fixtures before real-world planning.** The requests are invented English, Kannada, and Hindi examples and each has a `[DEMO ONLY ...]` prefix. All metrics use `TAP_WATER_COVERAGE`, unit `percent`, and an explicitly fictional demo source; their source year is illustrative too. Coordinates are left null rather than invented.

Run the seed serially, not concurrently. It uses a transaction, preserves existing districts, and inserts only missing demo requests and metrics, so sequential reruns do not duplicate these fixtures or delete other records. It does not overwrite existing populations or refresh existing demo values when fixture values change. Its printed totals describe the demo set ensured, not newly inserted rows or the entire database.

## Read-only district endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/districts` | Districts sorted by name and state |
| GET | `/api/districts/:id` | One district |
| GET | `/api/districts/:id/requests` | That district's requests, newest first |
| GET | `/api/districts/:id/infrastructure` | That district's infrastructure metrics |

Successful district responses use `{ "success": true, "data": ... }`. Collections return arrays, including an empty array when an existing district has no matching records. IDs must be positive decimal integers without leading zeros and within the MySQL signed Int range. Invalid IDs return HTTP 400, and unknown districts return HTTP 404 on all three ID-based routes. Database failures go through the centralized handler and return a generic HTTP 500 without exposing Prisma details. No write endpoints or frontend data pages are implemented.

## Run locally

In one terminal:

```powershell
cd backend
npm run dev
```

The API defaults to `http://localhost:3000`. Use `npm start` to run without watching files.

In a second terminal:

```powershell
cd frontend
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Health endpoint

`GET http://localhost:3000/api/health` returns HTTP 200:

```json
{
  "success": true,
  "message": "Civic Intelligence API is running"
}
```

To check it from PowerShell while the backend is running:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

This checks that the API is running; it does not check MySQL connectivity. The endpoint accepts no user inputs. JSON parsing rejects malformed or oversized bodies, and future input-bearing endpoints must add explicit validation.

Unknown routes return a JSON 404. The centralized error handler returns safe JSON messages without exposing internal error details. CORS uses its default permissive configuration for local development; configure the intended frontend origin when deployment is requested.

## Checks

```powershell
cd backend
npm test
npm run prisma:format
npm run prisma:validate
cd ../frontend
npm run build
```

Schema validation requires `DATABASE_URL` to be defined; the placeholder in your local backend `.env` is sufficient because validation does not connect to MySQL. Generate Prisma Client before running the tests on a fresh checkout. Tests start and close their own local HTTP server and mock database queries, so no MySQL connection is required. Coverage includes district reads, empty collections, invalid IDs, unknown districts, hidden database errors, unavailable write endpoints, and the original health/middleware behavior.

The frontend build is written to ignored `frontend/dist/`. Use `npm run preview` from `frontend/` to preview that build locally.

The first database layer was verified with Prisma format/validate, migration application, client generation, two seed runs, and all 21 backend tests. Additional live HTTP checks against MySQL confirmed all district reads, exact seed counts, multilingual text preservation, invalid/missing IDs, and health. An initial Node test-mock incompatibility with Prisma proxy methods was fixed before the passing run.

## Initial verification and known issues

- Dependencies were installed for both apps and locked in their respective `package-lock.json` files.
- All three backend HTTP tests passed, including the exact health endpoint response.
- Prisma validated the model-free MySQL schema using a process-local placeholder URL; no database connection was made.
- The frontend production build passed.
- Git ignore checks confirmed local environment files, dependencies, build output, logs, and editor settings are ignored, while `.env.example` files remain eligible for version control.
- Initial npm registry lookups failed with `ENOTCACHED` because the execution environment defaulted to offline mode. Online access resolved this.
- Initial test/build attempts hit sandbox `spawn EPERM` errors, and Prisma's engine download hit `ECONNREFUSED`. Rerunning with the necessary execution/network permissions succeeded.
- At installation, the frontend audit reported zero vulnerabilities. The backend audit reported three high-severity findings along the `prisma` -> `@prisma/config` -> `deepmerge-ts` dependency chain, arising from [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). This remains unresolved. npm suggested downgrading Prisma to 6.12.0; no forced downgrade or unverified transitive override was applied.
