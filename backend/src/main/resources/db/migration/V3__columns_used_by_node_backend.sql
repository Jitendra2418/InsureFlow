-- V3__columns_used_by_node_backend.sql
-- Columns and tables that backend/server.js and services/billingService.js read or write
-- but that V1 never created. Reconstructed from the code, not from a live database dump.
-- Lines marked GUESS: the code shows the name and how it is used, not the exact type.
-- Additive only: nothing is dropped or altered.

-- users: customer registration (server.js:145)
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20) UNIQUE;        -- type taken from database/init.sql

-- clients: POST/PUT /api/admin/clients (server.js:465, 517)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_id     VARCHAR(50);  -- GUESS: same value as code ('CLI-123456' or user-supplied)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_type VARCHAR(50);  -- GUESS: defaults to 'Bank' in code
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status        VARCHAR(30);  -- GUESS: defaults to 'A-ACTIVE' in code
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address       TEXT;         -- GUESS: free text, '' when empty
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state         VARCHAR(50);  -- GUESS: '' when empty

-- campaigns: POST /api/admin/campaigns (server.js:686)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description TEXT;         -- GUESS: optional free text

-- campaign_events: POST /api/admin/events (server.js:826)
ALTER TABLE campaign_events ADD COLUMN IF NOT EXISTS media             VARCHAR(100);  -- GUESS: required string
ALTER TABLE campaign_events ADD COLUMN IF NOT EXISTS scheduled_drop    DATE;          -- same value as send_date (DATE)
ALTER TABLE campaign_events ADD COLUMN IF NOT EXISTS final_description TEXT;          -- GUESS: optional free text
ALTER TABLE campaign_events ADD COLUMN IF NOT EXISTS event_type        VARCHAR(50);   -- GUESS: required string

-- segments: POST /api/admin/segments (server.js:1012)
ALTER TABLE segments ADD COLUMN IF NOT EXISTS insurance_status VARCHAR(5);   -- code only allows 'I' or 'UI'
ALTER TABLE segments ADD COLUMN IF NOT EXISTS client_id        UUID REFERENCES clients(id) ON DELETE SET NULL;  -- GUESS: FK, joined to clients.id
ALTER TABLE segments ADD COLUMN IF NOT EXISTS state            VARCHAR(50);  -- copied from clients.state or 'ALL'
ALTER TABLE segments ADD COLUMN IF NOT EXISTS spoken_key       VARCHAR(255); -- GUESS: e.g. 'UI-APEXTRUSTBANK-TX'
ALTER TABLE segments ADD COLUMN IF NOT EXISTS target           INT DEFAULT 0; -- summed as int
ALTER TABLE segments ADD COLUMN IF NOT EXISTS created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- beneficiaries: enrollment and beneficiary edits (server.js:1632)
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS is_primary    BOOLEAN DEFAULT TRUE;  -- code treats anything but false as primary
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200);          -- GUESS: required only for minors

-- billing: server.js:1927 creates these at startup; copied here verbatim so the schema is complete
CREATE TABLE IF NOT EXISTS payment_retry_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    premium_record_id UUID NOT NULL REFERENCES premium_records(id) ON DELETE CASCADE,
    retry_number INT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    attempted_at TIMESTAMPTZ,
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS payment_attempt_count INT DEFAULT 0;
ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;
