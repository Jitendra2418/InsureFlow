/**
 * billing-worker.js
 * ─────────────────
 * Standalone cron process — run separately from server.js:
 *   node billing-worker.js
 *
 * Cron schedule:
 *   - Monthly billing: 1st of every month at 00:05 AM
 *   - Retry check:     Daily at 06:00 AM (picks up due retries from payment_retry_queue)
 *
 * To test immediately without waiting for cron, set env:
 *   RUN_BILLING_NOW=true node billing-worker.js
 */

require('dotenv').config();
const cron = require('node-cron');
const { Pool } = require('pg');
const {
  generateMonthlyPremiumRecords,
  processPendingCharges,
  processDueRetries,
} = require('./services/billingService');

// Ensure payment_retry_queue table exists
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'insureflow',
  user: process.env.DB_USER || 'insureflow_user',
  password: process.env.DB_PASSWORD || 'your_db_password',
});

async function ensureRetryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_retry_queue (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      premium_record_id UUID NOT NULL REFERENCES premium_records(id) ON DELETE CASCADE,
      retry_number INT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      attempted_at TIMESTAMPTZ,
      result TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Also add payment_attempt_count and last_attempted_at columns if missing
  await pool.query(`
    ALTER TABLE premium_records
    ADD COLUMN IF NOT EXISTS payment_attempt_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ
  `).catch(() => {}); // ignore if already exists
  console.log('✅ [Billing Worker] DB tables verified.');
}

/**
 * Full monthly billing run:
 * 1. Generate records → 2. Charge → 3. Queue failures
 */
async function runMonthlyBilling() {
  console.log('\n════════════════════════════════════════════');
  console.log(`🏦 [Billing Worker] Monthly billing run started — ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════');
  try {
    await generateMonthlyPremiumRecords(new Date());
    await processPendingCharges();
    console.log('\n✅ [Billing Worker] Monthly billing run complete.');
  } catch (err) {
    console.error('❌ [Billing Worker] Monthly billing error:', err.message);
  }
}

/**
 * Daily retry run — processes due entries in payment_retry_queue.
 */
async function runRetryJob() {
  console.log('\n════════════════════════════════════════════');
  console.log(`🔄 [Billing Worker] Retry job started — ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════');
  try {
    await processDueRetries();
    console.log('\n✅ [Billing Worker] Retry job complete.');
  } catch (err) {
    console.error('❌ [Billing Worker] Retry job error:', err.message);
  }
}

async function main() {
  await ensureRetryTable();

  // ── Immediate test mode ──────────────────────────────────────────────────
  if (process.env.RUN_BILLING_NOW === 'true') {
    console.log('⚡ RUN_BILLING_NOW=true — running billing job immediately for testing...');
    await runMonthlyBilling();
    await runRetryJob();
    console.log('\n🎉 Immediate billing run complete. Keeping worker alive for cron...');
  }

  // ── Cron: Monthly billing — 1st of every month at 00:05 ─────────────────
  cron.schedule('5 0 1 * *', async () => {
    await runMonthlyBilling();
  }, { timezone: 'America/New_York' });

  // ── Cron: Daily retry check — every day at 06:00 ─────────────────────────
  cron.schedule('0 6 * * *', async () => {
    await runRetryJob();
  }, { timezone: 'America/New_York' });

  console.log('\n🚀 [Billing Worker] Running. Schedules:');
  console.log('   📅 Monthly billing : 1st of every month at 00:05 AM ET');
  console.log('   🔄 Retry check     : Every day at 06:00 AM ET');
  console.log('   💡 To test now     : RUN_BILLING_NOW=true node billing-worker.js\n');
}

main().catch(err => {
  console.error('Fatal error starting billing worker:', err);
  process.exit(1);
});
