# InsureFlow Backend Migration Specification: Node.js to Java 21 (Spring Boot 3)

> **Document Purpose**: Complete, authoritative technical specification for migrating the InsureFlow backend from Node.js (Express) to Java 21 with Spring Boot 3.2.x, Spring Data JPA, Spring Security, and Maven.
>
> ⚠️ **STRICT ZERO-REGRESSION CONSTRAINT**: The React frontend (`http://localhost:5173`) must **NOT** be modified unless an endpoint contract explicitly requires it. The Spring Boot backend must run on port `8080` and strictly reproduce the exact JSON request/response contracts, field names (camelCase), status codes, and database behaviors currently running in `backend/server.js`.

---

## 1. Architectural Overview & System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       React 18 + TypeScript Frontend                         │
│       Customer Portal (/dashboard)  |  Admin/Operations Portal (/admin)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP REST (JSON)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Spring Boot 3.2.x Backend Application (Port 8080)            │
│  ┌─────────────────────────┐  ┌────────────────────────┐  ┌──────────────┐  │
│  │ Security & JWT Filter   │  │ Actuarial Rating Engine│  │ Audit Logger │  │
│  └─────────────────────────┘  └────────────────────────┘  └──────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Controllers: Auth, Policies, Enrollment, Campaigns, Events, Claims   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Services & Spring Data JPA Repositories                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ JDBC / Hibernate
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database (insureflow-db: Port 5433)              │
│  users, clients, products, campaigns, campaign_codes, campaign_events,      │
│  segments, policies, beneficiaries, policy_audit_logs, claims, premiums     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Maven Build Configuration (`pom.xml`)

Target Runtime: **Java 21 (LTS)**, **Spring Boot 3.2.x**, **Maven 3.9+**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>
    <groupId>com.insureflow</groupId>
    <artifactId>insureflow-backend</artifactId>
    <version>1.0.0</version>
    <name>insureflow-backend</name>
    <description>Enterprise Insurance Enrollment &amp; Servicing Engine</description>

    <properties>
        <java.version>21</java.version>
        <jjwt.version>0.12.5</jjwt.version>
    </properties>

    <dependencies>
        <!-- Spring Web & Validation -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Spring Data JPA & PostgreSQL -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- Spring Security & JWT -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>${jjwt.version}</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- OpenAPI / Swagger Documentation -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.5.0</version>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

---

## 3. Database Schema & PostgreSQL Configuration

Connecting to PostgreSQL running in Docker on port `5433`:

```properties
# src/main/resources/application.properties
server.port=8080

spring.datasource.url=jdbc:postgresql://127.0.0.1:5433/insureflow
spring.datasource.username=insureflow_user
spring.datasource.password=your_db_password
spring.datasource.driver-class-name=org.postgresql.Driver

spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

jwt.secret=insureflow-super-secret-jwt-token-key-2026-secure-production-ready
jwt.expiration-ms=86400000
```

### Table Definitions in PostgreSQL

