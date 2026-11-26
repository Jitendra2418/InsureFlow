# 🛡️ InsureFlow – Insurance Enrollment & Servicing Platform

<p align="center">
  <img src="https://img.shields.io/badge/Java-21-orange?style=for-the-badge&logo=openjdk" />
  <img src="https://img.shields.io/badge/Spring_Boot-3.2.x-brightgreen?style=for-the-badge&logo=springboot" />
  <img src="https://img.shields.io/badge/React-18.x-blue?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-316192?style=for-the-badge&logo=postgresql" />
  <img src="https://img.shields.io/badge/AWS-ECS_+_RDS_+_S3-FF9900?style=for-the-badge&logo=amazonaws" />
  <img src="https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions" />
</p>

> **Enterprise-level insurance enrollment and servicing platform** built for a bank–insurer partnership. Customers enroll in AD&D cover using campaign codes, manage their policies, and raise claims — all supported by a full operations and admin backend.

---

## 👥 Team

| Developer | Module | Role |
|-----------|--------|------|
| **Jitendra** | Enrollment & Policy | Customer-facing flows: enrollment, policy management, PDF certificates, audit history, cancellation |
| **Aman** | Campaign, Billing & Claims | Operations flows: campaign creation, billing scheduler, claims workflow, operations dashboard |

