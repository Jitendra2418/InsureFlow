# InsureFlow – Architecture & Design Document
> **Prepared for:** Jitendra & Aman | **Deadline:** Friday, 27 November 2026 EOD
> **Role:** Enterprise Software Architect (15+ years)

---

## 1. Executive Summary

InsureFlow is a multi-tenant, role-based insurance enrollment and servicing platform. It connects a **bank (client)** that runs campaigns, **customers** who enroll in AD&D insurance products, and an **operations/admin team** that manages billing, claims, and campaign analytics.

The system is built on a **Spring Boot microservices-inspired monolith** (modular monolith pattern — pragmatic for a team of 2), React SPA frontend, PostgreSQL on RDS, and hosted fully on AWS.

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Clients["Client Layer"]
        CU["👤 Customer Browser\n(React SPA)"]
        AD["🔧 Admin Browser\n(React SPA)"]
        OP["📊 Operations Browser\n(React SPA)"]
    end

    subgraph CDN["AWS CloudFront + S3"]
        CF["CloudFront CDN\n(React Static Assets)"]
    end

    subgraph Gateway["API Gateway Layer"]
        ALB["AWS Application\nLoad Balancer"]
    end

    subgraph Backend["Backend – AWS ECS (Spring Boot)"]
        direction TB
        AUTH["🔐 Auth Module\nSpring Security + JWT"]
        ENR["📋 Enrollment & Policy Module\n(Jitendra)"]
        CAMP["📢 Campaign Module\n(Aman)"]
        BILL["💳 Billing Module\n(Aman)"]
        CLAIM["⚖️ Claims Module\n(Aman)"]
        DASH["📈 Dashboard Module\n(Aman)"]
        NOTIF["📧 Notification Service\nSES / SQS"]
        PDF["📄 PDF Generation\nJasperReports / iText"]
        SCHED["⏰ Scheduler\nSpring @Scheduled"]
    end

    subgraph Data["Data Layer – AWS RDS"]
        PG["PostgreSQL\n(Primary)"]
        PGR["PostgreSQL\n(Read Replica)"]
    end

    subgraph Storage["AWS Storage"]
        S3["S3 Bucket\nClaim Documents\n+ PDF Certificates"]
    end

    subgraph Monitoring["Observability"]
        CW["CloudWatch\nLogs + Metrics"]
        XRAY["AWS X-Ray\nTracing"]
    end

    CU --> CF
    AD --> CF
    OP --> CF
    CF --> ALB
    ALB --> AUTH
    AUTH --> ENR
    AUTH --> CAMP
    AUTH --> BILL
    AUTH --> CLAIM
    AUTH --> DASH
    ENR --> PDF
    ENR --> NOTIF
    BILL --> SCHED
    BILL --> NOTIF
    CLAIM --> S3
    CLAIM --> NOTIF
    ENR --> PG
    CAMP --> PG
    BILL --> PG
    CLAIM --> PG
    DASH --> PGR
    Backend --> CW
    Backend --> XRAY
```

---

## 3. AWS Infrastructure Architecture

```mermaid
flowchart LR
    subgraph Internet
        USER["🌐 Users\n(Browser)"]
    end

    subgraph AWS["AWS – ap-south-1 (Mumbai)"]
        subgraph CF_S3["CloudFront + S3"]
            S3STATIC["S3 Bucket\nReact Build"]
            CF2["CloudFront\nDistribution"]
        end

        subgraph VPC["VPC – 10.0.0.0/16"]
            subgraph PublicSubnet["Public Subnets (AZ-a, AZ-b)"]
                ALB2["Application\nLoad Balancer"]
                NAT["NAT Gateway"]
            end

            subgraph PrivateSubnet["Private Subnets (AZ-a, AZ-b)"]
                subgraph ECS["ECS Cluster (Fargate)"]
                    T1["Spring Boot\nTask (AZ-a)"]
                    T2["Spring Boot\nTask (AZ-b)"]
                end
                subgraph RDS["RDS Subnet Group"]
                    PRIMARY["PostgreSQL Primary\n(db.t3.medium)"]
                    REPLICA["Read Replica\n(db.t3.small)"]
                end
            end
        end

        subgraph Services["AWS Managed Services"]
            S3D["S3\nDocuments + Certs"]
            SES["SES\nEmail"]
            SM["Secrets Manager\nDB Creds + JWT Key"]
            ECR["ECR\nDocker Registry"]
            CWL["CloudWatch\nLogs + Alarms"]
        end
    end

    USER --> CF2
    CF2 --> S3STATIC
    USER --> ALB2
    ALB2 --> T1
    ALB2 --> T2
    T1 --> PRIMARY
    T2 --> PRIMARY
    PRIMARY --> REPLICA
    T1 --> S3D
    T2 --> S3D
    T1 --> SES
    T2 --> SM
    ECR --> ECS