```sql
-- 1. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'ADMIN', 'OPERATIONS')),
    date_of_birth DATE,
    phone VARCHAR(20),
    aadhar_number VARCHAR(12) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. clients (Partner Banks / Credit Unions)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    client_id VARCHAR(50) UNIQUE,
    business_type VARCHAR(50) DEFAULT 'Bank',
    status VARCHAR(20) DEFAULT 'A-ACTIVE',
    address TEXT,
    state VARCHAR(50),
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,   -- 'DD' (AD&D Flagship), 'HP' (HAP), 'RC' (Recuperative Care)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client_id UUID NOT NULL REFERENCES clients(id),
    product_id UUID NOT NULL REFERENCES products(id),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. campaign_codes (Multi-use marketing codes, e.g. 'ADD-FALL-2026')
CREATE TABLE campaign_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. campaign_events
CREATE TABLE campaign_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    event_id VARCHAR(50) UNIQUE NOT NULL,
    channel VARCHAR(50) NOT NULL,          -- Direct Mail, Email, SMS, Web
    media VARCHAR(50) NOT NULL,            -- Letter, Brochure, Digital Banner
    scheduled_drop DATE NOT NULL,
    send_date DATE,
    final_description TEXT,
    event_type VARCHAR(50) NOT NULL,       -- Acquisition, Cross-Sell, Retention
    quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. segments
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES campaign_events(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB,
    target INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. policies
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    product_id UUID NOT NULL REFERENCES products(id),
    campaign_code_id UUID REFERENCES campaign_codes(id),
    policy_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LAPSED','CANCELLED','EXPIRED')),
    cover_amount NUMERIC(12,2) NOT NULL,     -- $10,000 to $300,000 in $5,000 increments
    monthly_premium NUMERIC(10,2) NOT NULL,  -- (cover_amount / 1000) * 0.60
    effective_date DATE DEFAULT CURRENT_DATE,
    cancellation_date DATE,
    cancellation_reason TEXT,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. beneficiaries (Primary vs Contingent Tiers + Minor Trustee Safeguards)
CREATE TABLE beneficiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    phone VARCHAR(30),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    guardian_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. policy_audit_logs (Immutable Historical Audit Trail)
CREATE TABLE policy_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id),
    changed_by_user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,            -- POLICY_ENROLLED, UPDATE_COVER_AMOUNT, UPDATE_ADDRESS, UPDATE_BENEFICIARIES, CANCELLED
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. claims
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id),
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'SUBMITTED',  -- SUBMITTED, IN_REVIEW, APPROVED, REJECTED
    incident_date DATE NOT NULL,
    incident_type VARCHAR(100) NOT NULL,
    claim_amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Business Logic & Underwriting Rules (Strictly Implement)

1. **Underwriting Eligibility (Age 18–69)**:
   - At enrollment, calculate customer age from `users.date_of_birth`.
   - If `age < 18` or `age > 69`: Throw HTTP 400 with message:
     `"Underwriting eligibility check failed: Customer age {age} is outside the eligible range of 18–69 years. Policy cannot be issued."`

2. **Accidental Death & Dismemberment (AD&D) Rating Engine**:
   - Cover amount range: `$10,000` to `$300,000` in exact `$5,000` steps (`cover_amount % 5000 == 0`).
   - Actuarial Monthly Premium Formula:
     $$\text{monthlyPremium} = \left(\frac{\text{coverAmount}}{1000}\right) \times 0.60$$
   - Example: `$100,000` cover $\rightarrow$ `$60.00 / month`.

3. **Beneficiary Allocation Rules (ERISA & Insurance Compliance)**:
   - All beneficiaries marked `isPrimary = true` (or defaulted to true) **must sum to exactly 100.0%**.
   - If any `isPrimary = false` (Contingent) beneficiaries exist, **they must also sum to exactly 100.0%** among themselves.
   - Minor / Child Trustee Safeguard: If `relationship == 'Child'` or `relationship == 'Child (Minor under 18)'`, `guardianName` **cannot be blank**.
   - First and last names are mandatory for all beneficiaries.

4. **Duplicate Active Policy Prevention**:
   - A customer cannot hold two active policies for the same `product_id` (`status = 'ACTIVE'`).

5. **Aadhaar Unique Identity Validation**:
   - Customer signup requires a valid, unique 12-digit numeric Aadhaar number (`aadharNumber`).

6. **Immutable Audit Logging**:
   - Any policy modification (Enrollment, Cover change, Address change, Beneficiary update, Cancellation) **must write an immutable row to `policy_audit_logs`** with `old_value` and `new_value` formatted as JSON objects.

---

## 5. Complete REST API Specifications

### Auth Endpoints

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/auth/register` | Public | Customer registration with Aadhaar |
| `POST` | `/api/auth/login` | Public | Customer login (returns JWT token + user) |
| `POST` | `/api/auth/admin/register` | Public | Staff registration (`ADMIN` or `OPERATIONS`) |
| `POST` | `/api/auth/admin/login` | Public | Staff login |

