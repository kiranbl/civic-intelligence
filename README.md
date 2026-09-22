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
- Validated Census 2011 district population import with source/year provenance.
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

**Every population and water coverage value in the seed script is fictional DEMO data, not Census data or any official dataset.** The Census importer replaces only database total/rural/urban population and their shared provenance with official historical values. Requests and infrastructure metrics remain fictional. The requests are invented English, Kannada, and Hindi examples and each has a `[DEMO ONLY ...]` prefix. All metrics use `RURAL_FHTC_COVERAGE`, unit `percent`, and an explicitly fictional demo source; their source year is illustrative too. Coordinates are left null rather than invented.

Run the seed serially, not concurrently. It uses a transaction, preserves existing districts, and inserts only missing demo requests and metrics, so sequential reruns do not duplicate these fixtures or delete other records. It does not overwrite existing populations or refresh existing demo values when fixture values change. Its printed totals describe the demo set ensured, not newly inserted rows or the entire database.

## Census 2011 population import

Dataset: **Census 2011 - Primary Census Abstract, India/State/District data**, published by the Office of the Registrar General & Census Commissioner, India. Source year: **2011**. The workbook's dictionary is titled “Census 2011 - Primary Census Abstract - Record Structure.”

Download the original `2011-IndiaStateDist-0000.xlsx` manually from the [official Census download](https://censusindia.gov.in/nada/index.php/catalog/42557/download/46183/2011-IndiaStateDist-0000.xlsx), also available through the [Census catalog](https://censusindia.gov.in/nada/index.php/catalog/42557), and place it in `backend/data/raw/`. The importer reads this local file; it never scrapes or downloads web data. Do not edit the raw workbook.

The supplied file is **1,381,659 bytes (1.32 MiB)**. Although modest, the national binary workbook is unnecessary to track for an eight-row extract. It is Git-ignored; source instructions/checksum are in `backend/data/raw/README.md`, and the small reproducible CSV is under `backend/data/processed/census2011-karnataka-population.csv` for version control.

Inspection established the actual structure before implementation:

- `Data`: 2,029 rows including the first-row header, 94 columns.
- `Record Structure`: 96 rows, 4 columns; defines `TOT_P` (column K) as **Total Population (Persons)**.
- `State` is a geographic code. The `STATE` / `KARNATAKA` / `Total` row establishes state code `29`.
- Only `State=29`, `Level=DISTRICT`, and `TRU=Total`, `Rural`, or `Urban` rows qualify, with nonzero district code and zero codes in `Subdistt`, `Town/Village`, `Ward`, and `EB`.
- Each district must have exactly one row for each of `Total`, `Rural`, and `Urban`; duplicate district/TRU pairs or inconsistent district codes are rejected. `Bangalore Rural` is a district name, not a TRU classification.
- The source contains India, state, and district levels; the importer also explicitly rejects lower geographic levels if present. No fuzzy name matching, summed rural/urban reconstruction, or population estimation is used.

| Source district spelling | Application district | Code | 2011 Total | 2011 Rural | 2011 Urban |
| --- | --- | --- | ---: | ---: | ---: |
| Bangalore | Bengaluru Urban | 572 | 9,621,551 | 871,607 | 8,749,944 |
| Bangalore Rural | Bengaluru Rural | 583 | 990,923 | 722,179 | 268,744 |
| Mysore | Mysuru | 577 | 3,001,127 | 1,755,714 | 1,245,413 |
| Mandya | Mandya | 573 | 1,805,769 | 1,497,407 | 308,362 |
| Tumkur | Tumakuru | 571 | 2,678,980 | 2,079,902 | 599,078 |
| Hassan | Hassan | 574 | 1,776,421 | 1,399,658 | 376,763 |
| Kolar | Kolar | 581 | 1,536,401 | 1,056,328 | 480,073 |
| Ramanagara | Ramanagara | 584 | 1,082,636 | 814,877 | 267,759 |

From `backend/`, after installing dependencies and creating the eight districts using the seed if needed:

```powershell
npx prisma migrate deploy
npm run prisma:generate
npm run import:census -- --dry-run
# Review the eight matched populations above before the real import:
npm run import:census
npm run prisma:seed
```

To choose another copy of this same workbook layout: `npm run import:census -- --dry-run --file "C:/path/to/2011-IndiaStateDist-0000.xlsx"`. Paths supplied with `--file` are relative to the current directory unless absolute. The default raw and processed paths resolve relative to the backend, regardless of the invoking directory.

Dry-run validates the source, prints the eight-row pre-update summary, and writes the processed CSV, but **does not initialize Prisma, connect to MySQL, or write database records**. The real command prints the same summary before updates. Every run requires eight unique targets, rejects duplicate district/TRU matches, requires the actual population column, and rejects missing, non-numeric, non-integer, negative, or out-of-Int-range populations. Total must be positive; Rural and Urban may legitimately be zero. Every district must satisfy Rural + Urban = Total exactly; otherwise the import stops without adjusting values. Numeric strings are rejected rather than guessed/coerced. Header order can change, but the inspected column names and dictionary must remain valid.

Migration `20260921132824_add_population_provenance` adds nullable `populationSource` and `populationSourceYear`; unimported/demo rows remain null rather than falsely attributed. The importer requires the eight existing Karnataka districts and updates only `population` (Total), `ruralPopulation`, `urbanPopulation`, `populationSource = "Census of India - Primary Census Abstract"`, and `populationSourceYear = 2011` in a single transaction. Prisma's normal `updatedAt` timestamp advances for changed districts. Other district fields, citizen requests, and infrastructure metrics are untouched. Reruns skip unchanged records, including their timestamps. No districts are created. The demo seed preserves existing districts and therefore does not overwrite imported populations on rerun.

**Census 2011 population is historical demographic context, not a 2026 population estimate.** Name aliases align the application with the source labels; they do not perform a boundary harmonization or estimate later administrative changes. Water priority now uses rural population and rural WATER requests. The min-max normalization, 50/50 weights, thresholds, rounding and incomplete-data rules remain unchanged; rankings change with the rural inputs. The remaining requests and water-coverage metrics are demo data, so scores are still prototype outputs, not official findings.

Verification: the eight dry-run results matched an independent workbook inspection. The first real run updated 8 districts; the second updated 0. Full before/after comparisons confirmed that all request and metric records and unrelated district fields were preserved, with only the first update advancing district timestamps. The raw checksum was checked for preservation. Import validation, filtering, dry-run, successful update, idempotency, and existing analytics are covered by the backend tests.

## Read-only district endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/districts` | Districts sorted by name and state |
| GET | `/api/districts/:id` | One district |
| GET | `/api/districts/:id/requests` | That district's requests, newest first |
| GET | `/api/districts/:id/infrastructure` | That district's infrastructure metrics |

Successful district responses use `{ "success": true, "data": ... }`. Collections return arrays, including an empty array when an existing district has no matching records. IDs must be positive decimal integers without leading zeros and within the MySQL signed Int range. Invalid IDs return HTTP 400, and unknown districts return HTTP 404 on all three ID-based routes. Database failures go through the centralized handler and return a generic HTTP 500 without exposing Prisma details. No write endpoints or frontend data pages are implemented.

## Rural water-priority analytics

`methodology.scope` is **Rural water infrastructure prototype**. JJM FHTC coverage is rural household tap-water coverage, so demand is restricted to explicitly rural requests and normalized using rural population. Coverage is a household percentage, while demand is a request rate per rural person; the heuristic combines their indices and does not treat households and persons as interchangeable. **No JJM data has been imported. Current FHTC values are fictional until a JJM importer is added.** Census 2011 remains historical context, not current population.

Migration `20260922091719_rural_water_scope` adds nullable district rural/urban populations and `CitizenRequest.areaType` (`RURAL`, `URBAN`, `UNKNOWN`, default `UNKNOWN`). Existing unclassified requests stay UNKNOWN until explicitly classified. Shared population source/year applies to all three counts. The processed CSV contains `applicationDistrictName,sourceDistrictName,censusDistrictCode,totalPopulation,ruralPopulation,urbanPopulation,populationSource,populationSourceYear`.

The seed intentionally marks the existing fictional WATER requests RURAL and the Kannada village-road examples RURAL. Ambiguous sanitation and transport examples remain UNKNOWN. It updates areaType only on exact demo text/category/language/channel matches. Legacy coverage metrics with the exact demo source/year/district are renamed to `RURAL_FHTC_COVERAGE` without changing their values; non-demo metrics are untouched. Ambiguous legacy/current demo duplicates abort the transaction. The seed does not invent rural population values: run the Census importer before expecting complete analytics on a fresh database.

Response fields use explicit rural names: `ruralPopulation`, `ruralWaterRequestCount`, `ruralWaterRequestsPer100k`, and `ruralFhtcCoverage`, alongside district identity, demand index, gap, score, level, and completeness. Old generic response fields have been replaced. A zero or missing rural population makes the record incomplete; total population is never used as a fallback.

`GET /api/analytics/water-priority` returns every district in `{ success, data, methodology }`. This is a **prototype relative infrastructure-priority heuristic**, not an official government methodology or an AI prediction. Seed fixtures are fictional; after Census import, population reflects 2011 while requests and coverage remain demo data. Scores are relative to the districts in this response, not absolute measures of need or comparable scores across changing comparison sets.

The module follows routes -> controllers -> services -> Prisma. Weights, thresholds, and equal-demand behavior are configured in `backend/src/config/waterPriority.js`; the calculation is in `backend/src/services/waterPriority.service.js`.

For each district:

1. Count only stored requests with category `WATER` AND `areaType=RURAL`, without a date filter. URBAN and UNKNOWN water requests are excluded.
2. Calculate `ruralWaterRequestsPer100k = ruralWaterRequestCount / ruralPopulation * 100000`.
3. Normalize those rates using `(rate - minimumRate) / (maximumRate - minimumRate) * 100`.
4. Select `RURAL_FHTC_COVERAGE` by descending `sourceYear`, then `createdAt`, then `id`. Values are interpreted as percentages on a 0–100 scale; no unit conversion is performed.
5. Calculate `infrastructureGap = 100 - ruralFhtcCoverage`.
6. Calculate `priorityScore = demandIndex * 0.5 + infrastructureGap * 0.5`.

| Displayed score | Demo priority level |
| --- | --- |
| 0 <= score < 25 | LOW |
| 25 <= score < 50 | MEDIUM |
| 50 <= score < 75 | HIGH |
| 75 <= score <= 100 | VERY_HIGH |

Intermediate calculations retain full precision. Display values are rounded to two decimal places, and the priority level uses the rounded score. JSON numbers may omit trailing zeros. Complete records appear first, sorted by displayed priority score descending; tied scores and incomplete records use ascending district ID for deterministic ordering.

Equal rates, including a single district or all-zero counts, produce demandIndex `0`: there is no relative demand distinction, so only the infrastructure-gap component contributes. This does not imply an absence of citizen need.

Missing coverage or a nonfinite/out-of-range value produces `INCOMPLETE`, with null coverage, gap, score, and level. The newest invalid coverage record is not silently replaced with an older value. Demand can still be calculated and participates in normalization. A missing, nonpositive or invalid rural population produces null rate, demand index, score, and level; it is excluded from normalization, while valid coverage and gap remain available. Missing values are never invented. No districts returns an empty array. Database failures use the existing generic HTTP 500 response.

Example using historical Census rural population and fictional requests/coverage: Mandya has 1 rural water request and 1,497,407 rural persons. Its rate is `100000 / 1497407 = 0.0667821107...`. Minimum rate (Tumakuru) is `0.0480791883...`; maximum (Bengaluru Rural) is `0.1384698253...`. Demand index is `(0.0667821107... - 0.0480791883...) / (0.1384698253... - 0.0480791883...) * 100 = 20.6912164...`. With fictional rural FHTC coverage of 49%, the gap is `51`, and score is `20.6912164... * 0.5 + 51 * 0.5 = 35.8456082...`, displayed as **35.85 (MEDIUM)**.

The backend suite includes scoring, rounding, threshold boundaries, equal demand, missing/invalid data, ordering, query filters, and safe database error handling. Tests also cover the rural population denominator, exclusion of URBAN/UNKNOWN requests, and Total/Rural/Urban Census reconciliation. Import and seed reruns were verified against local MySQL without further changes.

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