```

---

## 4. Modular Monolith – Package Structure

```mermaid
flowchart TD
    subgraph SpringBoot["Spring Boot Application"]
        subgraph Shared["com.insureflow.shared"]
            SC["Security Config\nJWT Filter + Role Guards"]
            EX["Exception Handler\nGlobal @ControllerAdvice"]
            AU["Audit Entity\nCreatedAt, UpdatedAt, CreatedBy"]
        end

        subgraph AuthMod["com.insureflow.auth"]
            AREG["Register / Login API"]
            AJWT["JWT Provider"]
            AENT["User, Role Entities"]
        end

        subgraph EnrollMod["com.insureflow.enrollment (Jitendra)"]
            EC["EnrollmentController"]
            ES["EnrollmentService"]
            PS["PolicyService"]
            PDFS["PdfCertificateService"]
            BENS["BeneficiaryService"]
            ENTS1["Policy, Beneficiary,\nAuditLog Entities"]
        end

        subgraph CampMod["com.insureflow.campaign (Aman)"]
            CC["CampaignController"]
            CS["CampaignService"]
            CDCS["CampaignCodeService"]
            ENTS2["Client, Campaign,\nEvent, Segment,\nCampaignCode Entities"]
        end

        subgraph BillMod["com.insureflow.billing (Aman)"]
            BC["BillingController"]
            BS["BillingService"]
            BSC["BillingScheduler\n@Scheduled monthly"]
            ENTS3["PremiumRecord,\nPaymentRetry Entities"]
        end

        subgraph ClaimMod["com.insureflow.claims (Aman)"]
            CLC["ClaimsController"]
            CLS["ClaimsService"]
            CLD["ClaimsDocumentService\nS3 Upload"]
            ENTS4["Claim,\nClaimDocument Entities"]
        end

        subgraph DashMod["com.insureflow.dashboard (Aman)"]
            DC["DashboardController"]
            DS["DashboardService\n(read replica queries)"]
        end
    end

    Shared --> AuthMod
    Shared --> EnrollMod
    Shared --> CampMod
    Shared --> BillMod
    Shared --> ClaimMod
    Shared --> DashMod
