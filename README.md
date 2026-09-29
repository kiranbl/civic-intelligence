# Civic Intelligence

Civic Intelligence is a multilingual AI-assisted citizen demand and infrastructure planning prototype, built for **Google Build with AI: Code for Communities** in the **AI for Digital Public Infrastructure & Governance** track.

**[Live Prototype](https://civic-intelligence-9d29a.web.app/)** · **[GitHub Repository](https://github.com/kiranbl/civic-intelligence)** · [Backend](https://civic-intelligence-api-jlh9.onrender.com)

The working, deployed prototype accepts text and voice complaints in English, Kannada and Hindi. Google Speech-to-Text transcribes voice; Gemini produces structured request interpretations for human review. It aggregates general civic demand and combines rural WATER requests with official Census/JJM evidence, providing district-level geographic intelligence for evidence-informed governance. It is **not an official government system**.

## Key features

- Multilingual text input and English/Kannada/Hindi voice input using Google Cloud Speech-to-Text V2 / Chirp 3.
- Gemini structured civic-request analysis, human review before submission and civic-content validation before storage.
- District-scoped Census settlement resolution with multilingual search hints and conservative spelling matching.
- Citizen Demand Intelligence across all supported civic categories.
- Rural Water Evidence Analysis with explainable prototype planning considerations.
- Google Maps district intelligence, source provenance and visible methodology.
- Deployed React/Vite frontend on Firebase Hosting, Express API on Render and Prisma/MySQL on Aiven.

## How it works

1. Select a district and type a report, or record and review a voice transcript.
2. Analyze: sanity checks and Gemini civic-content validation precede structured interpretation and district-scoped settlement resolution. Nothing is saved.
3. Review/edit the interpretation. Editing text or changing district invalidates the preview.
4. Submit: the backend independently re-analyzes/revalidates and stores one valid request. The final classification can differ from the preview and is displayed.
5. The dashboard refreshes demand totals, rural-water analytics and planning evidence. Submission confirmation remains visible; tab changes preserve drafts, previews and district selection.

Voice transcription alone neither calls Gemini nor creates a citizen request. Network-ambiguous submissions are not retried automatically: check existing records before retrying to avoid duplicates.

## Technology architecture

```text
Citizen
  ↓
React + Vite — Firebase Hosting
  ↓
Node.js + Express API — Render
  ├── Google Gemini: structured interpretation and civic validation
  ├── Google Cloud Speech-to-Text V2 / Chirp 3: transcription
  ├── Prisma → Aiven MySQL: validated persistence
  └── Census/JJM evidence: deterministic analytics and planning

Google Maps JavaScript API → frontend district reference visualization
```

JavaScript throughout, with plain CSS and native controls. Backend responsibilities follow routes → controllers → services → Prisma. Separate app/server modules support isolated HTTP tests. Maps displays district reference points, not citizen complaint coordinates.

## Current scope

The six views are **Overview**, **Citizen Demand**, **Rural Water**, **District Intelligence**, **Submit Request**, and **Methodology**. Desktop uses a compact tabbed shell; mobile stacks naturally. Shared selection and one map instance persist across views.

Supported categories: WATER, ROADS, HEALTHCARE, EDUCATION, SANITATION, TRANSPORT, ELECTRICITY and OTHER. General Citizen Demand includes all categories and RURAL/URBAN/UNKNOWN requests. Rural Water is the first deeply evidence-backed sector module.

The verified evidence dashboard covers **Bengaluru Urban, Bengaluru Rural, Mysuru, Mandya, Tumakuru, Hassan, Kolar and Ramanagara**. The historical statewide settlement registry does not expand this selectable eight-district subset.

Current data: **32 synthetic baseline citizen requests**, alongside any live prototype submissions; official **Census 2011** historical population; and official **JJM reported rural household tap connections through 21 September 2026**. Scores and planning outputs remain prototype decision support, not official findings.

## Citizen Demand Intelligence

`GET /api/analytics/citizen-priorities` is read-only and returns `{ success: true, data: { totalRequests, categoryBreakdown, urgencyBreakdown, areaTypeBreakdown, districtBreakdown, recentRequests } }`. It includes all eight civic categories and RURAL, URBAN and UNKNOWN requests. Breakdown entries contain their category/urgency/areaType, count, and percentage of all stored requests (rounded to two decimals). Null urgency is counted separately as UNSPECIFIED. Fixed enum order is used for these breakdowns; districts use ascending ID, including zero-request districts. Recent requests are limited to five, ordered by createdAt descending then ID descending, and expose only district/category/urgency/area/time metadata. Text, generated summaries, locations and coordinates are omitted for privacy.

The dashboard shows general demand counts without scores, and refreshes them alongside rural-water analytics after submission. An urban WATER or non-WATER request contributes to general counts, but not the existing rural WATER score. Rural Water Evidence Analysis retains the original Census 2011 rural population, official JJM coverage, min-max normalization, weights and thresholds. Neither general counts nor prototype water scores are AI predictions or official government rankings.

The prototype baseline contains synthetic requests. New user submissions may coexist with them; no per-record origin distinction is inferred from IDs or AI metadata. Distribution is not representative of Karnataka's population. General analytics reads the existing database only and makes no Gemini calls or database writes.

## Rural water-priority analytics

`methodology.scope` is **Rural water infrastructure prototype**. JJM coverage is rural household tap-connection coverage, so demand is restricted to explicitly rural requests and normalized using rural population. Coverage is a household percentage, while demand is a request rate per rural person; the heuristic combines their indices and does not treat households and persons as interchangeable. Current coverage uses eight official JJM metrics dated 21/09/2026. Census 2011 remains historical context, not current population.

Migration `20260922091719_rural_water_scope` adds nullable district rural/urban populations and `CitizenRequest.areaType` (`RURAL`, `URBAN`, `UNKNOWN`, default `UNKNOWN`). Existing unclassified requests stay UNKNOWN until explicitly classified. Shared population source/year applies to all three counts. The processed population CSV contains `applicationDistrictName,sourceDistrictName,censusDistrictCode,totalPopulation,ruralPopulation,urbanPopulation,populationSource,populationSourceYear`.

Response fields use explicit rural names: `ruralPopulation`, `ruralWaterRequestCount`, `ruralWaterRequestsPer100k`, and `ruralFhtcCoverage`, alongside district identity, demand index, gap, score, level, and completeness. Old generic response fields have been replaced. A zero or missing rural population makes the record incomplete; total population is never used as a fallback.

`GET /api/analytics/water-priority` returns every district in `{ success, data, methodology }`. This is a **prototype relative infrastructure-priority heuristic**, not an official government methodology or an AI prediction. Population is official Census 2011 historical context; coverage is official JJM reported connections. Baseline requests are synthetic, and live submissions may coexist. Scores are relative to the districts in this response, not absolute measures of need or comparable scores across changing comparison sets.

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

The backend suite includes scoring, rounding, threshold boundaries, equal demand, missing/invalid data, ordering, query filters, and safe database error handling. Tests also cover the rural population denominator, exclusion of URBAN/UNKNOWN requests, and Total/Rural/Urban Census reconciliation.

## Explainable water planning

`GET /api/analytics/water-planning` returns the existing water-priority fields, ordering and methodology, plus each district's `planningProfile`, `planningAction`, three evidence-based rationale statements (one for incomplete data), an `evidence` object and `limitations`. It adds `planningMethodology` with the thresholds and precision rule. The original `/water-priority` contract and formula are unchanged.

The flow is: **citizen text → Gemini classification → deterministic demand analytics → official-data infrastructure comparison → deterministic planning profile → explainable planning consideration**. Gemini interprets citizen text; it does **not** calculate scores, gaps, profiles, recommendations or budgets. The read-only service reuses `getWaterPriority()` and performs no database writes or Gemini calls.

Thresholds live in `backend/src/config/waterPlanning.js`. They apply to the existing display-rounded analytics values: high demand means `demandIndex >= 50`; high gap means `infrastructureGap >= 20`. Exact boundary values are high. No priority calculations are duplicated or modified.

| Profile | Planning consideration |
| --- | --- |
| HIGH_DEMAND_HIGH_GAP | Explore targeted household water-access expansion |
| HIGH_DEMAND_LOW_GAP | Investigate localized water-supply reliability |
| LOW_DEMAND_HIGH_GAP | Validate potentially under-reported access needs |
| LOW_DEMAND_LOW_GAP | Monitor coverage and maintain service quality |
| INSUFFICIENT_DATA | Review available infrastructure data (`REVIEW_DATA`) |

Incomplete analytics or invalid/missing demand, gap or coverage never produce a guessed profile. Evidence retains the analytics values, including nulls. The rule uses no district names and does not infer exact locations, construction requirements, costs, beneficiaries or timelines. Aggregate connection and demand measures cannot diagnose the cause of a service problem.

The Rural Water view includes **Planning Insight**, showing the backend action, rationale, evidence and limitations. It loads independently with a GET-only retry and refreshes after district selection or successful submission. The ranking table remains compact. The visible prototype label and disclaimer apply to every profile, including incomplete data.

Every result notes synthetic/AI demonstration citizen demand, relative normalization, Census **2011** rural population, the configured JJM snapshot **21/09/2026**, and that reported connections do not independently establish water quantity, quality, pressure or regularity. Actual coverage provenance remains in the reused methodology response. These are prototype planning considerations, **not official government recommendations**, and require local verification.

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

Architecture: routes validate request bodies; controllers handle HTTP; the shared analysis service calls an isolated Gemini client and validates output; the create service alone persists an explicit field mapping through Prisma. The client has a fixed server instruction, separate JSON-encoded citizen data, a 30-second abort/deadline per attempt and bounded retries/fallbacks described below. No function calling, agents, RAG, embeddings or database access is provided to Gemini. Prompt-injection-like text cannot set the server instruction, schema, model, database IDs or write fields. These boundaries and output validation do not guarantee that real model classifications resist every semantic manipulation; tests verify server behavior, not model accuracy.

`POST /api/citizen-requests/analyze` accepts text and an optional districtId for historical settlement resolution:

```json
{ "text": "Our village pipeline has been broken for two weeks." }
```

Text must be a string, at most 5,000 JavaScript characters (UTF-16 code units) before trimming, and nonempty after trimming. The endpoint returns HTTP 200 with `{ "success": true, "data": { ...validatedAnalysis, "model": "gemini-3.8-flash" } }`. It never writes to the database. When districtId is supplied it reads and validates that district before Gemini; without districtId it performs no database lookup.

`POST /api/citizen-requests` accepts only:

```json
{ "districtId": 1, "text": "Our village pipeline has been broken for two weeks.", "channel": "TEXT" }
```

districtId must be a positive JSON integer within the MySQL Int range and refer to an existing district. It is checked before calling Gemini. channel is required and must be TEXT, VOICE or MESSAGING; these describe the origin of supplied **text**, with no audio or speech processing. The service analyzes the text and returns HTTP 201 with `{ "success": true, "data": createdCitizenRequest }`. It stores the trimmed original text, application-supplied district/channel, validated AI fields, actual successful model, confidence and server processing timestamp. IDs and timestamps come from the server/database; coordinates remain null. Extra body fields, such as a client-supplied category, confidence, model, arbitrary district names, or priority score, are rejected.

Migration **20260923090000_citizen_request_ai_analysis** adds nullable `summaryEnglish` (TEXT), `locationText`, `aiModel`, `aiConfidence`, and `aiProcessedAt` to CitizenRequest. Production startup applies committed migrations; existing requests are not reclassified or backfilled. Existing 32 synthetic demo requests remain valid with null AI fields. Census and JJM records are unchanged. For another environment, run `npx prisma migrate deploy` and `npm run prisma:generate` before using the new fields.

The instruction uses UNKNOWN unless rural/urban context is explicit, OTHER for a meaningful civic issue that does not clearly fit another category, the shared LOW/MEDIUM/HIGH/CRITICAL evidence-based urgency rubric, and CRITICAL only for a credible immediate serious emergency. summaryEnglish must preserve meaning; schemes, places, dates and other details must not be invented. Output enums, nullable fields, confidence 0–1, short uppercase subcategories and absence of extra fields are enforced before either endpoint succeeds.

| Condition | HTTP | Public message |
| --- | ---: | --- |
| Invalid input, channel or ID type | 400 | Invalid request |
| Non-civic or meaningless content | 422 | Please describe a local civic or infrastructure problem. |
| Unknown district | 404 | District not found |
| JSON body exceeds 100kb | 413 | Request body too large |
| Missing key/invalid model configuration | 503 | AI service is not configured |
| Exhausted transient timeout retries/fallbacks | 503 | AI service is temporarily unavailable |
| Exhausted primary/fallback capacity retries | 503 | AI service is temporarily unavailable |
| Network or Gemini service failure | 502 | AI service is temporarily unavailable |
| Invalid, blocked or truncated model output | 502 | AI service returned an invalid analysis |
| Database/internal failure | 500 | Internal server error |

The centralized handler never returns raw SDK/Prisma errors. Server error logs contain only status and a server-owned error code, not keys, full stacks, citizen text or model payloads. Failed analysis never creates a request. The create endpoint is not an upsert/idempotent submission API: repeated successful POSTs create separate requests. It is a deployed prototype with no authentication.

Normal `npm test` uses mocked Gemini responses and requires no API key. It covers English/Kannada/Hindi mock handling, schema and evidence checks, invalid inputs, missing configuration, failures/timeouts, prompt boundaries, zero-write analysis, explicit create mapping, and existing APIs. Mock classifications are not claims about real Gemini accuracy. No synthetic request was added to the real database during these tests. New successful rural WATER submissions will naturally enter the existing deterministic demand counts; this changes inputs, not the formula.

For a separate, explicit manual smoke test after configuring a key:

```bash
npm run smoke
```

This sends the English/Kannada/Hindi village-pipeline examples and one prompt-injection case to Gemini independently, prints each validated structured result, and never connects to Prisma or saves data. It is not part of `npm test` and real outputs may differ between languages or runs. The current Census 2011 population, JJM reported connections through 21/09/2026, and existing synthetic demand still support prototype demonstrations, not real policy recommendations.

Gemini availability: HTTP 408, 429, 500, 502, 503 and 504, local deadlines and explicit transient transport errors receive three primary retries after 1000, 2000 and 4000 ms, each with 0–249 ms random jitter. After exhaustion, the configured fallback models are attempted once each in order (default: gemini-3.6-flash, then gemini-3.5-flash-lite). Generic errors, authentication/permission errors and invalid successful responses do not trigger switching. Each attempt retains a 30-second deadline. All models share the same instructions, input, JSON Schema and application validation. Returned `model` and saved `aiModel` identify the successful model. Configuration uses `GEMINI_FALLBACK_MODELS`; the old singular variable is no longer used. The manual `npm run smoke` command attempts English, Kannada, Hindi and a prompt-injection case independently, prints a summary, and exits nonzero after all cases if any failed. It never saves requests. Retry sleep and randomness are injectable in tests.

## Civic-content validation

Both `POST /api/citizen-requests/analyze` and `POST /api/citizen-requests` use the same validation path for typed text and reviewed voice transcripts. Existing structural checks retain the 5,000-character maximum, district/channel validation and strict structured-response checks.

Unicode-aware prechecks reject clearly meaningless number/symbol-only or repeated-character input before Gemini. Gemini's required boolean `isCivicRequest` assesses whether the text describes a plausible local civic/infrastructure issue; OTHER is not a catch-all for irrelevant text. Invalid/non-civic content returns controlled **HTTP 422** and is not stored. Missing or malformed AI verdicts fail closed as invalid AI output. Empty/malformed request bodies remain covered by structural validation.

Final submission re-analyzes independently and does not trust client-supplied preview results. Standalone SQL-looking strings, code snippets, gibberish and unrelated questions are treated as data for rejection, never executed. A genuine civic report may quote technical text; this is not a keyword blacklist or SQL-sanitization mechanism. Prisma handles persistence; citizen text is never raw SQL.

The form preserves text and district selection and displays:

> We couldn't identify a civic or infrastructure issue in this request. Please describe the local problem, location, and what is affected.

Short meaningful English, Kannada and Hindi reports remain supported. Semantic validation reduces irrelevant submissions but is not infallible; mocked tests do not establish real model accuracy.

## Historical Karnataka settlement resolution

The registry is built only from the supplied official Census PCA workbooks:

- `backend/data/raw/census-settlements/2011-IndiaStateDistSbDistVill-0000.xlsx`
- `backend/data/raw/census-settlements/2011-IndiaStateDistSbDistTwn-0000.xlsx`

Both have `Data` and `Record Structure` sheets, with headers in Data row 1. Geographic fields are identified by their header names: State, District, Subdistt, Town/Village, Ward, EB, Level, Name and TRU. Parent DISTRICT and SUB-DISTRICT Total rows supply names keyed by their codes. Only state 29, exact VILLAGE/Rural or TOWN/Urban rows with zero Ward/EB are retained. No population threshold or place-name pattern determines classification.

From the backend directory run `npm run import:settlements -- --dry-run`, then `npm run import:settlements`. Neither command connects to the database. The streaming JavaScript reader is necessary because the 334 MB village XLSX expands to over 2 GB of worksheet XML. Raw files stay ignored and are never changed. SHA-256 source hashes and shared source/year provenance are recorded in the tracked processed JSON. Runtime reads only this Karnataka registry, not the all-India workbooks. Direct ZIP/XML dependencies were already transitive dependencies of the existing workbook reader.

The supplied sources contain 29,340 Karnataka village rows and 371 town rows (347 unique town codes), across 30 historical districts. Town+outgrowth aggregates and core towns sometimes share a code; BBMP also has rows across subdistricts. Preserve source rows and reconcile those variants by Census code at runtime. Exact duplicate rows, inconsistent codes or missing parents fail import. Terminal inspected administrative suffixes (CMC, TMC, TP, CT, M Corp., NAC, CB, optional + OG and Part) provide explicit base-name aliases; the source name remains unchanged. Different codes retain ambiguous identity, but same-type candidates can establish the area type without choosing a settlement code.

The shared resolver runs after validated civic Gemini analysis for both preview and creation. The selected district is a hard geographic search boundary: its application name resolves through the historical crosswalk, and no candidate from another district is searched. Gemini cannot choose or change the selected district. The API accepts optional validated districtId for preview; the UI supplies it. Without district context, settlement enrichment is skipped.

Gemini returns verbatim original-script `locationText` and may return nullable `locationTextLatin`, a Latin phonetic rendering of the same place (maximum 191 characters). The latter is only a validated search hint, not an authoritative classification, request translation or persisted database column.

Resolution precedence:

1. Preserve explicit reliable AI RURAL/URBAN context.
2. Apply an exact verified district-scoped municipal override.
3. Match either location field exactly against district Census canonical names and aliases.
4. Try conservative district-scoped fuzzy matching.
5. Leave unresolved or mixed-type candidates UNKNOWN.

Lookup uses Unicode NFKC, lowercase and punctuation/whitespace normalization, including harmless spacing differences; canonical source names remain untouched. Fuzzy matching uses normalized edit distance, Latin names of at least **8 characters**, the same initial letter, **at least 80% similarity**, and at most **2 edits**. Equal-length names allow only **1 edit**. A **5-percentage-point near-tie margin** retains close contenders rather than claiming uncertain identity. Exact matches always precede fuzzy matching. These are conservative heuristics, not proof of geographic identity.

All strong RURAL candidates can establish RURAL; all URBAN candidates can establish URBAN. Multiple possible identities produce no unique settlement code or canonical-name claim. Mixed RURAL/URBAN candidates remain UNKNOWN. Internal diagnostics record method, candidate count, unique identity when available and fuzzy similarity; normal responses omit these diagnostics.

Example: selected district **Kolar**, Kannada location **ಬೈರಸಂದ್ರ**, Latin hint **Bairasandra**, Census candidate **Byrasandra** → **RURAL**. This is matching inside Kolar, not statewide guessing. Preview and final submission share this resolver, while final submission still performs fresh AI analysis. No existing request is reprocessed.

Name-only crosswalks: Bangalore → Bengaluru Urban, Bangalore Rural → Bengaluru Rural, Mysore → Mysuru, Tumkur → Tumakuru, Belgaum → Belagavi, Bijapur → Vijayapura, Gulbarga → Kalaburagi, Bellary → Ballari, Shimoga → Shivamogga and Chikmagalur → Chikkamagaluru. Existing project Census mappings and the [MHA 2014 naming record](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2014-pdfs/ls-161214/3797.pdf) underpin these spelling aliases. They do not reconcile changed district boundaries. Original Census district spellings are also accepted.

Vijayanagara was formed after 2011 from Bellary/Ballari territory ([district history](https://vijayanagara.nic.in/en/history/)). No verified settlement-level current-boundary crosswalk is supplied: UNKNOWN stays UNKNOWN for that district. A modern district name is not proof that every former district settlement still belongs to it.

A separate municipal-locality supplement contains exactly Uttarahalli and Jayanagar, scoped to Bengaluru Urban/Bangalore, backed by the [BBMP zonal classification](https://site.bbmp.gov.in/zonalclassification.html). These URBAN overrides are explicitly municipal evidence, not Census town classifications, and only apply to exact locality matches when AI says UNKNOWN. No inference is made for “near Uttarahalli”, broader addresses or similarly named places elsewhere. New aliases require reviewed evidence; no individual request adds aliases automatically.

Census settlement classification is historical **2011** administrative context, not guaranteed current municipal status or a live boundary service. Registry provenance is shared at file level; municipal provenance lives in its separate configuration. With no schema change, a stored areaType alone does not prove whether AI, Census or municipal evidence supplied it. Existing records are not reprocessed. The statewide registry does not expand selectable districts or the eight-district Census/JJM water dataset. Resolved URBAN and UNKNOWN still contribute to general Citizen Demand, while only RURAL WATER is eligible for existing rural-water scoring. Scoring and official population/coverage values are unchanged.

Observed ambiguity examples: Mandya has Gondihalli villages in both Krishnarajpet and Nagamangala; Hassan has multiple Haralahalli villages as well as Haralahalli (CT). Gondihalli can now resolve RURAL by same-type consensus without a unique identity; bare Haralahalli remains UNKNOWN because rural and urban candidates coexist. A full, unique Census name such as Haralahalli (CT) can match. Positive tests instead use unambiguous Madapuranala (Mandya), K. Basavanahalli (Mysore), Hirimande (Hassan), Hadnal (Belgaum) and Jamga Khandala (Gulbarga), together with towns in those districts.

## Speech-to-Text

### Optional microphone input

Choose English (`en-IN`), Kannada (`kn-IN`) or Hindi (`hi-IN`), then Start recording. A supported secure-context Chrome/Edge browser records `audio/webm;codecs=opus` (mono requested, 64 kbps; native microphone capture rate). Stop manually or let the 45-second timer stop it. Unsupported browsers retain typed input. Microphone tracks stop on completion, error, or unmount, including late permission responses; unmount also aborts any pending upload. HTTPS (or localhost) and user microphone permission are required. Type and Speak panels share a roughly 62/38 desktop/tablet layout and stack at 700px or narrower.

The browser uploads to `POST /api/speech/transcribe` using multipart fields **`audio`** (one WebM file), **`languageCode`**, and optional **`districtName`**, captured when recording starts. The backend accepts only the eight canonical Census application district names and derives historical spellings from the existing Census alias mapping. Arbitrary hints and unknown fields are rejected. It never sends credentials. The backend uses memory-only Multer upload handling, then a controller/service and Google's official `@google-cloud/speech` **V2 synchronous** client with Application Default Credentials. There is no database dependency, audio file storage, streaming, browser SpeechRecognition, or automatic Gemini call.

Recognition uses the official @google-cloud/speech V2 SpeechClient and synchronous recognize method, with endpoint us-speech.googleapis.com and implicit recognizer projects/GOOGLE_CLOUD_PROJECT/locations/us/recognizers/_. GOOGLE_CLOUD_PROJECT is read from the server environment; missing/invalid configuration produces a controlled service-unavailable response. ADC remains unchanged. No persistent recognizer is created.

All three locales (en-IN, hi-IN, kn-IN) use model chirp_3, languageCodes containing only the selected locale, autoDecodingConfig: {}, and features: { enableAutomaticPunctuation: true }. Uploaded audio is supplied as inline content bytes. Automatic decoding replaces explicit codec/sample-rate/channel settings; browser WebM/Opus stays unchanged without resampling or transcoding.

Context uses adaptation.phraseSets[].inlinePhraseSet.phrases with individual { value } objects and no boost. Only the existing civic terminology and validated district canonical/historical names are included, for all three locales. English civic terms may assist mixed-language speech. No arbitrary client hints, personal locality hardcoding or persistent PhraseSet resources are added. The primary transcript is returned without rewriting; Analyze and Submit remain separate.

Google's [V2 language matrix](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages) lists Chirp 3, punctuation and adaptation for all three locales in us. The [Chirp 3 guide](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3) documents synchronous Recognize and the implicit recognizer; Kannada is listed as Preview. Audio is processed in the US multi-region. The 30-second provider deadline, 1 MiB upload limit, rate limits and safe errors remain in force.

Repeat live 10–45 second English/Hindi/Kannada complaints manually, including water quality, affected houses and a local area name. Verify project API/IAM access, latency, punctuation and editable output. Automated tests mock Speech and cannot establish real recognition quality.

Successful response:

```json
{"success":true,"data":{"transcript":"Recognized citizen text","languageCode":"en-IN","noSpeech":false}}
```

Empty recognition returns an empty transcript with `noSpeech:true`. Validation errors return controlled 400/413 responses, quota limits return 429, and provider/authentication failures return a safe 503. No provider messages, credential paths, tokens, audio or transcripts are logged. Transcripts append to existing text, invalidate previous analysis, and remain editable. Analyze and Submit are disabled while recording/transcribing and always require explicit user action. The existing text-submission channel remains `TEXT`; voice only supplies editable text. Text is never silently truncated to fit the 5,000-character limit.

Uploads are limited to **1 MiB**, one audio file and one language field. WebM MIME/header checks reject obvious invalid files; Google validates actual decoding. The browser enforces 45 seconds; this is not a server-side duration parser. Calls use a 30-second SDK deadline and no automatic retries. See the [V2 Chirp 3 guide](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3).

### Speech credentials and paid-endpoint limits

On Render retain `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-speech-service-account.json` and your configured `GOOGLE_CLOUD_PROJECT`. The mounted service-account JSON stays outside the repository. Local speech testing requires ADC or a local credential path outside the checkout; no JSON is provided or committed. Existing `DATABASE_URL`, CORS, Gemini configuration and production bootstrap remain unchanged. The Speech client is lazy: health and typed workflows do not require Speech credentials.

The speech route limits **5 attempts per client per 10 minutes in production**, **30 in development/test**, plus **60 attempts per process per 10 minutes**, before buffering audio or calling Google. IPv6 clients are grouped by subnet. Counts are memory-only and reset on restart; multiple instances have separate quotas. This reduces abuse risk but is not authentication or a global billing guarantee. Google project quotas remain the final external spending control.

`TRUST_PROXY_HOPS` configures a bounded numeric hop count: default **0 locally**, **1 when Render sets `RENDER=true`**. Never set blanket `trust proxy=true` or trust arbitrary leftmost forwarded headers. [Render forwards client information through its ingress](https://render.com/articles/how-render-handles-ddos-attacks); verify the trusted hop count for your service's ingress: confirm two independent clients get separate rate-limit budgets and spoofing extra leftmost `X-Forwarded-For` entries cannot reset one client's budget. If the nearest forwarded address is another proxy, the conservative default may group clients together. Set an explicit higher count only after verifying all paths and header sanitation. No diagnostic IP endpoint is exposed.

## District Intelligence mapping

The supplementary map uses **Google Maps JavaScript API**, the official `@googlemaps/js-api-loader` and `AdvancedMarkerElement` (no deprecated legacy Marker). Set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` at Vite build time. Restrict the public browser key to Maps JavaScript API and your frontend HTTP referrers. The key is intentionally browser-visible; never use a server/service-account credential here. Missing configuration leaves a friendly disabled map, while district analysis stays usable. Only maps, marker and core libraries are loaded: no Places, Geocoding, Routes or coordinate lookup calls.

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

### Map failure handling and source attribution

Loading is bounded at 20 seconds and failures stay inside the map area. Missing references omit only those markers. Existing OSM-sourced coordinates and their attribution remain; map imagery and controls are supplied by Google. All map tests mock the SDK, and no live coordinate requests are needed. District names, reference disclaimers, and analytics remain unchanged.

## Data sources & provenance

Raw official files are preserved and ignored; small processed extracts carry provenance and support reproducible deployment.

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

**Census 2011 population is historical demographic context, not a 2026 population estimate.** Name aliases align the application with the source labels; they do not perform a boundary harmonization or estimate later administrative changes. Water priority now uses rural population and rural WATER requests. The min-max normalization, 50/50 weights, thresholds, rounding and incomplete-data rules remain unchanged; rankings change with the rural inputs. Baseline requests remain synthetic and live submissions may coexist; current water coverage is official JJM reported coverage. Scores remain prototype outputs, not official findings.

## JJM rural tap-connection import

Official source: [Jal Jeevan Mission J1 report](https://ejalshakti.gov.in/JJM/JJMReports/Physical/Rpt_JJM_VillageWisePWSReport.aspx). The paired J5 export and its inspected provenance are documented in `backend/data/raw/README.md`.

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

Source date **2026-09-21** comes explicitly from J5. J1 itself has no date; matching J1/J5 household and connection totals reconciles this supplied pair without inventing a separate J1 timestamp. The metric represents **JJM-reported rural household tap-connection coverage as of 21/09/2026**, not independently verified water-service functionality. Matching totals do not certify water quantity, quality, or regularity. Census 2011 rural population remains historical context; current administrative boundary compatibility is not established by matching names alone. Baseline citizen requests are synthetic; live prototype submissions can coexist.

From `backend/`, the safe validation command is:

```bash
npm run import:jjm -- --dry-run
```

Dry-run validates both sources, prints all eight rows and both reconciliation results, writes `data/processed/jjm-karnataka-rural-coverage-2026-09-21.csv`, and makes **zero database connections or writes**. The CSV has exactly the eleven requested fields and eight target districts. Database replacement eligibility is checked only by the real command.

Migration **20260922120000_jjm_metric_provenance** adds nullable `InfrastructureMetric.sourceDate` and `sourceUrl`. For another initialized environment requiring a raw-source import, the sequence is:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run import:jjm
```

The real import prints the same source-validation table before acquiring Prisma. A serializable transaction preflights all eight existing Karnataka districts and requires exactly one existing `RURAL_FHTC_COVERAGE` metric each. Only an exact fictional demo source/year or this same official JJM snapshot is replaceable. Missing/duplicate metrics or unrelated sources abort without choosing, deleting, or overwriting them. It updates existing IDs in place with `unit=PERCENT`, `source=Jal Jeevan Mission`, `sourceYear=2026`, `sourceDate=2026-09-21T00:00:00.000Z`, the official J1 report URL, and the full-precision coverage. Reruns skip unchanged rows and timestamps. No Census fields, requests, or other metric types are written. Seed reruns preserve existing official rural coverage instead of recreating demo metrics. Run import/seed commands serially.

Analytics weights, thresholds, normalization, denominator for demand, sorting and missing-data rules are unchanged. Methodology metadata identifies the Census 2011 demographic context, JJM import context, synthetic citizen demand and prototype scoring. Its `coverageData` checks selected metric provenance to distinguish demo, official, mixed and missing sources; dry-run preparation does not relabel existing demo metrics as official. The provenance migration is a prerequisite for the updated selection.

The tests use small synthetic HTML fixtures and an isolated transactional database double. They cover HTML detection, aliases, headers, date/year, all six bands, exact reconciliation, private connections, invalid inputs, inclusive denominator, precision, no-connection dry run, in-place replacement, preservation, idempotency, seed protection and existing APIs. They do not require or commit the raw exports.

## API summary

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/health` | Process health; no database/Google call |
| GET | `/api/analytics/citizen-priorities` | General civic-demand counts |
| GET | `/api/analytics/water-priority` | Rural-water scores and methodology |
| GET | `/api/analytics/water-planning` | Deterministic planning considerations |
| POST | `/api/citizen-requests/analyze` | Validated preview; no writes |
| POST | `/api/citizen-requests` | Revalidated request creation (201) |
| POST | `/api/speech/transcribe` | Reviewed-text input from audio; no request creation |
| GET | `/api/districts` | Districts sorted by name and state |
| GET | `/api/districts/:id` | One district |
| GET | `/api/districts/:id/requests` | That district's requests, newest first |
| GET | `/api/districts/:id/infrastructure` | That district's infrastructure metrics |

Successful district responses use `{ "success": true, "data": ... }`. Collections return arrays, including an empty array when an existing district has no matching records. IDs must be positive decimal integers without leading zeros and within the MySQL signed Int range. Invalid IDs return HTTP 400, and unknown districts return HTTP 404 on all three ID-based routes. Database failures go through the centralized handler and return a generic HTTP 500 without exposing Prisma details. District routes remain read-only; citizen-request submission is a separate endpoint. The Home dashboard consumes these read-only APIs.

## Local setup

Requires Node.js **22.12+** and npm; MySQL 8 is needed for local persistence. Each app has its own package/lockfile; there is no root npm application.

From the repository root in PowerShell (copy environment examples only if a local file does not already exist):

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
cd ../backend
npm ci
Copy-Item .env.example .env
npm run prisma:generate
```

Set local backend credentials privately in ignored `backend/.env`, for example the placeholder connection `mysql://USER:PASSWORD@localhost:3306/civic_intelligence`. Configure Gemini and Speech only when using those services. The health route and mocked tests do not need MySQL or live Google credentials. Configure frontend `VITE_API_BASE_URL` as needed; its development default is `http://localhost:3000/api`.

For a fresh, empty local database with the production evidence baseline:

```powershell
# From backend/
npx prisma migrate deploy
npm run bootstrap:production
npm run dev
```

Start `npm run dev` from `frontend/` in a second terminal and open the Vite URL. Bootstrap details and safety rules appear below. The optional development `npm run prisma:seed` instead uses fictional population/coverage fixtures before source imports; it is not the production initializer. Never reset an existing database to follow setup instructions.

Repository layout: `frontend/src/components` holds dashboard/form/map/voice components; `pages/Home.jsx` owns navigation; `services` holds API/Maps clients. Backend `src` contains routes, controllers, services, validators, prompts, schemas and configuration; `prisma` contains models, migrations and demo fixtures; `scripts/import` contains source importers; `data/processed` contains deployment extracts and the settlement registry. Preserve ignored raw source files separately.

## Production deployment: Firebase → Render → Aiven

The prototype is deployed: Firebase Hosting serves React/Vite, Render runs the Node/Express API, and Prisma connects to Aiven MySQL. Use Node 24 (at least 22.12). Do not copy a local database or run the development demo seed in production.

### Aiven MySQL and backend environment

For a new environment, provision an empty MySQL database separately. Aiven supplies the host, port, database, username, password and project CA certificate; none is hardcoded. Supply Render with:

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

CORS accepts only exact configured origins. Production startup rejects missing/invalid configuration; preview domains must be listed explicitly rather than wildcarding preview hosts. Without configuration, development permits `http://localhost:5173` and `http://127.0.0.1:5173`. Requests without an Origin header remain allowed for health checks/server clients. CORS is browser access control, not authentication. No Gemini or database credential belongs in a `VITE_` variable.

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

### Firebase Hosting frontend

Firebase serves `frontend/dist`; unknown frontend routes rewrite to `/index.html`. Use the existing repository-root Firebase configuration. Authenticate and select the intended project manually with Firebase CLI:

```powershell
firebase login
firebase use civic-intelligence-9d29a
cd frontend
npm ci
$env:VITE_API_BASE_URL = 'https://civic-intelligence-api-jlh9.onrender.com/api'
$env:VITE_GOOGLE_MAPS_API_KEY = 'YOUR_HTTP_REFERRER_RESTRICTED_BROWSER_KEY'
$env:VITE_GOOGLE_MAPS_MAP_ID = 'YOUR_MAP_ID'
npm run build
cd ..
firebase deploy --only hosting
```

Replace the Maps placeholders locally before a real deployment; no real key belongs in this README. These three build-time variables configure the deployed frontend. The production build rejects missing, localhost, non-HTTPS or credential-bearing API URLs. Missing Maps credentials leave the map disabled rather than blocking other views. Rebuild when changing Vite environment values. Add `https://civic-intelligence-9d29a.web.app` (and any other intentionally used exact frontend origin) to Render's `CORS_ALLOWED_ORIGINS` and the Maps key's HTTP-referrer restrictions.

All `VITE_` values are browser-visible. Never include Gemini keys, database credentials or service-account credentials. The Maps browser key is intentionally public at runtime; restrict it by HTTP referrer and to Maps JavaScript API.

## Testing and validation

Latest completed automated validation after civic-content validation:

- **281 backend tests passed**.
- **71 frontend tests passed** (Node API-loader tests plus Vitest component tests).
- Frontend production build passed.
- **78 JavaScript syntax checks passed**.
- Prisma validation passed.
- Security scan found no secrets.

```powershell
cd backend
npm test
npm run prisma:validate
cd ../frontend
npm test
npm run build
```

Provide the production build variables documented above before building. Prisma validation requires a configured DATABASE_URL but does not connect to MySQL. Generate Prisma Client first on a fresh checkout. Automated tests mock Gemini, Speech, Maps and database operations; they do not verify real Gemini semantic accuracy or real speech recognition quality. Live behavior depends on external services, credentials, quotas, model availability and network conditions. Manual browser checks should cover mobile layout, microphone permission/cleanup, transcript editing, map interaction and Analyze/Submit feedback. `npm run smoke` is a separate explicit real Gemini operation, never an automated-test prerequisite.

## Security

Never commit .env files, Gemini API keys, database credentials, Google service-account JSON, Aiven CA files or server credentials. Commit placeholder-only .env.example files. Build output, dependencies and raw source workbooks/exports remain ignored. VITE_ variables are public browser configuration, never server-secret storage. Restrict the Maps browser key to approved HTTP referrers and Maps JavaScript API.

CORS is not authentication. No authentication has been implemented. Review access control, abuse prevention and service quotas before broader public use. The existing dependency-audit finding in Prisma → @prisma/config → deepmerge-ts ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) requires a separately reviewed dependency update; no dependency changes are part of this documentation update.

## Limitations

- Prototype, not an official government decision system or policy recommendation.
- Synthetic baseline requests coexist with live submissions; general counts are not representative population statistics.
- Census population and settlement geography are from 2011, not current population estimates or guaranteed current boundaries.
- JJM reports tap connections, not independently verified quality, reliability, pressure or regular service.
- Only Rural Water currently has deep official-data integration; the evidence dashboard covers eight verified districts.
- AI interpretations and civic semantic validation can be imperfect; human review and local verification remain necessary.
- No authentication or submission idempotency keys; repeated successful submissions create separate records.

## Future scope

Potential extensions include authentication and stronger abuse controls, reviewed evidence integration for additional sectors/districts, updated demographic/boundary crosswalks, and field validation of service quality. These are future possibilities, not implemented capabilities.

Built by **Kiran Bhaskaran Lakshman**.
