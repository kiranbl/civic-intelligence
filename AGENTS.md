# Civic Intelligence

## Project context

This project is being built for the Google Build with AI: Code for Communities hackathon. The working project name is Civic Intelligence.

The goal is to build a multilingual AI platform that analyses citizen development requests together with demographic and infrastructure data to identify infrastructure gaps and demand hotspots for policymakers.

## Technology stack

- Frontend: React + Vite.
- Backend: Node.js + Express.
- Database: MySQL with Prisma ORM.
- AI: Google Gemini API, to be added later.
- Maps: Google Maps, to be added later.
- Deployment: Google Cloud, to be added later.

## Development rules

- Use JavaScript, not TypeScript.
- Keep the architecture simple and beginner-readable.
- Do not introduce Docker, Kubernetes, Kafka, Redis, GraphQL, microservices, LangChain, vector databases, or unnecessary infrastructure.
- Use controller/service/route separation in the backend: routes define endpoints and connect middleware, controllers handle HTTP requests and responses, and services contain business logic and database operations.
- Keep secrets in `.env` files and never commit them. Before introducing environment files, configure Git to ignore secret-bearing files. Any committed `.env.example` files must contain placeholders only.
- Validate API inputs.
- Add tests for important business logic.
- Do not implement features outside the requested task.
- Explain significant architectural choices before making them.

## Current phase

The user has authorized the initial frontend and backend scaffold, dependency installation, and validation.

Limit the frontend to a Home page displaying the project name and tagline, with React Router and no UI framework. The first database layer is authorized: District, CitizenRequest, and InfrastructureMetric models, fictional demo seed data, and read-only district endpoints. Keep the health endpoint working. Do not add create/update/delete endpoints until requested.

Do not add a dashboard, Gemini, Google Maps, authentication, deployment, or other project features until requested.

The read-only water-priority analytics endpoint is also authorized. Keep scoring weights and priority thresholds in named configuration, document the prototype heuristic and missing-data behavior, and do not describe scores as an official methodology or AI predictions. Other analytics domains are not authorized.

Census 2011 population ingestion is authorized for the eight existing Karnataka districts. Preserve raw workbooks and explicit inspected district aliases. Require district-level Total, Rural, and Urban rows and exact Rural + Urban = Total reconciliation; validate and dry-run before updating. Shared provenance applies to all three population fields. Treat 2011 population as historical context, not a current estimate. The importer must not modify requests or metrics.

Rural water scope is authorized: use only WATER requests marked RURAL and the rural population denominator. Preserve min-max normalization, 50/50 weights, thresholds, rounding, and incomplete-data behavior. Demo WATER requests may be intentionally marked RURAL, and exact fictional demo metrics renamed to RURAL_FHTC_COVERAGE without changing their values. Do not infer real request area type or invent rural populations.

JJM importer implementation and dry-run validation are authorized. Preserve the local J1/J5 HTML exports; no scraping or authenticated API calls. Require eight exact case-insensitive district matches, J5 date 21/09/2026 and financial year 2026-2027, exact J1/J5 PWS household and connection reconciliation, and zero private connections. Calculate C / (H + U) * 100, including non-PWS unconnected households. Retain full precision in the database and round display values only. A future authorized real import must replace only the eight demo rural coverage metrics, preserve Census and request data, and be idempotent. Label JJM coverage as reported connections, not independently verified functionality. Do not execute the real import until separately authorized. Coverage remains fictional in the current database until that real import occurs.