```

---

## 5. Database ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        date date_of_birth
        string phone
        string role "CUSTOMER|ADMIN|OPERATIONS"
        timestamp created_at
        timestamp updated_at
    }

    CLIENTS {
        uuid id PK
        string name
        string code UK
        string contact_email
        boolean is_active
        timestamp created_at
    }

    PRODUCTS {
        uuid id PK
        string name
        string code UK "DD|HP|RC"
        string description
        string status "FLAGSHIP|ACTIVE|COMING_SOON"
        boolean free_basic_enabled
        decimal free_basic_min
        decimal free_basic_max
        decimal premium_rate_per_thousand
        timestamp created_at
    }

    CAMPAIGNS {
        uuid id PK
        uuid client_id FK
        uuid product_id FK
        string campaign_id UK
        string name
        string status "PLANNED|ACTIVE|COMPLETED"
        date start_date
        date end_date
        timestamp created_at
    }

    CAMPAIGN_EVENTS {
        uuid id PK
        uuid campaign_id FK
        string event_id UK
        string channel "DIRECT_MAIL|DIGITAL"
        date send_date
        int quantity
        timestamp created_at
    }

    SEGMENTS {
        uuid id PK
        uuid event_id FK
        string name
        int target_count
        string description
    }

    CAMPAIGN_CODES {
        uuid id PK
        uuid campaign_id FK
        string code UK
        boolean is_used
        uuid used_by_user_id FK
        timestamp used_at
        timestamp created_at
    }

    POLICIES {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        uuid campaign_code_id FK
        string policy_number UK
        decimal cover_amount
        decimal monthly_premium
        string status "ACTIVE|CANCELLED|LAPSED"
        date effective_date
        date cancellation_date
        string cancellation_reason
        string address_line1
        string address_line2
        string city
        string state
        string zip_code
        string certificate_s3_key
        timestamp created_at
        timestamp updated_at
    }

    BENEFICIARIES {
        uuid id PK
        uuid policy_id FK
        string first_name
        string last_name
        string relationship
        decimal percentage
        string phone
        boolean is_active
        timestamp created_at
    }

    POLICY_AUDIT_LOGS {
        uuid id PK
        uuid policy_id FK
        uuid changed_by_user_id FK
        string action "ADDRESS_UPDATED|BENEFICIARY_ADDED|CANCELLED|etc"
        jsonb old_value
        jsonb new_value
        timestamp changed_at
    }

    PREMIUM_RECORDS {
        uuid id PK
        uuid policy_id FK
        date billing_month
        decimal amount
        string status "PENDING|PAID|FAILED|RETRYING"
        int retry_count
        timestamp due_date
        timestamp paid_at
        timestamp created_at
    }

    CLAIMS {
        uuid id PK
        uuid policy_id FK
        uuid user_id FK
        string claim_number UK
        string incident_type
        date incident_date
        string description
        string status "SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED"
        decimal claimed_amount
        decimal approved_amount
        string reviewer_notes
        uuid reviewed_by FK
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }

    CLAIM_DOCUMENTS {
        uuid id PK
        uuid claim_id FK
        string file_name
        string s3_key
        string content_type
        bigint file_size
        timestamp uploaded_at
    }

    USERS ||--o{ POLICIES : "has"
    USERS ||--o{ CLAIMS : "submits"
    USERS ||--o{ CAMPAIGN_CODES : "uses"
    CLIENTS ||--o{ CAMPAIGNS : "owns"
    PRODUCTS ||--o{ CAMPAIGNS : "featured in"
    PRODUCTS ||--o{ POLICIES : "covers"
    CAMPAIGNS ||--o{ CAMPAIGN_EVENTS : "has"
    CAMPAIGNS ||--o{ CAMPAIGN_CODES : "generates"
    CAMPAIGN_EVENTS ||--o{ SEGMENTS : "targets"
    CAMPAIGN_CODES ||--o| POLICIES : "activates"
    POLICIES ||--o{ BENEFICIARIES : "has"
    POLICIES ||--o{ POLICY_AUDIT_LOGS : "tracked by"
    POLICIES ||--o{ PREMIUM_RECORDS : "billed via"
    POLICIES ||--o{ CLAIMS : "claimed on"
    CLAIMS ||--o{ CLAIM_DOCUMENTS : "supported by"
```

---

## 6. Frontend Application Structure

```mermaid
flowchart TD
    subgraph ReactApp["React SPA – Role-Based Routing"]
        ROUTER["React Router v6\nAuth Guard HOC"]

        subgraph PublicRoutes["Public Routes"]
            HOME["/ Landing Page\n(Product showcase)"]
            LOGIN["/ login\nUnified login"]
            SIGNUP["/ signup\nCustomer registration"]
        end

        subgraph CustomerRoutes["Customer Routes /customer/*"]
            CDASH["Dashboard\nMy Policies"]
            ENROLL["/ enroll\nCampaign code entry\n→ Cover selection\n→ Beneficiaries"]
            POLICY["/ policy/:id\nPolicy detail + PDF download"]
            UPDATEPOL["/ policy/:id/edit\nUpdate address/beneficiaries"]
            CANCEL["/ policy/:id/cancel\nCancellation flow"]
            CCLAIN["/ claims/new\nSubmit a claim"]
            MYCLAINS["/ claims\nMy claims list"]
        end

        subgraph AdminRoutes["Admin Routes /admin/*"]
            ADASH["Admin Dashboard"]
            CLIENTS["/ clients\nManage banks/clients"]
            CAMPS["/ campaigns\nList campaigns"]
            NEWCAMP["/ campaigns/new\nCreate campaign +\nevents + segments"]
            CAMPDETAIL["/ campaigns/:id\nCampaign detail\n+ code generation"]
            PRODUCTS["/ products\nManage product catalog\n(AD&D active, others coming soon)"]
            CLAIMSMGMT["/ claims\nClaims queue\nStatus workflow"]
            USERS["/ users\nUser management"]
        end

        subgraph OpsRoutes["Operations Routes /ops/*"]
            OPSDASH["Ops Dashboard\nEnrollments per campaign\nResponse rate\nActive policies\nOpen claims"]
            BILLING["/ billing\nMonthly billing overview\nFailed payments retry"]
            CLAIMSOPS["/ claims\nClaims review workflow"]
        end
    end

    ROUTER --> PublicRoutes
    ROUTER --> CustomerRoutes
    ROUTER --> AdminRoutes
    ROUTER --> OpsRoutes
```

