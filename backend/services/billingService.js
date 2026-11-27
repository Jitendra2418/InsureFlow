/**
 * billingService.js
 * ─────────────────
 * Core billing logic:
 *   1. generateMonthlyPremiumRecords() — creates premium_records for all ACTIVE policies
 *   2. processPendingCharges()         — charges PENDING records via mock gateway
 *   3. scheduleFailedForRetry()        — queues FAILED records into payment_retry_queue
 */

const { Pool } = require('pg');
const { charge } = require('./mockPaymentGateway');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'insureflow',
  user: process.env.DB_USER || 'insureflow_user',
  password: process.env.DB_PASSWORD || 'your_db_password',
});

// Retry schedule: days after the original billing date
const RETRY_SCHEDULE_DAYS = [3, 7, 14];

/**
 * Step 1: Generate premium records for all ACTIVE policies for the given billing month.
 * Skips policies that already have a record for that month.
 * @param {Date} billingDate — first day of the billing month
 */
async function generateMonthlyPremiumRecords(billingDate = new Date()) {
  const billingMonth = new Date(billingDate.getFullYear(), billingDate.getMonth(), 1);
  const billingMonthStr = billingMonth.toISOString().split('T')[0]; // YYYY-MM-01
  const dueDate = new Date(billingMonth);
  dueDate.setDate(dueDate.getDate() + 7); // due 7 days after month start

  console.log(`\n📋 [Billing] Generating premium records for ${billingMonthStr}...`);

  const client = await pool.connect();
  try {
    // Fetch all ACTIVE policies with their monthly premium
    const activePolicies = await client.query(`
      SELECT p.id, p.policy_number, p.monthly_premium, p.user_id,
             u.email, u.first_name, u.last_name
      FROM policies p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'ACTIVE'
    `);

    console.log(`   Found ${activePolicies.rows.length} active policies.`);

    let created = 0;
    let skipped = 0;

    for (const policy of activePolicies.rows) {
      // Check if record already exists for this month
      const existing = await client.query(
        `SELECT id FROM premium_records
         WHERE policy_id = $1::uuid AND billing_month = $2::date`,
        [policy.id, billingMonthStr]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert new PENDING premium record
      await client.query(
        `INSERT INTO premium_records
           (policy_id, billing_month, amount, status, due_date, retry_count)
         VALUES ($1::uuid, $2::date, $3::numeric, 'PENDING', $4::timestamptz, 0)`,
        [policy.id, billingMonthStr, policy.monthly_premium, dueDate.toISOString()]
      );
      created++;
    }

    console.log(`   ✅ Created: ${created} records | Skipped (already exist): ${skipped}`);
    return { created, skipped };
  } finally {
    client.release();
  }
}

/**
 * Step 2: Process all PENDING premium records — attempt charge via mock gateway.
 */
async function processPendingCharges() {
  console.log('\n💳 [Billing] Processing pending charges...');
  const client = await pool.connect();
  try {
    const pending = await client.query(`
      SELECT pr.id, pr.policy_id, pr.amount, pr.billing_month,
             p.policy_number, u.email, u.first_name, u.last_name
      FROM premium_records pr
      JOIN policies p ON pr.policy_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE pr.status = 'PENDING'
    `);

    console.log(`   Found ${pending.rows.length} pending charges.`);

    let paid = 0;
    let failed = 0;

    for (const record of pending.rows) {
      const result = await charge({
        policyId: record.policy_id,
        amount: parseFloat(record.amount),
        customerEmail: record.email,
        policyNumber: record.policy_number,
      });

      if (result.success) {
        await client.query(
          `UPDATE premium_records
           SET status = 'PAID', paid_at = CURRENT_TIMESTAMP,
               retry_count = retry_count + 1
           WHERE id = $1::uuid`,
          [record.id]
        );
        console.log(`   ✅ PAID   — ${record.policy_number} (\$${record.amount})`);
        paid++;
      } else {
        await client.query(
          `UPDATE premium_records
           SET status = 'FAILED', retry_count = retry_count + 1
           WHERE id = $1::uuid`,
          [record.id]
        );
        console.log(`   ❌ FAILED — ${record.policy_number}: ${result.failureReason}`);

        // Schedule retry attempts
        await scheduleRetries(client, record.id, result.failureReason);
        failed++;
      }
    }

    console.log(`   Summary → PAID: ${paid} | FAILED: ${failed}`);
    return { paid, failed };
  } finally {
    client.release();
  }
}

/**
 * Schedule retry entries in payment_retry_queue for a failed premium record.
 */
async function scheduleRetries(client, premiumRecordId, initialFailureReason) {
  const now = new Date();
  for (let i = 0; i < RETRY_SCHEDULE_DAYS.length; i++) {
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + RETRY_SCHEDULE_DAYS[i]);
    await client.query(
      `INSERT INTO payment_retry_queue
         (premium_record_id, retry_number, scheduled_at, result)
       VALUES ($1::uuid, $2::int, $3::timestamptz, $4::text)`,
      [premiumRecordId, i + 1, scheduledAt.toISOString(), `Scheduled after: ${initialFailureReason}`]
    );
  }
  // Mark record as RETRY_SCHEDULED
  await client.query(
    `UPDATE premium_records SET status = 'RETRY_SCHEDULED' WHERE id = $1::uuid`,
    [premiumRecordId]
  );
}

