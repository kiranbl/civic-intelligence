# Civic Intelligence

AI-powered infrastructure planning platform

Built for the Google Build with AI: Code for Communities hackathon. The intended platform will analyse multilingual citizen development requests alongside demographic and infrastructure data to identify infrastructure gaps and demand hotspots for policymakers.

## Current scope

This repository contains the application scaffold and first database layer:

- React + Vite frontend in JavaScript, using React Router and plain CSS.
- Rural water dashboard with dynamic totals, district ranking, score explanations, and an explicit analyze/review/submit citizen-request flow.
- Node.js + Express API with dotenv, cors, JSON parsing, and centralized error handling.
- Prisma ORM configured for MySQL with District, CitizenRequest, and InfrastructureMetric models.
- Read-only district, citizen request, and infrastructure endpoints.
- Clearly fictional demo fixtures for eight Karnataka districts.
- Validated Census 2011 district population import with source/year provenance.
- Backend HTTP tests using Node's built-in test runner.

Gemini now structures multilingual citizen requests. The District Intelligence view includes Leaflet and OpenStreetMap integration. Authentication, audio processing, and Google Cloud deployment remain deferred.

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

Replace the database placeholders in your local `backend/.env` with your MySQL credentials. The health endpoint does not query MySQL. Local `.env` files are ignored by Git; commit only placeholder examples. Frontend `VITE_` variables are public browser configuration and must never contain secrets. `VITE_API_BASE_URL` is the dashboard’s only backend URL setting (default `http://localhost:3000/api`). Set it in `frontend/.env` when using another API address; restart Vite after changing it. The old `VITE_API_URL` setting is not used.

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

Successful district responses use `{ "success": true, "data": ... }`. Collections return arrays, including an empty array when an existing district has no matching records. IDs must be positive decimal integers without leading zeros and within the MySQL signed Int range. Invalid IDs return HTTP 400, and unknown districts return HTTP 404 on all three ID-based routes. Database failures go through the centralized handler and return a generic HTTP 500 without exposing Prisma details. District routes remain read-only; citizen-request submission is a separate endpoint. The Home dashboard consumes these read-only APIs.

## Rural water-priority analytics

`methodology.scope` is **Rural water infrastructure prototype**. JJM coverage is rural household tap-connection coverage, so demand is restricted to explicitly rural requests and normalized using rural population. Coverage is a household percentage, while demand is a request rate per rural person; the heuristic combines their indices and does not treat households and persons as interchangeable. **The separately authorized real JJM import is complete in local MySQL: eight official metrics dated 21/09/2026 replaced demo coverage, and a rerun updated zero rows.** Census 2011 remains historical context, not current population.

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

## JJM rural tap-connection import

The two official, manually supplied files are in `backend/data/raw/jjm/`:

- `State wise PWS and FHTC Coverage.xls`: Format J1, Karnataka, All Districts.
- `Habitation wise FHTC Coverage( Reported Till 21_09.xls`: Format J5, Karnataka, Financial Year **2026-2027**, explicitly **Reported Till 21/09/2026**.

Both are HTML Excel exports, not binary XLS workbooks. The importer detects the HTML/Excel signature and parses with Cheerio; it never executes scripts, fetches links, scrapes, or calls an API. Raw exports are ignored by Git and never modified. See `backend/data/raw/README.md` for source URLs, inspection details, file sizes, and hashes. The parser validates the inspected header labels and row/column spans and fails if the layout changes. J5's source spelling `House Connectons` is intentionally recognized as printed.

J1 has 31 district rows with village counts; J5 has 31 district rows with habitation counts. These geographic counts are **not** treated as interchangeable. Only the PWS household and tap-connection totals are reconciled, district by district. J5 contains six PWS coverage bands: zero, >0 to <25%, >=25 to <50%, >=50 to <75%, >=75 to <100%, and >=100%. Every band's household and connection counts participate, including the zero-coverage band.

The explicit name map recognizes Bengaluru Urban, Bengaluru Rural, Mysuru, Mandya, Tumakuru, Hassan, Kolar, and Ramanagara case-insensitively. It preserves source spelling, including `BENGALURU RURAL`, `TUMAKURU`, and `RAMANAGARA`. It does not fuzzy-match or reuse historical Census aliases. Each district must appear exactly once in each source; missing/duplicate matches, incorrect state/category/date/year, invalid counts, or cross-source mismatches stop the run.