#### `POST /api/auth/register` Request Body:
```json
{
  "email": "customer@example.com",
  "password": "SecurePassword123!",
  "firstName": "Nanda",
  "lastName": "Kishore",
  "dateOfBirth": "1992-05-14",
  "phone": "555-0199",
  "aadharNumber": "123456789012"
}
```
#### Response (`201 Created`):
```json
{
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "uuid",
    "email": "customer@example.com",
    "firstName": "Nanda",
    "lastName": "Kishore",
    "dateOfBirth": "1992-05-14",
    "phone": "555-0199",
    "aadharNumber": "123456789012",
    "role": "CUSTOMER"
  }
}
```

---

### Enrollment & Policy Endpoints (Customer Scoped)

| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/enrollment/validate-code` | Validates campaign code (e.g. `ADD-FALL-2026`) |
| `POST` | `/api/enrollment/enroll` | Enrolls policy in PostgreSQL + adds beneficiaries + logs audit |
| `GET` | `/api/policies` | Lists current customer's policies with beneficiaries |
| `GET` | `/api/policies/:id` | Full policy details with calculations, beneficiaries, and audit logs |
| `GET` | `/api/policies/:id/audit-logs` | Dedicated audit trail endpoint |
| `PUT` | `/api/policies/:id` | Update cover amount, address, and/or beneficiaries |
| `PUT` | `/api/policies/:id/beneficiaries`| Dedicated update beneficiaries endpoint |
| `DELETE`| `/api/policies/:id` | Cancel policy (`status = 'CANCELLED'`) |

#### `POST /api/enrollment/enroll` Request Body:
```json
{
  "campaignCode": "ADD-FALL-2026",
  "coverAmount": 100000,
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "beneficiaries": [
    {
      "firstName": "Priya",
      "lastName": "Chowdary",
      "relationship": "Spouse",
      "percentage": 50,
      "phone": "555-0101",
      "isPrimary": true,
      "guardianName": ""
    },
    {
      "firstName": "Arjun",
      "lastName": "Chowdary",
      "relationship": "Child (Minor under 18)",
      "percentage": 50,
      "phone": "555-0102",
      "isPrimary": true,
      "guardianName": "Priya Chowdary"
    },
    {
      "firstName": "Kiran",
      "lastName": "Chowdary",
      "relationship": "Sibling",
      "percentage": 100,
      "phone": "555-0103",
      "isPrimary": false,
      "guardianName": ""
    }
  ]
}
```

#### `GET /api/policies/:id` Response Payload:
```json
{
  "id": "uuid",
  "policyNumber": "POL-2026-256192",
  "userId": "uuid",
  "productId": "uuid",
  "productName": "Accidental Death & Dismemberment (AD&D)",
  "productCode": "DD",
  "campaignCode": "ADD-FALL-2026",
  "coverAmount": 100000.0,
  "monthlyPremium": 60.0,
  "annualPremium": 720.0,
  "dailyRate": 1.97,
  "status": "ACTIVE",
  "effectiveDate": "2026-11-26",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "beneficiaries": [
    {
      "id": "uuid",
      "firstName": "Priya",
      "lastName": "Chowdary",
      "relationship": "Spouse",
      "percentage": 50.0,
      "phone": "555-0101",
      "isPrimary": true,
      "guardianName": ""
    }
  ],
  "auditLogs": [
    {
      "id": "uuid",
      "action": "POLICY_ENROLLED",
      "old_value": null,
      "new_value": {
        "policyNumber": "POL-2026-256192",
        "coverAmount": 100000,
        "monthlyPremium": 60,
        "campaignCode": "ADD-FALL-2026"
      },
      "changed_at": "2026-11-27T08:56:06.844Z",
      "first_name": "Nanda",
      "last_name": "Kishore"
    }
  ],
  "createdAt": "2026-11-27T08:56:06.844Z"
}
```

---

### Admin & Operations Endpoints (`ADMIN` or `OPERATIONS` Role)

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/admin/clients` | Lists partner bank clients |
| `POST` | `/api/admin/clients` | Creates a new client partner |
| `PUT` | `/api/admin/clients/:id` | Updates client details |
| `DELETE`| `/api/admin/clients/:id` | Deletes or deactivates client |
| `GET` | `/api/products` & `/api/admin/products` | Lists insurance products (`DD`, `HP`, `RC`) |
| `GET` | `/api/admin/campaigns` | Lists campaigns with `eventsCount` |
| `POST` | `/api/admin/campaigns` | Creates new marketing campaign |
| `GET` | `/api/admin/events` | Lists campaign events (optional `?campaignId=`) |
| `POST` | `/api/admin/events` | Creates a campaign dispatch event |
| `GET` | `/api/admin/segments` | Lists target segments |
| `POST` | `/api/admin/segments` | Creates target marketing segment |
| `GET` | `/api/admin/claims` | Lists claims for admin review |
| `POST` | `/api/claims` | Submits a claim against an active policy |