---

## 7. Enrollment Flow (Jitendra's Module)

```mermaid
sequenceDiagram
    actor C as Customer
    participant FE as React Frontend
    participant API as Spring Boot API
    participant DB as PostgreSQL
    participant PDF as PDF Service
    participant S3 as AWS S3
    participant SES as AWS SES

    C->>FE: Enter campaign code
    FE->>API: POST /api/enrollment/validate-code {code}
    API->>DB: SELECT campaign_code WHERE code=? AND is_used=false
    DB-->>API: Campaign + Product details
    API-->>FE: 200 OK {campaignId, productName, coverOptions}

    C->>FE: Select cover amount + add beneficiaries
    FE->>API: POST /api/enrollment/enroll
    Note over API: Validate: age 18-69,<br/>no duplicate product enrollment,<br/>cover $10k-$300k in $5k steps,<br/>beneficiary % sums to 100

    API->>DB: INSERT policy (status=ACTIVE)
    API->>DB: INSERT beneficiaries
    API->>DB: UPDATE campaign_code SET is_used=true
    API->>PDF: Generate certificate PDF
    PDF-->>S3: Upload PDF → s3://insureflow/certs/{policyNumber}.pdf
    S3-->>API: S3 key
    API->>DB: UPDATE policy SET certificate_s3_key=?
    API->>SES: Send welcome email with PDF link
    API-->>FE: 201 Created {policyNumber, certificateUrl}
    FE-->>C: Policy created! Download certificate
```

---

## 8. Billing Flow (Aman's Module)

```mermaid
sequenceDiagram
    participant CRON as Spring @Scheduled<br/>(1st of month, midnight)
    participant BS as BillingService
    participant DB as PostgreSQL
    participant NOTIF as SES Notification

    CRON->>BS: triggerMonthlyBilling()
    BS->>DB: SELECT policies WHERE status='ACTIVE'
    loop For each active policy
        BS->>DB: INSERT premium_record {policyId, month, amount, status=PENDING}
        BS->>BS: Simulate payment gateway call
        alt Payment succeeds
            BS->>DB: UPDATE premium_record SET status=PAID
        else Payment fails
            BS->>DB: UPDATE premium_record SET status=FAILED, retry_count=0
            BS->>NOTIF: Email customer — payment failed
        end
    end

    Note over BS,DB: Retry Job runs daily for FAILED records<br/>(retry_count < 3)
    BS->>DB: SELECT premium_records WHERE status=FAILED AND retry_count < 3
    loop Retry each failed record
        BS->>BS: Retry payment
        alt Retry succeeds
            BS->>DB: UPDATE status=PAID
        else Still fails
            BS->>DB: UPDATE retry_count++
            BS->>DB: If retry_count=3 → flag policy as LAPSED
        end
    end
```

---

## 9. Claims Flow (Aman's Module)

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Customer submits claim\n+ uploads documents to S3
    SUBMITTED --> UNDER_REVIEW : Admin picks up claim
    UNDER_REVIEW --> APPROVED : Admin approves\n+ sets approved_amount
    UNDER_REVIEW --> REJECTED : Admin rejects\n+ adds reviewer_notes
    APPROVED --> [*] : Payout triggered\nCustomer notified via SES
    REJECTED --> [*] : Customer notified\nwith rejection reason
