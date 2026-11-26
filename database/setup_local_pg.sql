-- ============================================================
-- InsureFlow Local PostgreSQL Setup Script
-- Run as: psql -U postgres -f setup_local_pg.sql
-- ============================================================

-- 1. Create user if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'insureflow_user') THEN
    CREATE USER insureflow_user WITH PASSWORD 'InsureFlow2026!';
  END IF;
END
$$;

-- 2. Create database if not exists
SELECT 'CREATE DATABASE insureflow OWNER insureflow_user ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'insureflow')\gexec

-- 3. Grant privileges
GRANT ALL PRIVILEGES ON DATABASE insureflow TO insureflow_user;
