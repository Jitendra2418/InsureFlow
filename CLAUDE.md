# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docs vs. reality

`README.md`, `InsureFlow-Architecture.md` and `DATABASE_AND_AUTH_GUIDE.md` describe a planned stack (JPA entities, Flyway, Spring Security, S3, SES, refresh tokens, Playwright). The real backend is a **Spring Boot 3.5 / Java 21 port of a former Express server**. It uses plain JDBC with the original SQL. The business rules in those docs apply; their commands, ports and endpoint lists don't.

## The one rule for backend work

The backend was migrated 1:1 from `backend/server.js` (deleted; see git history before the migration). **Every response must stay byte-compatible with what Express returned**, because the frontend was built against it. That includes behaviour that looks wrong:
- mixed key casing (`RETURNING *` rows are sent raw with snake_case, e.g. `POST /api/claims`, audit logs' `old_value`)
- NUMERIC/BIGINT columns returned as strings when a row is sent raw (`"amount":"90.00"`), but numbers where the old code called `parseFloat`
- DATE columns shifted by the machine's UTC offset (`2026-10-01` comes out as `"2026-09-30T18:30:00.000Z"` in IST; billing months are stored as e.g. `2026-10-31`). The user chose to keep this.
- error bodies are always `{ "error": "..." }`, and DB errors are `"Database error: " + <Postgres message>`

The `support/` package exists to reproduce JavaScript and node-pg semantics. Use it in new code instead of plain Java equivalents:
- `Js`: truthiness, `parseFloat`/`parseInt`/`Number()`, `toFixed`, JS number printing (90.0 → `90`), `UNDEFINED` for absent body keys (dropped from JSON), and `trim()` that throws JS-style TypeErrors
- `JsDate`: JS `Date` semantics in the JVM's local zone
- `Db`: `$n` placeholders, all params sent as text (`stringtype=unspecified`), result types converted like node-pg, raw Postgres error messages
- `Jwt`: HS256 compatible with `jsonwebtoken` (24h, payload `{id,email,role}`). It's on the JDK deliberately, because jjwt rejects secrets under 32 bytes.
- `Env`: reads `backend/.env` with dotenv rules; settings are `process.env.X || default`

## Commands

```bash
cd backend
./mvnw spring-boot:run                                   # API on :8080 (Windows: mvnw.cmd)
./mvnw spring-boot:run -Dspring-boot.run.profiles=worker # billing cron worker, no HTTP
RUN_BILLING_NOW=true ./mvnw spring-boot:run -Dspring-boot.run.profiles=worker   # run billing once now
./mvnw test                                              # unit tests
./mvnw test -Dtest=JsSemanticsTest#datesParseLikeV8      # single test
./mvnw package && java -jar target/insureflow-api-1.0.0.jar

cd frontend && npm run dev     # :5173, proxies /api to 127.0.0.1:8080
npm run build                  # tsc && vite build (the only frontend type check)
```

Config comes from env vars or `backend/.env` (`PORT`, `DB_HOST`, `DB_PORT` default 5433, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`). Run from `backend/` so `.env` is found.

## Database

- No file in the repo used to describe the full schema the code needs. The schema of record is `backend/src/main/resources/db/migration/V1` + `V2` + `V3`. V3 was reconstructed from the SQL the code runs (lines marked `GUESS` have inferred types) and verified by running every route against it. Nothing runs these files automatically: there is no Flyway, apply them by hand.
- `database/init.sql` (used by `docker-compose.yml`) is **incomplete**: products, campaigns, events, segments, claims and billing routes fail against it.
- At startup the API runs `CREATE TABLE IF NOT EXISTS payment_retry_queue` plus two `ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS`, as the Node server did.
- Each pooled connection sets its session `TimeZone` back to the server/database default (see `AppConfig.dataSource`), because node-pg never sent one. This decides `CURRENT_DATE` and how `json_agg` prints timestamps.

## Frontend (`frontend/src/`)

- All HTTP goes through `apiRequest<T>()` in `api/index.ts`. It adds the bearer token from `localStorage['insureflow_token']` and throws `Error(data.error)` when a response is not OK.
- `context/AuthContext.tsx` stores `insureflow_user` and `insureflow_token`. `App.tsx` guards routes by role: customers use `/login`, `/signup`, `/dashboard`; staff use `/admin/*`.
- `utils/ratingEngine.ts` is the client-side premium calculator. `utils/pdfCertificate.ts` builds certificates in the browser (jsPDF); there is no server-side PDF.

## Business rules (from README)

- Age 18–69 at enrollment. Cover $10,000–$300,000 in $5,000 steps. Premium = cover ÷ 1000 × $0.60 per month.
- One active AD&D policy per customer. Campaign codes are reusable (the code doesn't mark them used).
- Primary and contingent beneficiary percentages must each total 100% (±0.01). Minors need a guardian.
- A failed payment is retried at +3, +7 and +14 days (`payment_retry_queue`), then marked FAILED. Charges go through the random `MockPaymentGateway` (70% success).

## Git workflow

- Never commit directly to `main`. Use feature branches and PRs reviewed by the other developer.
- Branches and commits use the Jira key, e.g. `INS-7-monthly-billing-payment-retry` and `feat(INS-7): ...`.