```

---

## 10. CI/CD Pipeline

```mermaid
flowchart LR
    subgraph GitHub["GitHub Repository"]
        FB["Feature Branch\n(jitendra/* or aman/*)"]
        PR["Pull Request\n(cross-review required)"]
        MAIN["main branch"]
    end

    subgraph GHA["GitHub Actions"]
        subgraph PRChecks["On PR Open"]
            UNIT["JUnit Tests\n+ Jacoco Coverage"]
            LINT["Checkstyle\n+ SpotBugs"]
            BUILD["Maven Build"]
            PW["Playwright E2E\n(preview env)"]
        end

        subgraph Deploy["On merge to main"]
            DOCKER["Docker Build\n+ ECR Push"]
            ECSDEPLOY["ECS Rolling\nDeploy"]
            RDS["Flyway DB\nMigrations"]
            FEDBUILD["React Build\n+ S3 Sync"]
            CFINVAL["CloudFront\nInvalidation"]
        end
    end

    subgraph AWS2["AWS Production"]
        ECSP["ECS Fargate\nSpring Boot"]
        S3FE["S3 + CloudFront\nReact App"]
        RDSP["RDS PostgreSQL"]
    end

    FB --> PR
    PR --> PRChecks
    PRChecks --> MAIN
    MAIN --> Deploy
    DOCKER --> ECSDEPLOY
    ECSDEPLOY --> ECSP
    RDS --> RDSP
    FEDBUILD --> CFINVAL
    CFINVAL --> S3FE
```

---

## 11. Security Architecture

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | JWT Bearer tokens (15-min access + 7-day refresh) |
| **Authorization** | Spring Security `@PreAuthorize` with roles: `ROLE_CUSTOMER`, `ROLE_ADMIN`, `ROLE_OPERATIONS` |
| **Password** | BCrypt hashing (strength 12) |
| **Secrets** | AWS Secrets Manager (DB creds, JWT signing key, SES keys) |
| **Transport** | HTTPS enforced via CloudFront + ACM certificate |
| **S3 Documents** | Pre-signed URLs (15-min TTL) — no public bucket access |
| **API Rate Limiting** | AWS WAF on ALB |
| **CORS** | Restricted to CloudFront origin only |
| **SQL Injection** | JPA/Hibernate parameterized queries only |
| **Audit Trail** | Every policy change → `policy_audit_logs` with old/new JSON |

---

## 12. API Contract Summary (OpenAPI)

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Customer self-registration |
| POST | `/api/auth/login` | Public | Login → JWT |
| POST | `/api/auth/refresh` | Public | Refresh token |

### Enrollment & Policy (Jitendra)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/enrollment/validate-code` | Customer | Validate campaign code |
| POST | `/api/enrollment/enroll` | Customer | Enroll + create policy |
| GET | `/api/policies` | Customer | List my policies |
| GET | `/api/policies/{id}` | Customer | Policy detail |
| GET | `/api/policies/{id}/certificate` | Customer | Pre-signed PDF URL |
| PUT | `/api/policies/{id}/address` | Customer | Update address |
| PUT | `/api/policies/{id}/beneficiaries` | Customer | Update beneficiaries |
| DELETE | `/api/policies/{id}` | Customer | Cancel policy |
| GET | `/api/policies/{id}/audit` | Customer/Admin | Audit history |

### Campaign (Aman)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/admin/clients` | Admin | Create client (bank) |
| GET | `/api/admin/clients` | Admin | List clients |
| POST | `/api/admin/campaigns` | Admin | Create campaign |
| POST | `/api/admin/campaigns/{id}/events` | Admin | Add event + segments |
| POST | `/api/admin/campaigns/{id}/generate-codes` | Admin | Generate campaign codes |
| GET | `/api/admin/campaigns/{id}/codes` | Admin | List codes + usage |

### Billing (Aman)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/ops/billing` | Operations | List billing records |
| POST | `/api/ops/billing/run` | Operations | Trigger manual billing run |
| POST | `/api/ops/billing/{id}/retry` | Operations | Retry failed payment |

### Claims (Aman)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/claims` | Customer | Submit claim |
| POST | `/api/claims/{id}/documents` | Customer | Upload document |
| GET | `/api/claims` | Customer/Admin/Ops | List claims (filtered by role) |
| GET | `/api/claims/{id}` | All | Claim detail |
| PUT | `/api/claims/{id}/status` | Admin/Ops | Move claim status |

