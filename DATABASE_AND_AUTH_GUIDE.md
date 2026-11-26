# 🛡️ InsureFlow – Database & Authentication Integration Guide
> **For Developers:** Jitendra (Enrollment & Policy Module) & Aman (Campaign, Billing & Claims Module)  
> **Architecture Reference:** Modular Monolith with PostgreSQL 16 & Spring Security JWT

---

## 📌 Table of Contents
1. [Shared PostgreSQL Configuration](#1-shared-postgresql-configuration)
2. [Starting PostgreSQL with Docker Compose (Recommended)](#2-starting-postgresql-with-docker-compose-recommended)
3. [Starting PostgreSQL Locally (Native Installation)](#3-starting-postgresql-locally-native-installation)
4. [Database Schema & Ownership Breakdown](#4-database-schema--ownership-breakdown)
5. [Authentication & Authorization Integration](#5-authentication--authorization-integration)
6. [Backend Spring Boot Configuration](#6-backend-spring-boot-configuration)
7. [Frontend Setup & Color Palette Reference](#7-frontend-setup--color-palette-reference)
8. [Git Collaboration Workflow for Jitendra & Aman](#8-git-collaboration-workflow-for-jitendra--aman)

---

## 1. Shared PostgreSQL Configuration

Both Jitendra and Aman **must use the exact same database settings** so that local development and testing remain 100% reproducible:

| Parameter | Value |
|-----------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database Name** | `insureflow` |
| **Username** | `insureflow_user` |
| **Password** | `your_db_password` |
| **JDBC URL** | `jdbc:postgresql://localhost:5432/insureflow` |
| **PostgreSQL Version** | `16` |

---

## 2. Starting PostgreSQL with Docker Compose (Recommended)

A pre-configured `docker-compose.yml` and `database/init.sql` script are included in the repository root.

### Single-Command Start:
```bash
docker compose up -d
```

### What this does automatically:
1. Pulls and launches `postgres:16-alpine` on port `5432`.
2. Creates the `insureflow` database and `insureflow_user`.
3. Runs `database/init.sql`, which:
   - Enables `uuid-ossp` extension.
   - Creates all **13 core tables** matching the Architecture ER diagram.
   - Seeds the product catalog: **AD&D (DD)**, Hospital Accident Plan (HP), Recuperative Care (RC).
   - Seeds partner bank **Apex Trust Bank** (`APEX-BANK`) and campaign code `ADD-FALL-2026`.
   - Seeds demo accounts for Jitendra (`jitendra@insureflow.com`) and Aman (`aman@insureflow.com`).
4. Persists database data across restarts using Docker volume `pgdata`.

### Helpful Docker Commands:
```bash
# Check container status
docker compose ps

# View PostgreSQL logs
docker compose logs -f postgres

# Stop PostgreSQL
docker compose down
```

---

## 3. Starting PostgreSQL Locally (Native Installation)

If you have native PostgreSQL 16 installed instead of Docker:

1. Open `psql` or pgAdmin as the `postgres` superuser:
```bash
psql -U postgres
```

2. Run the user and database setup:
```sql
CREATE USER insureflow_user WITH PASSWORD 'your_db_password';
CREATE DATABASE insureflow OWNER insureflow_user;
GRANT ALL PRIVILEGES ON DATABASE insureflow TO insureflow_user;
\c insureflow
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

3. Import the initial schema:
```bash
psql -U insureflow_user -d insureflow -f database/init.sql
```

---

## 4. Database Schema & Ownership Breakdown

Per the Architecture Document, module ownership is partitioned cleanly:

| Table | Owner | Description |
|---|---|---|
| `users` | **Shared** | Accounts for Customer, Admin, and Operations |
| `products` | **Shared** (Jitendra leads) | Product catalog (AD&D Flagship, etc.) |
| `policies` | **Jitendra** | Enrolled customer policies, cover amounts, premiums |
| `beneficiaries` | **Jitendra** | Beneficiary allocations (must sum to 100%) |
| `policy_audit_logs`| **Jitendra** | Full JSON audit trail of policy modifications |
| `clients` | **Aman** | Bank partners running insurance campaigns |
| `campaigns` | **Aman** | Marketing campaigns |
| `campaign_events` | **Aman** | Direct mail / digital email events |
| `segments` | **Aman** | Targeted customer segments |
| `campaign_codes` | **Aman** | One-time campaign promo codes |
| `premium_records` | **Aman** | Monthly billing schedule records |
| `claims` | **Aman** | Claims submitted by customers |
| `claim_documents` | **Aman** | S3 document metadata supporting claims |

### Flyway Migrations Location:
Migration files are located at:
```
backend/src/main/resources/db/migration/
├── V1__init_schema.sql
└── V2__seed_initial_data.sql
```
Spring Boot runs these migrations automatically on startup (`spring.flyway.enabled=true`).

---

## 5. Authentication & Authorization Integration

### Customer Registration: `POST /api/auth/register`
**Request Body:**
```json
{
  "email": "customer@example.com",
  "password": "Password123!",
  "firstName": "Jitendra",
  "lastName": "Chowdary",
  "dateOfBirth": "1998-05-15",
  "phone": "+91 98765 43210"
}
```
**Underwriting Validation Rule:**
- Customer must be **18 to 69 years old** at enrollment.
- Passwords hashed using **BCrypt (strength 12)**.
- Default role assigned: `ROLE_CUSTOMER`.

### Unified Login: `POST /api/auth/login`
**Request Body:**
```json
{
  "email": "customer@example.com",
  "password": "Password123!"
}
```
**Response Body (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "eyJhbGciOiJIUzI1Ni...",
  "tokenType": "Bearer",
  "expiresIn": 900000,
  "user": {
    "id": "c1f7b824-386d-47fb-94f4-5b721e05d0e1",
    "email": "customer@example.com",
    "firstName": "Jitendra",
    "lastName": "Chowdary",
    "role": "CUSTOMER"
  }
}
```

---

## 6. Backend Spring Boot Configuration

Add this to `backend/src/main/resources/application-local.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/insureflow
    username: insureflow_user
    password: your_db_password
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration

app:
  jwt:
    secret: 404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
    access-token-expiry-ms: 900000       # 15 minutes
    refresh-token-expiry-ms: 604800000   # 7 days
```

---

## 7. Frontend Setup & Color Palette Reference

The frontend is built with **React 18 + Vite + TypeScript + Tailwind CSS** using the required theme palette:

| Color Name | Hex Code | RGB | Purpose |
|---|---|---|---|
| **Olive / Sage** | `#8B9A6E` | `rgb(139, 154, 110)` | Primary buttons, active badges, key highlights |
| **Cream** | `#F7F2EB` | `rgb(247, 242, 235)` | Clean app background |
| **Sand** | `#EAE2D6` | `rgb(234, 226, 214)` | Card surfaces, modals, containers, borders |
| **Soft Gray** | `#EEEEEE` | `rgb(238, 238, 238)` | Input backgrounds, dividers, neutral tags |

### Running the Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at **`http://localhost:5173`**.

### Included Flows:
1. **Customer Signup (`/signup`):** Validates age (18–69), creates customer profile.
2. **Customer Login (`/login`):** Unified authentication with quick demo buttons for Jitendra and Aman.
3. **Customer Dashboard (`/dashboard`):** Active policies list, policy cards, download certificate action, explore products catalog.
4. **Interactive AD&D Enrollment Modal:**
   - Step 1: Validates partner campaign code (`ADD-FALL-2026`).
   - Step 2: Slider for Principal Sum cover ($10,000 to $300,000 in $5,000 steps), live premium calculator (`(cover/1000) * $0.60`).
   - Step 3: Address entry and multi-beneficiary allocation (guarantees percentage sums to exactly 100%).
   - Step 4: Policy generation and schedule certificate preview.

---

## 8. Git Collaboration Workflow for Jitendra & Aman

Follow these steps to commit your files and push to your remote GitHub repository:

### Step 1: Stage and Commit the Initial Baseline
From the project root:
```bash
# Check status
git status

# Add all project files
git add .

# Create initial commit
git commit -m "feat: setup PostgreSQL schema, auth flow, and customer dashboard with custom palette"
```

### Step 2: Link to Your GitHub Repository
Replace `<your-org-or-username>` with your GitHub repository URL:
```bash
git remote add origin https://github.com/<your-username>/insureflow.git
git branch -M main
git push -u origin main
```

### Step 3: Feature Branch Workflow
- **Jitendra's branches:**
  ```bash
  git checkout -b jitendra/enrollment-flow
  git checkout -b jitendra/policy-pdf-generation
  ```
- **Aman's branches:**
  ```bash
  git checkout -b aman/campaign-management
  git checkout -b aman/billing-scheduler
  git checkout -b aman/claims-workflow
  ```

Before merging into `main`, open a Pull Request on GitHub so the other developer can review and approve!
