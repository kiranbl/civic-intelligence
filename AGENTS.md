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