> 🤝 **Shared:** Authentication (JWT + Spring Security), database schema, API documentation, CI/CD pipeline, AWS infrastructure

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [Architecture Overview](#-architecture-overview)
4. [Module Breakdown](#-module-breakdown)
5. [Getting Started](#-getting-started)
6. [Environment Variables](#-environment-variables)
7. [Running Locally](#-running-locally)
8. [API Documentation](#-api-documentation)
9. [Database](#-database)
10. [Testing](#-testing)
11. [Deployment](#-deployment-aws)
12. [CI/CD Pipeline](#-cicd-pipeline)
13. [Project Structure](#-project-structure)
14. [Business Rules](#-business-rules)
15. [Git Workflow](#-git-workflow)

---

## 📌 Project Overview

InsureFlow supports the full lifecycle of an Accidental Death & Dismemberment (AD&D) insurance product offered by a bank to its customers via marketing campaigns:

```
Bank sends campaign mailer
        ↓
Customer receives unique campaign code
        ↓
Customer enrolls online → picks cover → adds beneficiaries
        ↓
Policy created → PDF certificate generated → stored in S3
        ↓
Monthly billing runs automatically
        ↓
Customer raises a claim → uploads documents → admin reviews
        ↓
Operations dashboard tracks campaign performance
```

### Product Catalog

| Product | Code | Covers | Status |
|---------|------|--------|--------|
| **AD&D** | DD | Death and listed losses from accidents | ✅ Flagship |
| HAP | HP | Hospital stays and ER visits from accidents | 🔜 Coming Soon |
| Recuperative Care | RC | Daily cash after discharge, accident or sickness | 🔜 Coming Soon |

---

## 🛠 Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Java | 21 (LTS) | Language |
| Spring Boot | 3.2.x | Application framework |
| Spring Security | 6.x | Auth & role-based access |
| Spring Data JPA / Hibernate | 6.x | ORM |
| JJWT | 0.12.x | JWT token generation & validation |
| Flyway | 10.x | Database migrations |
| iText 7 | Latest | PDF certificate generation |
| SpringDoc OpenAPI | 2.x | Swagger UI / API docs |
| JUnit 5 + Mockito | Built-in | Unit testing |
| Maven | 3.9.x | Build tool |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| React Router | 6.x | Client-side routing |
| Axios + React Query | Latest | HTTP client + server state |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | Latest | Component library |
| Vite | 5.x | Build tool |
| Playwright | 1.44.x | End-to-end testing |

### AWS Infrastructure
| Service | Purpose |
|---------|---------|
| ECS Fargate | Spring Boot container hosting |
| RDS PostgreSQL | Primary database + read replica |
| S3 | Claim documents + PDF certificates |
| CloudFront + S3 | React SPA hosting & CDN |
| Application Load Balancer | HTTPS termination + routing |
| Secrets Manager | DB credentials, JWT signing key |
| SES | Transactional emails (welcome, billing, claims) |
| CloudWatch | Logs, metrics, alarms |
| ECR | Docker image registry |
| ACM | SSL/TLS certificate |
| WAF | API rate limiting & protection |

---

## 🏗 Architecture Overview

InsureFlow uses a **Modular Monolith** pattern — clean module boundaries within a single deployable Spring Boot application. This is intentional for a 2-person team: simple deployment, no inter-service networking, easy to split into microservices later.

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront + S3                          │
│                   React SPA (3 portals)                     │
│         /customer   /admin   /ops                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│              AWS Application Load Balancer                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 ECS Fargate (Spring Boot)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │   Auth   │ │Enrollment│ │ Campaign │ │   Billing    │  │
│  │  Module  │ │& Policy  │ │ Module   │ │   Module     │  │
│  │ (Shared) │ │(Jitendra)│ │  (Aman)  │ │   (Aman)     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐                                  │
│  │  Claims  │ │Dashboard │                                  │
│  │ (Aman)   │ │  (Aman)  │                                  │
│  └──────────┘ └──────────┘                                  │
└───────────────────────────────────────┬─────────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────┐
              ▼                         ▼                  ▼
      ┌───────────────┐        ┌──────────────┐    ┌──────────┐
      │ RDS PostgreSQL│        │  AWS S3      │    │  SES     │
      │ Primary + Rep │        │  Docs + PDFs │    │  Email   │
      └───────────────┘        └──────────────┘    └──────────┘
```

---

## 📦 Module Breakdown

### 🔐 Auth Module (Shared)
- Customer self-registration & login
- Admin and Operations login (admin-created accounts)
- JWT access tokens (15-min) + refresh tokens (7-day)
- Role-based access: `ROLE_CUSTOMER`, `ROLE_ADMIN`, `ROLE_OPERATIONS`

### 📋 Enrollment & Policy Module — *Jitendra*
- Validate campaign code on entry
- Enroll customer: cover selection ($10K–$300K in $5K steps), beneficiary setup
- Business rule enforcement: age 18–69, no duplicate enrollment, premium = $0.60/$1,000/month
- Generate unique policy number + downloadable PDF certificate (stored in S3)
- View & update address / beneficiaries — every change logged to audit history
- Cancel policy with confirmation

### 📢 Campaign Module — *Aman*
- Create and manage bank clients
- Create campaigns linked to a client and product
- Add campaign events (Direct Mail, Digital Email) with segments
- Generate unique campaign codes in bulk

### 💳 Billing Module — *Aman*
- Monthly Spring `@Scheduled` job creates premium records for all active policies
- Failed payments flagged for retry (up to 3 retries → policy lapses)
- Operations team can view billing status and trigger manual retries

### ⚖️ Claims Module — *Aman*
- Customers submit claims with supporting documents (uploaded directly to S3 via pre-signed URL)
- Admin moves claims through: `SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED`
- Email notifications at each status change

### 📈 Dashboard Module — *Aman*
- Enrollments per campaign & response rate
- Active policies count
- Open claims count
- Failed billing summary

---

## 🚀 Getting Started

### Prerequisites

- **Java 21** – [Download](https://adoptium.net/)
- **Maven 3.9+** – [Download](https://maven.apache.org/)
- **Node.js 20+ / npm** – [Download](https://nodejs.org/)
- **PostgreSQL 16** – [Download](https://www.postgresql.org/)
- **Docker** (optional, for containerised local dev) – [Download](https://www.docker.com/)
- **AWS CLI** (for deployment) – [Download](https://aws.amazon.com/cli/)

### Clone the Repository

```bash
git clone https://github.com/<your-org>/insureflow.git
cd insureflow
```

---

## 🔐 Environment Variables

### Backend (`/backend/.env` or `application-local.yml`)

```yaml
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/insureflow
spring.datasource.username=insureflow_user
spring.datasource.password=your_db_password

# JWT
app.jwt.secret=your-256-bit-secret-key-here
app.jwt.access-token-expiry-ms=900000       # 15 minutes
app.jwt.refresh-token-expiry-ms=604800000   # 7 days

# AWS S3
aws.s3.bucket-name=insureflow-documents
aws.region=ap-south-1
aws.s3.presigned-url-ttl-minutes=15

# AWS SES
aws.ses.from-email=noreply@insureflow.com

# Flyway
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
```

### Frontend (`/frontend/.env.local`)

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_APP_NAME=InsureFlow
```

---

## 💻 Running Locally

### 1. Start PostgreSQL

```bash
# Using Docker (recommended)
docker run --name insureflow-db \
  -e POSTGRES_DB=insureflow \
  -e POSTGRES_USER=insureflow_user \
  -e POSTGRES_PASSWORD=your_db_password \
  -p 5432:5432 \
  -d postgres:16
```

### 2. Run the Backend

```bash
cd backend
mvn clean install -DskipTests
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Backend starts on: **http://localhost:8080**  
Swagger UI: **http://localhost:8080/swagger-ui.html**

### 3. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on: **http://localhost:5173**

### 4. Run with Docker Compose (Full Stack)

```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| React Frontend | http://localhost:5173 |
| Spring Boot API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| PostgreSQL | localhost:5432 |

---

## 📖 API Documentation

Swagger UI is available at `/swagger-ui.html` when the backend is running.

### Key Endpoints at a Glance

```
POST   /api/auth/register                    → Customer registration
POST   /api/auth/login                       → Login (all roles)
POST   /api/auth/refresh                     → Refresh JWT

GET    /api/products                         → List insurance products

POST   /api/enrollment/validate-code         → Validate campaign code
POST   /api/enrollment/enroll                → Enroll customer
GET    /api/policies                         → My policies
GET    /api/policies/{id}/certificate        → Download PDF certificate
PUT    /api/policies/{id}/address            → Update address
PUT    /api/policies/{id}/beneficiaries      → Update beneficiaries
DELETE /api/policies/{id}                    → Cancel policy
GET    /api/policies/{id}/audit              → Audit history

POST   /api/admin/clients                    → Create client (bank)
POST   /api/admin/campaigns                  → Create campaign
POST   /api/admin/campaigns/{id}/events      → Add event + segments
POST   /api/admin/campaigns/{id}/generate-codes → Generate campaign codes

GET    /api/ops/billing                      → Billing overview
POST   /api/ops/billing/run                  → Trigger billing job
POST   /api/ops/billing/{id}/retry           → Retry failed payment

POST   /api/claims                           → Submit claim
POST   /api/claims/{id}/documents            → Upload claim document
GET    /api/claims                           → List claims
PUT    /api/claims/{id}/status               → Update claim status (Admin/Ops)

GET    /api/ops/dashboard                    → Operations dashboard metrics
```

---

## 🗄 Database

InsureFlow uses **Flyway** for version-controlled database migrations.

### Migration Files Location
```
backend/src/main/resources/db/migration/
├── V1__create_users_and_roles.sql
├── V2__create_products.sql
├── V3__create_clients_and_campaigns.sql
├── V4__create_campaign_events_segments_codes.sql
├── V5__create_policies_and_beneficiaries.sql
├── V6__create_policy_audit_logs.sql
├── V7__create_premium_records.sql
├── V8__create_claims_and_documents.sql
└── V9__seed_products.sql
```

### Core Tables

| Table | Owner | Description |
|-------|-------|-------------|
| `users` | Shared | All users (customer, admin, ops) |
| `products` | Shared | Insurance product catalog |
| `clients` | Aman | Bank clients |
| `campaigns` | Aman | Marketing campaigns |
| `campaign_events` | Aman | Mail/email events under campaigns |
| `segments` | Aman | Customer segments per event |
| `campaign_codes` | Aman | Unique one-time enrollment codes |
| `policies` | Jitendra | Customer insurance policies |
| `beneficiaries` | Jitendra | Policy beneficiaries |
| `policy_audit_logs` | Jitendra | Full change history (JSON diff) |
| `premium_records` | Aman | Monthly billing records |
| `claims` | Aman | Customer claims |
| `claim_documents` | Aman | S3 document references |

---

## 🧪 Testing

### Unit Tests (JUnit 5 + Mockito)

```bash
cd backend
mvn test
# View coverage report
open target/site/jacoco/index.html
```

**Jitendra's test coverage targets:**
- `EnrollmentService` – age validation, duplicate check, premium calculation
- `PolicyService` – policy creation, cancellation, audit log entries
- `PdfCertificateService` – PDF generation
- `BeneficiaryService` – percentage validation

**Aman's test coverage targets:**
- `CampaignService` – campaign creation, code generation
- `BillingService` – premium calculation, retry logic, lapse logic
- `ClaimsService` – status transitions, document upload

### End-to-End Tests (Playwright)

```bash
cd frontend
npx playwright install
npx playwright test
npx playwright test --ui       # Interactive mode
npx playwright show-report     # HTML report
```

**Jitendra's E2E flows:**
1. Customer signup → login → enter campaign code → enroll → download PDF
2. Update address and beneficiaries → verify audit log
3. Cancel policy → verify cancellation confirmation

**Aman's E2E flows:**
1. Admin login → create client → create campaign → add events → generate codes
2. Ops login → view billing → retry failed payment
3. Customer submit claim → upload doc → admin approve claim

---

## ☁️ Deployment (AWS)

### Infrastructure Overview

```
ap-south-1 (Mumbai)
│
├── CloudFront + S3          → React SPA
├── Application Load Balancer → HTTPS → ECS
├── ECS Fargate              → Spring Boot (2 tasks across 2 AZs)
├── RDS PostgreSQL           → Primary (db.t3.medium) + Read Replica
├── S3 (private)             → Claim docs + PDF certificates
├── Secrets Manager          → DB creds, JWT key
└── SES                      → Transactional email
```

### Manual Deploy Steps

#### 1. Build and Push Docker Image

```bash
# Authenticate to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com

# Build and push
cd backend
docker build -t insureflow-backend .
docker tag insureflow-backend:latest <account-id>.dkr.ecr.ap-south-1.amazonaws.com/insureflow-backend:latest
docker push <account-id>.dkr.ecr.ap-south-1.amazonaws.com/insureflow-backend:latest
```

#### 2. Deploy Frontend to S3 + CloudFront

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://insureflow-frontend --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

#### 3. Run Database Migrations

Flyway migrations run automatically on application startup.  
To run manually:

```bash
mvn flyway:migrate -Dflyway.url=jdbc:postgresql://<RDS_ENDPOINT>:5432/insureflow
```

---

## 🔄 CI/CD Pipeline

GitHub Actions runs on every PR and merge to `main`.

```
On Pull Request:
  → Checkstyle + SpotBugs lint
  → Maven build
  → JUnit tests + JaCoCo coverage (minimum 80%)
  → Playwright E2E tests (preview environment)
  → PR requires approval from the other developer

On merge to main:
  → Docker build + ECR push
  → ECS rolling deploy
  → Flyway migration
  → React build + S3 sync
  → CloudFront invalidation
```

Pipeline files: `.github/workflows/`

```
.github/workflows/
├── pr-checks.yml      → Lint, test, build on PR
└── deploy.yml         → Full deploy on merge to main
```

---

## 📁 Project Structure

```
insureflow/
│
├── backend/                          # Spring Boot application
│   ├── src/main/java/com/insureflow/
│   │   ├── InsureFlowApplication.java
│   │   ├── shared/                   # Shared: security config, exceptions, audit base
│   │   │   ├── config/
│   │   │   │   ├── SecurityConfig.java
│   │   │   │   └── JwtAuthFilter.java
│   │   │   ├── exception/
│   │   │   │   └── GlobalExceptionHandler.java
│   │   │   └── audit/
│   │   │       └── AuditableEntity.java
│   │   ├── auth/                     # Auth module (shared)
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── entity/               # User, Role
│   │   │   └── repository/
│   │   ├── enrollment/               # Jitendra's module
│   │   │   ├── controller/
│   │   │   │   ├── EnrollmentController.java
│   │   │   │   └── PolicyController.java
│   │   │   ├── service/
│   │   │   │   ├── EnrollmentService.java
│   │   │   │   ├── PolicyService.java
│   │   │   │   ├── BeneficiaryService.java
│   │   │   │   └── PdfCertificateService.java
│   │   │   ├── entity/               # Policy, Beneficiary, PolicyAuditLog
│   │   │   ├── repository/
│   │   │   └── dto/
│   │   ├── campaign/                 # Aman's module
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── entity/               # Client, Campaign, Event, Segment, CampaignCode
│   │   │   ├── repository/
│   │   │   └── dto/
│   │   ├── billing/                  # Aman's module
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   │   ├── BillingService.java
│   │   │   │   └── BillingScheduler.java
│   │   │   ├── entity/               # PremiumRecord
│   │   │   ├── repository/
│   │   │   └── dto/
│   │   ├── claims/                   # Aman's module
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   │   ├── ClaimsService.java
│   │   │   │   └── ClaimsDocumentService.java
│   │   │   ├── entity/               # Claim, ClaimDocument
│   │   │   ├── repository/
│   │   │   └── dto/
│   │   └── dashboard/                # Aman's module
│   │       ├── controller/
│   │       ├── service/
│   │       └── dto/
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-local.yml
│   │   └── db/migration/             # Flyway SQL scripts
│   ├── src/test/java/com/insureflow/ # JUnit tests
│   ├── Dockerfile
│   └── pom.xml
│
├── frontend/                         # React application
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                   # Root router
│   │   ├── auth/                     # Login, signup, JWT context
│   │   ├── customer/                 # Customer portal pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── EnrollmentFlow.tsx
│   │   │   ├── PolicyDetail.tsx
│   │   │   ├── EditPolicy.tsx
│   │   │   ├── CancelPolicy.tsx
│   │   │   └── Claims.tsx
│   │   ├── admin/                    # Admin portal pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   ├── CampaignDetail.tsx
│   │   │   ├── Products.tsx
│   │   │   └── ClaimsManagement.tsx
│   │   ├── operations/               # Operations portal pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Billing.tsx
│   │   │   └── ClaimsReview.tsx
│   │   ├── components/               # Shared UI components
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── api/                      # Axios API clients
│   │   └── types/                    # TypeScript interfaces
│   ├── e2e/                          # Playwright tests
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── .github/
│   └── workflows/
│       ├── pr-checks.yml
│       └── deploy.yml
│
├── docker-compose.yml
└── README.md
```

---

## 📐 Business Rules

| Rule | Detail |
|------|--------|
| **Eligibility** | Age 18–69 at time of enrollment |
| **Cover range** | \$10,000 – \$300,000 in steps of \$5,000 |
| **Premium formula** | `monthly_premium = (cover_amount ÷ 1000) × $0.60` |
| **Example** | \$100,000 cover → **\$60.00/month** |
| **Duplicate enrollment** | One active policy per product per customer |
| **Beneficiaries** | All percentages must sum to exactly 100% |
| **Campaign codes** | Single-use; one code activates exactly one policy |
| **Billing retry** | Max 3 retries on failed payment → policy lapses |
| **Policy cancellation** | Immediate; cancellation date recorded |
| **Claim documents** | Stored in S3; accessed via 15-min pre-signed URLs |

---

## 🌿 Git Workflow

> ⚠️ **No direct commits to `main`. All changes go through Pull Requests reviewed by the other developer.**

### Branch Naming

```
jitendra/enrollment-flow
jitendra/policy-pdf-generation
jitendra/policy-audit-history
aman/campaign-management
aman/billing-scheduler
aman/claims-workflow
shared/auth-module
shared/db-schema-v1
```

### PR Rules

- Every PR must be reviewed and approved by the **other** developer
- All CI checks (lint, build, tests) must pass before merge
- Use squash merge to keep `main` history clean
- Link each PR to its Jira story

---

## 📬 Contact

| Developer | Jira Board | Module |
|-----------|-----------|--------|
| Jitendra | `INSURE-JITENDRA` | Enrollment & Policy |
| Aman | `INSURE-AMAN` | Campaign, Billing & Claims |

---

<p align="center">Built with ☕ Java, ⚛️ React & ☁️ AWS &nbsp;|&nbsp; InsureFlow &copy; 2026</p>