The adopted calculation for this validated source pair is:

```text
H = households in villages with PWS (J1)
U = unconnected households in villages without PWS (J1)
P = households with private connections in villages without PWS (J1)
C = households with household tap connections in villages with PWS (J1)
require P = 0
require H = sum of J5 household counts across all six PWS bands
require C = sum of J5 connection counts across all six PWS bands
totalReportedRuralHouseholds = H + U
ruralFhtcCoverage = C / (H + U) * 100
```

The denominator includes households in non-PWS villages; it is not Census population or PWS households alone. A positive denominator, nonnegative integer counts, C <= H and C <= H + U, and coverage within 0–100 are required. A future nonzero P requires a methodological decision and cannot be imported by this script. Values remain full-precision JavaScript numbers internally and in database writes; the printed table and processed CSV round percentages to two decimals. The raw-source importer does not read this reporting CSV. Production bootstrap separately uses its validated household counts to recover full-precision coverage, as described below.

Source date **2026-09-21** comes explicitly from J5. J1 itself has no date; matching J1/J5 household and connection totals reconciles this supplied pair without inventing a separate J1 timestamp. The metric represents **JJM-reported rural household tap-connection coverage as of 21/09/2026**, not independently verified water-service functionality. Matching totals do not certify water quantity, quality, or regularity. Census 2011 rural population remains historical context; current administrative boundary compatibility is not established by matching names alone. Citizen requests remain fictional/synthetic demo data.

From `backend/`, the safe validation command is:

```bash
npm run import:jjm -- --dry-run
```

Dry-run validates both sources, prints all eight rows and both reconciliation results, writes `data/processed/jjm-karnataka-rural-coverage-2026-09-21.csv`, and makes **zero database connections or writes**. The CSV has exactly the eleven requested fields and eight target districts. Database replacement eligibility is checked only by the real command.

