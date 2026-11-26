-- V2__seed_initial_data.sql
-- Seed products, clients, campaigns and demo accounts

INSERT INTO products (name, code, description, status, premium_rate_per_thousand)
VALUES 
('Accidental Death & Dismemberment', 'DD', 'Comprehensive protection covering accidental death, loss of limbs, and severe injuries from unforeseen accidents.', 'FLAGSHIP', 0.60),
('Hospital Accident Plan', 'HP', 'Direct cash payout for hospital stays and emergency room treatments resulting from accidents.', 'COMING_SOON', 0.85),
('Recuperative Care', 'RC', 'Daily living allowance and recovery assistance following qualifying medical discharge.', 'COMING_SOON', 0.75)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone, role)
VALUES 
('jitendra@insureflow.com', '$2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW', 'Jitendra', 'Chowdary', '1998-05-15', '+1-555-0101', 'CUSTOMER'),
('aman@insureflow.com', '$2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW', 'Aman', 'Kumar', '1997-08-20', '+1-555-0102', 'ADMIN'),
('customer@example.com', '$2a$12$Nq9v7b1mP9s7GvHkXqH2Re98aYlE01m0rAwhs3iBshJkW9VrqDaqW', 'Sarah', 'Jenkins', '1988-03-22', '+1-555-0199', 'CUSTOMER')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clients (name, code, contact_email, is_active)
VALUES ('Apex Trust Bank', 'APEX-BANK', 'partnerships@apextrust.com', TRUE)
ON CONFLICT (code) DO NOTHING;