/**
 * Step 3: Process due retries from payment_retry_queue.
 * Picks entries where scheduled_at <= NOW and not yet attempted.
 */
async function processDueRetries() {
  console.log('\n🔄 [Billing] Processing due retries...');
  const client = await pool.connect();
  try {
    const dueRetries = await client.query(`
      SELECT rq.id as queue_id, rq.premium_record_id, rq.retry_number,
             pr.policy_id, pr.amount, pr.billing_month,
             p.policy_number, u.email, u.first_name, u.last_name
      FROM payment_retry_queue rq
      JOIN premium_records pr ON rq.premium_record_id = pr.id
      JOIN policies p ON pr.policy_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE rq.scheduled_at <= NOW()
        AND rq.attempted_at IS NULL
        AND pr.status IN ('RETRY_SCHEDULED', 'FAILED')
      ORDER BY rq.scheduled_at ASC
    `);

    console.log(`   Found ${dueRetries.rows.length} due retries.`);

    let retryPaid = 0;
    let retryFailed = 0;

    for (const entry of dueRetries.rows) {
      const result = await charge({
        policyId: entry.policy_id,
        amount: parseFloat(entry.amount),
        customerEmail: entry.email,
        policyNumber: entry.policy_number,
      });

      const resultText = result.success
        ? `SUCCESS — TXN: ${result.transactionId}`
        : `FAILED — ${result.failureReason}`;

      // Mark this retry attempt as done
      await client.query(
        `UPDATE payment_retry_queue
         SET attempted_at = CURRENT_TIMESTAMP, result = $1::text
         WHERE id = $2::uuid`,
        [resultText, entry.queue_id]
      );

      if (result.success) {
        await client.query(
          `UPDATE premium_records
           SET status = 'PAID', paid_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid`,
          [entry.premium_record_id]
        );
        console.log(`   ✅ RETRY PAID   — ${entry.policy_number} (attempt #${entry.retry_number})`);
        retryPaid++;
      } else {
        // Check if this was the last retry
        const remaining = await client.query(
          `SELECT COUNT(*) FROM payment_retry_queue
           WHERE premium_record_id = $1::uuid AND attempted_at IS NULL`,
          [entry.premium_record_id]
        );
        const pendingRetries = parseInt(remaining.rows[0].count, 10);

        if (pendingRetries === 0) {
          // All retries exhausted — mark permanently FAILED
          await client.query(
            `UPDATE premium_records SET status = 'FAILED' WHERE id = $1::uuid`,
            [entry.premium_record_id]
          );
          console.log(`   🚫 EXHAUSTED    — ${entry.policy_number} (all ${RETRY_SCHEDULE_DAYS.length} retries done) — marking FAILED`);
          // In a real system: send email to customer here
          console.log(`   📧 [Mock Email] Would notify ${entry.email} — payment permanently failed for ${entry.policy_number}`);
        } else {
          console.log(`   ❌ RETRY FAILED — ${entry.policy_number} (attempt #${entry.retry_number}, ${pendingRetries} retries remaining)`);
        }
        retryFailed++;
      }
    }

    console.log(`   Summary → RETRY PAID: ${retryPaid} | RETRY FAILED: ${retryFailed}`);
    return { retryPaid, retryFailed };
  } finally {
    client.release();
  }
}

module.exports = {
  generateMonthlyPremiumRecords,
  processPendingCharges,
  processDueRetries,
};