### Dashboard (Aman)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/ops/dashboard` | Operations | Enrollments, response rate, active policies, open claims |
| GET | `/api/ops/dashboard/campaigns/{id}` | Operations | Per-campaign metrics |

### Products (Admin)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/products` | Public | List products (AD&D Flagship, others Coming Soon) |
| PUT | `/api/admin/products/{id}` | Admin | Update product status |

---

## 13. Business Rules Reference

| Rule | Detail |
|------|--------|
| **Age eligibility** | Customer must be 18–69 years old at enrollment |
| **Cover amounts** | \$10,000 to \$300,000 in steps of \$5,000 (59 options) |
| **Premium formula** | `monthly_premium = (cover_amount / 1000) × $0.60` |
| **Example** | \$100,000 cover → \$60.00/month |
| **Duplicate enrollment** | One active policy per product per customer |
| **Beneficiary rule** | All beneficiary percentages must sum to exactly 100% |
| **Campaign code** | Single-use; linked to exactly one campaign |
| **Policy lapse** | 3 consecutive failed payments → policy LAPSED |
| **Cancellation** | Immediate; no pro-rata refund (confirm with business) |

---

## 14. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Framework** | Spring Boot | 3.2.x |
| **Language** | Java | 21 (LTS) |
| **ORM** | Spring Data JPA + Hibernate | 6.x |
| **DB Migrations** | Flyway | 10.x |
| **Security** | Spring Security + JJWT | 0.12.x |
| **PDF Generation** | iText 7 / JasperReports | Latest |
| **Scheduler** | Spring `@Scheduled` | Built-in |
| **API Docs** | SpringDoc OpenAPI (Swagger UI) | 2.x |
| **Testing (Unit)** | JUnit 5 + Mockito + AssertJ | Built-in |
| **Testing (E2E)** | Playwright (Java bindings) | 1.44.x |
| **Frontend** | React + TypeScript | 18.x / 5.x |
| **UI Library** | Tailwind CSS + shadcn/ui | Latest |
| **HTTP Client** | Axios + React Query | Latest |
| **Build** | Maven (backend) / Vite (frontend) | Latest |
| **Containerization** | Docker + AWS ECR | Latest |
| **Hosting** | AWS ECS Fargate + RDS + S3 + CloudFront | - |
| **CI/CD** | GitHub Actions | - |
| **Monitoring** | AWS CloudWatch + X-Ray | - |

---

## 15. Module Ownership Summary

| Feature | Owner | Priority |
|---------|-------|----------|
| Auth (JWT, roles, login/signup) | **Shared** | P0 |
| DB schema + Flyway migrations | **Shared** | P0 |
| Product catalog API | **Shared** (Jitendra leads) | P0 |
| Campaign code validation | **Jitendra** (consumes Aman's codes) | P0 |
| Enrollment + policy creation | **Jitendra** | P0 |
| PDF certificate generation | **Jitendra** | P1 |
| Policy update + audit history | **Jitendra** | P1 |
| Policy cancellation | **Jitendra** | P1 |
| Client + Campaign creation | **Aman** | P0 |
| Event + Segment management | **Aman** | P0 |
| Campaign code generation | **Aman** | P0 |
| Monthly billing scheduler | **Aman** | P1 |
| Failed payment retry | **Aman** | P1 |
| Claims submission + S3 upload | **Aman** | P1 |
| Claims status workflow | **Aman** | P1 |
| Operations dashboard | **Aman** | P2 |
| CI/CD pipeline | **Shared** | P1 |
| AWS setup + IaC | **Shared** | P1 |

---

> [!IMPORTANT]
> **Agree on the DB schema (Section 5) and API contracts (Section 12) before writing a single line of feature code.** This is the shared contract between Jitendra and Aman's modules.

> [!TIP]
> **Start here:** `1.` Auth module (shared) → `2.` DB schema + Flyway migrations (shared) → `3.` Jitendra: Product catalog + Campaign code validation → `4.` Aman: Campaign + Code generation → `5.` Both develop their modules in parallel.

> [!NOTE]
> The **modular monolith** pattern is intentionally chosen over microservices. It gives you clean module boundaries (easy to split later), simple deployment (one ECS task), and no inter-service networking complexity — pragmatic for a 2-person team with a fixed deadline.
