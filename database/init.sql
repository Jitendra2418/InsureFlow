-- InsureFlow Database Initialization Script
-- Matches InsureFlow System Architecture Section 5

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    phone VARCHAR(30),
    role VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER', -- 'CUSTOMER', 'ADMIN', 'OPERATIONS'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CLIENTS TABLE (Bank partners)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL, -- 'DD', 'HP', 'RC'
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'FLAGSHIP', 'ACTIVE', 'COMING_SOON'
    free_basic_enabled BOOLEAN DEFAULT FALSE,
    free_basic_min DECIMAL(12, 2) DEFAULT 0.00,
    free_basic_max DECIMAL(12, 2) DEFAULT 0.00,
    premium_rate_per_thousand DECIMAL(6, 2) DEFAULT 0.60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    campaign_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED', -- 'PLANNED', 'ACTIVE', 'COMPLETED'
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CAMPAIGN_EVENTS TABLE
CREATE TABLE IF NOT EXISTS campaign_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    channel VARCHAR(50) NOT NULL, -- 'DIRECT_MAIL', 'DIGITAL'
    send_date DATE,
    quantity INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SEGMENTS TABLE
CREATE TABLE IF NOT EXISTS segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES campaign_events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_count INT DEFAULT 0,
    description TEXT
);

-- 7. CAMPAIGN_CODES TABLE
CREATE TABLE IF NOT EXISTS campaign_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    code VARCHAR(100) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. POLICIES TABLE (Owned by Jitendra)
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    campaign_code_id UUID REFERENCES campaign_codes(id) ON DELETE SET NULL,
    policy_number VARCHAR(100) UNIQUE NOT NULL,
    cover_amount DECIMAL(12, 2) NOT NULL,
    monthly_premium DECIMAL(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CANCELLED', 'LAPSED'
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cancellation_date DATE,
    cancellation_reason VARCHAR(255),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    certificate_s3_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. BENEFICIARIES TABLE (Owned by Jitendra)
CREATE TABLE IF NOT EXISTS beneficiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. POLICY_AUDIT_LOGS TABLE (Owned by Jitendra)
CREATE TABLE IF NOT EXISTS policy_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'ADDRESS_UPDATED', 'BENEFICIARY_ADDED', 'CANCELLED'
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. PREMIUM_RECORDS TABLE (Owned by Aman)
CREATE TABLE IF NOT EXISTS premium_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    billing_month DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'FAILED', 'RETRYING'
    retry_count INT DEFAULT 0,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. CLAIMS TABLE (Owned by Aman)
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claim_number VARCHAR(100) UNIQUE NOT NULL,
    incident_type VARCHAR(100) NOT NULL,
    incident_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED', -- 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
    claimed_amount DECIMAL(12, 2) NOT NULL,
    approved_amount DECIMAL(12, 2),
    reviewer_notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. CLAIM_DOCUMENTS TABLE (Owned by Aman)
CREATE TABLE IF NOT EXISTS claim_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    s3_key VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    file_size BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA
-- Insert Products
INSERT INTO products (name, code, description, status, premium_rate_per_thousand)
VALUES 
('Accidental Death & Dismemberment', 'DD', 'Comprehensive protection covering accidental death, loss of limbs, and severe injuries from unforeseen accidents.', 'FLAGSHIP', 0.60),
('Hospital Accident Plan', 'HP', 'Direct cash payout for hospital stays and emergency room treatments resulting from accidents.', 'COMING_SOON', 0.85),
('Recuperative Care', 'RC', 'Daily living allowance and recovery assistance following qualifying medical discharge.', 'COMING_SOON', 0.75)
ON CONFLICT (code) DO NOTHING;

-- Insert Default Demo Users (BCrypt hashed 'Password123!')
-- BCrypt: $2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW
INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone, role)
VALUES 
('jitendra@insureflow.com', '$2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW', 'Jitendra', 'Chowdary', '1998-05-15', '+1-555-0101', 'CUSTOMER'),
('aman@insureflow.com', '$2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW', 'Aman', 'Kumar', '1997-08-20', '+1-555-0102', 'ADMIN'),
('customer@example.com', '$2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW', 'Sarah', 'Jenkins', '1988-03-22', '+1-555-0199', 'CUSTOMER')
ON CONFLICT (email) DO NOTHING;

-- Insert Partner Bank Client
INSERT INTO clients (name, code, contact_email, is_active)
VALUES ('Apex Trust Bank', 'APEX-BANK', 'partnerships@apextrust.com', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Insert Active Campaign
DO $$
DECLARE
    bank_id UUID;
    prod_id UUID;
    camp_id UUID;
BEGIN
    SELECT id INTO bank_id FROM clients WHERE code = 'APEX-BANK' LIMIT 1;
    SELECT id INTO prod_id FROM products WHERE code = 'DD' LIMIT 1;
    
    IF bank_id IS NOT NULL AND prod_id IS NOT NULL THEN
        INSERT INTO campaigns (client_id, product_id, campaign_id, name, status, start_date, end_date)
        VALUES (bank_id, prod_id, 'CMP-2026-APEX-ADD', 'Apex Fall 2026 AD&D Campaign', 'ACTIVE', '2026-09-01', '2026-12-31')
        ON CONFLICT (campaign_id) DO NOTHING;

        SELECT id INTO camp_id FROM campaigns WHERE campaign_id = 'CMP-2026-APEX-ADD' LIMIT 1;

        -- Insert Promo Campaign Codes
        INSERT INTO campaign_codes (campaign_id, code, is_used)
        VALUES 
        (camp_id, 'ADD-FALL-2026', FALSE),
        (camp_id, 'APEX-SECURE-100', FALSE),
        (camp_id, 'WELCOME-ADD-50', FALSE)
        ON CONFLICT (code) DO NOTHING;
    END IF;
END $$;