---

## 6. Target Spring Boot Project Structure

```
backend/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── insureflow/
│   │   │           ├── InsureFlowApplication.java
│   │   │           ├── config/
│   │   │           │   ├── SecurityConfig.java
│   │   │           │   ├── JwtAuthenticationFilter.java
│   │   │           │   └── WebConfig.java (CORS configuration)
│   │   │           ├── controller/
│   │   │           │   ├── AuthController.java
│   │   │           │   ├── PolicyController.java
│   │   │           │   ├── EnrollmentController.java
│   │   │           │   ├── AdminClientController.java
│   │   │           │   ├── AdminCampaignController.java
│   │   │           │   ├── AdminEventController.java
│   │   │           │   └── ClaimController.java
│   │   │           ├── dto/
│   │   │           │   ├── request/
│   │   │           │   └── response/
│   │   │           ├── entity/
│   │   │           │   ├── User.java
│   │   │           │   ├── Client.java
│   │   │           │   ├── Product.java
│   │   │           │   ├── Campaign.java
│   │   │           │   ├── CampaignCode.java
│   │   │           │   ├── CampaignEvent.java
│   │   │           │   ├── Policy.java
│   │   │           │   ├── Beneficiary.java
│   │   │           │   ├── PolicyAuditLog.java
│   │   │           │   └── Claim.java
│   │   │           ├── repository/
│   │   │           │   ├── UserRepository.java
│   │   │           │   ├── PolicyRepository.java
│   │   │           │   ├── BeneficiaryRepository.java
│   │   │           │   ├── PolicyAuditLogRepository.java
│   │   │           │   ├── CampaignRepository.java
│   │   │           │   └── ClientRepository.java
│   │   │           ├── service/
│   │   │           │   ├── AuthService.java
│   │   │           │   ├── PolicyService.java
│   │   │           │   ├── RatingEngineService.java
│   │   │           │   └── AuditLogService.java
│   │   │           └── util/
│   │   │               └── JwtUtil.java
│   │   └── resources/
│   │       ├── application.properties
│   │       └── db/migration/
```

---

## 7. Migration Execution Checklist

- [ ] Initialize Maven project with Spring Boot 3.2.x and Java 21 in `pom.xml`.
- [ ] Configure `application.properties` pointing to `127.0.0.1:5433/insureflow`.
- [ ] Implement JPA Entities matching PostgreSQL types (UUID primary keys, numeric precision, timestamps).
- [ ] Implement Spring Security + JJWT authentication filter expecting `Authorization: Bearer <token>`.
- [ ] Enable CORS for `http://localhost:5173` with credentials, GET, POST, PUT, DELETE, OPTIONS.
- [ ] Port all 28 API endpoints into `@RestController` classes preserving exact JSON property names.
- [ ] Port the actuarial rating engine formula: `(coverAmount / 1000) * 0.60`.
- [ ] Port the primary/contingent beneficiary validation rules (both pools must equal 100.0%).
- [ ] Port immutable audit logging into `policy_audit_logs`.
- [ ] Test with `mvn clean compile` and launch backend on port `8080`.
- [ ] Verify that the React frontend at `http://localhost:5173` runs with zero changes.
