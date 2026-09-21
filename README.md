# Civic Intelligence

AI-powered infrastructure planning platform

Built for the Google Build with AI: Code for Communities hackathon. The intended platform will analyse multilingual citizen development requests alongside demographic and infrastructure data to identify infrastructure gaps and demand hotspots for policymakers.

## Current scope

This repository contains the initial scaffold only:

- React + Vite frontend in JavaScript, using React Router and plain CSS.
- One Home page with the project name and tagline.
- Node.js + Express API with dotenv, cors, JSON parsing, and centralized error handling.
- Prisma ORM configured for MySQL, with no models or database queries.
- Backend HTTP tests using Node's built-in test runner.

Gemini, Google Maps, authentication, dashboards, and Google Cloud deployment are deferred.

## Requirements

- Node.js 22.12 or newer (verified locally with Node.js 24.14.0) and npm.
- MySQL will be needed when database features are added. It is not required to run the Home page, health endpoint, tests, or schema validation.

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
    schema.prisma    # MySQL datasource and client generator; no models
    migrations/      # Reserved; no migrations yet
  src/
    config/          # Reserved for configuration helpers
    controllers/     # HTTP request and response handling
    middleware/      # Centralized error handling
    routes/          # Endpoint definitions
    services/        # Business logic and future database operations
    validators/      # Reserved for future API input validation
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

Replace the database placeholders locally when database work begins. The health endpoint does not use `DATABASE_URL`. Local `.env` files are ignored by Git; commit only placeholder examples. Frontend `VITE_` variables are public browser configuration and must never contain secrets. `VITE_API_URL` is provided for later API calls and is not consumed by the Home page.

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
npm run prisma:validate
cd ../frontend
npm run build
```

Schema validation requires `DATABASE_URL` to be defined; the placeholder in your local backend `.env` is sufficient because validation does not connect to MySQL. Tests start and close their own local HTTP server and do not require `.env` or a database.

The frontend build is written to ignored `frontend/dist/`. Use `npm run preview` from `frontend/` to preview that build locally.

No migrations or database models exist yet. The `prisma:generate` script is provided for use after models are added; client generation is deferred for the empty schema. Do not run migrations or create models as part of this scaffold.

## Initial verification and known issues

- Dependencies were installed for both apps and locked in their respective `package-lock.json` files.
- All three backend HTTP tests passed, including the exact health endpoint response.
- Prisma validated the model-free MySQL schema using a process-local placeholder URL; no database connection was made.
- The frontend production build passed.
- Git ignore checks confirmed local environment files, dependencies, build output, logs, and editor settings are ignored, while `.env.example` files remain eligible for version control.
- Initial npm registry lookups failed with `ENOTCACHED` because the execution environment defaulted to offline mode. Online access resolved this.
- Initial test/build attempts hit sandbox `spawn EPERM` errors, and Prisma's engine download hit `ECONNREFUSED`. Rerunning with the necessary execution/network permissions succeeded.
- At installation, the frontend audit reported zero vulnerabilities. The backend audit reported three high-severity findings along the `prisma` -> `@prisma/config` -> `deepmerge-ts` dependency chain, arising from [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). This remains unresolved. npm suggested downgrading Prisma to 6.12.0; no forced downgrade or unverified transitive override was applied.
