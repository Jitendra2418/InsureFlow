-- ============================================================
-- InsureFlow Local PostgreSQL Full Schema Setup
-- Run this AFTER creating the database and user via pgAdmin or psql
--
-- In pgAdmin: open Query Tool on "insureflow" database → paste → Run (F5)
-- In psql:    \c insureflow   then   \i path/to/this/file.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  date_of_birth   DATE NOT NULL,
  phone           VARCHAR(30),
  aadhar_number   VARCHAR(20) UNIQUE,
  role            VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER'
                    CHECK (role IN ('CUSTOMER','ADMIN','OPERATIONS')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: segments
-- ============================================================
CREATE TABLE IF NOT EXISTS segments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL,
  product_id  UUID NOT NULL REFERENCES products(id),
  segment_id  UUID REFERENCES segments(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: campaign_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_codes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id      UUID NOT NULL REFERENCES campaigns(id),
  code             VARCHAR(50) UNIQUE NOT NULL,
  is_used          BOOLEAN NOT NULL DEFAULT FALSE,
  used_by_user_id  UUID REFERENCES users(id),
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  segment_id   UUID REFERENCES segments(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: policies
-- ============================================================
CREATE TABLE IF NOT EXISTS policies (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  campaign_code_id    UUID REFERENCES campaign_codes(id),
  policy_number       VARCHAR(50) UNIQUE NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','LAPSED','CANCELLED','EXPIRED')),
  cover_amount        NUMERIC(12,2) NOT NULL,
  monthly_premium     NUMERIC(10,2) NOT NULL,
  effective_date      DATE,
  cancellation_date   DATE,
  cancellation_reason TEXT,
  address_line1       VARCHAR(255),
  address_line2       VARCHAR(255),
  city                VARCHAR(100),
  state               VARCHAR(100),
  zip_code            VARCHAR(20),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: beneficiaries
-- ============================================================
CREATE TABLE IF NOT EXISTS beneficiaries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id    UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  relationship VARCHAR(50),
  percentage   NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  phone        VARCHAR(30),
  is_primary   BOOLEAN NOT NULL DEFAULT TRUE,
  guardian_name VARCHAR(100),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: policy_audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS policy_audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id    UUID NOT NULL REFERENCES policies(id),
  user_id      UUID REFERENCES users(id),
  action       VARCHAR(50) NOT NULL,
  field_name   VARCHAR(100),
  old_value    TEXT,
  new_value    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: premium_records
-- ============================================================
CREATE TABLE IF NOT EXISTS premium_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id    UUID NOT NULL REFERENCES policies(id),
  amount       NUMERIC(10,2) NOT NULL,
  due_date     DATE NOT NULL,
  paid_date    DATE,
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','PAID','OVERDUE','WAIVED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: claims
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id       UUID NOT NULL REFERENCES policies(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  claim_number    VARCHAR(50) UNIQUE NOT NULL,
  claim_type      VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
                    CHECK (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID')),
  claim_amount    NUMERIC(12,2),
  incident_date   DATE,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: claim_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS claim_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  file_url    VARCHAR(500),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: campaign_events
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id),
  event_type   VARCHAR(50) NOT NULL,
  user_id      UUID REFERENCES users(id),
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GRANT PERMISSIONS TO insureflow_user
-- ============================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO insureflow_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO insureflow_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO insureflow_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO insureflow_user;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Products
INSERT INTO products (id, code, name, description) VALUES
  (uuid_generate_v4(), 'DD', 'Accidental Death & Dismemberment (AD&D)', 'Group AD&D coverage for enrolled customers')
ON CONFLICT (code) DO NOTHING;

-- Segments
INSERT INTO segments (id, name, description) VALUES
  (uuid_generate_v4(), 'Apex Trust Bank', 'Apex Trust Bank partner customers')
ON CONFLICT DO NOTHING;

-- Campaign (linked to product DD)
DO $$
DECLARE
  v_product_id UUID;
  v_segment_id UUID;
  v_campaign_id UUID;
BEGIN
  SELECT id INTO v_product_id FROM products WHERE code = 'DD' LIMIT 1;
  SELECT id INTO v_segment_id FROM segments WHERE name = 'Apex Trust Bank' LIMIT 1;

  -- Insert campaign only if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'Apex Trust Fall 2026') THEN
    INSERT INTO campaigns (id, name, product_id, segment_id, status, start_date, end_date)
    VALUES (uuid_generate_v4(), 'Apex Trust Fall 2026', v_product_id, v_segment_id, 'ACTIVE', '2026-01-01', '2027-12-31')
    RETURNING id INTO v_campaign_id;

    -- Campaign codes
    INSERT INTO campaign_codes (id, campaign_id, code, is_used)
    VALUES
      (uuid_generate_v4(), v_campaign_id, 'ADD-FALL-2026', false),
      (uuid_generate_v4(), v_campaign_id, 'APEX-SECURE-100', false),
      (uuid_generate_v4(), v_campaign_id, 'WELCOME-ADD-50', false);
  END IF;
END
$$;

-- Admin user (Aman - blocked from customer portal)
INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, role)
VALUES (
  'aman@insureflow.com',
  '$2a$12$placeholder_hash_aman',
  'Aman', 'Kumar',
  '1992-05-15',
  'ADMIN'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'Setup complete!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