Migration **20260922120000_jjm_metric_provenance** adds nullable `InfrastructureMetric.sourceDate` and `sourceUrl`. It has been applied locally and Prisma regenerated. The authorized real import updated eight metrics, with zero updates on rerun; Census fields and existing requests were preserved. For another initialized environment, the deployment/import sequence is:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run import:jjm
```

The real import prints the same source-validation table before acquiring Prisma. A serializable transaction preflights all eight existing Karnataka districts and requires exactly one existing `RURAL_FHTC_COVERAGE` metric each. Only an exact fictional demo source/year or this same official JJM snapshot is replaceable. Missing/duplicate metrics or unrelated sources abort without choosing, deleting, or overwriting them. It updates existing IDs in place with `unit=PERCENT`, `source=Jal Jeevan Mission`, `sourceYear=2026`, `sourceDate=2026-09-21T00:00:00.000Z`, the official J1 report URL, and the full-precision coverage. Reruns skip unchanged rows and timestamps. No Census fields, requests, or other metric types are written. Seed reruns preserve existing official rural coverage instead of recreating demo metrics. Run import/seed commands serially.

Analytics weights, thresholds, normalization, denominator for demand, sorting and missing-data rules are unchanged. Methodology metadata identifies the Census 2011 demographic context, JJM import context, synthetic citizen demand and prototype scoring. Its `coverageData` checks selected metric provenance to distinguish demo, official, mixed and missing sources; dry-run preparation does not relabel existing demo metrics as official. The provenance migration is a prerequisite for the updated selection.

The tests use small synthetic HTML fixtures and an isolated transactional database double. They cover HTML detection, aliases, headers, date/year, all six bands, exact reconciliation, private connections, invalid inputs, inclusive denominator, precision, no-connection dry run, in-place replacement, preservation, idempotency, seed protection and existing APIs. They do not require or commit the raw exports. The separate local MySQL import was verified with before/after snapshots and live API checks.

## Gemini multilingual request understanding

Gemini converts unstructured citizen text into structured request metadata: language, category, subcategory, urgency, area type, an English summary, an explicitly stated location, and classification confidence. The MVP supports English, Kannada and Hindi, including mixed/noisy/transliterated input on a best-effort basis; other or unidentifiable languages use `other`. This is the meaningful AI component. **Deterministic backend analytics, not Gemini, calculates infrastructure priority.** Existing weights, normalization and thresholds are unchanged.

The backend uses the official [`@google/genai` SDK](https://googleapis.github.io/js-genai/) and [`gemini-3.8-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), with [structured JSON output](https://ai.google.dev/gemini-api/docs/structured-output). It sends an explicit JSON Schema and validates the response again with Ajv, with no coercion or silent removal of extra fields. Additional checks enforce summary/identifier lengths and require locationText to be a verbatim substring of the citizen text, in its original script. This prevents accepting an unstated location string but does not prove that every accepted substring is a place. Summaries and classifications can be imperfect and must not be treated as official decisions. Confidence is the model's self-assessment, not a calibrated accuracy probability.

Configure only the ignored `backend/.env` locally:

```dotenv
GEMINI_API_KEY=YOUR_LOCAL_KEY
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.5-flash-lite
```

Obtain your own key through Google AI Studio. Never commit it or put it in a frontend/VITE variable. `backend/.env.example` contains an empty key and the default primary/fallback model names. Restart the backend after changing `.env`. Configuration is checked lazily: without a key the server and existing non-AI routes remain available, while valid AI requests return HTTP 503 with `AI service is not configured`. No fake result is returned. Automated tests use mocked calls; live smoke testing is an explicit manual operation.

Architecture: routes validate request bodies; controllers handle HTTP; the shared analysis service calls an isolated Gemini client and validates output; the create service alone persists an explicit field mapping through Prisma. The client has a fixed server instruction, separate JSON-encoded citizen data, a 30-second abort/deadline and one attempt. No function calling, agents, RAG, embeddings or database access is provided to Gemini. Prompt-injection-like text cannot set the server instruction, schema, model, database IDs or write fields. These boundaries and output validation do not guarantee that real model classifications resist every semantic manipulation; tests verify server behavior, not model accuracy.

`POST /api/citizen-requests/analyze` accepts only:

```json
{ "text": "Our village pipeline has been broken for two weeks." }
```

Text must be a string, at most 5,000 JavaScript characters (UTF-16 code units) before trimming, and nonempty after trimming. The endpoint returns HTTP 200 with `{ "success": true, "data": { ...validatedAnalysis, "model": "gemini-3.8-flash" } }`. It makes no database calls or writes.

`POST /api/citizen-requests` accepts only:

```json
{ "districtId": 1, "text": "Our village pipeline has been broken for two weeks.", "channel": "TEXT" }
```

districtId must be a positive JSON integer within the MySQL Int range and refer to an existing district. It is checked before calling Gemini. channel is required and must be TEXT, VOICE or MESSAGING; these describe the origin of supplied **text**, with no audio or speech processing. The service analyzes the text and returns HTTP 201 with `{ "success": true, "data": createdCitizenRequest }`. It stores the trimmed original text, application-supplied district/channel, validated AI fields, configured model, confidence and server processing timestamp. IDs and timestamps come from the server/database; coordinates remain null. Extra body fields, such as a client-supplied category, confidence, model, district in the analyze endpoint, or priority score, are rejected.

Migration **20260923090000_citizen_request_ai_analysis** adds nullable `summaryEnglish` (TEXT), `locationText`, `aiModel`, `aiConfidence`, and `aiProcessedAt` to CitizenRequest. The local schema migration is applied; existing requests are not reclassified or backfilled. Existing 32 synthetic demo requests remain valid with null AI fields. Census and JJM records are unchanged. For another environment, run `npx prisma migrate deploy` and `npm run prisma:generate` before using the new fields.

The instruction uses UNKNOWN unless rural/urban context is explicit, OTHER when the issue does not clearly fit, LOW absent evidence of elevated urgency, and CRITICAL only for an explicitly indicated immediate serious emergency. summaryEnglish must preserve meaning; schemes, places, dates and other details must not be invented. Output enums, nullable fields, confidence 0–1, short uppercase subcategories and absence of extra fields are enforced before either endpoint succeeds.

| Condition | HTTP | Public message |
| --- | ---: | --- |
| Invalid input, channel or ID type | 400 | Invalid request |
| Unknown district | 404 | District not found |
| JSON body exceeds 100kb | 413 | Request body too large |
| Missing key/invalid model configuration | 503 | AI service is not configured |
| Exhausted transient timeout retries/fallbacks | 503 | AI service is temporarily unavailable |
| Exhausted primary/fallback capacity retries | 503 | AI service is temporarily unavailable |
| Network or Gemini service failure | 502 | AI service is temporarily unavailable |
| Invalid, blocked or truncated model output | 502 | AI service returned an invalid analysis |
| Database/internal failure | 500 | Internal server error |

The centralized handler never returns raw SDK/Prisma errors. Server error logs contain only status and a server-owned error code, not keys, full stacks, citizen text or model payloads. Failed analysis never creates a request. The create endpoint is not an upsert/idempotent submission API: repeated successful POSTs create separate requests. It is intended for this local MVP; no authentication was added.

Normal `npm test` uses mocked Gemini responses and requires no API key. It covers English/Kannada/Hindi mock handling, schema and evidence checks, invalid inputs, missing configuration, failures/timeouts, prompt boundaries, zero-write analysis, explicit create mapping, and existing APIs. Mock classifications are not claims about real Gemini accuracy. No synthetic request was added to the real database during these tests. New successful rural WATER submissions will naturally enter the existing deterministic demand counts; this changes inputs, not the formula.

For a separate, explicit manual smoke test after configuring a key:

```bash
npm run smoke
```

This sends the English/Kannada/Hindi village-pipeline examples and one prompt-injection case to Gemini independently, prints each validated structured result, and never connects to Prisma or saves data. It is not part of `npm test` and real outputs may differ between languages or runs. The current Census 2011 population, JJM reported connections through 21/09/2026, and existing synthetic demand still support prototype demonstrations, not real policy recommendations.

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

Unknown routes return a JSON 404. The centralized error handler returns safe JSON messages without exposing internal error details. CORS defaults to the two local Vite origins and uses an exact environment-configured allowlist in production; see deployment preparation below.

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

Gemini availability: HTTP 408, 429, 500, 502, 503 and 504, local deadlines and explicit transient transport errors receive three primary retries after 1000, 2000 and 4000 ms, each with 0–249 ms random jitter. After exhaustion, the configured fallback models are attempted once each in order (default: gemini-3.6-flash, then gemini-3.5-flash-lite). Generic errors, authentication/permission errors and invalid successful responses do not trigger switching. Each attempt retains a 30-second deadline. All models share the same instructions, input, JSON Schema and application validation. Returned `model` and saved `aiModel` identify the successful model. Configuration uses `GEMINI_FALLBACK_MODELS`; the old singular variable is no longer used. The manual `npm run smoke` command attempts English, Kannada, Hindi and a prompt-injection case independently, prints a summary, and exits nonzero after all cases if any failed. It never saves requests. Retry sleep and randomness are injectable in tests.

## Explainable water planning

`GET /api/analytics/water-planning` returns the existing water-priority fields, ordering and methodology, plus each district's `planningProfile`, `planningAction`, three evidence-based rationale statements (one for incomplete data), an `evidence` object and `limitations`. It adds `planningMethodology` with the thresholds and precision rule. The original `/water-priority` contract and formula are unchanged.

The flow is: **citizen text → Gemini classification → deterministic demand analytics → official-data infrastructure comparison → deterministic planning profile → explainable planning consideration**. Gemini interprets citizen text; it does **not** calculate scores, gaps, profiles, recommendations or budgets. The new read-only service reuses `getWaterPriority()` and performs no database writes or Gemini calls.

Thresholds live in `backend/src/config/waterPlanning.js`. They apply to the existing display-rounded analytics values: high demand means `demandIndex >= 50`; high gap means `infrastructureGap >= 20`. Exact boundary values are high. No priority calculations are duplicated or modified.

| Profile | Planning consideration |
| --- | --- |
| HIGH_DEMAND_HIGH_GAP | Explore targeted household water-access expansion |
| HIGH_DEMAND_LOW_GAP | Investigate localized water-supply reliability |
| LOW_DEMAND_HIGH_GAP | Validate potentially under-reported access needs |
| LOW_DEMAND_LOW_GAP | Monitor coverage and maintain service quality |
| INSUFFICIENT_DATA | Review available infrastructure data (`REVIEW_DATA`) |

Incomplete analytics or invalid/missing demand, gap or coverage never produce a guessed profile. Evidence retains the analytics values, including nulls. The rule uses no district names and does not infer exact locations, construction requirements, costs, beneficiaries or timelines. Aggregate connection and demand measures cannot diagnose the cause of a service problem.

District Intelligence includes **Planning Insight**, showing the backend action, rationale, evidence and limitations. It loads independently with a GET-only retry and refreshes after district selection or successful submission. The ranking table remains compact. The visible prototype label and disclaimer apply to every profile, including incomplete data.

Every result notes synthetic/AI demonstration citizen demand, relative normalization, Census **2011** rural population, the configured JJM snapshot **21/09/2026**, and that reported connections do not independently establish water quantity, quality, pressure or regularity. Actual coverage provenance remains in the reused methodology response. These are prototype planning considerations, **not official government recommendations**, and require local verification.

## District Intelligence mapping

The supplementary map uses **Leaflet + React Leaflet** and OpenStreetMap raster tiles. It requires no API key, billing account, or Google Maps configuration. Gemini remains the backend AI provider and its configuration is unchanged.

Select a ranking button or map marker to update District Intelligence. Initial bounds show all configured references, with zoom capped at 9 for the initial fit; later selections pan without changing zoom. Popups show district name, reference label, priority, score, coverage and rural WATER count. Marker letters and a selected star supplement priority colors. The ranking remains keyboard-accessible navigation when mapping is unavailable.

### Verified district reference coordinates

Coordinates are checked-in frontend data in `frontend/src/config/districtLocations.js`, **not MySQL data**. Verified against OpenStreetMap on **2026-09-25** using individually reviewed Nominatim results and an Overpass office lookup. These are headquarters/geographic reference points, **not complaint locations, infrastructure projects, or exact district centroids**. No complaint coordinates are currently collected/displayed by the frontend.

| Dataset district | Reference | Latitude | Longitude | OSM source |
| --- | --- | ---: | ---: | --- |
| Bengaluru Urban | Bengaluru city reference | 12.9767936 | 77.5900820 | [City relation](https://www.openstreetmap.org/relation/7902476) |
| Bengaluru Rural | Devanahalli DC Office administrative reference | 13.2809804 | 77.6227856 | [Office site](https://www.openstreetmap.org/way/1193268145) |
| Mysuru | Mysuru city | 12.3051828 | 76.6553609 | [City node](https://www.openstreetmap.org/node/2068274800) |
| Mandya | Mandya city | 12.5238888 | 76.8961961 | [City node](https://www.openstreetmap.org/node/652721136) |
| Tumakuru | Tumakuru city | 13.3400771 | 77.1006208 | [City node](https://www.openstreetmap.org/node/571400151) |
| Hassan | Hassan city | 13.0070817 | 76.0992703 | [City node](https://www.openstreetmap.org/node/340748436) |
| Kolar | Kolar city | 13.1367201 | 78.1337246 | [City node](https://www.openstreetmap.org/node/245618507) |
| Ramanagara | Ramanagara headquarters town | 12.7252766 | 77.2804797 | [Town node](https://www.openstreetmap.org/node/245609255) |

The Bengaluru Urban point is Nominatim's city reference for the city relation. Bengaluru Rural uses the bounding-box center returned by Overpass for the mapped **office site**, not a district centroid or a surveyed building entrance. The [district administration address](https://bangalorerural.nic.in/en/contact-us/) identifies its office at Beerasandra, Devanahalli. Other entries use explicit OSM city/town nodes; district boundary results were excluded. OSM data is © OpenStreetMap contributors under the [ODbL](https://www.openstreetmap.org/copyright). The configuration retains source URLs and verification dates; there is no runtime geocoding service.

The dataset name remains **Ramanagara**. The UI retains the administrative note **Bengaluru South / Bangalore South (renamed in 2025)** with Ramanagara as headquarters, supported by [district administration history](https://ramanagara.nic.in/en/history/). No source-linked database record was renamed.

### Tiles, attribution and failure handling

The interactive browser uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. **© OpenStreetMap contributors** attribution must remain visible. Public OSM tiles are a best-effort community service intended for normal interactive use, without an availability guarantee. Follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/): no bulk downloads, offline downloading, prefetch jobs, cache-busting or custom caching proxies. Browser HTTP caching and normal Referer headers remain enabled; only currently viewed tiles are requested. No application-level tile storage or background geocoding is implemented.

Missing/invalid references omit only their markers. A map error boundary preserves the rest of District Intelligence if initialization fails; tile failures show a small notice. Frontend tests mock React Leaflet and make no external tile requests. Existing request Analyze/Submit and deterministic planning remain unchanged. `VITE_API_BASE_URL` is the only frontend environment setting required for the API; no mapping environment variables are used.

## Citizen request preview and submission flow

The dashboard includes a two-step demonstration form. Choose a district, enter up to 5,000 JavaScript string characters, and select **Analyze Request**. This calls `/api/citizen-requests/analyze` without saving. English, Kannada and Hindi examples only populate the textarea. Review the interpretation before selecting **Submit Request**. Editing text invalidates the preview; changing district uses the latest explicit selection.

Submission sends only `districtId`, reviewed `text` and `channel: TEXT` to the existing create endpoint. The backend reanalyzes and validates the text; the final stored result may differ and is displayed explicitly. After HTTP 201 the dashboard reloads its district requests, totals and analytics without a full-page refresh. A failed dashboard refresh preserves the saved confirmation and offers a GET-only refresh. Browser retries are manual; ambiguous submission network failures warn users to check records before retrying, because the API does not provide idempotency keys.

Run frontend checks with `cd frontend`, `npm test`, and `npm run build`. Vitest/jsdom component tests and the existing Node API-loader tests mock all HTTP calls, including Gemini-backed analysis and request creation. No real records are written by these tests. `VITE_API_BASE_URL` remains the only browser backend URL setting; credentials belong exclusively to the backend.

## Deployment preparation: Aiven → Render → Vercel

This is configuration and bootstrap preparation only; nothing has been deployed. Keep the existing schema/migrations, Gemini models, analytics, map, and source data. Use Node 24 (at least 22.12) for both builds. Do not copy local MySQL or run the development demo seed in production.

### Aiven MySQL and backend environment

Provision an empty MySQL database separately when deployment is authorized. Aiven supplies the host, port, database, username, password and project CA certificate; none is hardcoded. Supply Render with:

| Backend environment | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Aiven MySQL connection URL, with strict TLS as below |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact HTTPS frontend origins; no path or trailing slash |
| `GEMINI_API_KEY` | Backend-only secret from your own Gemini account |
| `GEMINI_MODEL` | Your chosen primary model (existing default `gemini-3.8-flash`) |
| `GEMINI_FALLBACK_MODELS` | Existing ordered defaults `gemini-3.6-flash,gemini-3.5-flash-lite`, or your explicit model configuration |
| `PORT` | Supplied by Render; do not set it to the local development port |

Prisma **6.19.3** uses `DATABASE_URL` from `schema.prisma`. The placeholder format is:

```dotenv
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE?sslcert=/etc/secrets/aiven-ca.pem&sslaccept=strict"
CORS_ALLOWED_ORIGINS=https://FRONTEND-HOST
```

Percent-encode special characters in URL credentials. Download the CA for **your Aiven project**, then supply it as a Render secret file named `aiven-ca.pem`, available at `/etc/secrets/aiven-ca.pem`; do not commit certificates or credentials. Use the Aiven DNS hostname so certificate identity validation can succeed. `sslcert` supplies the trusted server CA and `sslaccept=strict` keeps validation enabled; do not substitute `accept_invalid_certs` or another driver's `ssl-mode` URL parameter. If TLS fails, correct the CA/hostname rather than disabling validation. The same URL and CA must be available to migration, bootstrap and runtime processes. See [Prisma 6 MySQL TLS parameters](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql), [Aiven certificates](https://aiven.io/docs/platform/concepts/tls-ssl-certificates), and [Render secret files](https://render.com/docs/configure-environment-variables#secret-files).

CORS accepts only exact configured origins. Production startup rejects missing/invalid configuration; preview domains must be listed explicitly rather than allowing every Vercel subdomain. Without configuration, development permits `http://localhost:5173` and `http://127.0.0.1:5173`. Requests without an Origin header remain allowed for health checks/server clients. CORS is browser access control, not authentication. No Gemini or database credential belongs in a `VITE_` variable.

### Render backend commands

Use a Node web service with **Root Directory `backend`**:

```text
Build: npm ci --include=dev && npx prisma generate
Start: npm run start:production
Health check: /api/health
```

The explicit `--include=dev` retains the pinned Prisma CLI for production migrations, even with `NODE_ENV=production`. `start:production` expands to:

```sh
prisma migrate deploy && npm run bootstrap:production && npm start
```

Inside npm scripts, `prisma` resolves to the installed CLI; the equivalent manual sequence starts with `npx prisma migrate deploy`. Any migration/bootstrap failure stops startup. Never use `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, or destructive database commands for this sequence. Server startup binds `0.0.0.0` and honors `process.env.PORT` (3000 is only the local fallback), matching [Render's port requirements](https://render.com/docs/web-services#port-binding). The unchanged health response does not query Gemini or write/query the database.

### Safe baseline bootstrap

`npm run bootstrap:production` assumes migrations already exist and reads only repository-controlled data:

- The original `[DEMO ONLY ...]` fixtures in `prisma/demoData.js`: four requests per district, 32 total; no local AI demonstration records are copied.
- `data/processed/census2011-karnataka-population.csv`: official Total/Rural/Urban values and shared Census 2011 provenance.
- `data/processed/jjm-karnataka-rural-coverage-2026-09-21.csv`: previously validated J1/J5 extract, dated 21/09/2026, FY 2026-2027. Coverage is recomputed as `tapConnectedHouseholds / (pwsHouseholds + nonPwsUnconnectedHouseholds) * 100`, preserving full precision; the rounded CSV column is only a cross-check. The extract was generated after J1/J5 reconciliation and zero-private-connection validation; bootstrap does not claim to revalidate absent raw reports. Existing official source constants supply `sourceUrl`, `sourceYear`, date and unit.

It validates headers, eight unique targets, historical aliases, numeric counts, Rural + Urban = Total, household totals, display coverage, dates and provenance before a database transaction. Ignored raw workbooks/exports are **not required**. Preserve these small tracked extracts when deploying; later source updates require an explicit reviewed data migration, not editing this baseline to repair a live database.

All three application tables must be empty to initialize (Prisma migration metadata does not count). A serializable transaction creates **8 districts, 32 synthetic requests and 8 official JJM metrics**, verifies the resulting baseline, and rolls back on failure. Fictional fixture populations/coverage are never inserted. No AI calls or copies of local requests 33/34 are involved. IDs remain database-generated; future submissions may naturally receive IDs 33 onward.

On restart it verifies every baseline district/population/provenance, all 32 exact synthetic requests and exactly one matching official rural coverage metric per district. Correctly initialized data causes **zero writes**, even after extra user/demo requests or unrelated metric types are added. IDs, timestamps and additional records are preserved. Missing, duplicate, altered, partially initialized or inconsistent baselines stop with an explicit error; nothing is deleted, overwritten, reset or repaired. Run one initializer at a time. A concurrent serializable conflict fails safely; rerun after the other initializer completes. This command is not a general synchronization/import tool.

### Vercel frontend

Use **Root Directory `frontend`**, Vite preset, install `npm ci`, build `npm run build`, output `dist`. The only application environment setting is:

```dotenv
VITE_API_BASE_URL=https://BACKEND-HOST/api
```

Set this to the authorized Render HTTPS URL for each Vercel environment before building. Production builds fail for missing, localhost, non-HTTPS, or credential-bearing URLs. The development server keeps its localhost default. The frontend uses a build-time value, so rebuild when changing it; see [Vercel Vite configuration](https://vercel.com/docs/frameworks/frontend/vite). Add the corresponding Vercel origin to Render's CORS allowlist. Leaflet/OSM needs no deployment secret; retain visible attribution. No hosting configuration is needed for extra routes because the current application serves only `/`.

For a local production **build check only**, a process-specific, non-live placeholder URL can be used without altering `.env`:

```powershell
$env:VITE_API_BASE_URL = 'https://backend.example.invalid/api'
npm run build
Remove-Item Env:VITE_API_BASE_URL
```

That example build is not a deployable backend configuration. Configure the actual authorized backend URL in Vercel later. Census remains historical **2011** context, JJM reports connections through **21/09/2026**, and baseline citizen requests remain fictional. All scores/planning insights remain prototype demonstrations.
